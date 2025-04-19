import { useEffect, useState, useCallback, useRef } from "react";
import InfiniteScroll from "react-infinite-scroller";
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

function PhotoGallery({ initialUrl, likesUrl, enableLikes }) {
  const [photos, setPhotos] = useState([]);
  const [nextUrl, setNextUrl] = useState(undefined);
  const [selected, setSelected] = useState(undefined);
  const [userLikes, setUserLikes] = useState({});
  const [likesLoaded, setLikesLoaded] = useState(false);
  const ongoingFetch = useRef(new Set()); // Stores in-progress URLs

  const hasFetchedLikes = useRef(false); // Prevents multiple fetches

  useEffect(() => {
    setNextUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    if (hasFetchedLikes.current) return; // Run only if likes are enabled
    hasFetchedLikes.current = true; // Mark as executed

    if (!enableLikes) {
      setLikesLoaded(true);
      return;
    }

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
        setLikesLoaded(true);
      } catch (error) {
        console.error("Error fetching user likes:", error);
        setLikesLoaded(true);
      }
    };

    fetchLikes();
  }, [likesUrl, enableLikes]);

  const doFetch = useCallback(async () => {
    if (!nextUrl || ongoingFetch.current.has(nextUrl)) return; // Prevent duplicate fetch
    ongoingFetch.current.add(nextUrl); // Mark as in-progress

    try {
      const response = await fetch(nextUrl).then((response) => response.json());
      setPhotos((photos) => [...photos, ...response?.photos]);
      setNextUrl(response?._links?.next?.href);
      return response.length > 0;
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      ongoingFetch.current.delete(nextUrl); // Remove from in-progress after completion
    }
  });

  return (
    <>
      <InfiniteScroll
        loadMore={likesLoaded ? doFetch : () => {}}
        hasMore={!!nextUrl}
        loader={<LoadingBar />}
      >
        <div className="grid gap-1 grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
          {photos.map((photo, idx) => (
            <div className="relative inline-block">
              <img
                key={photo.id}
                className="flex object-cover w-full h-full cursor-pointer"
                alt=""
                src={photo.thumbnail}
                onClick={() => setSelected(idx)}
              />
              {enableLikes && (
                <div className="absolute bottom-4 right-4 flex items-center gap-2">
                  <button
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
      </InfiniteScroll>
      <Lightbox
        photo={selected !== undefined && photos[selected]}
        onNext={() => {
          if (selected + 1 < photos.length) {
            setSelected(selected + 1);
            return;
          }

          if (!nextUrl) {
            setSelected(0);
            return;
          }

          doFetch().then((hasMorePhotos) =>
            setSelected(hasMorePhotos ? selected + 1 : 0)
          );
        }}
        onPrevious={() => setSelected(Math.max(0, selected - 1))}
        onClose={() => setSelected(undefined)}
      />
    </>
  );
}

export default PhotoGallery;
