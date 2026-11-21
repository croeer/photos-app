// Decode one thumbnail at a time to keep the memory cost independent of batch size.
async function readThumbnail(url, signal) {
  if (!url) throw new Error("Für dieses Foto fehlt die Vorschauadresse.");
  const previewUrl = new URL(url, window.location.href);
  // Keep CORS-enabled reads separate from the gallery's ordinary image cache.
  if (previewUrl.origin !== window.location.origin && previewUrl.protocol === "https:") {
    previewUrl.searchParams.set("studio-preview", "1");
  }
  let response;
  try {
    response = await fetch(previewUrl, { signal, credentials: "omit" });
  } catch {
    throw new Error("Bildabruf blockiert. Bitte Verbindung und CORS-Freigabe der Fotodomain prüfen.");
  }
  if (!response.ok) throw new Error(`Vorschaubild konnte nicht geladen werden (HTTP ${response.status}).`);
  const blob = await response.blob();
  // Older S3 thumbnails are WebP files served as binary/octet-stream.
  const isWebP = /\.webp$/i.test(previewUrl.pathname);
  const src = URL.createObjectURL(isWebP && !blob.type.startsWith("image/")
    ? blob.slice(0, blob.size, "image/webp") : blob);
  try {
    const image = new Image();
    image.src = src;
    try {
      await image.decode();
    } catch {
      throw new Error("Der Browser konnte das Vorschaubild nicht dekodieren.");
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(src);
  }
}

function askWorker(worker, message, signal, transfer = []) {
  return new Promise((resolve, reject) => {
    function cleanup() {
      worker.onmessage = worker.onerror = worker.onmessageerror = null;
      signal.removeEventListener("abort", abort);
    }
    function abort() {
      cleanup();
      reject(new DOMException("Abgebrochen", "AbortError"));
    }
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort);
    worker.onmessage = ({ data }) => { cleanup(); resolve(data); };
    worker.onerror = worker.onmessageerror = () => {
      cleanup();
      reject(new Error("CLIP konnte nicht ausgeführt werden."));
    };
    try {
      worker.postMessage(message, transfer);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

export async function suggestPhotoTags(photos, signal, onReady, onPhoto) {
  const worker = new Worker((process.env.PUBLIC_URL || "") + "/clip/worker.js", { type: "module" });
  try {
    const init = await askWorker(worker, { init: true, studio: true }, signal);
    if (!init.ready) throw new Error("CLIP konnte nicht geladen werden.");
    onReady();
    for (const photo of photos) {
      let pixels;
      try {
        pixels = await readThumbnail(photo.thumbnail, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        onPhoto(photo.id, [], error.message || "Vorschaubild konnte nicht gelesen werden.");
        continue;
      }
      const buffer = pixels.data.buffer;
      const result = await askWorker(worker, { buffer, width: pixels.width, height: pixels.height }, signal, [buffer]);
      onPhoto(photo.id, result.tags || [], result.error ? "Analyse fehlgeschlagen." : "");
    }
  } finally {
    worker.terminate();
  }
}
