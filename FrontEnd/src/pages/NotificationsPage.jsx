import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationItem from '../components/NotificationItem';
import UserProfileCard from '../components/UserProfileCard';
import Button from '../components/Button';
import Logo from '../components/Logo';
import FeedbackModal from '../components/FeedbackModal';
import ConfirmModal from '../components/ConfirmModal';
import backgroundEllipse from '../assets/background.svg';

const NotificationsPage = ({ userType: propUserType }) => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const userType = propUserType || localStorage.getItem('userType') || 'admin';

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
      const role = encodeURIComponent(localStorage.getItem('userType') || userType || '');
      const response = await fetch(`/api/notifications/?user=${userKey}&role=${role}`);
      if (response.ok) {
        const data = await response.json();
        const mappedData = data.map(n => ({
          ...n,
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
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    const userDisplayName = localStorage.getItem('userDisplayName') || 'User';
    setUser({ name: userDisplayName, email: userEmail, employeeId: 'ADM001' });
    fetchNotifications();
  }, []);

  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = selectedFilter === 'all' ||
      notification.status?.toLowerCase() === selectedFilter.toLowerCase();
    const matchesSearch = !searchTerm ||
      notification.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notification.message?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, mode: null });

  const handleClear = (mode) => {
    setConfirmModal({ isOpen: true, mode });
  };

  const executeClear = async () => {
    const { mode } = confirmModal;
    setConfirmModal({ isOpen: false, mode: null });
    if (!mode) return;

    try {
      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
      const role = encodeURIComponent(localStorage.getItem('userType') || userType || '');
      const res = await fetch(`/api/notifications/clear/?mode=${mode}&user=${userKey}&role=${role}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        fetchNotifications();
      } else {
        alert('Failed to clear notifications.');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to clear notifications.');
    }
  };

  const handleFeedbackClick = () => {
    setShowFeedbackModal(true);
  };

  const handleLogoutClick = () => {
    localStorage.removeItem('userType');
    localStorage.removeItem('userEmail');
    navigate('/login');
  };

  const handleNotificationClick = (notification) => {
    const notificationKey = `notification_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(notificationKey, JSON.stringify({ notification, userType }));
    window.open(`/notification-details?id=${notification.id}`, '_blank');

    if (!notification.is_read) {
      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
      fetch(`/api/notifications/read/${notification.id}/?user=${userKey}`, { method: 'POST' })
        .then(() => fetchNotifications())
        .catch((e) => console.error('Failed to mark read', e));
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            <div className="flex items-center" style={{ marginLeft: '20px' }}>
              <Logo size="default" showText={false} />
            </div>
            <div className="flex-1 flex justify-center">
              <h1 className="text-2xl font-bold text-[#3f4299] text-center">Code Watch</h1>
            </div>
            <div className="w-16"></div>
          </div>
        </div>
      </div>
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px' }}>
        <div className="flex w-full">
          <div className="flex-1">
            <div className="flex items-center justify-between" style={{ marginBottom: '50px' }}>
              <h2 className="text-3xl font-bold text-[#3f4299]">Notifications</h2>
              <div className="flex items-center gap-3" style={{ marginRight: '40px' }}>
                <button
                  onClick={() => handleClear('read')}
                  className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-[8px] hover:bg-gray-50 transition-colors"
                >
                  Clear Viewed
                </button>
                <button
                  onClick={() => handleClear('all')}
                  className="px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-[8px] hover:bg-red-50 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
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
                <div key={notification.id || index} style={{ marginBottom: '16px' }}>
                  <NotificationItem
                    notification={notification}
                    onClick={() => handleNotificationClick(notification)}
                  />
                </div>
              ))
            )}
          </div>
          <div className="w-80 flex-shrink-0" style={{ marginRight: '100px', marginLeft: '100px' }}>
            <div style={{ marginTop: '0px' }}>
              <div style={{ marginBottom: '20px' }}>
                {user && <UserProfileCard user={user} />}
              </div>
              <div className="mt-6 space-y-4">
                {userType === 'admin' && (
                  <div style={{ marginBottom: '20px' }}>
                    <Button variant="primary" size="default" className="w-full" onClick={() => navigate('/admin/manage-violations')}>
                      Manage Violations
                    </Button>
                  </div>
                )}
                <div style={{ marginBottom: '20px' }}>
                  <Button variant="primary" size="default" className="w-full" onClick={handleFeedbackClick}>
                    Violation Feedback
                  </Button>
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <Button variant="secondary" size="default" className="w-full" onClick={handleLogoutClick}>
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showFeedbackModal && (
        <FeedbackModal onClose={() => setShowFeedbackModal(false)} />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, mode: null })}
        onConfirm={executeClear}
        title="Clear Notifications"
        message={`Are you sure you want to clear ${confirmModal.mode === 'read' ? 'all viewed notifications' : 'all notifications'} from your list? Other users will not be affected.`}
      />
    </div>
  );
};

export default NotificationsPage;
