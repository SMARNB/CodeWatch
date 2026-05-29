import React, { useState, useEffect } from 'react';
import Button from './Button';

const AddCameraModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    cameraName: '',
    cameraId: '',
    location: '',
    ipAddress: '',
    status: '',
    streamUrl: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    // Add event listener for ESC key
    document.addEventListener('keydown', handleEscape);

    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleSubmit = async () => {
    // Validate form
    const newErrors = {};
    if (!formData.cameraName.trim()) {
      newErrors.cameraName = 'Please enter a camera name';
    }
    if (!formData.cameraId.trim()) {
      newErrors.cameraId = 'Please enter a Camera ID';
    }
    if (!formData.location.trim()) {
      newErrors.location = 'Please enter a location';
    }
    if (!formData.ipAddress.trim()) {
      newErrors.ipAddress = 'Please enter an IP Address';
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.ipAddress)) {
      newErrors.ipAddress = 'Please enter a valid IP Address';
    }
    if (!formData.status) {
      newErrors.status = 'Please select a status';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

   setIsSubmitting(true);

    // 1. Prepare Data (Map React names to Django names)
    const submitPayload = {
        name: formData.cameraName,      // React: cameraName -> Django: name
        camera_id: formData.cameraId,   // React: cameraId -> Django: camera_id
        location: formData.location,
        ip_address: formData.ipAddress, // React: ipAddress -> Django: ip_address
        status: formData.status,
        stream_url: formData.streamUrl || '' // React: streamUrl -> Django: stream_url
    };

    try {
      // 2. Send to Backend
      const response = await fetch('/api/add-camera/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitPayload),
      });

      // 3. Handle Result
      if (response.ok) {
        alert("✅ Camera Added Successfully!");
        if (onClose) onClose();
      } else {
        const errorData = await response.json();
        alert("❌ Error: " + (errorData.message || "Failed to add camera"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Network Error: Is the Backend running?");
    } finally {
      setIsSubmitting(false);
    }
    // Call onClose to close the modal
    if (onClose) {
      onClose();
    }
  };

  const handleTestConnection = () => {
    if (!formData.streamUrl.trim()) {
      setTestResult({ success: false, message: 'Please enter a Stream URL first.' });
      return;
    }

    setIsTestingConnection(true);
    setTestResult(null);

    // Simulate backend connection test
    setTimeout(() => {
      setIsTestingConnection(false);
      // For demonstration, we assume success if it starts with rtsp:// or http
      const isLikelyValid = formData.streamUrl.startsWith('rtsp://') || formData.streamUrl.startsWith('http');
      if (isLikelyValid) {
        setTestResult({ success: true, message: 'Connection successful!' });
      } else {
        setTestResult({ success: false, message: 'Connection failed. Ensure URL is correct.' });
      }
    }, 1500);
  };

  const handleBackdropClick = (e) => {
    // Close modal when clicking on backdrop
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const statuses = ['Active', 'Inactive', 'Maintenance'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10"
      onClick={handleBackdropClick}
    >
      {/* Modal Content */}
      <div
        className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Header with Close Button */}
        <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
          <div className="flex-1"></div>
          <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            Add Camera
          </h2>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
              aria-label="Close"
              title="Close"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="space-y-5 overflow-y-auto flex-1" style={{ padding: '10px' }}>
          {/* Camera Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Camera Name
            </label>
            <input
              type="text"
              name="cameraName"
              value={formData.cameraName}
              onChange={handleInputChange}
              placeholder="Enter camera name"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.cameraName 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.cameraName && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.cameraName}
              </p>
            )}
          </div>

          {/* Camera ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Camera ID
            </label>
            <input
              type="text"
              name="cameraId"
              value={formData.cameraId}
              onChange={handleInputChange}
              placeholder="Enter Camera ID"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.cameraId 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.cameraId && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.cameraId}
              </p>
            )}
          </div>

          {/* Location Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              placeholder="Enter location"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.location 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.location}
              </p>
            )}
          </div>

          {/* IP Address Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              IP Address
            </label>
            <input
              type="text"
              name="ipAddress"
              value={formData.ipAddress}
              onChange={handleInputChange}
              placeholder="Enter IP Address"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.ipAddress 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.ipAddress && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.ipAddress}
              </p>
            )}
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Status
            </label>
            <div className="relative">
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors ${
                  errors.status 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              >
                <option value="">Select Status</option>
                {statuses.map((status) => (
                  <option key={status} value={status.toLowerCase()}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.status}
              </p>
            )}
          </div>

          {/* Stream URL Input (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Stream URL (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                name="streamUrl"
                value={formData.streamUrl}
                onChange={handleInputChange}
                placeholder="Enter stream URL"
                className="flex-1 h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className={`h-[48px] px-4 bg-gray-100 border border-[#bab6b6] text-gray-700 font-medium rounded-[8px] hover:bg-gray-200 transition-colors whitespace-nowrap ${isTestingConnection ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                {isTestingConnection ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            {testResult && (
              <p className={`mt-1 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {testResult.message}
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white flex justify-end" style={{ padding: '10px' }}>
          <Button
            variant="primary"
            size="default"
            onClick={handleSubmit}
            disabled={isSubmitting} // <--- Add this
            className={`min-w-[100px] ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Saving...' : 'Add Camera'} {/* <--- Change text */}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddCameraModal;

