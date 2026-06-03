import React, { useState } from 'react';

const EditCameraModal = ({ camera, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: camera.name || '',
    location: camera.location || '',
    ip_address: camera.ip_address || '',
    status: camera.status || '',
    stream_url: camera.stream_url || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cameras/${camera.camera_id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSave();
        onClose();
      } else {
        const errorData = await response.json();
        alert("❌ Error: " + (errorData.message || "Failed to update camera"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Network Error: Is the Backend running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statuses = ['Active', 'Inactive', 'Maintenance'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div
        className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
          <div className="flex-1"></div>
          <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center whitespace-nowrap" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            Edit Camera ({camera.camera_id})
          </h2>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        <div className="space-y-5 overflow-y-auto flex-1" style={{ padding: '10px' }}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>IP Address</label>
            <input type="text" name="ip_address" value={formData.ip_address} onChange={handleInputChange} className="w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>Status</label>
            <select name="status" value={formData.status} onChange={handleInputChange} className="w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}>
              <option value="">Select Status</option>
              {statuses.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>Stream URL</label>
            <input type="text" name="stream_url" value={formData.stream_url} onChange={handleInputChange} className="w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }} />
          </div>
        </div>
        <div className="bg-white flex justify-end" style={{ padding: '10px' }}>
          <button onClick={handleSubmit} disabled={isSubmitting} className={`h-[48px] w-[190px] px-[10px] bg-[#3f4299] text-white text-[16px] font-bold rounded-[8px] hover:bg-[#2d3170] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCameraModal;
