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
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get userType from prop or localStorage
  const userType = propUserType || localStorage.getItem('userType') || 'admin';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/');
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map(n => ({
          ...n,
          // Mapping backend 'type' to your frontend color 'status'
          status: n.type === 'security' ? 'Red' :
            n.type === 'system' ? 'Green' :
              n.type === 'backup' ? 'Blue' : 'Yellow',
          timestamp: new Date(n.time)
        }));
        setNotifications(mappedData);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Set User Data
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    const userDisplayName = localStorage.getItem('userDisplayName') || 'User';
    setUser({ name: userDisplayName, email: userEmail, employeeId: 'ADM001' });

    // 2. Load Notifications from Database
    fetchNotifications();
  }, []);

  // Get dynamic heading based on userType
  const getPageHeading = () => {
    const headings = {
      admin: 'Admin Notifications',
      ssd: 'SSD Notifications',
      'department-head': 'Department Head Notifications'
    };
    return headings[userType] || 'Notifications';
  };

  // Filter notifications based on selected filter and search term
  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = selectedFilter === 'all' ||
      notification.status?.toLowerCase() === selectedFilter.toLowerCase();
    const matchesSearch = !searchTerm ||
      notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message?.toLowerCase().includes(searchTerm.toLowerCase());
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
    const url = `/notification-details?id=${notification.id}`;
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

            {/* Notifications List with Loading State */}
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="w-12 h-12 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="bg-white rounded-lg p-10 text-center border border-dashed border-gray-300">
                <p className="text-gray-500">No notifications found.</p>
              </div>
            ) : (
              filteredNotifications.map((notification, index) => (
                <div key={notification.id || index} className="mb-5">
                  <NotificationItem
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                </div>
              ))
            )}
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
