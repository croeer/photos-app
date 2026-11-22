import { useEffect, useState, useCallback, useRef } from "react";
import TagFilter from "./TagFilter";
import BatchTagEditor from "./BatchTagEditor";
import PhotoTagEditor from "./PhotoTagEditor";
import Lightbox from "./Lightbox";
import LoadingBar from "./LoadingBar";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { v4 as uuidv4 } from "uuid";

const getUserId = () => {
  let userId = localStorage.getItem("userId");
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem("userId", userId);
  }
  return userId;
};

/**
 * @param {{initialUrl?:string, likesUrl?:string, enableLikes?:boolean, tagsUrl?:string,
 *   editor?: {url:string, token:string, onAuthorizationError:() => void} | null}} props
 */
function PhotoGallery({ initialUrl, likesUrl, enableLikes, tagsUrl = "", editor = null }) {
  const [selectedTags, setSelectedTags] = useState([]);
  let url = initialUrl;
  if (url && selectedTags.length) {
    const query = new URL(url, window.location.origin);
    query.searchParams.set("tags", JSON.stringify(selectedTags));
    url = query.href;
  }

  return (
    <>
      {tagsUrl && <TagFilter url={tagsUrl} selected={selectedTags} onChange={setSelectedTags} />}
      <PhotoResults key={url} initialUrl={url} likesUrl={likesUrl} enableLikes={enableLikes}
        filtered={selectedTags.length > 0} editor={editor} />
    </>
  );
}

function PhotoResults({ initialUrl, likesUrl, enableLikes, filtered, editor }) {
  const [photos, setPhotos] = useState([]);
  const [nextUrl, setNextUrl] = useState(initialUrl);
  const [selected, setSelected] = useState(undefined);
  const [selection, setSelection] = useState(null);
  const [userLikes, setUserLikes] = useState({});
  const [likesReady, setLikesReady] = useState(!enableLikes);
  const [failed, setFailed] = useState(false);
  const request = useRef(null);
  const sentinel = useRef(null);
  const hasFetchedLikes = useRef(false);

  useEffect(() => {
    if (!enableLikes || hasFetchedLikes.current) return;
    hasFetchedLikes.current = true;

    const fetchLikes = async () => {
      try {
        const userId = getUserId();
        const response = await fetch(`${likesUrl}/${userId}`);
        const data = await response.json();

        // Convert array of liked photo IDs into a hashmap for O(1) lookups
        const likesMap = data.photos.reduce((acc, photoId) => {
          acc["image#" + photoId] = true;
          return acc;
        }, {});

        setUserLikes(likesMap);
      } catch (error) {
        console.error("Error fetching user likes:", error);
      } finally {
        setLikesReady(true);
      }
    };

    fetchLikes();
  }, [likesUrl, enableLikes]);

  const doFetch = useCallback(() => {
    if (!nextUrl) return Promise.resolve(false);
    if (request.current?.url === nextUrl) return request.current.promise;
    const controller = new AbortController();
    const load = async () => {
      let url = nextUrl;
      // A filtered DynamoDB page can be empty and still have a continuation.
      while (url && !controller.signal.aborted) {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const page = await response.json();
        if (controller.signal.aborted) return false;
        url = page._links?.next?.href;
        if (page.photos.length || !url) {
          setPhotos(current => [...current, ...page.photos]);
          setNextUrl(url);
          return page.photos.length > 0;
        }
      }
      return false;
    };
    setFailed(false);
    const promise = load().catch(() => {
      if (!controller.signal.aborted) {
        request.current = null;
        setFailed(true);
      }
      return false;
    });
    request.current = { url: nextUrl, controller, promise };
    return promise;
  }, [nextUrl]);

  useEffect(() => () => {
    request.current?.controller.abort();
    request.current = null;
  }, []);

  useEffect(() => {
    if (!nextUrl || failed) return;
    if (!photos.length) {
      doFetch();
      return;
    }
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) doFetch();
    }, { rootMargin: "350px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [nextUrl, doFetch, failed, photos.length]);

  // Function to handle moving to the next photo in lightbox mode
  const handleNextPhoto = useCallback(async () => {
    if (selected === undefined) return;

    // If we have more photos already loaded
    if (selected + 1 < photos.length) {
      setSelected(selected + 1);
      return;
    }

    // If we need to fetch more photos and have a URL to fetch from
    if (nextUrl) {
      const hasMorePhotos = await doFetch();
      if (hasMorePhotos) {
        // We successfully loaded more photos, move to the next one
        setSelected(selected + 1);
      } else {
        // No more photos available, loop back to beginning
        setSelected(0);
      }
    } else {
      // No more photos to fetch, loop back to beginning
      setSelected(0);
    }
  }, [selected, photos.length, nextUrl, doFetch]);

  function updateTags(id, tags) {
    setPhotos(current => current.map(photo => photo.id === id ? { ...photo, tags } : photo));
  }

  function togglePhoto(id) {
    setSelection(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      {editor && <BatchTagEditor photos={photos} selection={selection} setSelection={setSelection}
        editor={editor} onSaved={updateTags} />}
        <div className={editor ? `grid gap-3 sm:grid-cols-2 md:grid-cols-3 ${selection !== null ? "grid-cols-2" : ""}` : "grid gap-1 grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8"}>
          {photos.map((photo, idx) => (
            <div className={editor ? "overflow-hidden rounded border border-gray-200" : "relative aspect-square"} key={photo.id}>
              {selection !== null ? (
                <label className={`relative block cursor-pointer rounded ${selection.has(photo.id) ? "ring-2 ring-inset ring-cadbury" : ""}`}>
                  <img src={photo.thumbnail} alt="" className="aspect-square w-full object-cover" />
                  <input type="checkbox" checked={selection.has(photo.id)} onChange={() => togglePhoto(photo.id)}
                    aria-label={`Foto ${idx + 1} auswählen`}
                    className="absolute left-2 top-2 h-6 w-6 accent-cadbury" />
                  <span className="block p-2 text-sm">{photo.tags?.join(" · ") || "Ohne Tags"}</span>
                </label>
              ) : (
                <img
                  className={`block object-cover w-full cursor-pointer ${editor ? "aspect-square" : "h-full"}`}
                  alt={photo.tags?.join(", ") || "Galeriefoto"}
                  src={photo.thumbnail}
                  onClick={() => setSelected(idx)}
                />
              )}
              {editor && selection === null && <PhotoTagEditor photo={photo} editor={editor}
                onSaved={tags => updateTags(photo.id, tags)} />}
              {enableLikes && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <button
                    disabled={!likesReady}
                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 text-white transition-colors"
                    onClick={(e) => {
                      var hasLiked = !userLikes[photo.id];

                      // update like count
                      setPhotos((photos) => {
                        const newPhotos = [...photos];
                        newPhotos[idx].likes = userLikes[photo.id]
                          ? newPhotos[idx].likes - 1
                          : newPhotos[idx].likes + 1;
                        return newPhotos;
                      });

                      // toggle heart
                      setUserLikes((userLikes) => {
                        const newUserLikes = { ...userLikes };
                        newUserLikes[photo.id] = !newUserLikes[photo.id];
                        return newUserLikes;
                      });

                      // Call likes API
                      if (likesUrl) {
                        const photoId = photo.id.split("#")[1];
                        fetch(
                          `${likesUrl}/${getUserId()}/${photoId}?hasLiked=${hasLiked}`,
                          {
                            method: "POST",
                          }
                        ).catch((err) => {
                          console.error("Error updating like:", err);
                          // Revert optimistic UI updates on error
                          setPhotos((photos) => {
                            const newPhotos = [...photos];
                            newPhotos[idx].likes = userLikes[photo.id]
                              ? newPhotos[idx].likes + 1
                              : newPhotos[idx].likes - 1;
                            return newPhotos;
                          });
                          setUserLikes((userLikes) => {
                            const newUserLikes = { ...userLikes };
                            newUserLikes[photo.id] = !newUserLikes[photo.id];
                            return newUserLikes;
                          });
                        });
                      }
                    }}
                  >
                    {userLikes[photo.id] ? (
                      <AiFillHeart color="#E60026" />
                    ) : (
                      <AiOutlineHeart />
                    )}
                    <span className="text-sm font-medium">{photo.likes}</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      {nextUrl && (
        <div ref={sentinel} className="my-4 text-center">
          {!photos.length && !failed && <LoadingBar />}
          <button className="text-sm underline" onClick={doFetch}>
            {failed ? "Laden fehlgeschlagen · Erneut versuchen" : "Weitere Fotos laden"}
          </button>
        </div>
      )}
      {!nextUrl && !photos.length && (
        <p role="status" className="my-8 text-center text-gray-600">
          {filtered ? "Keine Fotos mit allen ausgewählten Tags." : "Noch keine Fotos vorhanden."}
        </p>
      )}
      <Lightbox
        photo={selected !== undefined && photos[selected]}
        onNext={handleNextPhoto}
        onPrevious={() => setSelected(Math.max(0, selected - 1))}
        onClose={() => setSelected(undefined)}
      />
    </>
  );
}

export default PhotoGallery;
