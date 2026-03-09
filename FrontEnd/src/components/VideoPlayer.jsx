import React, { useState, useEffect, useRef } from 'react';

const VideoPlayer = ({ 
  streamUrl, 
  clipUrl, 
  placeholder = 'Loading feed...', 
  className = '',
  onEnded,
  autoPlay = true,
  muted = true
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  
  // --- NEW LOGIC FOR LIVE FEED ---
  // We use a timestamp to force the browser to reload the image
  const [liveImageTimestamp, setLiveImageTimestamp] = useState(Date.now());
  
  const videoRef = useRef(null);

  // Determine mode: If clipUrl exists, it's a recorded video. Otherwise, it's Live.
  const isClip = !!clipUrl; 

  // EFFECT: Handle Live Feed Refreshing
  useEffect(() => {
    let interval;
    if (!isClip) {
      // If it's LIVE, refresh the image 10 times a second (10 FPS)
      interval = setInterval(() => {
        setLiveImageTimestamp(Date.now());
        setIsLoading(false); // Assume it's loading once the interval starts
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isClip]);

  // Video Event Handlers (Only for Clips)
  const handleLoadStart = () => { setIsLoading(true); setHasError(false); };
  const handleLoadedData = () => { setIsLoading(false); };
  const handleError = () => { setIsLoading(false); setHasError(true); };
  const handleEnded = () => {
    if (onEnded && isClip) onEnded();
    if (isClip && videoRef.current) videoRef.current.pause();
  };

  return (
    <div className={`relative w-full h-full bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      
      {/* Aspect Ratio Container */}
      <div className="h-[500px] relative flex items-center justify-center bg-black">
        
        {isClip ? (
          /* ==================== RECORDED CLIP MODE (HTML5 Video) ==================== */
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-contain"
            src={clipUrl}
            autoPlay={autoPlay}
            muted={muted}
            controls={true}
            onLoadStart={handleLoadStart}
            onLoadedData={handleLoadedData}
            onError={handleError}
            onEnded={handleEnded}
          />
        ) : (
          /* ==================== LIVE STREAM MODE (Image Refresh) ==================== */
          /* We ignore streamUrl and hardcode the local file path for the demo */
          <img 
            src={`/live_feed.jpg?t=${liveImageTimestamp}`}
            alt="Live AI Stream"
            className="w-full h-full object-contain"
            onError={(e) => { 
                // Don't show broken image icon, just keep previous frame or black
                e.target.style.display = 'none'; 
                setHasError(true);
            }}
            onLoad={(e) => {
                e.target.style.display = 'block';
                setHasError(false);
                setIsLoading(false);
            }}
          />
        )}
        
        {/* Loading Overlay (Shared) */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75 z-10">
            <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-white text-sm font-medium">{placeholder}</p>
          </div>
        )}

        {/* Error Overlay (Shared) */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-10">
            <p className="text-white text-sm font-medium">Stream Offline</p>
            <p className="text-gray-400 text-xs mt-1">Checking connection...</p>
          </div>
        )}
      </div>

      {/* Live Indicator UI (Only for Live) */}
      {!isClip && (
        <div className="absolute top-4 right-4 z-20">
             <div className="bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse shadow-md">
                ● LIVE ..
            </div>
        </div>
      )}
      
      {/* Clip Info Overlay (Only for Clips) */}
      {isClip && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg text-sm z-20">
          <span>Recorded Clip</span>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;