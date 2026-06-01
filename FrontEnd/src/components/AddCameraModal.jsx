import React, { useState, useEffect } from 'react';
import Button from './Button';

// All cameras are served through MediaMTX; the Camera ID is also the stream path.
const RTSP_BASE = 'rtsp://127.0.0.1:8554';
const buildStreamUrl = (id) => (id.trim() ? `${RTSP_BASE}/${id.trim()}` : '');

const AddCameraModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({ cameraId: '', location: '', streamUrl: '' });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [submitMessage, setSubmitMessage] = useState(null);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'cameraId') {
      setFormData(prev => ({ ...prev, cameraId: value, streamUrl: buildStreamUrl(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async () => {
    const newErrors = {};
    if (!formData.cameraId.trim()) newErrors.cameraId = 'Please enter a Camera ID';
    else if (/\s/.test(formData.cameraId.trim())) newErrors.cameraId = 'Camera ID can’t contain spaces (it’s used as the stream path)';
    if (!formData.location.trim()) newErrors.location = 'Please enter a location';
    if (!formData.streamUrl.trim()) newErrors.streamUrl = 'Stream URL is required';
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
        setSubmitMessage({ success: true, message: 'Camera registered! Push your stream to its path and it’ll go live.' });
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
    if (!formData.streamUrl.trim()) { setTestResult({ success: false, message: 'Enter a Camera ID first.' }); return; }
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
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Camera ID</label>
            <input type="text" name="cameraId" value={formData.cameraId} onChange={handleInputChange} placeholder="e.g. cam5" className={inputClass(errors.cameraId)} style={inputStyle} />
            {errors.cameraId
              ? <p className={errClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{errors.cameraId}</p>
              : <p className={hintClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>This doubles as the MediaMTX stream path you’ll push to.</p>}
          </div>
          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleInputChange} placeholder="e.g. Main Entrance" className={inputClass(errors.location)} style={inputStyle} />
            {errors.location && <p className={errClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{errors.location}</p>}
          </div>
          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Stream URL</label>
            <div className="flex gap-2">
              <input type="text" name="streamUrl" value={formData.streamUrl} onChange={handleInputChange} placeholder="Fills in automatically from the Camera ID"
                className={`flex-1 ${inputClass(errors.streamUrl)}`} style={inputStyle} />
              <button type="button" onClick={handleTestConnection} disabled={isTestingConnection}
                className={`h-[48px] px-4 bg-gray-100 border border-[#bab6b6] text-gray-700 font-medium rounded-[8px] hover:bg-gray-200 transition-colors whitespace-nowrap ${isTestingConnection ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {errors.streamUrl
              ? <p className={errClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>{errors.streamUrl}</p>
              : <p className={hintClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Auto-filled from the ID. Only edit it for an external camera with its own RTSP URL.</p>}
            {testResult && <p className={`mt-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>{testResult.message}</p>}
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
