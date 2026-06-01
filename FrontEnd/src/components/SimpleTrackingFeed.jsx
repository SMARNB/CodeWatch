import React, { useState, useEffect } from 'react';

const SimpleTrackingFeed = ({ trackingFeedUrl, cameraId }) => {
  const [frameSrc, setFrameSrc] = useState(null);

  useEffect(() => {
    let mounted = true;
    let timeout;

    const loadFrame = () => {
      if (!mounted) return;
      const src = trackingFeedUrl
        ? `${trackingFeedUrl}?nc=${Math.random()}`
        : `/live_feed_${cameraId}.jpg?nc=${Math.random()}`;

      fetch(src)
        .then(res => {
          const ct = res.headers.get('content-type') || '';
          if (!res.ok || ct.startsWith('text/')) throw new Error('bad response');
          return res.blob();
        })
        .then(blob => {
          if (!mounted) return;
          const url = URL.createObjectURL(blob);
          setFrameSrc(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return url;
          });
          timeout = setTimeout(loadFrame, 300);
        })
        .catch(() => {
          if (mounted) timeout = setTimeout(loadFrame, 500);
        });
    };

    loadFrame();
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, [trackingFeedUrl, cameraId]);

  return frameSrc ? (
    <img
      src={frameSrc}
      alt="Live Tracking Feed"
      className="w-full h-full object-contain"
      style={{ background: '#1a1a2e' }}
    />
  ) : (
    <div className="w-full h-full flex items-center justify-center" style={{ background: '#1a1a2e' }}>
      <p className="text-gray-400">Loading feed...</p>
    </div>
  );
};

export default SimpleTrackingFeed;
