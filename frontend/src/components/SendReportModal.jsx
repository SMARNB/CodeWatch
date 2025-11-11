import React, { useState, useEffect } from 'react';
import Button from './Button';

const SendReportModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    reportType: '',
    recipients: '',
    subject: '',
    message: '',
    priority: ''
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

  const handleSubmit = () => {
    // Validate form
    const newErrors = {};
    if (!formData.reportType) {
      newErrors.reportType = 'Please select a report type';
    }
    if (!formData.recipients.trim()) {
      newErrors.recipients = 'Please enter recipients';
    }
    if (!formData.subject.trim()) {
      newErrors.subject = 'Please enter a subject';
    }
    if (!formData.message.trim()) {
      newErrors.message = 'Please enter a message';
    }
    if (!formData.priority) {
      newErrors.priority = 'Please select a priority';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Handle form submission here if needed
    console.log('Send Report form data:', formData);
    
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

  const reportTypes = ['Daily', 'Weekly', 'Monthly', 'Incident', 'Security', 'Performance'];
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

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
            Send Report
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
          {/* Report Type Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Report Type
            </label>
            <div className="relative">
              <select
                name="reportType"
                value={formData.reportType}
                onChange={handleInputChange}
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors ${
                  errors.reportType 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              >
                <option value="">Select Report Type</option>
                {reportTypes.map((type) => (
                  <option key={type} value={type.toLowerCase()}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            {errors.reportType && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.reportType}
              </p>
            )}
          </div>

          {/* Recipients Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Recipients
            </label>
            <input
              type="text"
              name="recipients"
              value={formData.recipients}
              onChange={handleInputChange}
              placeholder="Enter recipients (comma-separated emails)"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.recipients 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.recipients && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.recipients}
              </p>
            )}
          </div>

          {/* Subject Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Subject
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleInputChange}
              placeholder="Enter subject"
              className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] ${
                errors.subject 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
            />
            {errors.subject && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.subject}
              </p>
            )}
          </div>

          {/* Priority Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Priority
            </label>
            <div className="relative">
              <select
                name="priority"
                value={formData.priority}
                onChange={handleInputChange}
                className={`w-full h-[48px] border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors ${
                  errors.priority 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                    : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px', marginBottom: '10px' }}
              >
                <option value="">Select Priority</option>
                {priorities.map((priority) => (
                  <option key={priority} value={priority.toLowerCase()}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            {errors.priority && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.priority}
              </p>
            )}
          </div>

          {/* Message Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Message
            </label>
            <textarea
              name="message"
              value={formData.message}
              onChange={handleInputChange}
              rows={4}
              placeholder="Enter your message..."
              className={`w-full border rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors resize-none placeholder:text-[#bab6b6] ${
                errors.message 
                  ? 'border-red-500 focus:ring-2 focus:ring-red-500 focus:border-red-500' 
                  : 'border-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", minHeight: '96px', padding: '10px', marginBottom: '10px' }}
            />
            {errors.message && (
              <p className="mt-1 text-sm text-red-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {errors.message}
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
            Send Report
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SendReportModal;

