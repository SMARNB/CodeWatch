import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import ViolationTrack from '../components/ViolationTrack';
import FeedbackForm from '../components/FeedbackForm';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';

const NotificationDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // State for notification data
  const [notificationData, setNotificationData] = useState(() => {
    // Initialize notification data from location state or sessionStorage
    // First, try to get from location state (same tab navigation)
    if (location.state?.notification) {
      return {
        notification: location.state.notification,
        userType: location.state.userType || localStorage.getItem('userType') || 'admin'
      };
    }

    // If not in state, check URL params for sessionStorage key (new tab)
    const urlParams = new URLSearchParams(location.search);
    const notificationKey = urlParams.get('key');

    if (notificationKey) {
      try {
        const storedData = sessionStorage.getItem(notificationKey);
        if (storedData) {
          const data = JSON.parse(storedData);
          // Clean up the sessionStorage item after reading (optional, kept for refresh safety if needed, but user said it expires)
          // sessionStorage.removeItem(notificationKey); 
          return data;
        }
      } catch (error) {
        console.error('Error reading notification data from sessionStorage:', error);
      }
    }

    // Fallback: return null notification, will fetch in useEffect
    return {
      notification: null,
      userType: localStorage.getItem('userType') || 'admin'
    };
  });

  const [notification, setNotification] = useState(notificationData.notification);
  const userType = notificationData.userType || localStorage.getItem('userType') || 'admin';

  // State management
  const [violationEvents, setViolationEvents] = useState([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStreamUrl, setActiveStreamUrl] = useState(null);
  const [activeCamera, setActiveCamera] = useState("Initializing...");



  // State for user data
  const [user, setUser] = useState(null);

  // Get user data from localStorage
  useEffect(() => {
    const getUserData = () => {
      const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
      const userDisplayName = localStorage.getItem('userDisplayName') || 'User';

      const prefix = userType === 'admin' ? 'ADM' :
        userType === 'ssd' ? 'SSD' : 'DHD';

      setUser({
        name: userDisplayName,
        email: userEmail,
        employeeId: `${prefix}001`,
      });
    };
    getUserData();
  }, [userType]);

  // Fetch violation events and notification details if missing
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      // Get ID from URL or existing notification
      const urlParams = new URLSearchParams(location.search);
      const paramId = urlParams.get('id');
      const notifId = notification?.id || paramId;

      if (!notifId) {
        setError("No notification ID provided.");
        setLoading(false);
        return;
      }

      try {
        // Fetch details from the new endpoint
        const response = await fetch(`http://127.0.0.1:8000/api/notifications/${notifId}/`);

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const data = await response.json();

        // Update notification if it was missing or stale
        // Backend returns: { id, title, message, type, is_read, timestamp, violation_events: [...] }
        const mappedNotification = {
          id: data.id,
          title: data.title,
          message: data.message,
          type: data.type,
          // Map backend type to frontend 'status' color logic
          status: data.type === 'security' ? 'Red' :
            data.type === 'system' ? 'Green' :
              data.type === 'backup' ? 'Blue' : 'Yellow',
          timestamp: data.timestamp,
          personId: data.personId, // CHANGED: Added personId mapping
        };

        setNotification(mappedNotification);

        // 2. Fetch Violation Events (New Endpoint)
        try {
          const eventsResponse = await fetch(`http://127.0.0.1:8000/api/notifications/${notifId}/violation-events/`);
          if (eventsResponse.ok) {
            const eventsData = await eventsResponse.json();
            setViolationEvents(eventsData.events || []);
          } else {
            console.warn("Failed to fetch events from new endpoint, checking base response...");
            // Fallback to data from first call if available (legacy support)
            setViolationEvents(data.violation_events || []);
          }
        } catch (evErr) {
          console.error("Error fetching events:", evErr);
          setViolationEvents(data.violation_events || []);
        }

      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load notification details. ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [location.search]); // Depend on location search to refetch if URL changes

  // Polling for live camera handover
  // Polling for live camera handover
  useEffect(() => {
    // CHANGED: Use personId from notification or specific target
    const targetPersonId = notification?.personId;
    if (!targetPersonId) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/live-track/${targetPersonId}/`);
        if (response.ok) {
          const data = await response.json();
          // If we get a valid stream and it's different, switch
          if (data.stream_url && data.stream_url !== activeStreamUrl) {
            console.log("Handover: Switching to camera", data.active_camera_name);
            setActiveStreamUrl(data.stream_url);
            setActiveCamera(data.active_camera_name); // CHANGED: Update camera name
          }
        }
      } catch (err) {
        console.error("Live track polling error:", err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [notification, activeStreamUrl]);

  // Handle video clip ended
  const handleClipEnded = () => {
    if (currentClipIndex < violationEvents.length - 1) {
      setCurrentClipIndex((prev) => prev + 1);
    }
  };

  // Handle event click
  const handleEventClick = (index) => {
    setCurrentClipIndex(index);
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/feedback/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...feedbackData,
          notificationId: notification?.id
        }),
      });

      if (!response.ok) throw new Error("Feedback submission failed");

      const result = await response.json();
      console.log('Feedback submitted:', result);
      return { success: true };
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      throw new Error('Failed to submit feedback. Please try again.');
    }
  };

  // Handle window close
  const handleClose = () => {
    window.close();
    if (!document.hidden) {
      navigate(-1);
    }
  };

  const currentClipUrl = violationEvents[currentClipIndex]?.clipUrl || null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden flex items-center justify-center">
        {/* Background Ellipse */}
        <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
          <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
        </div>
        <div className="text-center z-10">
          <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#3f4299] font-medium">Loading details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden flex items-center justify-center">
        <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
          <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
        </div>
        <div className="bg-white p-8 rounded-lg shadow-lg z-10 text-center max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={handleClose} className="px-6 py-2 bg-[#3f4299] text-white rounded-lg hover:bg-[#2d3170] transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Navbar */}
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full hover:shadow-md transition-shadow duration-300" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            {/* Logo */}
            <div className="flex items-center" style={{ marginLeft: '20px' }}>
              <Logo size="default" showText={false} />
            </div>

            {/* Title */}
            <div className="flex-1 flex justify-center">
              <h1 className="text-2xl font-bold text-[#3f4299] text-center tracking-wide">
                Code Watch
              </h1>
            </div>

            {/* Close Button */}
            <div className="flex items-center" style={{ marginRight: '20px' }}>
              <button
                onClick={handleClose}
                className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-[#3f4299] hover:bg-[#e0e1ff] rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3f4299]"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative w-full max-w-[1920px] mx-auto px-6 lg:px-12 pt-8 pb-12">
        {/* Header Section */}
        <div className="mb-8 pl-4 border-l-4 border-[#3f4299]">
          <h1 className="text-3xl font-bold text-[#3f4299]">
            {activeStreamUrl ? `Live Tracking: ${activeCamera}` : (notification?.message || 'Notification Details')}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {notification?.timestamp ? new Date(notification.timestamp).toLocaleString() : ''}
            {notification?.type && <span className={`ml-3 px-2 py-1 rounded-full text-xs font-semibold uppercase ${notification.status === 'Red' ? 'bg-red-100 text-red-700' :
              notification.status === 'Green' ? 'bg-green-100 text-green-700' :
                notification.status === 'Blue' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
              {notification.type}
            </span>}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column: Media & Details */}
          <div className="flex-1 space-y-8">
            {/* Video & Events Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Video Player */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 p-1">
                <VideoPlayer
                  clipUrl={activeStreamUrl || currentClipUrl}
                  placeholder="Loading violation clip..."
                  onEnded={handleClipEnded}
                  autoPlay={true}
                  muted={false}
                />
                {violationEvents.length > 0 && (
                  <div className="p-3 text-center bg-gray-50 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-600">
                      Playing Clip {currentClipIndex + 1} of {violationEvents.length}
                    </p>
                  </div>
                )}
              </div>

              {/* Violation Track List */}
              <div className="h-full min-h-[400px]">
                <ViolationTrack
                  eventsList={violationEvents}
                  activeIndex={currentClipIndex}
                  onEventClick={handleEventClick}
                />
              </div>
            </div>

            {/* Feedback Form */}
            <div className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300 p-6 border border-gray-100">
              <h3 className="text-lg font-bold text-[#3f4299] mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Provide Feedback
              </h3>
              <FeedbackForm
                user={user}
                onSubmit={handleFeedbackSubmit}
                notificationId={notification?.id}
              />
            </div>
          </div>

          {/* Right Column: User Profile */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="sticky top-8">
              {user && <UserProfileCard user={user} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailsPage;


