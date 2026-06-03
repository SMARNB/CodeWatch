import React from 'react';

const NotificationItem = ({ notification, onClick }) => {
  const { message, status, details, timestamp, type } = notification;

  // Color mapping based on status
  const getStatusStyles = (status) => {
    switch (status?.toLowerCase()) {
      case 'red':
      case 'violation':
      case 'alert':
      case 'error':
        return {
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600',
          dotColor: 'bg-red-500'
        };
      case 'green':
      case 'resolved':
      case 'success':
      case 'completed':
        return {
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          textColor: 'text-green-800',
          iconColor: 'text-green-600',
          dotColor: 'bg-green-500'
        };
      case 'yellow':
      case 'warning':
      case 'pending':
        return {
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600',
          dotColor: 'bg-yellow-500'
        };
      case 'blue':
      case 'info':
      case 'notification':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600',
          dotColor: 'bg-blue-500'
        };
      default:
        return {
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          textColor: 'text-gray-800',
          iconColor: 'text-gray-600',
          dotColor: 'bg-gray-500'
        };
    }
  };

  const statusStyles = getStatusStyles(status);

  // Get appropriate icon based on type or status
  const getIcon = () => {
    if (type) {
      switch (type.toLowerCase()) {
        case 'security':
          return (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1ZM12 7C13.1 7 14 7.9 14 9S13.1 11 12 11 10 10.1 10 9 10.9 7 12 7ZM12 13C14.67 13 17 14.33 17 16V17H7V16C7 14.33 9.33 13 12 13Z" />
            </svg>
          );
        case 'camera':
          return (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 15C13.66 15 15 13.66 15 12S13.66 9 12 9 9 10.34 9 12 10.34 15 12 15ZM20 4H16.83L15 2H9L7.17 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 18H4V6H8.05L9.88 4H14.12L15.95 6H20V18Z" />
            </svg>
          );
        case 'system':
          return (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" />
            </svg>
          );
        default:
          return (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" />
            </svg>
          );
      }
    }

    // Default icon based on status
    switch (status?.toLowerCase()) {
      case 'red':
      case 'violation':
      case 'alert':
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21H23L12 2L1 21ZM13 18H11V16H13V18ZM13 14H11V10H13V14Z" />
          </svg>
        );
      case 'green':
      case 'resolved':
      case 'success':
      case 'completed':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12S6.48 22 12 22 22 17.52 22 12 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" />
          </svg>
        );
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className={`
        flex flex-row items-center p-4 rounded-[8px] border border-gray-200 shadow-sm
        ${statusStyles.bgColor} ${statusStyles.borderColor} 
        hover:shadow-md transition-all duration-200 ease-in-out
        w-full cursor-pointer
      `}
      onClick={onClick}
    >
      {/* Status Dot */}
      <div className={`
        w-3 h-3 rounded-full mr-3 flex-shrink-0
        ${statusStyles.dotColor}
      `} />

      {/* Icon */}
      <div className={`
        mr-3 flex-shrink-0
        ${statusStyles.iconColor}
      `}>
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Message */}
        <div className={`
          font-medium text-sm mb-1
          ${statusStyles.textColor}
        `}>
          {message}
        </div>

        {/* Details */}
        {details && (
          <div className="text-xs text-gray-600 mb-1">
            {details}
          </div>
        )}

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs text-gray-500">
            {formatTimestamp(timestamp)}
          </div>
        )}
      </div>

    </div>
  );
};

export default NotificationItem;
