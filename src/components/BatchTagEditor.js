import { useEffect, useRef, useState } from "react";
import ClipTagDialog from "./ClipTagDialog";
import { parseTagDraft, savePhotoTags } from "./photoTags";

const control = "rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50";
const primary = "rounded-lg bg-cadbury px-3 py-2 text-sm font-medium text-white disabled:opacity-50";
const photoCount = count => `${count} ${count === 1 ? "Foto" : "Fotos"}`;

export default function BatchTagEditor({ photos, selection, setSelection, editor, onSaved }) {
  const [open, setOpen] = useState(false);
  const [clipPhotos, setClipPhotos] = useState(null);
  const [message, setMessage] = useState("");
  const selected = photos.filter(photo => selection?.has(photo.id));

  if (selection === null) {
    return <button className={control + " mb-3"} onClick={() => {
      setSelection(new Set());
      setMessage("");
    }}>Fotos auswählen</button>;
  }

  return (
    <>
      <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3 shadow-sm">
        <strong className="mr-auto text-sm">{selected.length} ausgewählt</strong>
        <button className={primary} disabled={!selected.length} onClick={() => {
          setOpen(true);
          setMessage("");
        }}>Tags bearbeiten</button>
        <button className={control} disabled={!selected.length} onClick={() => {
          setClipPhotos(selected);
          setMessage("");
        }}>Tags vorschlagen</button>
        <button className={control} disabled={selected.length === photos.length} onClick={() => {
          setSelection(new Set(photos.map(photo => photo.id)));
          setMessage("");
        }}>Geladene Fotos auswählen</button>
        <button className={control} disabled={!selected.length} onClick={() => {
          setSelection(new Set());
          setMessage("");
        }}>Auswahl aufheben</button>
        <button className="px-2 py-1 text-sm underline" onClick={() => setSelection(null)}>Beenden</button>
        {message && <p role="status" className="w-full text-sm">{message}</p>}
      </div>
      {clipPhotos && <ClipTagDialog photos={clipPhotos} editor={editor} onSaved={onSaved}
        onClose={() => setClipPhotos(null)} />}
      {open && <BatchDialog photos={selected} editor={editor} onSaved={onSaved}
        onClose={() => setOpen(false)}
        onPartial={ids => setSelection(new Set(ids))}
        onComplete={count => {
          setOpen(false);
          setMessage(`Tags für ${photoCount(count)} gespeichert.`);
        }} />}
    </>
  );
}

function BatchDialog({ photos, editor, onSaved, onClose, onPartial, onComplete }) {
  const dialog = useRef(null);
  const pending = useRef(null);
  const [mode, setMode] = useState("add");
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(null);
  const adding = mode === "add";
  const busy = progress !== null;

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => {
      pending.current?.abort();
      node.close();
    };
  }, []);

  const tags = parseTagDraft(draft);
  const counts = new Map();
  const changes = [];
  for (const photo of photos) {
    const current = photo.tags || [];
    for (const tag of current) counts.set(tag, (counts.get(tag) || 0) + 1);
    const updated = adding
      ? [...new Set([...current, ...tags])]
      : current.filter(tag => !tags.includes(tag));
    if (updated.length !== current.length) changes.push({ photo, updated });
  }
  const tooMany = changes.filter(change => change.updated.length > 20).length;
  const invalid = tags.some(tag => Array.from(tag).length > 40 || /\p{Cc}/u.test(tag));
  let action = adding ? "Tags hinzufügen" : "Tags entfernen";
  if (tags.length) {
    const label = tags.length === 1 ? `„${tags[0]}“` : `${tags.length} Tags`;
    action = adding ? `${label} zu ${photoCount(changes.length)} hinzufügen` : `${label} von ${photoCount(changes.length)} entfernen`;
  }

  function switchMode(value) {
    if (mode === value) return;
    setMode(value);
    setDraft("");
    setMessage("");
  }

  async function save(event) {
    event.preventDefault();
    if (pending.current || !changes.length || invalid || tooMany) return;
    const controller = new AbortController();
    pending.current = controller;
    const remaining = [];
    let conflicts = 0;
    let completed = 0;
    setProgress({ completed, total: changes.length });
    setMessage("");
    try {
      for (const { photo, updated } of changes) {
        if (controller.signal.aborted) return;
        try {
          const result = await savePhotoTags(editor, photo, updated, controller.signal);
          if (result.signedOut || controller.signal.aborted) return;
          onSaved(photo.id, result.tags);
          if (result.conflict) {
            remaining.push(photo.id);
            conflicts++;
          }
        } catch {
          if (controller.signal.aborted) return;
          remaining.push(photo.id);
        }
        completed++;
        setProgress({ completed, total: changes.length });
      }
      if (!remaining.length) {
        onComplete(completed);
      } else {
        onPartial(remaining);
        setMessage(`${completed - remaining.length} von ${completed} gespeichert. ${photoCount(remaining.length)} weiter ausgewählt.`
          + (conflicts ? " Zwischenzeitlich bearbeitete Tags wurden neu geladen." : "")
          + " Bitte prüfen und erneut speichern.");
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setProgress(null);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="batch-tag-title" onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }} className="max-h-[85vh] w-11/12 max-w-md overflow-y-auto rounded-xl p-5 text-gray-800 shadow-xl backdrop:bg-black/50">
      <form onSubmit={save}>
        <h3 id="batch-tag-title" className="text-xl font-medium">Tags für {photoCount(photos.length)} bearbeiten</h3>
        <fieldset disabled={busy} className="mt-4">
          <legend className="sr-only">Aktion</legend>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={adding} className={adding ? primary : control} onClick={() => switchMode("add")}>Hinzufügen</button>
            <button type="button" aria-pressed={!adding} className={adding ? control : primary} onClick={() => switchMode("remove")}>Entfernen</button>
          </div>
          <label className="mt-4 block text-sm">Tags (mit Komma trennen)
            <input value={draft} onChange={e => setDraft(e.target.value)} className="mt-1 w-full rounded border border-gray-400 p-2" />
          </label>
          {counts.size > 0 && <>
            <p className="mb-2 mt-4 text-sm">Vorhandene Tags in der Auswahl</p>
            <div className="flex flex-wrap gap-2">
              {[...counts.keys()].sort((a, b) => a.localeCompare(b, "de")).map(tag => (
                <button type="button" key={tag} aria-pressed={tags.includes(tag)}
                  className={`rounded-full border px-3 py-1 text-sm ${tags.includes(tag) ? "border-cadbury text-cadbury" : "border-gray-300"}`}
                  onClick={() => setDraft((tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag]).join(", "))}>
                  {tag} · {counts.get(tag)} von {photos.length}
                </button>
              ))}
            </div>
          </>}
        </fieldset>
        {invalid && <p role="alert" className="mt-3 text-sm">Tags dürfen höchstens 40 druckbare Zeichen enthalten.</p>}
        {tooMany > 0 && <p role="alert" className="mt-3 text-sm">Bei {photoCount(tooMany)} würde die Grenze von 20 Tags überschritten.</p>}
        {!busy && tags.length > 0 && !changes.length && <p className="mt-3 text-sm">Für diese Auswahl ist keine Änderung nötig.</p>}
        {message && <p role="alert" className="mt-3 text-sm">{message}</p>}
        {busy && <p role="status" className="mt-3 text-sm">{progress.completed} von {progress.total} bearbeitet …</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className={primary} disabled={busy || !changes.length || invalid || !!tooMany}>{busy ? "Speichert …" : action}</button>
          <button type="button" className="text-sm underline" disabled={busy} onClick={onClose}>Schließen</button>
        </div>
      </form>
    </dialog>
  );
}
