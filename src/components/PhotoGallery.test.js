import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PhotoGallery from "./PhotoGallery";

const photo = (id, tags = []) => ({ id, thumbnail: "/" + id, web: "/" + id, tags });
const page = (photos, next) => ({ photos, _links: next ? { next: { href: next } } : {} });
const ok = body => ({ ok: true, json: async () => body });
let enterViewport;

beforeEach(() => {
  global.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() { enterViewport = () => this.callback([{ isIntersecting: true }]); }
    disconnect() {}
  };
});
afterEach(() => { delete global.IntersectionObserver; });

test("changing tags discards old requests and scroll follows filtered continuations across empty pages", async () => {
  let finishBlue;
  global.fetch = jest.fn(async href => {
    const url = new URL(href, "http://localhost");
    if (url.pathname === "/tags") return ok({ tags: { blau: 2, schale: 2 } });
    if (url.pathname === "/empty") return ok(page([], "/more"));
    if (url.pathname === "/more") return ok(page([photo("second", ["blau", "schale"])]));
    const tags = JSON.parse(url.searchParams.get("tags") || "[]");
    if (tags.length === 2) return ok(page([photo("first", tags)], "/empty"));
    if (tags.length === 1) return new Promise(resolve => { finishBlue = resolve; });
    return ok(page([photo("legacy")]));
  });

  render(<PhotoGallery initialUrl="/list" tagsUrl="/tags" />);
  await screen.findByAltText("Galeriefoto");
  fireEvent.click(await screen.findByRole("button", { name: "blau" }));
  expect(screen.queryByAltText("Galeriefoto")).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "scha" } });
  fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
  await screen.findByAltText("blau, schale");
  await act(async () => finishBlue(ok(page([photo("stale", ["blau"])]))));
  expect(screen.queryByAltText("blau")).toBeNull();
  await act(async () => enterViewport());
  await waitFor(() => expect(screen.getAllByAltText("blau, schale")).toHaveLength(2));
  expect(screen.queryByRole("button", { name: "Weitere Fotos laden" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Filter löschen" }));
  expect(await screen.findByAltText("Galeriefoto")).toBeInTheDocument();
  expect(screen.queryByAltText("blau, schale")).toBeNull();
});

test("an empty final page shows a clear empty state and stops scrolling", async () => {
  global.fetch = jest.fn(async href => {
    if (href === "/tags") return ok({ tags: { rot: 1 } });
    if (href === "/list") return ok(page([photo("legacy")]));
    return ok(page([]));
  });
  render(<PhotoGallery initialUrl="/list" tagsUrl="/tags" />);
  fireEvent.click(await screen.findByRole("button", { name: "rot" }));
  expect(await screen.findByText("Keine Fotos mit allen ausgewählten Tags.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Weitere Fotos laden" })).toBeNull();
  expect(screen.queryByRole("img")).toBeNull();
});

test("studio staff can replace tags on an existing photo", async () => {
  global.fetch = jest.fn(async href => href === "/list"
    ? ok(page([photo("image#cup", ["blau"])]))
    : ok({ tags: ["tasse", "weiß"] }));
  render(<PhotoGallery initialUrl="/list" editor={{ url: "/save", token: "staff", onAuthorizationError: jest.fn() }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Tags bearbeiten" }));
  fireEvent.change(screen.getByLabelText("Tags (mit Komma trennen)"), { target: { value: "Tasse, weiß" } });
  fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
  expect(await screen.findByText("tasse · weiß")).toBeInTheDocument();
  const [, options] = global.fetch.mock.calls.find(([url]) => url === "/save");
  expect(options.headers.Authorization).toBe("Bearer staff");
  expect(JSON.parse(options.body)).toEqual({ id: "image#cup", previousTags: ["blau"], tags: ["Tasse", "weiß"] });
});
