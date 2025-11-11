import React from 'react';

const ViolationTrack = ({ eventsList = [], activeIndex = 0, onEventClick }) => {
  // Format timestamp for display
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!eventsList || eventsList.length === 0) {
    return (
      <div className="w-full h-full bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-center">
        <div className="text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-gray-500 text-sm">No violation events found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h2 className="text-lg font-semibold text-gray-900">Violation Timeline</h2>
        <p className="text-sm text-gray-500 mt-1">{eventsList.length} event(s) detected</p>
      </div>

      {/* Events List */}
      <div className="overflow-y-auto max-h-[600px]">
        <div className="px-4 py-4">
          {eventsList.map((event, index) => {
            const isActive = index === activeIndex;
            const isPast = index < activeIndex;
            const isFuture = index > activeIndex;

            return (
              <div
                key={event.id || index}
                onClick={() => onEventClick && onEventClick(index)}
                className={`
                  relative flex items-start mb-4 p-4 rounded-lg border-2 cursor-pointer
                  transition-all duration-200
                  ${
                    isActive
                      ? 'bg-blue-50 border-blue-500 shadow-md'
                      : isPast
                      ? 'bg-green-50 border-green-200 hover:border-green-300'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }
                `}
              >
                {/* Timeline Indicator */}
                <div className="flex flex-col items-center mr-4">
                  {/* Vertical Line */}
                  {index < eventsList.length - 1 && (
                    <div
                      className={`
                        w-0.5 h-12
                        ${
                          isActive
                            ? 'bg-blue-500'
                            : isPast
                            ? 'bg-green-500'
                            : 'bg-gray-300'
                        }
                      `}
                    />
                  )}
                  
                  {/* Dot */}
                  <div
                    className={`
                      w-4 h-4 rounded-full border-2 flex-shrink-0
                      ${
                        isActive
                          ? 'bg-blue-500 border-blue-700 shadow-lg ring-2 ring-blue-200'
                          : isPast
                          ? 'bg-green-500 border-green-700'
                          : 'bg-gray-400 border-gray-600'
                      }
                    `}
                  >
                    {isActive && (
                      <div className="w-full h-full rounded-full bg-white animate-ping opacity-75" />
                    )}
                  </div>
                </div>

                {/* Event Content */}
                <div className="flex-1 min-w-0">
                  {/* Event Type/Title */}
                  <div className="flex items-center justify-between mb-2">
                    <h3
                      className={`
                        font-semibold text-sm
                        ${isActive ? 'text-blue-900' : isPast ? 'text-green-900' : 'text-gray-700'}
                      `}
                    >
                      {event.type || event.title || `Violation ${index + 1}`}
                    </h3>
                    {isActive && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded-full">
                        Playing
                      </span>
                    )}
                    {isPast && (
                      <span className="px-2 py-1 text-xs font-medium bg-green-500 text-white rounded-full">
                        Completed
                      </span>
                    )}
                  </div>

                  {/* Event Description */}
                  {event.description && (
                    <p className="text-sm text-gray-600 mb-2">{event.description}</p>
                  )}

                  {/* Event Metadata */}
                  <div className="flex items-center space-x-4 text-xs text-gray-500">
                    {event.timestamp && (
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>{formatTime(event.timestamp)}</span>
                      </div>
                    )}
                    {event.location && (
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>{event.location}</span>
                      </div>
                    )}
                    {event.cameraId && (
                      <div className="flex items-center">
                        <svg
                          className="w-4 h-4 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        <span>Camera {event.cameraId}</span>
                      </div>
                    )}
                  </div>

                  {/* Date (if different from previous event) */}
                  {event.timestamp && index > 0 && (
                    eventsList[index - 1]?.timestamp &&
                    formatDate(event.timestamp) !== formatDate(eventsList[index - 1].timestamp) && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <span className="text-xs font-medium text-gray-500">
                          {formatDate(event.timestamp)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ViolationTrack;

