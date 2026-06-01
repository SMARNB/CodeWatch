import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const AddVisitorPage = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    purpose: 'Meeting',
    host_name: '',
    host_department: 'Computer Science',
    expected_duration_hours: 1
  });
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setIsCameraOpen(false);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    setPhoto(null);
    setPhotoPreview(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Could not access the camera. Please use file upload instead.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
      }, 'image/jpeg');
      
      stopCamera();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('phone', formData.phone);
    submitData.append('purpose', formData.purpose);
    submitData.append('host_name', formData.host_name);
    submitData.append('host_department', formData.host_department);
    submitData.append('expected_duration_hours', formData.expected_duration_hours);
    
    if (photo) {
      submitData.append('profile_picture', photo);
    }

    try {
      const response = await fetch('http://localhost:8000/api/visitors/add/', {
        method: 'POST',
        body: submitData
      });
      
      if (response.ok) {
        alert('Visitor registered successfully!');
        navigate('/guard/dashboard');
      } else {
        const errData = await response.json();
        alert(`Error: ${errData.message || 'Failed to register visitor'}`);
      }
    } catch (error) {
      console.error("Submit error:", error);
      alert("An error occurred while submitting.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-[#3f4299]">Register New Visitor</h1>
          <button 
            onClick={() => navigate('/guard/dashboard')}
            className="text-gray-600 hover:text-[#3f4299] font-medium transition-colors"
          >
            &larr; Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 mb-2">Full Name *</label>
                  <input 
                    type="text" 
                    name="name" 
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                    placeholder="Enter visitor's full name"
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  />
                </div>
                
                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 mb-2">Phone Number *</label>
                  <input 
                    type="text" 
                    name="phone" 
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    className="w-full h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                    placeholder="e.g. 0300-1234567"
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 mb-2">Purpose of Visit *</label>
                  <select 
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleInputChange}
                    className="w-full h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  >
                    <option value="Meeting">Meeting</option>
                    <option value="Delivery">Delivery</option>
                    <option value="Interview">Interview</option>
                    <option value="Campus Tour">Campus Tour</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 mb-2">Expected Duration *</label>
                  <select 
                    name="expected_duration_hours"
                    value={formData.expected_duration_hours}
                    onChange={handleInputChange}
                    className="w-full h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  >
                    <option value={1}>1 hour</option>
                    <option value={2}>2 hours</option>
                    <option value={3}>3 hours</option>
                    <option value={4}>4 hours</option>
                    <option value={8}>Full Day (8 hours)</option>
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 mb-2">Host Name *</label>
                  <input 
                    type="text" 
                    name="host_name" 
                    value={formData.host_name}
                    onChange={handleInputChange}
                    required
                    className="w-full h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                    placeholder="Who are they visiting?"
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 mb-2">Host Department *</label>
                  <select 
                    name="host_department"
                    value={formData.host_department}
                    onChange={handleInputChange}
                    className="w-full h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  >
                    <option value="Computer Science">Computer Science</option>
                    <option value="Electrical Engineering">Electrical Engineering</option>
                    <option value="BBA">BBA</option>
                    <option value="Law">Law</option>
                    <option value="Admin">Admin</option>
                    <option value="Physics">Physics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[14px] font-semibold text-gray-700 mb-2">Visitor Photo (Optional for embedding)</label>
                  
                  {!isCameraOpen && !photoPreview && (
                    <div className="flex gap-4">
                      <button type="button" onClick={startCamera} className="flex-1 h-[48px] border border-[#3f4299] text-[#3f4299] rounded-[8px] text-[14px] font-medium hover:bg-[#3f4299] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2">
                        &#128247; Open Camera
                      </button>
                      <label className="flex-1 h-[48px] border border-[#3f4299] text-[#3f4299] rounded-[8px] text-[14px] font-medium hover:bg-[#3f4299] hover:text-white transition-colors focus:outline-none flex items-center justify-center cursor-pointer">
                        &#128193; Upload File
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                      </label>
                    </div>
                  )}

                  {isCameraOpen && (
                    <div className="relative border-2 border-dashed border-gray-300 rounded-[8px] overflow-hidden bg-black">
                      <video ref={videoRef} autoPlay playsInline className="w-full object-cover"></video>
                      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                        <button type="button" onClick={capturePhoto} className="h-[40px] px-6 bg-[#3f4299] text-white rounded-[8px] text-[14px] font-medium hover:bg-[#2d3170] shadow-sm">
                          Capture
                        </button>
                        <button type="button" onClick={stopCamera} className="h-[40px] px-6 bg-red-600 text-white rounded-[8px] text-[14px] font-medium hover:bg-red-700 shadow-sm">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {photoPreview && !isCameraOpen && (
                    <div className="relative border-2 border-gray-200 rounded-lg p-2 bg-gray-50 text-center">
                      <img src={photoPreview} alt="Preview" className="mx-auto max-h-48 object-contain rounded" />
                      <button type="button" onClick={() => { setPhoto(null); setPhotoPreview(null); }} className="mt-4 text-red-600 font-medium hover:underline">
                        Remove Photo
                      </button>
                    </div>
                  )}
                  
                  <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200 mt-8">
              <button 
                type="submit" 
                disabled={loading}
                className={`w-full h-[48px] rounded-[8px] text-[14px] font-medium transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 ${loading ? 'bg-[#7a7cbd] text-white cursor-not-allowed' : 'bg-[#3f4299] text-white hover:bg-[#2d3170]'}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                {loading ? 'Registering Visitor...' : 'Register Visitor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddVisitorPage;
