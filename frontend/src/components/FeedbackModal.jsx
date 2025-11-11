import React, { useState, useEffect } from 'react';
import Button from './Button';

const FeedbackModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    violationId: '',
    userType: '',
    userId: '',
    thoughts: '',
    sendRequest: false
  });

  const [errors, setErrors] = useState({});

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
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleDone = () => {
    // Validate form if needed
    const newErrors = {};
    if (!formData.violationId) {
      newErrors.violationId = 'Please select a Violation ID';
    }
    if (!formData.userType) {
      newErrors.userType = 'Please select a User Type';
    }
    if (!formData.userId) {
      newErrors.userId = 'Please enter a User-ID';
    }
    if (!formData.thoughts.trim()) {
      newErrors.thoughts = 'Please share your thoughts';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle form submission here if needed
    console.log('Feedback form data:', formData);
    
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

  // Mock violation IDs - replace with actual data source
  const violationIds = [
    'VIOL-001',
    'VIOL-002',
    'VIOL-003',
    'VIOL-004',
    'VIOL-005'
  ];

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
            Feedback
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
          {/* Violation ID Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Violation ID
            </label>
            <div className="relative">
              <select
                name="violationId"
                value={formData.violationId}
                onChange={handleInputChange}
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors ${
                  errors.violationId 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              >
                <option value="">Select Violation ID</option>
                {violationIds.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </div>
            {errors.violationId && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.violationId}
              </p>
            )}
          </div>

          {/* User Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              User Type
            </label>
            <div className="relative">
              <select
                name="userType"
                value={formData.userType}
                onChange={handleInputChange}
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors ${
                  errors.userType 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              >
                <option value="">Select User Type</option>
                <option value="employee">Employee</option>
                <option value="student">Student</option>
              </select>
            </div>
            {errors.userType && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.userType}
              </p>
            )}
          </div>

          {/* User-ID Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              User-ID
            </label>
            <input
              type="text"
              name="userId"
              value={formData.userId}
              onChange={handleInputChange}
              placeholder="Enter User-ID"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.userId 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.userId && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.userId}
              </p>
            )}
          </div>

          {/* Share Your Thoughts Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Share Your Thoughts
            </label>
            <textarea
              name="thoughts"
              value={formData.thoughts}
              onChange={handleInputChange}
              rows={4}
              placeholder="Enter your thoughts here..."
              className={`w-full border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors resize-none placeholder:text-[#bab6b6] ${
                errors.thoughts 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", minHeight: '96px', padding: '10px', marginBottom: '10px' }}
            />
            {errors.thoughts && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.thoughts}
              </p>
            )}
          </div>

          {/* Send Request Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="sendRequest"
              id="sendRequest"
              checked={formData.sendRequest}
              onChange={handleInputChange}
              className="w-4 h-4 text-[#3f4299] border-[#bab6b6] rounded focus:ring-[#3f4299] focus:ring-2 cursor-pointer"
            />
            <label 
              htmlFor="sendRequest" 
              className="ml-2 text-sm font-medium text-gray-700 cursor-pointer"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              Send Request
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-white flex justify-end" style={{ padding: '10px' }}>
          <Button
            variant="primary"
            size="default"
            onClick={handleDone}
            className="min-w-[100px]"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
