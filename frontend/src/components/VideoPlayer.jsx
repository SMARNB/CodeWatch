import React, { useState } from 'react';

const VideoPlayer = ({ streamUrl, placeholder = 'Loading NVR Stream...', className = '' }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleLoadStart = () => {
    setIsLoading(true);
    setHasError(false);
  };

  const handleLoadedData = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`relative w-full bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Aspect Ratio Container */}
      <div className="aspect-video relative">
        {streamUrl ? (
          <>
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src={streamUrl}
              autoPlay
              muted
              loop
              playsInline
              onLoadStart={handleLoadStart}
              onLoadedData={handleLoadedData}
              onError={handleError}
            />
            
            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 bg-opacity-75">
                <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-4 text-white text-sm font-medium">{placeholder}</p>
              </div>
            )}

            {/* Error Overlay */}
            {hasError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
                <svg
                  className="w-16 h-16 text-red-500 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-white text-sm font-medium">Failed to load stream</p>
                <p className="text-gray-400 text-xs mt-1">Please check your connection</p>
              </div>
            )}

            {/* Play Icon Overlay (when paused) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 bg-white bg-opacity-20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <svg
                  className="w-10 h-10 text-white"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
            <div className="w-20 h-20 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-300 text-sm font-medium">{placeholder}</p>
          </div>
        )}
      </div>

      {/* Video Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            <span className="text-white text-xs font-medium">LIVE</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              className="text-white hover:text-blue-400 transition-colors"
              aria-label="Fullscreen"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
