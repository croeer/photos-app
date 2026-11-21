import { useState } from "react";
import { savePhotoTags } from "./photoTags";

export default function PhotoTagEditor({ photo, editor, onSaved }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const tags = photo.tags || [];

  async function save(event) {
    event.preventDefault();
    const edited = [...new Set(draft.split(",").map(tag => tag.trim()).filter(Boolean))];
    if (edited.length > 20 || edited.some(tag => Array.from(tag).length > 40)) {
      setMessage("Bis zu 20 Tags mit jeweils höchstens 40 Zeichen eingeben.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await savePhotoTags(editor, photo, edited);
      if (result.signedOut) return;
      onSaved(result.tags);
      if (result.conflict) {
        setDraft(result.tags.join(", "));
        setMessage("Die Tags wurden inzwischen geändert. Die aktuellen Tags stehen jetzt im Feld.");
        return;
      }
      setOpen(false);
      setMessage("Gespeichert.");
    } catch {
      setMessage("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-3">
      {open ? (
        <form onSubmit={save}>
          <label className="block text-sm">Tags (mit Komma trennen)
            <input value={draft} onChange={event => setDraft(event.target.value)} disabled={busy}
              autoFocus className="mt-1 w-full rounded border border-gray-400 p-2" />
          </label>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <button disabled={busy} className="font-medium text-cadbury underline">Speichern</button>
            <button disabled={busy} type="button" onClick={() => { setOpen(false); setMessage(""); }}>Abbrechen</button>
          </div>
        </form>
      ) : (
        <>
          {tags.length > 0 && <p className="mb-1 break-words text-sm">{tags.join(" · ")}</p>}
          <button className="text-sm font-medium text-cadbury underline" onClick={() => {
            setDraft(tags.join(", ")); setMessage(""); setOpen(true);
          }}>Tags bearbeiten</button>
        </>
      )}
      {message && <p role="status" className="mt-1 text-sm">{message}</p>}
    </div>
  );
}
