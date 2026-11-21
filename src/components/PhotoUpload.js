import { useState } from "react";

const PendingUpload = () => (
  <svg
    className="my-1 mr-4 w-5 h-5 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600 inline"
    viewBox="0 0 100 101"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
      fill="currentColor"
    />
    <path
      d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
      fill="currentFill"
    />
  </svg>
);

const toUploadClassName = (status) => {
  switch (status) {
    case "uploading":
      return "px-4 py-2 border-b border-gray-200 w-full font-medium truncate";
    case "failed":
      return "px-4 py-2 border-b border-gray-200 w-full line-through truncate";
    case "uploaded":
      return "px-4 py-2 border-b border-gray-200 w-full truncate";
    default:
      return "px-4 py-2 border-b border-gray-200 w-full text-gray-300 truncate";
  }
};

const calcUploadProgress = (uploads) => {
  const processed = uploads.filter(
    ({ status }) => status === "uploaded" || status === "failed"
  ).length;

  return (processed / uploads.length) * 100;
};

/**
 * @param {{url?: string, maxPhotosPerRequest?: number, onUpload: () => void,
 *   accessToken?: string, onAuthorizationError?: () => void}} props
 */
function PhotoUpload({ url, maxPhotosPerRequest, onUpload, accessToken, onAuthorizationError }) {
  const [uploads, setUploads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = "";
    if (!files.length) return;
    setError("");
    setUploads([]);
    if (files.length > maxPhotosPerRequest) {
      setError(`Bitte höchstens ${maxPhotosPerRequest} Fotos auf einmal auswählen.`);
      return;
    }

    const updateStatus = (index, status) => {
      setUploads(current => current.map((item, i) => i === index ? { ...item, status } : item));
    };

    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        body: JSON.stringify({ photos: JSON.stringify(files.map(file => file.name)) }),
      });
      if ((response.status === 401 || response.status === 403) && onAuthorizationError) {
        onAuthorizationError();
        return;
      }
      if (!response.ok) throw new Error();
      const { urls } = await response.json();
      if (!Array.isArray(urls) || urls.length !== files.length) throw new Error();

      setUploads(files.map(file => ({ name: file.name, status: "pending" })));
      let failed = 0;
      for (const [index, file] of files.entries()) {
        const form = new FormData();
        Object.entries(urls[index].fields).forEach(([key, value]) => form.append(key, value));
        form.append("file", file);
        updateStatus(index, "uploading");
        try {
          const result = await fetch(urls[index].url, { method: "POST", body: form });
          if (!result.ok) throw new Error();
          updateStatus(index, "uploaded");
        } catch {
          updateStatus(index, "failed");
          failed++;
        }
      }
      if (failed) {
        setError(`${failed} von ${files.length} Fotos fehlgeschlagen. Bitte die durchgestrichenen Fotos erneut auswählen.`);
      } else {
        setUploads([]);
        onUpload();
      }
    } catch {
      setError("Der Upload konnte nicht gestartet werden. Bitte erneut versuchen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!busy && (
        <label className="inline-block cursor-pointer rounded-lg bg-cadbury px-5 py-2.5 text-sm font-medium text-white focus-within:ring-4 hover:bg-purple-800">
          Fotos hochladen
          <input type="file" onChange={handleUpload} accept=".jpg,.jpeg,image/jpeg" multiple className="sr-only" />
        </label>
      )}
      {busy && !uploads.length && <p role="status">Upload wird vorbereitet …</p>}
      {uploads.length > 0 && (
        <div className="mt-4">
          <progress aria-label="Upload-Fortschritt" max="100" value={calcUploadProgress(uploads)} />
          <ul className="mt-2 rounded-lg border border-gray-200">
            {uploads.map(({ name, status }, index) => (
              <li className={toUploadClassName(status)} key={index}>
                {status === "uploading" && <PendingUpload />}
                {name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    </div>
  );
}

export default PhotoUpload;
