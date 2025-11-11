import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationItem from '../components/NotificationItem';
import UserProfileCard from '../components/UserProfileCard';
import Button from '../components/Button';
import Logo from '../components/Logo';
import FeedbackModal from '../components/FeedbackModal';
import backgroundEllipse from '../assets/background.svg';

const NotificationsPage = ({ userType: propUserType }) => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Get userType from prop or localStorage
  const userType = propUserType || localStorage.getItem('userType') || 'admin';

  // Get user data from localStorage
  useEffect(() => {
    const getUserData = () => {
      // Retrieve user email
      const userEmail = localStorage.getItem('userEmail') || 
                       localStorage.getItem('userName') || 
                       localStorage.getItem('username') || 
                       '';
      
      // Retrieve user display name
      const userDisplayName = localStorage.getItem('userDisplayName') || 
                              localStorage.getItem('userFullName') ||
                              localStorage.getItem('displayName') ||
                              localStorage.getItem('fullName') ||
                              userEmail.split('@')[0] ||
                              'User';
      
      // Retrieve employee ID if available, or generate a simple default
      const employeeId = localStorage.getItem('employeeId') || 
                        localStorage.getItem('employeeID') ||
                        (() => {
                          const prefix = userType === 'admin' ? 'ADM' : 
                                        userType === 'ssd' ? 'SSD' : 'DHD';
                          // Simple fallback - use first 3 chars of email or default
                          if (userEmail) {
                            const emailPart = userEmail.split('@')[0];
                            const numbers = emailPart.match(/\d/g);
                            if (numbers && numbers.length > 0) {
                              return `${prefix}${numbers.slice(-3).join('').padStart(3, '0')}`;
                            }
                          }
                          return `${prefix}001`;
                        })();

      // Create user object
      const userData = {
        name: userDisplayName,
        email: userEmail || (userType === 'admin' ? 'admin@company.com' : 
                             userType === 'ssd' ? 'ssd@company.com' : 'depthead@company.com'),
        employeeId: employeeId,
      };

      setUser(userData);
    };

    // Initial fetch
    getUserData();

    // Listen for storage changes
    const handleStorageChange = (e) => {
      const userDataKeys = [
        'userName', 'userEmail', 'username', 'user_email',
        'userFullName', 'userDisplayName', 'displayName', 'fullName',
        'employeeId', 'employeeID'
      ];
      
      if (userDataKeys.includes(e.key)) {
        getUserData();
      }
    };

    // Listen for custom storage events
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
  }, [userType]);

  // Get dynamic heading based on userType
  const getPageHeading = () => {
    const headings = {
      admin: 'Admin Notifications',
      ssd: 'SSD Notifications',
      'department-head': 'Department Head Notifications'
    };
    return headings[userType] || 'Notifications';
  };

  // Dummy notifications data with color-coded statuses
  const dummyNotifications = [
    {
      message: "Security violation detected at Camera 1",
      status: "Red",
      details: "Unauthorized access attempt detected in restricted area",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      type: "security"
    },
    {
      message: "System maintenance completed successfully",
      status: "Green",
      details: "All security systems updated and operational",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      type: "system"
    },
    {
      message: "Camera 3 offline - Network issues",
      status: "Yellow",
      details: "Network connectivity problems detected, investigating",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
      type: "camera"
    },
    {
      message: "New user account created",
      status: "Blue",
      details: "Department Head account registered successfully",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
      type: "user"
    },
    {
      message: "Daily backup completed",
      status: "Green",
      details: "All data backed up successfully to secure servers",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
      type: "system"
    },
    {
      message: "Multiple failed login attempts",
      status: "Red",
      details: "Suspicious activity detected from unknown IP address",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
      type: "security"
    }
  ];


  // Filter notifications based on selected filter and search term
  const filteredNotifications = dummyNotifications.filter(notification => {
    const matchesFilter = selectedFilter === 'all' || 
      notification.status?.toLowerCase() === selectedFilter.toLowerCase();
    const matchesSearch = !searchTerm || 
      notification.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.details?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // Navigation handlers
  const handleFeedbackClick = () => {
    // Open feedback modal
    setShowFeedbackModal(true);
  };

  const handleLogoutClick = () => {
    // Clear user data and navigate to login
    localStorage.removeItem('userType');
    localStorage.removeItem('userEmail');
    navigate('/login');
  };

  const handleNotificationClick = (notification) => {
    // Store notification data in sessionStorage for the new tab
    const notificationKey = `notification_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(notificationKey, JSON.stringify({
      notification,
      userType
    }));
    
    // Open notification details page in a new tab
    const url = `/notification-details?key=${encodeURIComponent(notificationKey)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Navbar */}
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            {/* Logo - Left */}
            <div className="flex items-center" style={{ marginLeft: '20px' }}>
              <Logo size="default" showText={false} />
            </div>
            
            {/* Code Watch - Center */}
            <div className="flex-1 flex justify-center">
              <h1 className="text-2xl font-bold text-[#3f4299] text-center">
                Code Watch
              </h1>
            </div>
            
            {/* Right side - Empty for balance */}
            <div className="w-16"></div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Screen Layout */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px' }}>
        <div className="flex w-full">
          {/* Left Column - Notifications */}
          <div className="flex-1">
            {/* Notifications Heading */}
            <h2 className="text-3xl font-bold text-[#3f4299] mb-5" style={{ marginBottom: '50px' }}>
              Notifications
            </h2>
            
            {filteredNotifications.map((notification, index) => (
              <div key={index} className="mb-5" style={{ marginBottom: '20px' }}>
                <NotificationItem 
                  notification={notification} 
                  onClick={() => handleNotificationClick(notification)}
                />
              </div>
            ))}
          </div>

          {/* Right Column - User Profile Card and Buttons */}
          <div className="w-80 flex-shrink-0" style={{ marginRight: '100px', marginLeft: '100px' }}>
            <div style={{ marginTop: '0px' }}>
              <div style={{ marginBottom: '20px' }}>
                {user && <UserProfileCard user={user} />}
              </div>
              
              {/* Buttons below UserProfileCard */}
              <div className="mt-6 space-y-4">
                {/* Manage Violations Button - Only for Admin */}
                {userType === 'admin' && (
                  <div style={{ marginBottom: '20px' }}>
                    <Button
                      variant="primary"
                      size="default"
                      className="w-full"
                      onClick={() => {
                        // Navigate to manage violations page or open modal
                        navigate('/admin/manage-violations');
                      }}
                    >
                      Manage Violations
                    </Button>
                  </div>
                )}
                
                {/* Violation Feedback Button */}
                <div style={{ marginBottom: '20px' }}>
                  <Button
                    variant="primary"
                    size="default"
                    className="w-full"
                    onClick={handleFeedbackClick}
                  >
                    Violation Feedback
                  </Button>
                </div>
                
                {/* Logout Button */}
                <div style={{ marginBottom: '20px' }}>
                  <Button
                    variant="secondary"
                    size="default"
                    className="w-full"
                    onClick={handleLogoutClick}
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}
    </div>
  );
};

export default NotificationsPage;