import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const mockGetUser = jest.fn();
const mockCallback = jest.fn();
const mockSignIn = jest.fn();
jest.mock("oidc-client-ts", () => ({
  UserManager: class {
    getUser = mockGetUser;
    signinRedirect = mockSignIn;
    signinRedirectCallback = mockCallback;
    events = { addAccessTokenExpired: () => () => {} };
  },
  WebStorageStateStore: jest.fn(),
}));
jest.mock("./components/PhotoGallery", () => ({ initialUrl }: { initialUrl: string }) => (
  <div data-testid="gallery">{initialUrl}</div>
));

const studio = {
  clientId: "studio-client", issuer: "https://issuer.example",
  loginUrl: "https://login.example", uploadUrl: "/api/studio/upload",
};
const bootstrap = {
  _links: { list: { href: "/api/list" }, request: { href: "/api/request" } },
  enablePhotoUpload: false, studio,
};
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState(null, "", "/");
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ ok: true, json: async () => bootstrap });
  mockGetUser.mockResolvedValue(null);
});

test("customers can browse the list and see no upload controls or upload instructions", async () => {
  render(<App bootstrapUrl="/bootstrap" />);
  expect(await screen.findByTestId("gallery")).toHaveTextContent("/api/list");
  fireEvent.click(screen.getByTitle("Hilfe"));
  expect(screen.queryByText(/hochladen/i)).toBeNull();
  expect(screen.queryByText("Anmelden")).toBeNull();
});

test("event galleries can still offer guest uploads", async () => {
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ...bootstrap, studio: undefined, enablePhotoUpload: true }) });
  render(<App bootstrapUrl="/bootstrap" />);
  expect(await screen.findByLabelText("Fotos hochladen")).toBeInTheDocument();
});

test("staff must sign in before selecting photos", async () => {
  window.history.replaceState(null, "", "/?studio");
  render(<App bootstrapUrl="/bootstrap" />);
  fireEvent.click(await screen.findByRole("button", { name: "Anmelden" }));
  expect(mockSignIn).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText("Fotos hochladen")).toBeNull();
});

test("staff sign-in completes once and the token goes only to the signing endpoint", async () => {
  window.history.replaceState(null, "", "/?code=example&state=example");
  mockCallback.mockResolvedValue({ access_token: "staff-token", expired: false });
  render(<StrictMode><App bootstrapUrl="/bootstrap" /></StrictMode>);
  const input = await screen.findByLabelText("Fotos hochladen");
  expect(mockCallback).toHaveBeenCalledTimes(1);
  expect(window.location.search).toBe("?studio");
  mockFetch.mockResolvedValueOnce({
    ok: true, json: async () => ({ urls: [{ url: "https://bucket.example", fields: { key: "piece.jpg" } }] }),
  }).mockResolvedValueOnce({ ok: true });
  fireEvent.change(input, { target: { files: [new File(["photo"], "piece.jpg")] } });
  expect(await screen.findByText(/^Hochgeladen\./)).toBeInTheDocument();
  expect(mockFetch).toHaveBeenCalledWith(studio.uploadUrl, expect.objectContaining({
    headers: { Authorization: "Bearer staff-token" },
  }));
  expect(mockFetch).toHaveBeenCalledWith("https://bucket.example", { method: "POST", body: expect.any(FormData) });
});

test("a rejected session returns staff to sign-in without sending a file to storage", async () => {
  window.history.replaceState(null, "", "/?studio");
  mockGetUser.mockResolvedValue({ access_token: "expired-on-server", expired: false });
  render(<App bootstrapUrl="/bootstrap" />);
  const input = await screen.findByLabelText("Fotos hochladen");
  mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
  fireEvent.change(input, { target: { files: [new File(["photo"], "piece.jpg")] } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Anmelden" })).toBeInTheDocument());
  expect(mockFetch).toHaveBeenCalledTimes(2);
});
