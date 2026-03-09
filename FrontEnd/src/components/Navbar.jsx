import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import UserAvatar from './UserAvatar';
import AddMemberModal from './AddMemberModal';
import AddCameraModal from './AddCameraModal';
import SendReportModal from './SendReportModal';

// Wrapper component for NavLink that uses isActive for both styling and indicator
const NavLinkWithIndicator = ({ to, onClick, children }) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `relative px-3 py-2 text-base font-normal transition-colors duration-200 ${
          isActive
            ? 'text-[#3f4299]'
            : 'text-black hover:text-[#3f4299]'
        }`
      }
      style={{ fontFamily: "'Open Sans', sans-serif", fontVariationSettings: "'wdth' 100" }}
    >
      {({ isActive }) => (
        <>
          {children}
          {/* Active indicator bar - positioned approximately 100px below the link text */}
          {isActive && (
            <div className="absolute top-[50px] left-0 right-0 h-1 bg-[#3f4299]"></div>
          )}
        </>
      )}
    </NavLink>
  );
};

const Navbar = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [username, setUsername] = useState('username');
  const [userDisplayName, setUserDisplayName] = useState(null);
  const [userAvatarUrl, setUserAvatarUrl] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [showSendReportModal, setShowSendReportModal] = useState(false);
  const [userType, setUserType] = useState('admin');

  // Fetch user data from localStorage (set during login)
  useEffect(() => {
    const getUserData = () => {
      // Retrieve userType
      const storedUserType = localStorage.getItem('userType') || 'admin';
      setUserType(storedUserType);
      
      // Retrieve username/email (primary display name)
      const storedUsername = localStorage.getItem('userName') || 
                            localStorage.getItem('userEmail') || 
                            localStorage.getItem('username') ||
                            localStorage.getItem('user_email') ||
                            'username';
      
      // Retrieve user's full name or display name for avatar initials
      const storedDisplayName = localStorage.getItem('userFullName') ||
                                localStorage.getItem('userDisplayName') ||
                                localStorage.getItem('displayName') ||
                                localStorage.getItem('fullName') ||
                                storedUsername;
      
      // Retrieve avatar URL if available
      const storedAvatarUrl = localStorage.getItem('userAvatar') ||
                              localStorage.getItem('userAvatarUrl') ||
                              localStorage.getItem('avatarUrl') ||
                              localStorage.getItem('avatar') ||
                              null;

      // Set state with retrieved data
      setUsername(storedUsername);
      setUserDisplayName(storedDisplayName);
      setUserAvatarUrl(storedAvatarUrl);
    };

    // Initial fetch
    getUserData();

    // Listen for storage changes (in case user data is updated in another tab/window)
    const handleStorageChange = (e) => {
      const userDataKeys = [
        'userType',
        'userName', 'userEmail', 'username', 'user_email',
        'userFullName', 'userDisplayName', 'displayName', 'fullName',
        'userAvatar', 'userAvatarUrl', 'avatarUrl', 'avatar'
      ];
      
      if (userDataKeys.includes(e.key)) {
        getUserData();
      }
    };

    // Also listen for custom storage events (for same-tab updates)
    const handleCustomStorage = () => {
      getUserData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userDataUpdated', handleCustomStorage);
    
    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataUpdated', handleCustomStorage);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLinkClick = (linkName, e) => {
    setIsMobileMenuOpen(false);
    
    // Prevent navigation for modal links
    if (linkName === 'Add User') {
      e?.preventDefault();
      setShowAddMemberModal(true);
      return;
    }
    
    if (linkName === 'Add Camera') {
      e?.preventDefault();
      setShowAddCameraModal(true);
      return;
    }
    
    if (linkName === 'Send Report') {
      e?.preventDefault();
      setShowSendReportModal(true);
      return;
    }
    
    // Handle logout
    if (linkName === 'Log out') {
      e?.preventDefault();
      // Clear all user-related data from localStorage
      localStorage.removeItem('userType');
      localStorage.removeItem('userEmail');
      localStorage.removeItem('userName');
      localStorage.removeItem('username');
      localStorage.removeItem('user_email');
      localStorage.removeItem('userFullName');
      localStorage.removeItem('userDisplayName');
      localStorage.removeItem('displayName');
      localStorage.removeItem('fullName');
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('userAvatarUrl');
      localStorage.removeItem('avatarUrl');
      localStorage.removeItem('avatar');
      
      // Reset component state
      setUsername('username');
      setUserDisplayName(null);
      setUserAvatarUrl(null);
      
      navigate('/');
    }
  };

  const handleLogout = () => {
    // Clear all user-related data from localStorage
    localStorage.removeItem('userType');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('username');
    localStorage.removeItem('user_email');
    localStorage.removeItem('userFullName');
    localStorage.removeItem('userDisplayName');
    localStorage.removeItem('displayName');
    localStorage.removeItem('fullName');
    localStorage.removeItem('userAvatar');
    localStorage.removeItem('userAvatarUrl');
    localStorage.removeItem('avatarUrl');
    localStorage.removeItem('avatar');
    
    // Reset component state
    setUsername('username');
    setUserDisplayName(null);
    setUserAvatarUrl(null);
    
    navigate('/');
  };

  // Get current userType from localStorage (for immediate access) or state
  const currentUserType = userType || localStorage.getItem('userType') || 'admin';

  // Get dashboard path based on userType
  const getDashboardPath = () => {
    if (currentUserType === 'admin') {
      return '/admin/dashboard';
    } else if (currentUserType === 'department-head') {
      return '/department-head/dashboard';
    } else if (currentUserType === 'ssd') {
      return '/ssd/dashboard';
    }
    return '/admin/dashboard';
  };

  // Default navigation links if none provided
  const defaultLinks = [
    { name: 'Dashboard', path: getDashboardPath() },
    { name: 'Add User', path: '/add-user' },
    { name: 'Add Camera', path: '/add-camera' },
    { name: 'Generate Analytics', path: '/analytics' },
    { name: 'Send Report', path: '/send-report' },
    { name: 'Previous Reports', path: '/reports' },
    { name: 'Log out', path: '/' }
  ];

  // Filter out "Add User" and "Add Camera" for Department Head users
  const navigationLinks = defaultLinks.filter(link => {
    if (currentUserType === 'department-head') {
      return link.name !== 'Add User' && link.name !== 'Add Camera';
    }
    return true;
  });

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-[0px_0px_6px_4px_rgba(151,151,151,0.12)]">
      <div className="w-full mx-auto" style={{ paddingLeft: '150px', paddingRight: '150px' }}>
        <div className="flex justify-between items-center h-20">
          
          {/* Left Section: Logo */}
          <div className="flex items-center flex-shrink-0">
            <Logo 
              size="default" 
              showText={false}
              className=""
            />
          </div>

          {/* Right Section: Navigation Links + NotificationBell + UserAvatar + Username (Grouped) */}
          <div className="flex items-center gap-8 mr-[5%] flex-shrink-0">
            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              {navigationLinks.map((link, index) => {
                // For modal links, use a button instead of NavLink
                if (link.name === 'Add User' || link.name === 'Add Camera' || link.name === 'Send Report') {
                  return (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        handleLinkClick(link.name, e);
                      }}
                      className="relative px-3 py-2 text-base font-normal transition-colors duration-200 text-black hover:text-[#3f4299]"
                      style={{ fontFamily: "'Open Sans', sans-serif", fontVariationSettings: "'wdth' 100" }}
                    >
                      {link.name}
                    </button>
                  );
                }
                return (
                  <NavLinkWithIndicator
                    key={index}
                    to={link.path}
                    onClick={(e) => handleLinkClick(link.name, e)}
                  >
                    {link.name}
                  </NavLinkWithIndicator>
                );
              })}
            </div>

            {/* Notification Bell Component */}
            <NotificationBell 
              notifications={[]}
              onNotificationClick={() => {
                // Determine the correct notifications route based on userType
                const notificationsRoute = currentUserType === 'admin' ? '/admin/notifications' :
                                         currentUserType === 'ssd' ? '/ssd/notifications' :
                                         '/department-head/notifications';
                // Open notifications page in a new tab
                window.open(notificationsRoute, '_blank');
              }}
            />

            {/* User Avatar Component */}
            <UserAvatar 
              username={userDisplayName || username}
              avatarUrl={userAvatarUrl}
              size="md"
              showDropdown={true}
              onLogout={handleLogout}
              onProfileClick={() => {
                // Navigate to profile page if needed
                console.log('Profile clicked');
              }}
              onSettingsClick={() => {
                // Navigate to settings page if needed
                console.log('Settings clicked');
              }}
            />

            {/* Username Display - Show email address or display name */}
            <span 
              className="hidden sm:block text-base font-normal text-black whitespace-pre"
              style={{ fontFamily: "'Open Sans', sans-serif", fontVariationSettings: "'wdth' 100" }}
            >
              {username || userDisplayName || 'username'}
            </span>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#3f4299]"
              aria-label="Toggle mobile menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              {navigationLinks.map((link, index) => {
                // For modal links, use a button instead of NavLink
                if (link.name === 'Add User' || link.name === 'Add Camera' || link.name === 'Send Report') {
                  return (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        handleLinkClick(link.name, e);
                      }}
                      className="block w-full text-left px-3 py-2 text-base font-medium rounded-md transition-colors duration-200 text-gray-700 hover:text-[#3f4299] hover:bg-gray-50"
                    >
                      {link.name}
                    </button>
                  );
                }
                return (
                  <NavLink
                    key={index}
                    to={link.path}
                    onClick={(e) => handleLinkClick(link.name, e)}
                    className={({ isActive }) =>
                      `block px-3 py-2 text-base font-medium rounded-md transition-colors duration-200 ${
                        isActive
                          ? 'text-[#3f4299] bg-blue-50'
                          : 'text-gray-700 hover:text-[#3f4299] hover:bg-gray-50'
                      }`
                    }
                  >
                    {link.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddMemberModal && (
        <AddMemberModal onClose={() => setShowAddMemberModal(false)} />
      )}
      {showAddCameraModal && (
        <AddCameraModal onClose={() => setShowAddCameraModal(false)} />
      )}
      {showSendReportModal && (
        <SendReportModal onClose={() => setShowSendReportModal(false)} />
      )}
    </nav>
  );
};

export default Navbar;