import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import NotificationItem from '../components/NotificationItem';
import UserProfileCard from '../components/UserProfileCard';
import Button from '../components/Button';
import Logo from '../components/Logo';
import FeedbackModal from '../components/FeedbackModal';
import ConfirmModal from '../components/ConfirmModal';
import SendReportModal from '../components/SendReportModal';
import backgroundEllipse from '../assets/background.svg';

const NotificationsPage = ({ userType: propUserType }) => {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [user, setUser] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showSendReport, setShowSendReport] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });

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
          status: n.category === 'blacklisted' ? 'purple' :
            n.category === 'unknown' ? 'red' :
              n.category === 'dress_code' ? 'orange' :
                n.category === 'password_reset' ? 'blue' : 'gray',
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
    const userEmployeeId = localStorage.getItem('userEmployeeId') || '';
    setUser({ name: userDisplayName, email: userEmail, employeeId: userEmployeeId });
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
        setAlertData({ isOpen: true, message: 'Failed to clear notifications.' });
      }
    } catch (e) {
      console.error(e);
      setAlertData({ isOpen: true, message: 'Failed to clear notifications.' });
    }
  };

  const handleFeedbackClick = () => {
    setShowFeedbackModal(true);
  };

  const handleLogoutClick = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userType');
    localStorage.removeItem('userEmail');
    navigate('/login');
  };

  const handleNotificationClick = (notification) => {
    if (notification.category === 'password_reset') {
      if (!notification.is_read) {
        const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
        fetch(`/api/notifications/read/${notification.id}/?user=${userKey}`, { method: 'POST' })
          .then(() => fetchNotifications()).catch((e) => console.error('Failed to mark read', e));
      }
      const email = notification.reset_email || '';
      navigate(`/admin/manage-users${email ? `?highlightEmail=${encodeURIComponent(email)}` : ''}`);
      return;
    }
    const notificationKey = `notification_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(notificationKey, JSON.stringify({ notification, userType }));
    window.open(`/notification-details?id=${notification.id}`, '_blank', 'popup,width=1280,height=820');

    if (!notification.is_read) {
      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
      fetch(`/api/notifications/read/${notification.id}/?user=${userKey}`, { method: 'POST' })
        .then(() => fetchNotifications())
        .catch((e) => console.error('Failed to mark read', e));
    }
  };

  const buildNotificationsSummary = (list) => {
    if (!list || list.length === 0) return 'No notifications to report.';
    const lines = list.map((n, i) => {
      const parts = [`${i + 1}. Notification #${n.id}`];
      if (n.violation_id) parts.push(`Violation #${n.violation_id}`);
      parts.push(`Type: ${n.violation_type || n.title || n.category || 'Notification'}`);
      const pclass = (n.person_classification || '').toLowerCase();
      if (n.person_name && pclass && pclass !== 'unknown') {
        parts.push(`Person: ${n.person_name} (ID: ${n.person_employee_id || 'N/A'}, Dept: ${n.person_department || 'N/A'}, Role: ${n.person_role || 'N/A'}, Class: ${n.person_classification})`);
      } else {
        parts.push('Person: Unknown');
      }
      if (n.time) parts.push(`Time: ${n.time}`);
      return parts.join(' | ');
    });
    return `Notifications Report (${list.length} item${list.length !== 1 ? 's' : ''}):\n\n${lines.join('\n')}`;
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="fixed bottom-0 left-0 w-full z-0">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            <div 
              className="flex items-center cursor-pointer transition-transform hover:scale-105" 
              style={{ marginLeft: '20px' }}
              onClick={() => {
                const role = localStorage.getItem('userType') || 'admin';
                const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                navigate(roleRoutes[role] || '/admin/dashboard');
              }}
              title="Go to Dashboard"
            >
              <Logo size="default" showText={false} />
            </div>
            <div 
              className="flex-1 flex justify-center cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => {
                const role = localStorage.getItem('userType') || 'admin';
                const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                navigate(roleRoutes[role] || '/admin/dashboard');
              }}
              title="Go to Dashboard"
            >
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#3f4299] to-[#4f46e5] text-center">Code Watch</h1>
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
              <div className="flex items-center" style={{ marginRight: '40px', gap: '32px' }}>
                <button
                  onClick={() => handleClear('read')}
                  className="py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-[8px] hover:bg-gray-50 transition-colors"
                  style={{ paddingLeft: '5px', paddingRight: '5px' }}
                >
                  Clear Viewed
                </button>
                <button
                  onClick={() => handleClear('all')}
                  className="py-2 text-sm font-medium text-red-600 border border-red-200 rounded-[8px] hover:bg-red-50 transition-colors"
                  style={{ paddingLeft: '5px', paddingRight: '5px' }}
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
                <div style={{ marginBottom: '20px' }}>
                  <Button variant="primary" size="default" className="w-full" onClick={() => setShowSendReport(true)}>
                    Send Report
                  </Button>
                </div>
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
      {showSendReport && (
        <SendReportModal
          onClose={() => setShowSendReport(false)}
          showReportPicker={false}
          initialSubject={`Notifications Report — ${filteredNotifications.length} item${filteredNotifications.length !== 1 ? 's' : ''}`}
          initialMessage={buildNotificationsSummary(filteredNotifications)}
          notificationIds={filteredNotifications.map(n => n.id).filter(Boolean)}
          violationIds={filteredNotifications.map(n => n.violation_id).filter(Boolean)}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(s => ({ ...s, isOpen: false }))}
        onConfirm={executeClear}
        title="Clear Notifications"
        message={`Are you sure you want to clear ${confirmModal.mode === 'read' ? 'all viewed notifications' : 'all notifications'} from your list? Other users will not be affected.`}
      />

      <ConfirmModal
        isOpen={alertData.isOpen}
        onClose={() => setAlertData({ isOpen: false, message: '' })}
        onConfirm={() => setAlertData({ isOpen: false, message: '' })}
        title="Alert"
        message={alertData.message}
        confirmText="OK"
        hideCancel={true}
      />
    </div>
  );
};

export default NotificationsPage;
