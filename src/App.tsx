import { useEffect, useState } from "react";
import logo from "./logo.svg";
import { AiOutlineQuestionCircle, AiOutlineReload } from "react-icons/ai";
import PhotoUpload from "./components/PhotoUpload";
import PhotoGallery from "./components/PhotoGallery";
import LoadingBar from "./components/LoadingBar";
import { LuGlasses } from "react-icons/lu";

interface BootstrapLinks {
  request?: { href: string };
  list?: { href: string };
}

interface Bootstrap {
  _links?: BootstrapLinks;
  maxPhotosPerRequest?: number;
}

interface AppProps {
  bootstrapUrl: string;
}

function App({ bootstrapUrl }: AppProps): JSX.Element {
  const [bootstrap, setBootstrap] = useState<Bootstrap | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    console.log("Fetching bootstrap data from", bootstrapUrl);
    fetch(bootstrapUrl)
      .then((response) => response.json())
      .then((data: Bootstrap) => setBootstrap(data));
  }, [bootstrapUrl]);

  if (!bootstrap) {
    return <LoadingBar />;
  }

  const handleToggleHelp = () => {
    setShowHelp(!showHelp);
  };

  const handleRefresh = () => {
    window.location.reload(); // Refresh the page
  };

  return (
    <div className="App">
      <div className="relative">
        {/* Refresh Button in the Upper Left Corner */}
        <div className="absolute top-5 left-5">
          <button
            onClick={handleRefresh}
            className="text-gray-600 hover:text-gray-800"
            title="Seite neu laden"
          >
            <AiOutlineReload size={24} />
          </button>
        </div>
        {/* Help Icon in the Upper Right Corner */}
        <div className="absolute top-5 right-5">
          <button
            onClick={handleToggleHelp}
            className="text-gray-600 hover:text-gray-800"
          >
            <AiOutlineQuestionCircle size={24} />
          </button>
        </div>
      </div>
      <div className="mt-5 mb-5 flex justify-center">
        <div className="text-center text-gray-600 text-2xl">Sandra & Chris</div>
      </div>
      <div className="mt-5 mb-5 flex justify-center">
        <div className="text-center text-gray-600">Wir sagen ja!</div>
      </div>
      <div className="mt-10 mb-10 flex justify-center">
        <img src={logo} alt="" />
      </div>
      {showHelp && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded shadow-lg max-w-sm text-center">
            <h2 className="text-lg font-bold mb-3">Wie benutzt man die App?</h2>
            <p>Willkommen zur Hochzeit von Sandra & Chris!</p>
            <p className="mt-3">Hier kannst du Fotos hochladen und ansehen.</p>
            <p className="mt-3">
              Klicke auf den Knopf „Foto hochladen“. Wähle ein oder mehrere
              Fotos von deinem Handy aus und warte, bis die Fotos hochgeladen
              sind. Sie erscheinen dann automatisch in der Galerie.
            </p>
            <p className="mt-3">
              In der Galerie siehst du alle hochgeladenen Fotos. Foto zu klein?
              Keine{" "}
              {
                <span className="inline-block">
                  <LuGlasses />
                </span>
              }
              ? Klicke auf ein Foto, um es dir größer anzusehen.
            </p>
            <button
              onClick={handleToggleHelp}
              className="mt-5 px-4 py-2 bg-purple-800 text-white rounded hover:bg-purple-600"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
      <div className="mt-10 mb-10 flex justify-center">
        <PhotoUpload
          url={bootstrap._links?.request?.href}
          maxPhotosPerRequest={10}
          onUpload={() => {
            window.location.reload();
          }}
        />
      </div>
      <PhotoGallery initialUrl={bootstrap._links?.request?.href} />
    </div>
  );
}

export default App;
