import { useCallback, useEffect, useState } from "react";
import { AiFillHeart, AiOutlineHeart } from "react-icons/ai";

function Photo({
  src,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 150,
}) {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [liked, setLiked] = useState(false);

  const handleTouchStart = useCallback((e) => {
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchEnd === 0) return;
    if (touchStart - touchEnd > minSwipeDistance) onSwipeLeft();
    if (touchStart - touchEnd < -minSwipeDistance) onSwipeRight();
    setTouchStart(0);
    setTouchEnd(0);
  }, [touchStart, touchEnd, minSwipeDistance, onSwipeLeft, onSwipeRight]);

  return (
    <>
      <div className="relative inline-block">
        <img
          alt=""
          className="max-h-[90vh]"
          src={src}
          style={{ marginLeft: touchEnd !== 0 ? touchEnd - touchStart : 0 }}
          onClick={onClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <button
            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-full px-3 py-1.5 text-white transition-colors"
            onClick={(e) => {
              // Prevent the click event from bubbling up to parent elements
              // Without this, clicking the like button would trigger the lightbox close
              e.stopPropagation();
              setLiked(!liked);
              // TODO: Implement like functionality
            }}
          >
            {liked ? <AiFillHeart /> : <AiOutlineHeart />}
            <span className="text-sm font-medium">{125}</span>
          </button>
        </div>
      </div>
    </>
  );
}

function Lightbox({ photo, onNext, onPrevious, onClose }) {
  useEffect(() => {
    if (!photo) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [photo]);

  if (!photo) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 z-50 w-screen h-screen flex justify-center items-center bg-black/70"
      onClick={onClose}
    >
      {/* Close Button with the highest z-index */}
      <button
        className="fixed z-[9999] top-6 right-8 text-white text-5xl font-bold cursor-pointer"
        onClick={onClose}
      >
        &times;
      </button>

      {/* Image Container to constrain large images */}
      <div className="relative flex justify-center items-center">
        <Photo
          src={photo.web}
          className="max-w-full max-h-full"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          onSwipeLeft={onNext}
          onSwipeRight={onPrevious}
        />
      </div>
    </div>
  );
}

export default Lightbox;
