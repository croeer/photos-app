import { useEffect, useRef, useState } from "react";
import { suggestPhotoTags } from "./clipSuggestions";
import { parseTagDraft, savePhotoTags } from "./photoTags";

const primary = "rounded-lg bg-cadbury px-3 py-2 text-sm font-medium text-white disabled:opacity-50";

function sameTags(a, b) {
  return a.length === b.length && a.every(tag => b.includes(tag));
}

// Apply only the edits staff made against the version they originally saw.
function mergeEdits(previous, edited, latest) {
  return [
    ...latest.filter(tag => !previous.includes(tag) || edited.includes(tag)),
    ...edited.filter(tag => !previous.includes(tag) && !latest.includes(tag)),
  ];
}

export default function ClipTagDialog({ photos, editor, onSaved, onClose }) {
  const dialog = useRef(null);
  const pendingSave = useRef(null);
  const [batch, setBatch] = useState(photos);
  const [rows, setRows] = useState(() => photos.map(photo => ({
    photo, suggestions: [], draft: (photo.tags || []).join(", "), analyzed: false, notice: "",
  })));
  const [phase, setPhase] = useState("loading");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => {
      pendingSave.current?.abort();
      node.close();
    };
  }, []);

  function update(id, change) {
    setRows(current => current.map(row => row.photo.id === id ? change(row) : row));
  }

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setPhase("loading");
    setMessage("");
    suggestPhotoTags(batch, signal, () => {
      if (!signal.aborted) setPhase("analyzing");
    }, (id, tags, error) => {
      if (signal.aborted) return;
      update(id, row => {
        const suggestions = tags.filter(tag => !row.photo.tags?.includes(tag));
        const current = row.photo.tags || [];
        const draft = suggestions.length && sameTags(parseTagDraft(row.draft), current)
          ? [...current, ...suggestions].join(", ") : row.draft;
        return { ...row, analyzed: !error, notice: error, suggestions, draft };
      });
    }).catch(() => {
      if (!signal.aborted) setMessage("CLIP konnte nicht ausgeführt werden. Bitte Verbindung und verfügbaren Gerätespeicher prüfen.");
    }).finally(() => {
      if (!signal.aborted) setPhase("review");
    });
    return () => controller.abort();
  }, [batch]);

  const review = phase === "review";
  const finished = rows.filter(row => row.analyzed || row.notice).length;
  const incomplete = rows.filter(row => !row.analyzed);
  const reviewedRows = rows.map(row => {
    const tags = parseTagDraft(row.draft);
    let error = "";
    if (tags.length > 20) error = "Bitte höchstens 20 Tags pro Foto eingeben.";
    else if (tags.some(tag => Array.from(tag).length > 40 || /\p{C}/u.test(tag))) {
      error = "Ein Tag darf höchstens 40 druckbare Zeichen enthalten.";
    }
    return { ...row, tags, error };
  });
  const changes = reviewedRows.filter(row => !sameTags(row.tags, row.photo.tags || []));
  const invalid = changes.some(row => row.error);

  function editDraft(id, draft) {
    update(id, row => ({ ...row, draft, notice: row.analyzed ? "" : row.notice }));
    setMessage("");
  }

  async function save() {
    if (pendingSave.current || !review || invalid || !changes.length) return;
    const controller = new AbortController();
    pendingSave.current = controller;
    setSaving(true);
    let saved = 0;
    try {
      for (const [i, { photo, tags }] of changes.entries()) {
        if (controller.signal.aborted) return;
        setMessage(`Speichert Foto ${i + 1} von ${changes.length} …`);
        try {
          const result = await savePhotoTags(editor, photo, tags, controller.signal);
          if (controller.signal.aborted || result.signedOut) return;
          onSaved(photo.id, result.tags);
          if (!result.conflict) saved++;
          update(photo.id, row => ({
            ...row, photo: { ...photo, tags: result.tags },
            suggestions: row.suggestions.filter(tag => !result.tags.includes(tag)),
            draft: (result.conflict ? mergeEdits(photo.tags || [], tags, result.tags) : result.tags).join(", "),
            notice: result.conflict ? "Tags wurden zwischenzeitlich geändert. Bitte erneut prüfen." : "Gespeichert.",
          }));
        } catch {
          if (controller.signal.aborted) return;
          update(photo.id, row => ({ ...row, notice: "Speichern fehlgeschlagen. Bitte erneut versuchen." }));
        }
      }
      setMessage(`${saved} von ${changes.length} gespeichert.`);
    } finally {
      pendingSave.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="clip-title" className="max-h-[90vh] w-11/12 max-w-xl overflow-y-auto rounded-xl p-0 text-gray-800 shadow-xl backdrop:bg-black/50"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
      <div className="sticky top-0 z-10 border-b bg-white p-4">
        <h3 id="clip-title" className="text-xl font-medium">Tag-Vorschläge für {photos.length === 1 ? "1 Foto" : photos.length + " Fotos"}</h3>
        <p role="status" className="mt-1 text-sm">{phase === "loading"
          ? "CLIP lädt auf diesem Gerät. Beim ersten Mal werden rund 170 MB heruntergeladen."
          : phase === "analyzing" ? `${finished} von ${photos.length} Fotos bearbeitet …`
          : message || (incomplete.length ? `${incomplete.length} von ${photos.length} Fotos konnten nicht analysiert werden.` : "Vorschläge prüfen und Tags bei Bedarf bearbeiten.")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {review && <button className={primary} disabled={saving || !changes.length || invalid} onClick={save}>Auswahl speichern</button>}
          {review && incomplete.length > 0 && <button disabled={saving} className="text-sm underline"
            onClick={() => {
              setRows(current => current.map(row => row.analyzed ? row : { ...row, notice: "" }));
              setBatch(incomplete.map(row => row.photo));
            }}>Analyse wiederholen</button>}
          <button disabled={saving} className="text-sm underline" onClick={onClose}>{review ? "Schließen" : "Abbrechen"}</button>
        </div>
      </div>
      <ul className="divide-y px-4">
        {reviewedRows.map(({ photo, suggestions, draft, tags, analyzed, notice, error }, i) => (
          <li key={photo.id} className="flex items-start gap-3 py-3">
            <img src={photo.thumbnail} loading="lazy" alt="" className="h-16 w-16 rounded object-cover" />
            <fieldset disabled={!review || saving} className="min-w-0 flex-1 text-sm">
              <legend className="font-medium">Foto {i + 1}</legend>
              {photo.tags?.length > 0 && <p className="break-words text-gray-600">Vorhanden: {photo.tags.join(", ")}</p>}
              {suggestions.length > 0 && <div className="mt-1 flex flex-wrap gap-2">
                {suggestions.map(tag => <label key={tag} className="flex items-center gap-1 rounded-full border px-2 py-1">
                  <input type="checkbox" checked={tags.includes(tag)} onChange={event => {
                    editDraft(photo.id, (event.target.checked ? [...tags, tag] : tags.filter(t => t !== tag)).join(", "));
                  }} />{tag}
                </label>)}
              </div>}
              {review && <label className="mt-2 block">Tags (mit Komma trennen)
                <input value={draft} onChange={event => editDraft(photo.id, event.target.value)}
                  aria-invalid={!!error} aria-describedby={error ? `clip-tag-error-${i}` : undefined}
                  className="mt-1 w-full rounded border border-gray-400 p-2 text-base" />
              </label>}
              {error && <p id={`clip-tag-error-${i}`} className="text-red-700">{error}</p>}
              {notice ? <p>{notice}</p> : analyzed && !suggestions.length && <p>Keine neuen Vorschläge.</p>}
            </fieldset>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
