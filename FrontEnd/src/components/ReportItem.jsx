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
      className="bg-white rounded-[8px] shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={handleItemClick}
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
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-700 truncate" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {description}
              </p>
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
            <div className="absolute right-0 mt-2 w-32 bg-white rounded-[8px] shadow-lg border border-gray-200 z-50">
              <div className="py-1">
                <button
                  onClick={handleUpdate}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-t-[8px]"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Update
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors rounded-b-[8px]"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportItem;

