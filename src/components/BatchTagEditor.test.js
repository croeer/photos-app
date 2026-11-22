import { act, fireEvent, render, screen, within } from "@testing-library/react";
import PhotoGallery from "./PhotoGallery";

import { suggestPhotoTags } from "./clipSuggestions";

jest.mock("./clipSuggestions");

const makePhoto = (id, tags = []) => ({ id, tags, thumbnail: "/" + id });
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
const button = name => screen.getByRole("button", { name });
const field = () => screen.getByLabelText("Tags (mit Komma trennen)");
let scroll;
const editor = { url: "/save", token: "access-token", onAuthorizationError: jest.fn() };

beforeAll(() => {
  // jsdom doesn't implement the native dialog API.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
beforeEach(() => {
  jest.clearAllMocks();
  global.IntersectionObserver = class {
    constructor(callback) { scroll = () => callback([{ isIntersecting: true }]); }
    observe() {}
    disconnect() {}
  };
});
afterEach(() => { delete global.IntersectionObserver; });

function setup(photos, save, later = []) {
  const writes = [];
  global.fetch = jest.fn(async (url, options) => {
    if (url === "/list") return response({ photos, _links: later.length ? { next: { href: "/more" } } : {} });
    if (url === "/more") return response({ photos: later });
    expect(options.headers.Authorization).toBe("Bearer access-token");
    const body = JSON.parse(options.body);
    writes.push(body);
    return save ? save(body, writes.length) : response({ tags: body.tags });
  });
  render(<PhotoGallery initialUrl="/list" editor={editor} />);
  return writes;
}
async function selectLoaded() {
  await screen.findAllByRole("button", { name: "Tags bearbeiten" });
  fireEvent.click(button("Fotos auswählen"));
  fireEvent.click(button("Geladene Fotos auswählen"));
}

test("selecting loaded photos snapshots the current pages, supports scrolling, and adds only missing tags", async () => {
  const writes = setup([makePhoto("a", ["blau"]), makePhoto("b", ["tasse"])], null, [makePhoto("c")]);
  await selectLoaded();
  await act(async () => scroll());
  expect(screen.getByLabelText("Foto 3 auswählen")).not.toBeChecked();
  expect(screen.getByLabelText("Foto 1 auswählen")).toBeChecked();
  fireEvent.click(screen.getByLabelText("Foto 3 auswählen"));
  fireEvent.click(button("Tags bearbeiten"));
  expect(button("blau · 1 von 3")).toBeInTheDocument();
  fireEvent.change(field(), { target: { value: "Blau, BLAU" } });
  fireEvent.click(button("„blau“ zu 2 Fotos hinzufügen"));
  await screen.findByText("Tags für 2 Fotos gespeichert.");
  expect(writes).toEqual([
    { id: "b", previousTags: ["tasse"], tags: ["tasse", "blau"] },
    { id: "c", previousTags: [], tags: ["blau"] },
  ]);
  expect(screen.getByText("3 ausgewählt")).toBeInTheDocument();

  fireEvent.click(button("Tags bearbeiten"));
  fireEvent.click(button("Entfernen"));
  fireEvent.click(button("blau · 3 von 3"));
  fireEvent.click(button("„blau“ von 3 Fotos entfernen"));
  await screen.findByText("Tags für 3 Fotos gespeichert.");
  expect(writes.slice(2).map(({ tags }) => tags)).toEqual([[], ["tasse"], []]);
  fireEvent.click(button("Auswahl aufheben"));
  expect(button("Tags bearbeiten")).toBeDisabled();
});

test("partial failures keep only the affected photos selected, retry uses the current tags", async () => {
  const writes = setup([makePhoto("a"), makePhoto("b"), makePhoto("c")], (body, count) => {
    if (count === 2) return response({ tags: ["neu"] }, 409);
    if (count === 3) throw new Error("offline");
    return response({ tags: body.tags });
  });
  await selectLoaded();
  fireEvent.click(button("Tags bearbeiten"));
  fireEvent.change(field(), { target: { value: "rot" } });
  fireEvent.click(button("„rot“ zu 3 Fotos hinzufügen"));
  expect(await screen.findByRole("alert")).toHaveTextContent("1 von 3 gespeichert");
  expect(screen.getByText("2 ausgewählt")).toBeInTheDocument();
  expect(button("neu · 1 von 2")).toBeInTheDocument();
  fireEvent.click(button("„rot“ zu 2 Fotos hinzufügen"));
  await screen.findByText("Tags für 2 Fotos gespeichert.");
  expect(writes.slice(3)).toEqual([
    { id: "b", previousTags: ["neu"], tags: ["neu", "rot"] },
    { id: "c", previousTags: [], tags: ["rot"] },
  ]);
});

test("can cancel and validates the twenty-tag limit before any writes", async () => {
  const writes = setup([makePhoto("full", Array.from({ length: 20 }, (_, i) => "tag" + i)), makePhoto("old")]);
  await selectLoaded();
  fireEvent.click(button("Tags bearbeiten"));
  fireEvent.change(field(), { target: { value: "extra" } });
  expect(screen.getByRole("alert")).toHaveTextContent("Bei 1 Foto");
  expect(within(screen.getByRole("dialog")).getByRole("button", { name: /zu 2 Fotos/ })).toBeDisabled();
  fireEvent.click(button("Schließen"));
  expect(writes).toHaveLength(0);
  expect(screen.getByText("2 ausgewählt")).toBeInTheDocument();
});

test("a rejected staff token stops the remaining writes", async () => {
  const writes = setup([makePhoto("a"), makePhoto("b")], () => response({}, 401));
  await selectLoaded();
  fireEvent.click(button("Tags bearbeiten"));
  fireEvent.change(field(), { target: { value: "rot" } });
  await act(async () => fireEvent.click(button("„rot“ zu 2 Fotos hinzufügen")));
  expect(editor.onAuthorizationError).toHaveBeenCalledTimes(1);
  expect(writes).toHaveLength(1);
});

test("CLIP analyzes only the marked photos and saves only reviewed additions", async () => {
  const writes = setup([makePhoto("a", ["blau"]), makePhoto("b")], null, [makePhoto("c")]);
  suggestPhotoTags.mockImplementation(async (photos, signal, ready, result) => {
    ready();
    photos.forEach(photo => result(photo.id, ["blau", "vase"], ""));
  });
  await screen.findAllByRole("button", { name: "Tags bearbeiten" });
  fireEvent.click(button("Fotos auswählen"));
  expect(button("Tags vorschlagen")).toBeDisabled();
  fireEvent.click(screen.getByLabelText("Foto 1 auswählen"));
  await act(async () => scroll());
  fireEvent.click(screen.getByLabelText("Foto 3 auswählen"));
  expect(suggestPhotoTags).not.toHaveBeenCalled();
  fireEvent.click(button("Tags vorschlagen"));
  await screen.findByText("Vorschläge prüfen und Tags bei Bedarf bearbeiten.");
  expect(suggestPhotoTags.mock.calls[0][0].map(p => p.id)).toEqual(["a", "c"]);
  expect(writes).toHaveLength(0);
  const last = within(screen.getByRole("group", { name: "Foto 2" }));
  fireEvent.click(last.getByLabelText("vase"));
  fireEvent.click(button("Auswahl speichern"));
  await screen.findByText("2 von 2 gespeichert.");
  expect(writes).toEqual([
    { id: "a", previousTags: ["blau"], tags: ["blau", "vase"] },
    { id: "c", previousTags: [], tags: ["blau"] },
  ]);
  expect(button("Auswahl speichern")).toBeDisabled();
});

test("CLIP can be cancelled during loading without writes", async () => {
  suggestPhotoTags.mockImplementation(() => new Promise(() => {}));
  const writes = setup([makePhoto("a")]);
  await selectLoaded();
  fireEvent.click(button("Tags vorschlagen"));
  const signal = suggestPhotoTags.mock.calls[0][1];
  fireEvent.click(button("Abbrechen"));
  expect(signal.aborted).toBe(true);
  expect(writes).toHaveLength(0);
});

test("CLIP retries failed thumbnails and safely merges concurrent edits after review", async () => {
  const writes = setup([makePhoto("a"), makePhoto("b")], (body, n) =>
    n === 1 ? response({ tags: ["handarbeit"] }, 409) : response({ tags: body.tags }));
  suggestPhotoTags.mockImplementationOnce(async (_, signal, ready, result) => {
    ready(); result("a", ["tasse"], ""); result("b", [], "Analyse fehlgeschlagen.");
  }).mockImplementationOnce(async (_, signal, ready, result) => {
    ready(); result("b", ["grün"], "");
  });
  await selectLoaded();
  fireEvent.click(button("Tags vorschlagen"));
  fireEvent.click(await screen.findByRole("button", { name: "Analyse wiederholen" }));
  await screen.findByRole("button", { name: "Auswahl speichern" });
  expect(suggestPhotoTags.mock.calls[1][0].map(p => p.id)).toEqual(["b"]);
  fireEvent.click(button("Auswahl speichern"));
  await screen.findByText("1 von 2 gespeichert.");
  fireEvent.click(button("Auswahl speichern"));
  await screen.findByText("1 von 1 gespeichert.");
  expect(writes.map(w => w.id)).toEqual(["a", "b", "a"]);
  expect(writes[2]).toEqual({ id: "a", tags: ["handarbeit", "tasse"], previousTags: ["handarbeit"] });
});

test("manual review edits existing and suggested tags, supports clearing, and skips unchanged photos", async () => {
  const writes = setup([makePhoto("a", ["tasse"]), makePhoto("b", ["vase"]), makePhoto("c", ["schale"])]);
  suggestPhotoTags.mockImplementationOnce(async (_, signal, ready, result) => {
    ready(); result("a", ["blau", "gestreift"], ""); result("b", [], ""); result("c", [], "");
  });
  await selectLoaded();
  fireEvent.click(button("Tags vorschlagen"));
  const [a, b, c] = await screen.findAllByRole("textbox");
  expect(a).toHaveValue("tasse, blau, gestreift");
  fireEvent.change(a, { target: { value: "Becher, kobaltblau, Becher" } });
  expect(screen.getByLabelText("blau")).not.toBeChecked();
  fireEvent.click(screen.getByLabelText("gestreift"));
  expect(a).toHaveValue("becher, kobaltblau, gestreift");
  fireEvent.change(b, { target: { value: "" } });
  fireEvent.change(c, { target: { value: " SCHALE " } });
  expect(writes).toHaveLength(0);
  fireEvent.click(button("Auswahl speichern"));
  await screen.findByText("2 von 2 gespeichert.");
  expect(writes).toEqual([
    { id: "a", previousTags: ["tasse"], tags: ["becher", "kobaltblau", "gestreift"] },
    { id: "b", previousTags: ["vase"], tags: [] },
  ]);
  expect(button("Auswahl speichern")).toBeDisabled();
});

test("manual edits survive analysis retry and rebase after a concurrent change", async () => {
  const writes = setup([makePhoto("a", ["alt", "tasse"])], (body, n) =>
    n === 1 ? response({ tags: ["alt", "matt"] }, 409) : response({ tags: body.tags }));
  suggestPhotoTags.mockImplementationOnce(async (_, signal, ready, result) => {
    ready(); result("a", [], "Analyse fehlgeschlagen.");
  }).mockImplementationOnce(async (_, signal, ready, result) => {
    ready(); result("a", ["blau"], "");
  });
  await selectLoaded();
  fireEvent.click(button("Tags vorschlagen"));
  const edit = await screen.findByRole("textbox");
  fireEvent.change(edit, { target: { value: "x".repeat(41) } });
  expect(edit).toHaveAttribute("aria-invalid", "true");
  expect(button("Auswahl speichern")).toBeDisabled();
  fireEvent.change(edit, { target: { value: Array.from({ length: 21 }, (_, i) => "tag" + i).join(",") } });
  expect(button("Auswahl speichern")).toBeDisabled();
  fireEvent.change(edit, { target: { value: "tasse, salzglasur" } });
  fireEvent.click(button("Analyse wiederholen"));
  expect(await screen.findByRole("textbox")).toHaveValue("tasse, salzglasur");
  expect(screen.getByLabelText("blau")).not.toBeChecked();
  fireEvent.click(button("Auswahl speichern"));
  await screen.findByText("0 von 1 gespeichert.");
  expect(screen.getByRole("textbox")).toHaveValue("matt, salzglasur");
  fireEvent.click(button("Auswahl speichern"));
  await screen.findByText("1 von 1 gespeichert.");
  expect(writes[1]).toEqual({ id: "a", previousTags: ["alt", "matt"], tags: ["matt", "salzglasur"] });
});
