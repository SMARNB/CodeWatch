import React, { useState } from 'react';

const UserAvatar = ({
  username = 'User',
  avatarUrl,
  size = 'md',
  showDropdown = true,
  onLogout,
  onChangePassword,
  className = '',
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };
  const getInitials = (name) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  const toggleDropdown = () => setIsDropdownOpen(!isDropdownOpen);
  const handleLogout = () => {
    setIsDropdownOpen(false);
    if (onLogout) onLogout();
  };
  const handleChangePassword = () => {
    setIsDropdownOpen(false);
    if (onChangePassword) onChangePassword();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Avatar Button */}
      <button
        onClick={showDropdown ? toggleDropdown : undefined}
        className={`${sizeClasses[size]} rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all hover:ring-2 hover:ring-gray-300`}
        aria-label="User menu"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
            {getInitials(username)}
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {showDropdown && isDropdownOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
          {/* Dropdown Panel */}
          <div 
            className="absolute left-1/2 -translate-x-1/2 mt-3 w-[280px] bg-white rounded-[8px] z-50 py-2 flex flex-col"
            style={{
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              fontFamily: "'Open Sans', sans-serif"
            }}
          >
            {/* User Info */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 text-center rounded-t-[8px]">
              <p className="text-[16px] font-bold text-[#3f4299] truncate">{username}</p>
            </div>
            {/* Change Password */}
            <div className="py-2">
              <button
                onClick={handleChangePassword}
                className="w-full px-6 py-[17px] text-[16px] font-bold text-gray-700 hover:bg-gray-50 focus:bg-gray-50 flex items-center justify-center space-x-4 transition-colors outline-none"
              >
                <svg className="w-[20px] h-[20px] text-[#3f4299]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span>Change Password</span>
              </button>
            </div>
            {/* Logout */}
            <div className="border-t border-gray-100 py-2">
              <button
                onClick={handleLogout}
                className="w-full px-6 py-[17px] text-[16px] font-bold text-red-600 hover:bg-red-50 focus:bg-red-50 flex items-center justify-center space-x-4 transition-colors outline-none rounded-b-[8px]"
              >
                <svg className="w-[20px] h-[20px] text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Log out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UserAvatar;