import React from 'react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false, hideCancel = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div
        className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Header */}
        <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
          <div className="flex-1"></div>
          <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center whitespace-nowrap" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            {title}
          </h2>
          <div className="flex-1 flex justify-end">
            {hideCancel && (
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: '20px 10px' }}>
          <p className="text-sm text-gray-600 mb-6" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            {message}
          </p>
        </div>

        {/* Footer */}
        <div className="bg-white flex justify-center gap-4" style={{ padding: '10px' }}>
          {!hideCancel && (
            <button
              onClick={onClose}
              className="h-[48px] px-[10px] w-[200px] text-gray-600 border border-gray-300 text-[16px] font-bold rounded-[8px] hover:bg-gray-50 transition-colors focus:outline-none"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`h-[48px] px-[10px] w-[200px] text-white text-[16px] font-bold rounded-[8px] transition-colors focus:outline-none ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#3f4299] hover:bg-[#2d3170]'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
