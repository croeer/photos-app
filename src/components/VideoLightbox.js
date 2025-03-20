import { useCallback, useEffect, useState } from "react";
import ReactPlayer from "react-player";

function Video({
  url,
  onClick,
  onSwipeLeft,
  onSwipeRight,
  minSwipeDistance = 150,
}) {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

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
    <div className="relative inline-block">
      <ReactPlayer
        url={url}
        controls={true}
        playing={true}
        width="100%"
        height="100%"
        style={{ marginLeft: touchEnd !== 0 ? touchEnd - touchStart : 0 }}
        onClick={onClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
    </div>
  );
}

function VideoLightbox({ video, onNext, onPrevious, onClose }) {
  useEffect(() => {
    if (!video) return;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [video]);

  if (!video) {
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

      {/* Video Container to constrain large videos */}
      <div className="relative flex justify-center items-center">
        <Video
          url={video.url}
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

export default VideoLightbox;
