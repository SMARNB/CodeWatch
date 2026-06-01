import React, { useState } from 'react';

const NotificationBell = ({ 
  notifications = [], 
  onNotificationClick, 
  className = '' 
}) => {
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
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
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

  const clearAll = async () => {
    if (!window.confirm('Clear all notifications from your list? Other users are not affected.')) return;
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

  const getIconColor = (type) => {
    switch (type) {
      case 'warning':
        return 'text-yellow-500';
      case 'error':
        return 'text-red-500';
      case 'success':
        return 'text-green-500';
      case 'info':
      default:
        return 'text-blue-500';
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
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Mark all read
                  </button>
                )}
                {visibleNotifications.length > 0 && (
                  <button onClick={clearAll} className="text-sm text-red-600 hover:text-red-800 font-medium">
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto max-h-80">
              {visibleNotifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p>No notifications</p>
                </div>
              ) : (
                visibleNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors ${
                      isUnread(notification) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 ${getIconColor(notification.type)}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <circle cx="10" cy="10" r="8" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isUnread(notification) ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {notification.time}
                        </p>
                      </div>
                      {isUnread(notification) && (
                        <div className="flex-shrink-0">
                          <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {visibleNotifications.length > 0 && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <button 
                  onClick={() => {
                    const currentUserType = localStorage.getItem('userType') || 'admin';
                    const notificationsRoute = currentUserType === 'admin' ? '/admin/notifications' :
                                             currentUserType === 'ssd' ? '/ssd/notifications' :
                                             '/department-head/notifications';
                    window.open(notificationsRoute, '_blank');
                    setIsOpen(false);
                  }}
                  className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium text-center"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
