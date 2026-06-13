import React, { useState, useEffect } from 'react';
import Button from './Button';
import ConfirmModal from './ConfirmModal';

const SendReportModal = ({ onClose, violationData, attachedReports, getClientPdf, showReportPicker = true, initialSubject, initialMessage, notificationIds, violationIds }) => {
  const [formData, setFormData] = useState({
    reportType: '',
    recipients: '',
    subject: '',
    message: '',
    priority: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState({ message: '', isSuccess: false });
  const [availableReports, setAvailableReports] = useState([]);
  const [selectedReportIds, setSelectedReportIds] = useState([]);

  // Load saved reports so the user can attach one or more to this email.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/get-reports/')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : (data.reports || []);
        setAvailableReports(list);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Pre-select any report(s) passed in from a detail page.
  useEffect(() => {
    if (attachedReports && attachedReports.length > 0) {
      setSelectedReportIds(attachedReports.map((r) => r.id).filter((x) => x != null));
    }
  }, [attachedReports]);
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });


  useEffect(() => {
    if (initialSubject || initialMessage) {
      setFormData(prev => ({
        ...prev,
        ...(initialSubject ? { subject: initialSubject } : {}),
        ...(initialMessage ? { message: initialMessage } : {}),
      }));
    } else if (violationData) {
      setFormData(prev => ({
        ...prev,
        subject: `Violation Alert: ${violationData.type} - ${violationData.personName}`,
        message: `Incident Details:\nTime: ${new Date().toLocaleString()}\nCamera: ${violationData.camera || 'Unknown'}\nType: ${violationData.type}`
      }));
    }
  }, [violationData, initialSubject, initialMessage]);

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

  const handleSubmit =  async () => {
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

    setIsSubmitting(true);

    // 1. Prepare Payload
    // If a Details page provided a live PDF capture, generate it now.
    let clientPdf = null;
    if (typeof getClientPdf === 'function') {
      try {
        clientPdf = await getClientPdf();
      } catch (e) {
        console.error('Client PDF capture failed', e);
      }
    }
    const payload = {
        ...formData,
        // Link to the person in the DB if we know who it is
        personId: violationData ? violationData.personId : null,
        attached_report_ids: selectedReportIds,
        notification_ids: notificationIds || [],
        violation_ids: violationIds || [],
        client_pdf: clientPdf,
        app_base_url: window.location.origin,
        user: localStorage.getItem('userEmail') || ''
    };

    try {
      // 2. Send to Backend
      const response = await fetch('/api/send-report/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // 3. Handle Result
      let result = {};
      try { result = await response.json(); } catch (e) { /* ignore */ }
      if (response.ok && result.email_sent) {
        setSubmitStatus({ message: "✅ Report saved and emailed to the recipients.", isSuccess: true });
        setTimeout(() => { if (onClose) onClose(); }, 2000);
      } else if (response.ok) {
        setSubmitStatus({ message: "⚠️ Report saved, but email could not be sent.", isSuccess: false });
        setTimeout(() => { if (onClose) onClose(); }, 3000);
      } else {
        setSubmitStatus({ message: "❌ Failed to save the report.", isSuccess: false });
      }
    } catch (error) {
      console.error(error);
      setSubmitStatus({ message: "❌ Network Error: Is the Backend running?", isSuccess: false });
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

  const reportTypes = ['Daily', 'Weekly', 'Monthly', 'Incident', 'Security', 'Performance'];
  const priorities = ['Low', 'Medium', 'High', 'Urgent'];

  return (
    <>
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

          {/* Attach Reports — only the generic Send Report (Previous Reports page) */}
          {showReportPicker && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Attach report(s) <span className="text-gray-400 font-normal">— optional</span>
            </label>
            <div className="border border-[#bab6b6] rounded-[8px] max-h-[150px] overflow-y-auto" style={{ marginBottom: '10px' }}>
              {availableReports.length === 0 ? (
                (attachedReports && attachedReports.length > 0) ? (
                  <div className="flex flex-wrap gap-2" style={{ padding: '10px' }}>
                    {attachedReports.map((r) => (
                      <span key={r.id} className="inline-flex items-center px-2 py-1 rounded-full bg-indigo-50 text-[#3f4299] text-xs font-semibold border border-indigo-100">
                        {r.label || `#${r.id}`}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400" style={{ padding: '12px' }}>No saved reports available to attach.</p>
                )
              ) : (
                availableReports.map((rep) => {
                  const rid = rep.id;
                  const checked = selectedReportIds.includes(rid);
                  return (
                    <label key={rid} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0" style={{ padding: '8px 12px' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setSelectedReportIds((prev) =>
                            e.target.checked ? [...prev, rid] : prev.filter((x) => x !== rid)
                          )
                        }
                        className="mt-0.5 w-4 h-4 accent-[#3f4299]"
                      />
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[#3f4299]">{rep.custom_id || rep.displayId || `#${rid}`}</span>
                        <span className="block text-xs text-gray-500 truncate">{rep.description || rep.subject || rep.type || 'Report'}</span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            {selectedReportIds.length > 0 && (
              <p className="text-xs text-gray-500" style={{ marginBottom: '10px' }}>
                {selectedReportIds.length} report{selectedReportIds.length > 1 ? 's' : ''} will be linked in the email.
              </p>
            )}
          </div>
          )}

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
        <div className="bg-white flex justify-between items-center border-t border-gray-100" style={{ padding: '10px 15px' }}>
          
          {/* Inline Status Message */}
          <div className="flex-1 pr-4">
            {submitStatus.message && (
              <span 
                className={`text-sm font-semibold ${submitStatus.isSuccess ? 'text-green-600' : 'text-red-600'}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                {submitStatus.message}
              </span>
            )}
          </div>

          {/* Send Button */}
          <Button
            variant="primary"
            size="default"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`min-w-[100px] ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Sending...' : 'Send Report'}
          </Button>
        </div>
      </div>
    </div>

      <ConfirmModal
        isOpen={alertData.isOpen}
        onClose={() => setAlertData(s => ({ ...s, isOpen: false }))}
        onConfirm={() => setAlertData(s => ({ ...s, isOpen: false }))}
        title="Alert"
        message={alertData.message}
        confirmText="OK"
        hideCancel={true}
      />
    </>
  );
};

export default SendReportModal;

