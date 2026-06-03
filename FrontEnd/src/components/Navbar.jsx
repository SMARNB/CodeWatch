import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import UserAvatar from './UserAvatar';
import AddMemberModal from './AddMemberModal';
import AddCameraModal from './AddCameraModal';
import AddVisitorModal from './AddVisitorModal';

// Custom hook for debouncing
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedValue(value); }, delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

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
  const [showAddVisitor, setShowAddVisitor] = useState(false);
  const [userType, setUserType] = useState('admin');
  const [notifications, setNotifications] = useState([]);
  const [toastMessage, setToastMessage] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      const fetchSearch = async () => {
        try {
          const res = await fetch(`/api/search/?q=${encodeURIComponent(debouncedSearch)}`);
          if (res.ok) {
            setSearchResults(await res.json());
            setIsSearchOpen(true);
          }
        } catch (e) { console.error("Search failed", e); }
      };
      fetchSearch();
    } else {
      setSearchResults(null);
      setIsSearchOpen(false);
    }
  }, [debouncedSearch]);

  // Fetch user data from localStorage (set during login)
  useEffect(() => {
    const getUserData = () => {
      // Retrieve userType
      const storedUserType = localStorage.getItem('userType');
      if (!storedUserType) {
        navigate('/login', { replace: true });
        return;
      }
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
    
    const fetchNotifications = async () => {
      try {
        const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
        const role = encodeURIComponent(localStorage.getItem('userType') || '');
        const response = await fetch(`/api/notifications/?user=${userKey}&role=${role}`);
        if (response.ok) {
          const data = await response.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    
    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataUpdated', handleCustomStorage);
      clearInterval(interval);
    };
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLinkClick = (linkName, e) => {
    setIsMobileMenuOpen(false);
    

    
    // Handle logout
    if (linkName === 'Log out') {
      e?.preventDefault();
      handleLogout();
    }
  };

  const handleLogout = () => {
    // Clear ALL localStorage
    localStorage.clear();
    
    // Reset component state
    setUsername('username');
    setUserDisplayName(null);
    setUserAvatarUrl(null);
    
    setToastMessage('Logged out');
    setTimeout(() => {
      navigate('/login');
    }, 1000);
  };

  // Get current userType from localStorage (for immediate access) or state
  const currentUserType = userType || localStorage.getItem('userType') || 'admin';

  const getDashboardPath = () => {
    if (currentUserType === 'admin') {
      return '/admin/dashboard';
    } else if (currentUserType === 'department-head') {
      return '/department-head/dashboard';
    } else if (currentUserType === 'ssd') {
      return '/ssd/dashboard';
    } else if (currentUserType === 'guard') {
      return '/guard/dashboard';
    }
    return '/admin/dashboard';
  };

  // Default navigation links
  const defaultLinks = [
    { name: 'Dashboard', path: getDashboardPath(), roles: ['admin', 'ssd', 'department-head', 'guard'] },
    { name: 'Notifications', path: `/${currentUserType}/notifications`, roles: ['ssd', 'department-head'] },

    { name: 'Manage Cameras', path: '/admin/manage-cameras', roles: ['admin'] },
    { name: 'Manage People', path: '/admin/manage-people', roles: ['admin'] },
    { name: 'Manage Users', path: '/admin/manage-users', roles: ['admin'] },
    { name: 'Manage Violations', path: '/admin/manage-violations', roles: ['admin', 'ssd'] },
    { name: 'Manage Blacklist', path: '/admin/manage-blacklist', roles: ['admin'] },
    { name: 'Generate Analytics', path: '/analytics', roles: ['admin'] },
    { name: 'Previous Reports', path: '/reports', roles: ['admin', 'ssd', 'department-head'] },
    { name: 'Add Visitor', path: '/guard/add-visitor', roles: ['guard'] },
    { name: 'Active Visitors', path: '/guard/visitors', roles: ['guard'] }
  ];

  // Filter links based on user type
  const navigationLinks = defaultLinks.filter(link => link.roles.includes(currentUserType));

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

          {/* Center Section: Title */}
          <div className="flex-1 flex justify-center">
            <h1 className="text-2xl font-bold text-[#3f4299] text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>Code Watch</h1>
          </div>

          {/* Right Section: Navigation Links + NotificationBell + UserAvatar + Username (Grouped) */}
          <div className="flex items-center gap-8 mr-[5%] flex-shrink-0">

            {/* Global Search - visible only to admin and ssd */}
            {(currentUserType === 'admin' || currentUserType === 'ssd') && (
              <div className="relative" ref={searchRef}>
                <div className="relative flex items-center">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search people, cameras..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { if(searchResults) setIsSearchOpen(true); }}
                    className="w-64 pl-9 pr-4 py-[7px] text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-transparent focus:bg-white transition-all"
                    style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '32px' }}
                  />
                </div>

                {isSearchOpen && searchResults && (
                  <div
                    className="absolute top-11 left-0 w-[300px] bg-white border border-gray-200 rounded-[8px] z-50 max-h-96 overflow-y-auto"
                    style={{ boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', fontFamily: "'Open Sans', sans-serif" }}
                  >
                    {/* People Results */}
                    {searchResults.people && searchResults.people.length > 0 && (
                      <div className="border-b border-gray-100">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest" style={{ padding: '10px 10px 4px 10px', fontFamily: "'Open Sans', sans-serif" }}>People</h4>
                        {searchResults.people.map(person => (
                          <div
                            key={person.id}
                            className="flex items-center border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                            style={{ padding: '10px' }}
                            onClick={() => { setIsSearchOpen(false); navigate(`/live-track/${person.id}`); }}
                          >
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="text-[14px] font-semibold text-gray-900 truncate" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.name}</div>
                              <div className="text-[12px] text-gray-500 mt-0.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.employee_id} • {person.department}</div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setIsSearchOpen(false); navigate(`/live-track/${person.id}`); }}
                              className="flex-shrink-0 py-1 mr-1 bg-[#3f4299] text-white text-[11px] font-semibold rounded-full hover:bg-[#2d3170] transition-colors whitespace-nowrap"
                              style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '14px', paddingRight: '14px' }}
                            >Live Track</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Cameras Results */}
                    {searchResults.cameras && searchResults.cameras.length > 0 && (
                      <div className="border-b border-gray-100">
                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest" style={{ padding: '10px 10px 4px 10px', fontFamily: "'Open Sans', sans-serif" }}>Cameras</h4>
                        {searchResults.cameras.map(cam => (
                          <div
                            key={cam.id}
                            className="flex items-center border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                            style={{ padding: '10px' }}
                            onClick={() => { setIsSearchOpen(false); navigate(getDashboardPath()); }}
                          >
                            <div className="flex-1 min-w-0 mr-3">
                              <div className="text-[14px] font-semibold text-gray-900 truncate" style={{ fontFamily: "'Open Sans', sans-serif" }}>{cam.name}</div>
                              <div className="text-[12px] text-gray-500 mt-0.5" style={{ fontFamily: "'Open Sans', sans-serif" }}>{cam.location}</div>
                            </div>
                            <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${cam.status === 'Active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          </div>
                        ))}
                      </div>
                    )}
                    {(!searchResults.people?.length && !searchResults.cameras?.length) && (
                      <div className="text-[13px] text-gray-500 text-center" style={{ padding: '20px 10px', fontFamily: "'Open Sans', sans-serif" }}>No results found.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Desktop Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              {navigationLinks.map((link, index) => {
                // For modal links, use a button instead of NavLink
                if (link.name === 'Send Report' || link.name === 'Add Visitor') {
                  return (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        if (link.name === 'Add Visitor') {
                          setShowAddVisitor(true);
                        } else {
                          handleLinkClick(link.name, e);
                        }
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

            {/* Notification Bell Component (Hidden for Guard) */}
            {currentUserType !== 'guard' && (
              <NotificationBell 
                notifications={notifications}
                onNotificationClick={async (notification) => {
                  if (!notification.is_read) {
                    try {
                      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
                      await fetch(`/api/notifications/read/${notification.id}/?user=${userKey}`, { method: 'POST' });
                      setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n));
                    } catch (err) {
                      console.error('Failed to mark read', err);
                    }
                  }
                  navigate(`/notification-details?id=${notification.id}`);
                }}
              />
            )}

            {/* User Avatar Component (dropdown: Change Password + Log out) */}
            <UserAvatar 
              username={userDisplayName || username}
              avatarUrl={userAvatarUrl}
              size="md"
              showDropdown={true}
              onLogout={handleLogout}
              onChangePassword={() => navigate('/reset-password?mode=change')}
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
                if (link.name === 'Send Report' || link.name === 'Add Visitor') {
                  return (
                    <button
                      key={index}
                      onClick={(e) => {
                        e.preventDefault();
                        if (link.name === 'Add Visitor') {
                          setIsMobileMenuOpen(false);
                          setShowAddVisitor(true);
                        } else {
                          handleLinkClick(link.name, e);
                        }
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
      {showAddVisitor && (
        <AddVisitorModal onClose={() => setShowAddVisitor(false)} />
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-up">
          {toastMessage}
        </div>
      )}
    </nav>
  );
};

export default Navbar;