import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from './ConfirmModal';

const NotificationBell = ({
  notifications = [],
  onNotificationClick,
  className = ''
}) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [locallyRead, setLocallyRead] = useState(() => new Set());
  const [clearedIds, setClearedIds] = useState(() => new Set());

  const visibleNotifications = notifications.filter(n => !clearedIds.has(n.id));
  const isUnread = (n) => !n.is_read && !locallyRead.has(n.id);
  const unreadCount = visibleNotifications.filter(isUnread).length;

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = (notification) => {
    setLocallyRead(prev => new Set(prev).add(notification.id));
    if (!notification.is_read) {
      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
      fetch(`/api/notifications/read/${notification.id}/?user=${userKey}`, { method: 'POST' }).catch(() => {});
    }
    setIsOpen(false);
    // Password-reset requests: Manage Users in the SAME window, with the user highlighted
    if (notification.category === 'password_reset') {
      const email = notification.reset_email || '';
      navigate(`/admin/manage-users${email ? `?highlightEmail=${encodeURIComponent(email)}` : ''}`);
      return;
    }
    // Everything else: detail view in a separate app window
    window.open(`/notification-details?id=${notification.id}`, '_blank', 'popup,width=1280,height=820');
  };

  const markAllAsRead = async () => {
    try {
      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
      const role = encodeURIComponent(localStorage.getItem('userType') || '');
      await fetch(`/api/notifications/read-all/?user=${userKey}&role=${role}`, { method: 'POST' });
      setLocallyRead(new Set(notifications.map(n => n.id)));
    } catch (e) {
      console.error('Failed to mark all as read', e);
    }
  };

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const clearAll = () => {
    setIsConfirmOpen(true);
  };

  const executeClearAll = async () => {
    setIsConfirmOpen(false);
    try {
      const userKey = encodeURIComponent(localStorage.getItem('userEmail') || localStorage.getItem('userName') || '');
      const role = encodeURIComponent(localStorage.getItem('userType') || '');
      await fetch(`/api/notifications/clear/?mode=all&user=${userKey}&role=${role}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'all' })
      });
      setClearedIds(new Set(notifications.map(n => n.id)));
    } catch (e) {
      console.error('Failed to clear notifications', e);
    }
  };

  const getIconColor = (category) => {
    switch (category) {
      case 'blacklisted':
        return 'text-purple-500';
      case 'unknown':
        return 'text-red-500';
      case 'dress_code':
        return 'text-orange-500';
      case 'password_reset':
        return 'text-blue-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={toggleDropdown}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Notifications"
      >
        <svg className="w-7 h-7" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div
            className="absolute right-0 mt-2 w-[340px] bg-white border border-gray-200 rounded-[8px] z-50 max-h-96 flex flex-col"
            style={{
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              fontFamily: "'Open Sans', sans-serif"
            }}
          >
            <div className="flex items-center justify-between border-b border-gray-100 bg-white rounded-t-[8px]" style={{ padding: '10px' }}>
              <h3 className="text-[18px] font-semibold text-[#3f4299]">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[14px] text-[#3f4299] hover:text-[#2d3170] font-semibold transition-colors focus:outline-none">
                    Mark all read
                  </button>
                )}
                {visibleNotifications.length > 0 && (
                  <button onClick={clearAll} className="text-[14px] text-red-600 hover:text-red-800 font-semibold transition-colors focus:outline-none">
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-80 custom-scrollbar">
              {visibleNotifications.length === 0 ? (
                <div className="text-center text-gray-500" style={{ padding: '20px 10px' }}>
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-[14px]">No notifications</p>
                </div>
              ) : (
                visibleNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${isUnread(notification) ? 'bg-[#f8f9ff]' : ''
                      }`}
                    style={{ padding: '10px' }}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 ${getIconColor(notification.category)}`}>
                        <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="8" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[15px] font-semibold ${isUnread(notification) ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-[14px] text-gray-600 mt-1 leading-relaxed">
                          {notification.message}
                        </p>
                        <p className="text-[12px] text-gray-500 mt-2 font-medium">
                          {notification.time}
                        </p>
                      </div>
                      {isUnread(notification) && (
                        <div className="flex-shrink-0 pt-1">
                          <div className="w-2.5 h-2.5 bg-[#3f4299] rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {visibleNotifications.length > 0 && (
              <div className="bg-white border-t border-gray-100 rounded-b-[8px]" style={{ padding: '10px' }}>
                <button
                  onClick={() => {
                    const currentUserType = localStorage.getItem('userType') || 'admin';
                    const notificationsRoute = currentUserType === 'admin' ? '/admin/notifications' :
                      currentUserType === 'ssd' ? '/ssd/notifications' :
                        '/department-head/notifications';
                    window.open(notificationsRoute, '_blank', 'popup,width=1280,height=820');
                    setIsOpen(false);
                  }}
                  className="w-full text-[14px] text-[#3f4299] hover:text-[#2d3170] font-bold text-center transition-colors focus:outline-none"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={executeClearAll}
        title="Clear Notifications"
        message="Clear all notifications from your list? Other users are not affected."
      />
    </div>
  );
};

export default NotificationBell;
