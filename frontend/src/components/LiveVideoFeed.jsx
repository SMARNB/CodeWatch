import React, { useState, useEffect } from 'react';

const LiveVideoFeed = ({ streamUrl }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Simulate loading state
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [streamUrl]);

  const handleVideoError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  const handleVideoLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
      {/* Video Element */}
      {streamUrl && !hasError ? (
        <video
          className="w-full h-full object-cover"
          autoPlay
          muted
          playsInline
          onError={handleVideoError}
          onLoadedData={handleVideoLoad}
          onLoadStart={() => setIsLoading(true)}
        >
          <source src={streamUrl} type="video/mp4" />
          <source src={streamUrl} type="video/webm" />
          <source src={streamUrl} type="video/ogg" />
        </video>
      ) : (
        /* Placeholder Background */
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900">
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full" style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: '20px 20px'
            }}></div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-16 h-16 mx-auto mb-4 relative">
              {/* Spinning loader */}
              <div className="w-full h-full border-4 border-gray-300 border-t-white rounded-full animate-spin"></div>
            </div>
            <p className="text-lg font-medium">Loading NVR Stream...</p>
            <p className="text-sm text-gray-300 mt-1">Connecting to camera feed</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-lg font-medium">Stream Error</p>
            <p className="text-sm text-red-200 mt-1">Unable to load video feed</p>
            <button 
              onClick={() => {
                setHasError(false);
                setIsLoading(true);
              }}
              className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Live Indicator */}
      {!isLoading && !hasError && (
        <div className="absolute top-4 left-4">
          <div className="flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>LIVE</span>
          </div>
        </div>
      )}

      {/* Video Controls Overlay */}
      {!isLoading && !hasError && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex justify-between items-center">
            {/* Camera Info */}
            <div className="bg-black bg-opacity-50 text-white px-3 py-2 rounded-lg">
              <p className="text-sm font-medium">Camera 1</p>
              <p className="text-xs text-gray-300">Main Entrance</p>
            </div>

            {/* Control Buttons */}
            <div className="flex space-x-2">
              <button className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
              </button>
              <button className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              <button className="bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-lg transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quality Indicator */}
      {!isLoading && !hasError && (
        <div className="absolute top-4 right-4">
          <div className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
            <span className="text-green-400">●</span> HD
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveVideoFeed;
