import { useEffect, useState } from "react";
import logo from "./logo.svg";
import {
  AiOutlineQuestionCircle,
  AiOutlineReload,
  AiOutlineCamera,
  AiOutlineArrowUp,
} from "react-icons/ai";
import PhotoUpload from "./components/PhotoUpload";
import PhotoGallery from "./components/PhotoGallery";
import LoadingBar from "./components/LoadingBar";
import { LuGlasses } from "react-icons/lu";

interface BootstrapLinks {
  request?: { href: string };
  list?: { href: string };
  challenge?: { href: string };
  likes?: { href: string };
}

interface Bootstrap {
  _links?: BootstrapLinks;
  maxPhotosPerRequest?: number;
  enablePhotoChallenge?: boolean;
  enablePhotoUpload?: boolean;
}

interface RandomChallenge {
  challenge: string;
}

interface AppProps {
  bootstrapUrl: string;
}

function App({ bootstrapUrl }: AppProps): JSX.Element {
  const [bootstrap, setBootstrap] = useState<Bootstrap | undefined>(undefined);
  const [showHelp, setShowHelp] = useState(false);
  const [showRandomChallenge, setShowRandomChallenge] = useState(false);
  const [challenge, setChallenge] = useState<RandomChallenge | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    console.log("Fetching bootstrap data from", bootstrapUrl);
    fetch(bootstrapUrl)
      .then((response) => response.json())
      .then((data: Bootstrap) => setBootstrap(data));
  }, [bootstrapUrl]);

  useEffect(() => {
    console.log("figuring out scroll component");
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > window.innerHeight);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleToggleHelp = () => {
    setShowHelp(!showHelp);
  };

  const handleRefresh = () => {
    window.location.reload(); // Refresh the page
  };

  const handleToggleRandomChallenge = () => {
    setShowRandomChallenge(!showRandomChallenge);
  };

  const handleRandomPhotoChallenge = () => {
    setShowRandomChallenge(true);
    fetch(bootstrap?._links?.challenge?.href || "")
      .then((response) => response.json())
      .then((data: RandomChallenge) => {
        setChallenge(data);
      })
      .catch((error) => {
        console.error("Error fetching random challenge:", error);
        setShowRandomChallenge(false);
      });
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!bootstrap) {
    return <LoadingBar />;
  }

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
        <div className="absolute top-5 right-5 flex space-x-4">
          {bootstrap.enablePhotoChallenge && (
            <button
              onClick={handleRandomPhotoChallenge}
              className="text-gray-600 hover:text-gray-800"
              title="Zufällige Foto-Challenge"
            >
              <AiOutlineCamera size={26} />
            </button>
          )}
          <button
            onClick={handleToggleHelp}
            className="text-gray-600 hover:text-gray-800"
            title="Hilfe"
          >
            <AiOutlineQuestionCircle size={24} />
          </button>
        </div>
      </div>
      <div className="mt-5 mb-3 flex justify-center">
        <div className="text-center text-gray-600 text-3xl font-custom">
          Sandra & Chris
        </div>
      </div>
      <div className="mt-3 mb-3 flex justify-center">
        <div className="text-center text-gray-600 text-sm">22.03.2025</div>
      </div>
      <div className="mt-3 mb-5 flex justify-center">
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
              Foto zu klein? Keine{" "}
              {
                <span className="inline-block">
                  <LuGlasses />
                </span>
              }
              ? Klicke auf ein Foto, um es dir größer anzusehen.
            </p>
            <p className="mt-3">
              Über das{" "}
              <span className="inline-block">
                <AiOutlineCamera />
              </span>
              -Symbol kannst du dir Inspiration für eine Foto-Challenge holen.
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
      {showRandomChallenge && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-5 rounded shadow-lg max-w-sm text-center">
            <h2 className="text-lg font-bold mb-3">
              Deine zufällige Foto-Challenge
            </h2>
            <p className="mt-3">{challenge?.challenge}</p>

            <button
              onClick={handleToggleRandomChallenge}
              className="mt-5 px-4 py-2 bg-purple-800 text-white rounded hover:bg-purple-600"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
      {bootstrap.enablePhotoUpload && (
        <div className="mt-10 mb-10 flex justify-center">
          <PhotoUpload
            url={bootstrap._links?.request?.href}
            maxPhotosPerRequest={bootstrap.maxPhotosPerRequest}
            onUpload={() => {
              window.location.reload();
            }}
          />
        </div>
      )}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 bg-cadbury text-white rounded-full shadow-lg hover:bg-purple-800 transition-all"
          aria-label="Scroll to top"
        >
          <AiOutlineArrowUp size={24} />
        </button>
      )}
      <PhotoGallery
        initialUrl={bootstrap._links?.request?.href}
        likesUrl={bootstrap._links?.likes?.href}
      />
    </div>
  );
}

export default App;
