import { useEffect, useState, useCallback, useRef } from "react";
import InfiniteScroll from "react-infinite-scroller";
import Lightbox from "./Lightbox";
import LoadingBar from "./LoadingBar";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";
import { v4 as uuidv4 } from "uuid";
import { useAuth } from "react-oidc-context";

const getUserId = () => {
  let userId = localStorage.getItem("userId");
  if (!userId) {
    userId = uuidv4();
    localStorage.setItem("userId", userId);
  }
  return userId;
};

function PhotoGallery({ initialUrl, likesUrl }) {
  const auth = useAuth?.(); // Check if useAuth exists
  const isAuthEnabled = !!auth;

  const [photos, setPhotos] = useState([]);
  const [nextUrl, setNextUrl] = useState(undefined);
  const [selected, setSelected] = useState(undefined);
  const [userLikes, setUserLikes] = useState({});
  const [likesLoaded, setLikesLoaded] = useState(false);
  const ongoingFetch = useRef(new Set());
  const hasFetchedLikes = useRef(false);
  const tokenRef = useRef(null);

  useEffect(() => {
    if (isAuthEnabled && auth.isAuthenticated) {
      tokenRef.current = auth.user?.id_token;
    }
  }, [auth.isAuthenticated, auth.user, isAuthEnabled]);

  useEffect(() => {
    setNextUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    if (hasFetchedLikes.current || !tokenRef.current) return;
    hasFetchedLikes.current = true;

    const fetchLikes = async () => {
      try {
        const userId = getUserId();
        const response = await fetch(`${likesUrl}/${userId}`, {
          headers: isAuthEnabled
            ? { Authorization: `Bearer ${tokenRef.current}` }
            : {},
        });
        const data = await response.json();
        setUserLikes(
          data.photos.reduce((acc, photoId) => {
            acc[`image#${photoId}`] = true;
            return acc;
          }, {})
        );
      } catch (error) {
        console.error("Error fetching user likes:", error);
      } finally {
        setLikesLoaded(true);
      }
    };

    fetchLikes();
  }, [likesUrl, isAuthEnabled]);

  const doFetch = useCallback(async () => {
    if (
      (isAuthEnabled && !auth?.isAuthenticated) ||
      !nextUrl ||
      ongoingFetch.current.has(nextUrl)
    )
      return;
    ongoingFetch.current.add(nextUrl);

    try {
      const response = await fetch(nextUrl, {
        headers: isAuthEnabled
          ? { Authorization: `Bearer ${tokenRef.current}` }
          : {},
      });
      if (response.status === 401) {
        console.error("Unauthorized access - 401");
        return;
      }
      const data = await response.json();
      setPhotos((prev) => [...prev, ...data.photos]);
      setNextUrl(data?._links?.next?.href);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      ongoingFetch.current.delete(nextUrl);
    }
  }, [auth.isAuthenticated, nextUrl, isAuthEnabled]);

  const toggleLike = async (photo, idx) => {
    const photoId = photo.id.split("#")[1];
    const hasLiked = !userLikes[photo.id];

    setPhotos((prev) => {
      const updated = [...prev];
      updated[idx].likes += hasLiked ? 1 : -1;
      return updated;
    });

    setUserLikes((prev) => ({ ...prev, [photo.id]: hasLiked }));

    try {
      await fetch(
        `${likesUrl}/${getUserId()}/${photoId}?hasLiked=${hasLiked}`,
        {
          method: "POST",
          headers: isAuthEnabled
            ? { Authorization: `Bearer ${tokenRef.current}` }
            : {},
        }
      );
    } catch (error) {
      console.error("Error updating like:", error);
      setPhotos((prev) => {
        const updated = [...prev];
        updated[idx].likes += hasLiked ? -1 : 1;
        return updated;
      });
      setUserLikes((prev) => ({ ...prev, [photo.id]: !hasLiked }));
    }
  };

  return (
    <>
      <InfiniteScroll
        loadMore={likesLoaded ? doFetch : () => {}}
        hasMore={!!nextUrl}
        loader={<LoadingBar />}
      >
        <div className="grid gap-1 grid-cols-2 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
          {photos.map((photo, idx) => (
            <div key={photo.id} className="relative inline-block">
              <img
                className="flex object-cover w-full h-full cursor-pointer"
                alt=""
                src={photo.thumbnail}
                onClick={() => setSelected(idx)}
              />
              <div className="absolute bottom-4 right-4 flex items-center gap-2">
                <button
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 text-white transition-colors"
                  onClick={() => toggleLike(photo, idx)}
                >
                  {userLikes[photo.id] ? (
                    <AiFillHeart color="#E60026" />
                  ) : (
                    <AiOutlineHeart />
                  )}
                  <span className="text-sm font-medium">{photo.likes}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </InfiniteScroll>
      <Lightbox
        photo={selected !== undefined && photos[selected]}
        onNext={() =>
          setSelected((prev) => (prev + 1 < photos.length ? prev + 1 : 0))
        }
        onPrevious={() => setSelected((prev) => Math.max(0, prev - 1))}
        onClose={() => setSelected(undefined)}
      />
    </>
  );
}

export default PhotoGallery;
