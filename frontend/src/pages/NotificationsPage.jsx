import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationItem from '../components/NotificationItem';
import UserProfileCard from '../components/UserProfileCard';
import Button from '../components/Button';
import Logo from '../components/Logo';

const NotificationsPage = ({ userType = 'admin' }) => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Dummy user data for UserProfileCard
  const dummyUser = {
    name: userType === 'admin' ? 'Admin User' : 
          userType === 'ssd' ? 'SSD User' : 'Department Head User',
    email: userType === 'admin' ? 'admin@company.com' : 
           userType === 'ssd' ? 'ssd@company.com' : 'depthead@company.com',
    employeeId: userType === 'admin' ? 'ADM001' : 
                userType === 'ssd' ? 'SSD001' : 'DHD001'
  };

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
    // Navigate to feedback modal or page
    navigate('/feedback', { state: { userType } });
  };

  const handleLogoutClick = () => {
    // Clear user data and navigate to login
    localStorage.removeItem('userType');
    localStorage.removeItem('userEmail');
    navigate('/login');
  };

  const handleNotificationClick = (notification) => {
    // Navigate to notification details page
    navigate('/notification-details', { 
      state: { 
        notification, 
        userType 
      } 
    });
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src="http://localhost:3845/assets/69bd5562076a8da41563ffca97f57699d1b0caeb.svg" />
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
                <UserProfileCard user={dummyUser} />
              </div>
              
              {/* Buttons below UserProfileCard */}
              <div className="mt-6 space-y-4">
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
    </div>
  );
};

export default NotificationsPage;