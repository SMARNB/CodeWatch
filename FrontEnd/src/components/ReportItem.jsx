import React, { useState, useRef, useEffect } from 'react';

const ReportItem = ({ reportId, description, onUpdate, onDelete, onClick, report }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleKebabClick = (e) => {
    e.stopPropagation();
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleUpdate = (e) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    if (onUpdate) {
      onUpdate(reportId);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    if (onDelete) {
      onDelete(reportId);
    }
  };

  const handleItemClick = (e) => {
    // Don't trigger click if clicking on the kebab menu or dropdown
    if (dropdownRef.current && dropdownRef.current.contains(e.target)) {
      return;
    }
    if (onClick) {
      onClick(reportId, report);
    }
  };

  return (
    <div 
      className="bg-white rounded-[8px] shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleItemClick}
      style={{ padding: '16px', paddingLeft: '12px' }}
    >
      <div className="flex items-center justify-between">
        {/* Left side - Report Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <span className="text-sm font-semibold text-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {reportId}
              </span>
            </div>
            {report.snapshot_url && (
              <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-gray-200" style={{ marginTop: '1px', marginBottom: '1px' }}>
                <img src={report.snapshot_url} alt="Violation Snapshot" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0 flex items-center gap-3">
              <p className="text-sm text-gray-700 truncate" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {description}
              </p>
              {report.movement_summary && report.movement_summary.length > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium shrink-0">
                  1 Violator
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side - Kebab Menu */}
        <div className="flex-shrink-0 relative" ref={dropdownRef}>
          <button
            onClick={handleKebabClick}
            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
            aria-label="More options"
            title="More options"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white rounded-[8px] z-50 overflow-hidden flex flex-col border border-gray-200"
              style={{
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
            >
              <button
                onClick={handleUpdate}
                className="w-full h-[48px] flex items-center text-left text-[14px] text-gray-700 hover:bg-gray-50 hover:text-[#3f4299] transition-colors border-b border-gray-100"
                style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '16px', paddingRight: '16px' }}
              >
                Update
              </button>
              <button
                onClick={handleDelete}
                className="w-full h-[48px] flex items-center text-left text-[14px] text-red-600 hover:bg-red-50 transition-colors"
                style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '16px', paddingRight: '16px' }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportItem;

