import React, { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Reusable camera-capture modal. Opens the device camera (built-in or an external/USB webcam),
 * shows a live preview, and hands a captured still back to the caller via onCapture(file, dataUrl)
 * as a JPEG File — drop-in compatible with the existing file-upload flow.
 *
 * Requires a secure context (HTTPS or localhost); the app is served over HTTPS, so this also works
 * for LAN clients (phones/other PCs). Shows a clear message if there's no camera or access is denied.
 */
const CameraCaptureModal = ({ onCapture, onClose, title = 'Take Photo' }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [facingMode, setFacingMode] = useState('user'); // 'user' = front, 'environment' = back
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async (mode) => {
    setError('');
    setReady(false);
    stopStream();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera is not available. Open the site over https:// and allow camera access in your browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (_) { /* autoplay quirks */ }
      }
      setReady(true);
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasMultipleCameras(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch (_) { /* enumerateDevices can throw before permission on some browsers */ }
    } catch (e) {
      const name = e && e.name;
      let msg = 'Could not access the camera.';
      if (name === 'NotAllowedError' || name === 'SecurityError') msg = 'Camera permission was denied. Allow camera access in your browser, then try again.';
      else if (name === 'NotFoundError' || name === 'OverconstrainedError') msg = 'No camera was found on this device.';
      else if (name === 'NotReadableError') msg = 'The camera is already in use by another app. Close it and try again.';
      setError(msg);
    }
  }, [stopStream]);

  // Start on mount; always release the camera on unmount.
  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ESC to close + lock background scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => { stopStream(); onClose && onClose(); };

  const switchCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(next);
    startStream(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !ready) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    // Draw the raw (un-mirrored) frame so the saved face image has true orientation for recognition.
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      stopStream();
      onCapture && onCapture(file, dataUrl);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      onClick={handleClose}
      style={{ fontFamily: "'Open Sans', sans-serif" }}
    >
      <div
        className="relative bg-white rounded-[8px] w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100" style={{ padding: '10px' }}>
          <h3 className="text-lg font-semibold text-[#3f4299]">{title}</h3>
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Live preview / error */}
        <div className="bg-black flex items-center justify-center" style={{ minHeight: '280px' }}>
          {error ? (
            <div className="text-center text-white/90 text-sm leading-relaxed" style={{ padding: '32px 24px' }}>{error}</div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full max-h-[60vh] object-contain"
              style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
            />
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2" style={{ padding: '10px' }}>
          {error ? (
            <>
              <button onClick={handleClose} className="flex-1 h-[44px] rounded-[8px] border border-gray-200 text-gray-700 text-sm font-semibold hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => startStream(facingMode)} className="flex-1 h-[44px] rounded-[8px] bg-[#3f4299] text-white text-sm font-semibold hover:bg-[#2d3170] transition-colors">Try again</button>
            </>
          ) : (
            <>
              {hasMultipleCameras && (
                <button
                  onClick={switchCamera}
                  title="Switch camera"
                  aria-label="Switch camera"
                  className="h-[44px] w-[44px] flex-shrink-0 flex items-center justify-center rounded-[8px] border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
              )}
              <button
                onClick={handleCapture}
                disabled={!ready}
                className={`flex-1 h-[44px] rounded-[8px] text-white text-sm font-semibold transition-colors ${ready ? 'bg-[#3f4299] hover:bg-[#2d3170]' : 'bg-gray-400 cursor-not-allowed'}`}
              >
                {ready ? '📸 Capture' : 'Starting camera…'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCaptureModal;
