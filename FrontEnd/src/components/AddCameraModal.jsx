import React, { useState, useEffect } from 'react';
import Button from './Button';

// MediaMTX relay base — used for the "Phone (Larix)" source, where the Camera ID is the stream path.
const RTSP_BASE = 'rtsp://127.0.0.1:8554';
const buildStreamUrl = (id) => (id.trim() ? `${RTSP_BASE}/${id.trim()}` : '');

const SOURCE_OPTIONS = [
  { value: 'phone', label: 'Phone (Larix → MediaMTX)' },
  { value: 'webcam', label: 'Webcam (this PC)' },
  { value: 'ipcam', label: 'IP Camera / NVR (RTSP)' },
];

const AddCameraModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ source: 'phone', cameraId: '', location: '', streamUrl: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [submitMessage, setSubmitMessage] = useState(null);
  const [serverIp, setServerIp] = useState('127.0.0.1');

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Auto-detect this machine's current LAN IP so we can show the exact Larix push address.
  useEffect(() => {
    fetch('/api/server-ip/')
      .then(r => r.json())
      .then(d => { if (d && d.ip) setServerIp(d.ip); })
      .catch(() => {});
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'source') {
      // Switching source resets the URL: phone derives it from the ID; webcam/ipcam are entered by hand.
      setFormData(prev => ({
        ...prev,
        source: value,
        streamUrl: value === 'phone' ? buildStreamUrl(prev.cameraId) : '',
      }));
      setTestResult(null);
      setErrors(prev => ({ ...prev, streamUrl: '' }));
    } else if (name === 'cameraId') {
      setFormData(prev => ({
        ...prev,
        cameraId: value,
        // Only the phone/MediaMTX source builds the URL from the Camera ID.
        streamUrl: prev.source === 'phone' ? buildStreamUrl(value) : prev.streamUrl,
      }));
      if (errors.cameraId) setErrors(prev => ({ ...prev, cameraId: '' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!formData.cameraId.trim()) newErrors.cameraId = 'Please enter a Camera ID';
    else if (/\s/.test(formData.cameraId.trim())) newErrors.cameraId = 'Camera ID can’t contain spaces (it’s used as an internal key)';
    if (!formData.location.trim()) newErrors.location = 'Please enter a location';
    if (!formData.streamUrl.trim()) {
      newErrors.streamUrl =
        formData.source === 'webcam' ? 'Enter the webcam device index (e.g. 0)'
        : formData.source === 'ipcam' ? 'Paste the camera/NVR RTSP URL'
        : 'Stream URL is required';
    } else if (formData.source === 'webcam' && !/^\d+$/.test(formData.streamUrl.trim())) {
      newErrors.streamUrl = 'A webcam index must be a whole number (e.g. 0, 1, 2)';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setIsSubmitting(true);
    setSubmitMessage(null);
    const submitPayload = {
      camera_id: formData.cameraId.trim(),
      location: formData.location.trim(),
      name: formData.location.trim(),
      stream_url: formData.streamUrl.trim(),
      status: 'Active',
      ip_address: '',
    };
    try {
      const response = await fetch('/api/add-camera/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        const okMsg =
          formData.source === 'phone' ? 'Camera registered! Push your Larix stream to its path and it’ll go live.'
          : formData.source === 'webcam' ? 'Camera registered! It’ll go live when the detection system runs.'
          : 'Camera registered! It’ll connect when the detection system runs.';
        setSubmitMessage({ success: true, message: okMsg });
        if (onSuccess) onSuccess();
        setTimeout(() => { if (onClose) onClose(); }, 1200);
      } else {
        setSubmitMessage({ success: false, message: data.message || 'Failed to add camera. Make sure the Camera ID is unique.' });
      }
    } catch (error) {
      console.error('Error:', error);
      setSubmitMessage({ success: false, message: 'Network error — is the backend running?' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.streamUrl.trim()) {
      setTestResult({ success: false, message: formData.source === 'webcam' ? 'Enter a device index first.' : 'Enter the stream URL first.' });
      return;
    }
    setIsTestingConnection(true);
    setTestResult(null);
    try {
      const response = await fetch('/api/test-camera-stream/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stream_url: formData.streamUrl }),
      });
      const data = await response.json().catch(() => ({}));
      setTestResult({ success: !!data.success, message: data.message || (data.success ? 'Connection successful!' : 'Connection failed.') });
    } catch (error) {
      setTestResult({ success: false, message: 'Could not reach the server to run the test.' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleBackdropClick = (e) => { if (e.target === e.currentTarget && onClose) onClose(); };
  const inputClass = (hasError) => `w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${hasError ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'}`;
  const inputStyle = { fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' };
  const labelClass = "block text-sm font-medium text-gray-700 mb-2";
  const errClass = "mt-1 text-sm text-red-600";
  const hintClass = "text-xs text-gray-500";

  const isPhone = formData.source === 'phone';
  const isWebcam = formData.source === 'webcam';
  const isIpcam = formData.source === 'ipcam';

  const cameraIdHint = isPhone
    ? 'This doubles as the MediaMTX stream path you’ll push to.'
    : 'A unique name for this camera (used internally, e.g. cam5).';
  const streamLabel = isWebcam ? 'Device Index' : 'Stream URL';
  const streamPlaceholder = isWebcam
    ? 'e.g. 0 (built-in webcam)'
    : isIpcam
    ? 'rtsp://user:pass@192.168.1.64:554/Streaming/Channels/101'
    : 'Fills in automatically from the Camera ID';
  const streamHint = isWebcam
    ? 'The OpenCV device index of a camera plugged into the machine running detection.'
    : isIpcam
    ? 'Paste the camera/NVR’s own RTSP URL. Test it in VLC first — if VLC plays it, this will too.'
    : 'Auto-filled from the Camera ID. Push your Larix stream to this path.';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={handleBackdropClick}>
      <div className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
          <div className="flex-1"></div>
          <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>Add Camera</h2>
          <div className="flex-1 flex justify-end">
            <button onClick={onClose} aria-label="Close" title="Close"
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="space-y-5 overflow-y-auto flex-1" style={{ padding: '10px' }}>
          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Source</label>
            <select name="source" value={formData.source} onChange={handleInputChange}
              className={inputClass(false)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className={hintClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>
              {isPhone ? 'For phones pushing via Larix to your local MediaMTX server.'
                : isWebcam ? 'For a USB/built-in webcam on the detection machine.'
                : 'For an IP camera or NVR you connect to directly over RTSP.'}
            </p>
          </div>
          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Camera ID</label>
            <input type="text" name="cameraId" value={formData.cameraId} onChange={handleInputChange} placeholder="e.g. cam5" className={inputClass(errors.cameraId)} style={inputStyle} />
            {errors.cameraId
              ? <p className={errClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{errors.cameraId}</p>
              : <p className={hintClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{cameraIdHint}</p>}
          </div>
          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="e.g. Main Entrance" className={inputClass(errors.location)} style={inputStyle} />
            {errors.location && <p className={errClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{errors.location}</p>}
          </div>
          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{streamLabel}</label>
            <div className="flex gap-2">
              <input type="text" name="streamUrl" value={formData.streamUrl} onChange={handleInputChange} placeholder={streamPlaceholder}
                className={`flex-1 ${inputClass(errors.streamUrl)}`} style={inputStyle} />
              <button type="button" onClick={handleTestConnection} disabled={isTestingConnection}
                className={`h-[48px] px-4 bg-gray-100 border border-[#bab6b6] text-gray-700 font-medium rounded-[8px] hover:bg-gray-200 transition-colors whitespace-nowrap ${isTestingConnection ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {errors.streamUrl
              ? <p className={errClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{errors.streamUrl}</p>
              : <p className={hintClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{streamHint}</p>}
            {testResult && <p className={`mt-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>{testResult.message}</p>}
            {isPhone && (
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-[8px] p-3" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                <p className="text-xs text-[#3f4299]">📱 In Larix on your phone, set the connection URL to:</p>
                <p className="text-[13px] font-semibold text-[#3f4299] break-all mt-1 select-all">
                  rtsp://{serverIp}:8554/{formData.cameraId.trim() || '<camera-id>'}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">
                  Auto-detected from this machine. If your IP/network changes, reopen this dialog for the new address — the saved camera URL stays on 127.0.0.1 and never needs editing.
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="bg-white flex flex-col gap-2" style={{ padding: '10px' }}>
          {submitMessage && (
            <p className={`text-sm text-right ${submitMessage.success ? 'text-green-600' : 'text-red-600'}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>{submitMessage.message}</p>
          )}
          <div className="flex justify-end">
            <Button variant="primary" size="default" onClick={handleSubmit} disabled={isSubmitting} className={`min-w-[100px] ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {isSubmitting ? 'Saving...' : 'Add Camera'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCameraModal;
