import { useEffect, useState } from "react";

export default function TagFilter({ url, selected, onChange }) {
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const counts = new Map();
      let next = url;
      while (next) {
        const response = await fetch(next, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const page = await response.json();
        for (const [tag, count] of Object.entries(page.tags)) {
          counts.set(tag, (counts.get(tag) || 0) + count);
        }
        next = page._links?.next?.href;
      }
      if (!controller.signal.aborted) {
        setCatalog([...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b, "de")));
      }
    }
    setFailed(false);
    load().catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [url, attempt]);

  if (failed) return (
    <button className="m-4 underline" onClick={() => setAttempt(attempt + 1)}>Tags erneut laden</button>
  );
  if (!catalog.length) return null;

  const term = search.trim().toLocaleLowerCase("de");
  const matches = catalog.filter(tag => !selected.includes(tag) && tag.includes(term));
  const visible = expanded || term ? matches : matches.slice(0, 12);
  function toggle(tag) {
    onChange(selected.includes(tag) ? selected.filter(value => value !== tag) : [...selected, tag].sort());
    setSearch("");
  }

  return (
    <section className="mx-auto mb-5 max-w-4xl px-4" aria-label="Galerie filtern">
      <label className="block font-medium" htmlFor="tag-search">Nach Tags filtern</label>
      <input id="tag-search" type="search" value={search} placeholder="Tag suchen"
        className="mt-2 w-full rounded border border-gray-300 px-3 py-2 sm:max-w-sm"
        onChange={event => setSearch(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && term) {
            const tag = matches.find(value => value === term) || (matches.length === 1 && matches[0]);
            if (tag) toggle(tag);
          }
        }} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[...selected, ...visible].map(tag => {
          const active = selected.includes(tag);
          return (
            <button key={tag} aria-pressed={active} disabled={!active && selected.length >= 20} onClick={() => toggle(tag)}
              className={`rounded-full border px-3 py-1 text-sm ${active ? "border-cadbury bg-cadbury text-white" : "border-gray-300 bg-white text-gray-800 hover:border-cadbury"}`}>
              {tag}{active && <span aria-hidden="true"> ×</span>}
            </button>
          );
        })}
        {!term && matches.length > 12 && (
          <button className="text-sm underline" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Weniger Tags" : "Alle Tags anzeigen"}
          </button>
        )}
        {!!selected.length && <button className="text-sm underline" onClick={() => { onChange([]); setSearch(""); }}>Filter löschen</button>}
      </div>
      {term && !matches.length && <p className="mt-2 text-sm">Kein weiterer passender Tag.</p>}
    </section>
  );
}
