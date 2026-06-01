import React, { useState, useEffect } from 'react';
import Button from './Button';

const AddVisitorModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    phoneNumber: '',
    department: '',
    host: '',
    purpose: '',
    profilePicture: null,
  });

  const [errors, setErrors] = useState({});
  const [profilePreview, setProfilePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hostQuery, setHostQuery] = useState('');
  const [hostResults, setHostResults] = useState([]);
  const [hostSelected, setHostSelected] = useState(null);
  const [showHostDropdown, setShowHostDropdown] = useState(false);
  const [isSearchingHost, setIsSearchingHost] = useState(false);

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

  useEffect(() => {
    if (!hostQuery || hostSelected) return;
    const timer = setTimeout(async () => {
      setIsSearchingHost(true);
      try {
        const res = await fetch('http://localhost:8000/api/people-db/');
        const data = await res.json();
        const filtered = data.filter(p => {
          const role = p.role?.toLowerCase();
          return (role === 'employee' || role === 'student' || role === 'department-head') &&
                 p.name.toLowerCase().includes(hostQuery.toLowerCase());
        });
        setHostResults(filtered);
        setShowHostDropdown(true);
      } catch (err) {
        console.error('Host search failed:', err);
      } finally {
        setIsSearchingHost(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [hostQuery, hostSelected]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({
          ...prev,
          profilePicture: 'Please select an image file'
        }));
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({
          ...prev,
          profilePicture: 'Image size should be less than 5MB'
        }));
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result);
      };
      reader.readAsDataURL(file);

      setFormData(prev => ({
        ...prev,
        profilePicture: file
      }));

      // Clear error
      if (errors.profilePicture) {
        setErrors(prev => ({
          ...prev,
          profilePicture: ''
        }));
      }
    }
  };

  const handleRemoveProfilePicture = () => {
    setFormData(prev => ({
      ...prev,
      profilePicture: null
    }));
    setProfilePreview(null);
    // Reset file input
    const fileInput = document.getElementById('profilePictureInput');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleSubmit = async () => {
    // Validate form
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Please enter a name';
    if (!hostSelected) newErrors.host = 'Please select a valid host from the list';
    if (!formData.purpose.trim()) newErrors.purpose = 'Please enter purpose';
    if (!formData.department.trim()) newErrors.department = 'Please select a department';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Create FormData for file upload
    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('host_name', formData.host);
    submitData.append('purpose', formData.purpose);
    submitData.append('host_department', formData.department);
    submitData.append('phone', formData.phoneNumber || '');
    
    // Add hidden role field
    submitData.append('role', 'visitor');

    if (formData.profilePicture) {
      submitData.append('profile_picture', formData.profilePicture);
    }

    try {
      setIsSubmitting(true);

      // 1. Send data to Django Backend
      const response = await fetch('/api/visitors/add/', {
        method: 'POST',
        body: submitData,
      });

      // 2. Handle Response
      if (response.ok) {
        alert("✅ Visitor Added Successfully!");
        if (onClose) onClose();
      } else {
        const errorData = await response.json();
        alert("❌ Error: " + (errorData.message || "Failed to add visitor"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Network Error: Is the Backend Server running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    // Close modal when clicking on backdrop
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

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
            Add Visitor
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
          
          {/* Profile Picture Upload */}
          <div className="flex flex-col items-center">
            <div className="relative">
              {profilePreview ? (
                <div className="relative">
                  <img
                    src={profilePreview}
                    alt="Profile preview"
                    className="w-24 h-24 rounded-full object-cover border-2 border-[#bab6b6]"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveProfilePicture}
                    className="absolute top-0 right-0 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    aria-label="Remove profile picture"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-[#bab6b6] flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            <label
              htmlFor="profilePictureInput"
              className="mt-2 cursor-pointer text-sm text-[#3f4299] hover:text-[#2d3170] font-medium"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              {profilePreview ? 'Change Picture' : 'Upload Profile Picture (Face Image)'}
            </label>
            <input
              type="file"
              id="profilePictureInput"
              accept="image/*"
              onChange={handleProfilePictureChange}
              className="hidden"
            />
            {errors.profilePicture && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.profilePicture}
              </p>
            )}
          </div>

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter name"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${errors.name
                ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.name}
              </p>
            )}
          </div>

          {/* Host Name Input */}
          {/* Host Name Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Host Name
            </label>
            
            {hostSelected ? (
              // Locked selected state
              <div className={`flex items-center justify-between w-full h-[48px] border rounded-[8px] px-3 bg-gray-50 ${errors.host ? 'border-red-500' : 'border-[#3f4299]'}`} style={{ marginBottom: '10px' }}>
                <span className="text-sm text-black" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  {hostSelected.name}
                  <span className="ml-2 text-xs text-gray-400 capitalize">
                    {hostSelected.role} • {hostSelected.department || 'N/A'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setHostSelected(null);
                    setHostQuery('');
                    setFormData(prev => ({ ...prev, host: '' }));
                  }}
                  className="text-gray-400 hover:text-red-500 ml-2"
                >✕</button>
              </div>
            ) : (
              // Search input
              <input
                type="text"
                value={hostQuery}
                onChange={(e) => {
                  setHostQuery(e.target.value);
                  if (errors.host) setErrors(prev => ({ ...prev, host: '' }));
                }}
                placeholder="Search employee or student..."
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black px-3 focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299] outline-none transition-colors placeholder:text-[#bab6b6] ${errors.host ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-[#bab6b6]'}`}
                style={{ fontFamily: "'Open Sans', sans-serif", marginBottom: '10px' }}
              />
            )}

            {/* Dropdown results */}
            {showHostDropdown && hostResults.length > 0 && !hostSelected && (
              <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-[8px] shadow-lg max-h-48 overflow-y-auto" style={{ top: '100%', marginTop: '-8px' }}>
                {hostResults.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      setHostSelected(person);
                      setFormData(prev => ({ ...prev, host: person.name }));
                      setShowHostDropdown(false);
                      setHostQuery('');
                      if (errors.host) setErrors(prev => ({ ...prev, host: '' }));
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  >
                    <span className="font-medium text-black">{person.name}</span>
                    <span className="ml-2 text-xs text-gray-400 capitalize">
                      {person.role} • {person.department || 'N/A'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {showHostDropdown && hostResults.length === 0 && hostQuery.length > 1 && !isSearchingHost && !hostSelected && (
              <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-[8px] shadow px-4 py-3 text-sm text-gray-400" style={{ top: '100%', marginTop: '-8px' }}>
                No matching employee or student found.
              </div>
            )}

            {errors.host && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.host}
              </p>
            )}
          </div>

          {/* Purpose of Visit Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Purpose of Visit
            </label>
            <input
              type="text"
              name="purpose"
              value={formData.purpose}
              onChange={handleInputChange}
              placeholder="Enter purpose of visit"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${errors.purpose
                ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.purpose && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.purpose}
              </p>
            )}
          </div>

          {/* Department Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Department
            </label>
            <div className="relative">
              <select
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors ${errors.department
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                  }`}
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              >
                <option value="" disabled>Select Department</option>
                {['RSCI', 'Law', 'Engineering', 'Business', 'Arts', 'DPT', 'Pharm-D'].map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            {errors.department && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.department}
              </p>
            )}
          </div>

          {/* Phone Number Input (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleInputChange}
              placeholder="Enter phone number"
              className="w-full h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-white flex justify-end" style={{ padding: '10px' }}>
          <Button
            variant="primary"
            size="default"
            onClick={handleSubmit}
            loading={isSubmitting} // Use existing prop for spinner
            disabled={isSubmitting}
            className={`min-w-[100px] ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Saving...' : 'Add Visitor'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddVisitorModal;
