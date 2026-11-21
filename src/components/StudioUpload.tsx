import { useEffect, useRef, useState } from "react";
import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import PhotoUpload from "./PhotoUpload";
import LoadingBar from "./LoadingBar";

export interface StudioConfig {
  clientId: string;
  issuer: string;
  loginUrl: string;
  uploadUrl: string;
}

interface Props {
  config: StudioConfig;
  maxPhotosPerRequest?: number;
}

export default function StudioUpload({ config, maxPhotosPerRequest }: Props) {
  const [manager] = useState(() => new UserManager({
    authority: config.issuer,
    client_id: config.clientId,
    redirect_uri: window.location.origin + "/",
    response_type: "code",
    scope: "openid",
    automaticSilentRenew: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  }));
  const initialSession = useRef<Promise<User | null>>();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    let active = true;
    // A redirect code can only be exchanged once, including in React Strict Mode.
    if (!initialSession.current) {
      const params = new URLSearchParams(window.location.search);
      if (params.has("state") && (params.has("code") || params.has("error"))) {
        initialSession.current = manager.signinRedirectCallback();
        window.history.replaceState(null, "", "/?studio");
      } else {
        initialSession.current = manager.getUser();
      }
    }

    initialSession.current.then(session => {
      if (active && session && !session.expired) setUser(session);
    }).catch(() => {
      if (active) setError("Die Anmeldung ist fehlgeschlagen. Bitte erneut anmelden.");
    }).finally(() => {
      if (active) setLoading(false);
    });

    const removeListener = manager.events.addAccessTokenExpired(() => setUser(null));
    return () => { active = false; removeListener(); };
  }, [manager]);

  const signIn = async () => {
    setError("");
    try {
      await manager.signinRedirect();
    } catch {
      setError("Die Anmeldung ist derzeit nicht erreichbar.");
    }
  };

  const signOut = async () => {
    await manager.removeUser();
    setUser(null);
    const logout = new URL("/logout", config.loginUrl);
    logout.searchParams.set("client_id", config.clientId);
    logout.searchParams.set("logout_uri", window.location.origin + "/");
    window.location.assign(logout.href);
  };

  return (
    <main className="mx-auto max-w-lg px-6 py-10 text-gray-800">
      <a href="/" className="underline">Zur Galerie</a>
      <h1 className="mt-8 text-3xl font-custom">Fotos fürs Atelier hochladen</h1>
      {loading ? <LoadingBar /> : user ? (
        <>
          <div className="my-6">
            <PhotoUpload
              url={config.uploadUrl}
              accessToken={user.access_token}
              maxPhotosPerRequest={maxPhotosPerRequest}
              onAuthorizationError={() => {
                setUser(null);
                setError("Bitte erneut anmelden, um Fotos hochzuladen.");
              }}
              onUpload={() => setUploaded(true)}
            />
          </div>
          {uploaded && <p role="status">Hochgeladen. Die Fotos erscheinen nach der Verarbeitung in der Galerie.</p>}
          <button onClick={signOut} className="mt-6 underline">Abmelden</button>
        </>
      ) : (
        <>
          <p className="my-4">Melde dich mit deinem Atelier-Konto an, um Fotos zur Galerie hinzuzufügen.</p>
          <button onClick={signIn} className="rounded-lg bg-cadbury px-5 py-2.5 text-white">Anmelden</button>
        </>
      )}
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    </main>
  );
}
