import React, { useState, useEffect, useRef } from 'react';

const VideoPlayer = ({ 
  streamUrl, 
  clipUrl, 
  trackingFeedUrl,
  cameraId,
  cameraName,
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
      // If it's LIVE, refresh the image ~5x/sec (200ms); ~2x/sec (500ms) for the heavier tracking feed.
      const refreshRate = trackingFeedUrl ? 500 : 200;
      interval = setInterval(() => {
    	setLiveImageTimestamp(Date.now());
   	setIsLoading(false);	
      }, refreshRate);
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
          /* ==================== LIVE STREAM MODE (Image Refresh or External URL) ==================== */
          (streamUrl && (streamUrl.startsWith('http') || streamUrl.startsWith('rtsp')) && !cameraId) ? (
            <video
              className="absolute inset-0 w-full h-full object-contain"
              src={streamUrl}
              autoPlay={autoPlay}
              muted={muted}
              onLoadStart={handleLoadStart}
              onLoadedData={handleLoadedData}
              onError={handleError}
            />
          ) : (
            <img 
              src={trackingFeedUrl ? `${trackingFeedUrl}?t=${liveImageTimestamp}` : cameraId ? `/live_feed_${cameraId}.jpg?t=${liveImageTimestamp}` : `/live_feed.jpg?t=${liveImageTimestamp}`}
              alt="Live AI Stream"
              className="w-full h-full object-contain"
              onError={(e) => { 
                  //e.target.style.display = 'none'; 
                  //setHasError(true);
              }}
              onLoad={(e) => {
                  e.target.style.display = 'block';
                  setHasError(false);
                  setIsLoading(false);
              }}
            />
          )
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

      {/* Camera Name UI */}
      {cameraName && (
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-black/60 backdrop-blur-sm text-white text-[36px] font-semibold px-4 py-2 rounded-lg shadow-lg border border-white/10">
            {cameraName}
          </div>
        </div>
      )}

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
