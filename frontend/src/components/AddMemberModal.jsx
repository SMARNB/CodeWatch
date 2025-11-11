import React, { useState, useEffect } from 'react';
import Button from './Button';

const AddMemberModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: '',
    employeeId: '',
    department: '',
    phoneNumber: '',
    profilePicture: null
  });

  const [errors, setErrors] = useState({});
  const [profilePreview, setProfilePreview] = useState(null);
  const [multipleImages, setMultipleImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

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

  // Generate ID prefix based on role
  const getRolePrefix = (role) => {
    const rolePrefixMap = {
      'admin': 'ADM',
      'department-head': 'DHD',
      'ssd': 'SSD',
      'employee': 'EMP',
      'student': 'STU'
    };
    return rolePrefixMap[role] || '';
  };

  // Generate ID based on role
  const generateEmployeeId = (role, existingId = '') => {
    if (!role) return '';
    
    const prefix = getRolePrefix(role);
    if (!prefix) return '';
    
    // If there's an existing ID with the same prefix, keep the number part
    if (existingId && existingId.startsWith(prefix)) {
      const numberPart = existingId.replace(prefix, '');
      return `${prefix}${numberPart}`;
    }
    
    // Generate a new ID with 3-digit number (can be improved with API call to get next available)
    const randomNumber = Math.floor(Math.random() * 999) + 1;
    return `${prefix}${randomNumber.toString().padStart(3, '0')}`;
  };

  // Generate email from ID
  const generateEmailFromId = (employeeId) => {
    if (!employeeId) return '';
    // Generate email in format: id@company.com (you can customize the domain)
    return `${employeeId.toLowerCase()}@company.com`;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'role') {
      // When role changes, generate new ID and email
      const newRole = value;
      const newEmployeeId = generateEmployeeId(newRole);
      const newEmail = generateEmailFromId(newEmployeeId);
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        employeeId: newEmployeeId,
        email: newEmail
      }));
    } else if (name === 'employeeId') {
      // When ID changes manually, update email
      const newEmail = generateEmailFromId(value);
      setFormData(prev => ({
        ...prev,
        [name]: value,
        email: newEmail
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
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

  const handleMultipleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    // Validate all files
    const validFiles = [];
    const invalidFiles = [];
    
    files.forEach(file => {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        invalidFiles.push(`${file.name} is not an image file`);
        return;
      }
      
      // Validate file size (max 5MB per file)
      if (file.size > 5 * 1024 * 1024) {
        invalidFiles.push(`${file.name} is larger than 5MB`);
        return;
      }
      
      validFiles.push(file);
    });
    
    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      setErrors(prev => ({
        ...prev,
        multipleImages: invalidFiles.join(', ')
      }));
    } else {
      // Clear errors
      if (errors.multipleImages) {
        setErrors(prev => ({
          ...prev,
          multipleImages: ''
        }));
      }
    }
    
    // If no valid files, return
    if (validFiles.length === 0) {
      // Reset file input
      const fileInput = document.getElementById('multipleImagesInput');
      if (fileInput) {
        fileInput.value = '';
      }
      return;
    }
    
    // Create previews for valid files using Promise.all for better async handling
    const previewPromises = validFiles.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            file: file,
            preview: reader.result,
            id: Math.random().toString(36).substring(7)
          });
        };
        reader.readAsDataURL(file);
      });
    });
    
    Promise.all(previewPromises).then(newPreviews => {
      setMultipleImages(prev => [...prev, ...validFiles]);
      setImagePreviews(prev => [...prev, ...newPreviews]);
    });
    
    // Reset file input to allow selecting the same files again
    const fileInput = document.getElementById('multipleImagesInput');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const handleRemoveImage = (imageId) => {
    setImagePreviews(prev => {
      const removedPreview = prev.find(img => img.id === imageId);
      if (removedPreview) {
        setMultipleImages(prevImages => 
          prevImages.filter(img => img !== removedPreview.file)
        );
        return prev.filter(img => img.id !== imageId);
      }
      return prev;
    });
  };

  const handleSubmit = () => {
    // Validate form
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Please enter a name';
    }
    if (!formData.role) {
      newErrors.role = 'Please assign a role';
    }
    if (!formData.employeeId.trim()) {
      newErrors.employeeId = 'Please enter an Employee ID';
    }
    // Email is auto-generated, but we can validate it exists
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    }
    if (!formData.department.trim()) {
      newErrors.department = 'Please enter a department';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle form submission here if needed
    // Create FormData for file upload
    const submitData = new FormData();
    submitData.append('name', formData.name);
    submitData.append('email', formData.email);
    submitData.append('role', formData.role);
    submitData.append('employeeId', formData.employeeId);
    submitData.append('department', formData.department);
    submitData.append('phoneNumber', formData.phoneNumber || '');
    if (formData.profilePicture) {
      submitData.append('profilePicture', formData.profilePicture);
    }
    // Append multiple images
    multipleImages.forEach((image, index) => {
      submitData.append('images', image);
    });
    
    console.log('Add Member form data:', {
      name: formData.name,
      email: formData.email,
      role: formData.role,
      employeeId: formData.employeeId,
      department: formData.department,
      phoneNumber: formData.phoneNumber,
      profilePicture: formData.profilePicture ? formData.profilePicture.name : null,
      multipleImages: multipleImages.map(img => img.name),
      imageCount: multipleImages.length
    });
    
    // TODO: Send submitData to your API endpoint
    // Example:
    // try {
    //   const response = await fetch('/api/members', {
    //     method: 'POST',
    //     body: submitData
    //   });
    //   const result = await response.json();
    //   // Handle success
    // } catch (error) {
    //   // Handle error
    // }
    
    // Call onClose to close the modal
    if (onClose) {
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    // Close modal when clicking on backdrop
    if (e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const roles = ['Admin', 'Department Head', 'SSD', 'Employee', 'Student'];

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
            Add Member
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
              {profilePreview ? 'Change Picture' : 'Upload Profile Picture'}
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
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.name 
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

          {/* Email Input (Auto-generated, read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Email <span className="text-gray-500 text-xs">(Auto-generated)</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              readOnly
              className="w-full h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-gray-600 bg-gray-50 outline-none cursor-not-allowed"
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.email}
              </p>
            )}
          </div>

          {/* Assign role Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Assign role
            </label>
            <div className="relative">
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors ${
                  errors.role 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              >
                <option value="">Select role</option>
                {roles.map((role) => {
                  // Map role names to consistent values
                  const roleValue = role === 'Department Head' 
                    ? 'department-head' 
                    : role.toLowerCase();
                  return (
                    <option key={role} value={roleValue}>
                      {role}
                    </option>
                  );
                })}
              </select>
            </div>
            {errors.role && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.role}
              </p>
            )}
          </div>

          {/* Employee ID Input (Auto-generated based on role, but editable) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Employee ID <span className="text-gray-500 text-xs">(Auto-generated)</span>
            </label>
            <input
              type="text"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleInputChange}
              placeholder="ID will be generated based on role"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.employeeId 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.employeeId && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.employeeId}
              </p>
            )}
            {formData.role && (
              <p className="mt-1 text-xs text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Format: {getRolePrefix(formData.role)}XXX (e.g., {getRolePrefix(formData.role)}001)
              </p>
            )}
          </div>

          {/* Department Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Department
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              placeholder="Enter department"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.department 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
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

          {/* Multiple Images Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Upload Images (Optional)
            </label>
            <div className="border-2 border-dashed border-[#bab6b6] rounded-[8px] p-4" style={{ marginBottom: '10px' }}>
              <input
                type="file"
                id="multipleImagesInput"
                accept="image/*"
                multiple
                onChange={handleMultipleImagesChange}
                className="hidden"
              />
              <label
                htmlFor="multipleImagesInput"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-[#3f4299] hover:text-[#2d3170] font-medium" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  Click to upload images or drag and drop
                </span>
                <span className="text-xs text-gray-500 mt-1" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  Multiple images allowed (Max 5MB per image)
                </span>
              </label>
            </div>
            
            {/* Image Previews Grid */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mt-3">
                {imagePreviews.map((imageData) => (
                  <div key={imageData.id} className="relative group">
                    <img
                      src={imageData.preview}
                      alt={`Preview ${imageData.id}`}
                      className="w-full h-24 object-cover rounded-[8px] border border-[#bab6b6]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(imageData.id)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                      {imageData.file.name.length > 10 
                        ? `${imageData.file.name.substring(0, 10)}...` 
                        : imageData.file.name}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {errors.multipleImages && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.multipleImages}
              </p>
            )}
            
            {imagePreviews.length > 0 && (
              <p className="mt-2 text-xs text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {imagePreviews.length} image{imagePreviews.length !== 1 ? 's' : ''} selected
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
            className="min-w-[100px]"
          >
            Add Member
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddMemberModal;

