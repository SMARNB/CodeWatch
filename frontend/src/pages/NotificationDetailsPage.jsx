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
  const [notificationData] = useState(() => {
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
          // Clean up the sessionStorage item after reading
          sessionStorage.removeItem(notificationKey);
          return data;
        }
      } catch (error) {
        console.error('Error reading notification data from sessionStorage:', error);
      }
    }
    
    // Fallback: return null notification
    return {
      notification: null,
      userType: localStorage.getItem('userType') || 'admin'
    };
  });
  
  const notification = notificationData.notification;
  const userType = notificationData.userType || localStorage.getItem('userType') || 'admin';

  // State management
  const [violationEvents, setViolationEvents] = useState([]);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for user data
  const [user, setUser] = useState(null);

  // Get user data from localStorage (similar to NotificationsPage)
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

  // Fetch violation events for this notification
  useEffect(() => {
    const fetchViolationEvents = async () => {
      if (!notification) {
        setError('No notification data available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // TODO: Replace with actual API call
        // const response = await fetch(`/api/notifications/${notification.id}/violation-events`);
        // const data = await response.json();
        // setViolationEvents(data.events);

        // Mock API call - simulate fetching violation events
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Mock violation events data
        const mockEvents = [
          {
            id: '1',
            type: 'Unauthorized Access',
            title: 'Violation Event 1',
            description: 'Unauthorized person detected in restricted area',
            timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
            location: 'Building A - Floor 3',
            cameraId: 'CAM-001',
            clipUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', // Mock video URL
          },
          {
            id: '2',
            type: 'Security Breach',
            title: 'Violation Event 2',
            description: 'Multiple unauthorized access attempts detected',
            timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(), // 25 minutes ago
            location: 'Building A - Floor 3',
            cameraId: 'CAM-001',
            clipUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', // Mock video URL
          },
          {
            id: '3',
            type: 'Suspicious Activity',
            title: 'Violation Event 3',
            description: 'Person loitering in restricted zone',
            timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(), // 20 minutes ago
            location: 'Building A - Floor 3',
            cameraId: 'CAM-002',
            clipUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4', // Mock video URL
          },
        ];

        setViolationEvents(mockEvents);
      } catch (err) {
        console.error('Failed to fetch violation events:', err);
        setError('Failed to load violation events. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchViolationEvents();
  }, [notification]);

  // Handle video clip ended - move to next clip
  const handleClipEnded = () => {
    if (currentClipIndex < violationEvents.length - 1) {
      setCurrentClipIndex((prev) => prev + 1);
    } else {
      // All clips played, reset to first clip or show message
      console.log('All violation clips have been played');
      // Optionally reset to first clip
      // setCurrentClipIndex(0);
    }
  };

  // Handle event click from ViolationTrack
  const handleEventClick = (index) => {
    setCurrentClipIndex(index);
  };

  // Handle feedback submission
  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/feedback', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(feedbackData),
      // });
      // const result = await response.json();

      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Feedback submitted:', feedbackData);

      // Show success message (FeedbackForm handles this internally)
      return { success: true };
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      throw new Error('Failed to submit feedback. Please try again.');
    }
  };

  // Handle window close
  const handleClose = () => {
    window.close(); // Close the current tab/window
    // Fallback: if window.close() doesn't work (some browsers block it), go back
    if (!document.hidden) {
      navigate(-1);
    }
  };

  // Get current clip URL
  const currentClipUrl = violationEvents[currentClipIndex]?.clipUrl || null;

  if (loading) {
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
              
              {/* Close Button - Top Right */}
              <div className="flex items-center" style={{ marginRight: '20px' }}>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                  aria-label="Close window"
                  title="Close"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]" style={{ paddingTop: '100px' }}>
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading violation details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !notification) {
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
              
              {/* Close Button - Top Right */}
              <div className="flex items-center" style={{ marginRight: '20px' }}>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                  aria-label="Close window"
                  title="Close"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-80px)]" style={{ paddingTop: '100px' }}>
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">Error Loading Notification</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[#3f4299] text-white rounded-lg hover:bg-[#2d3170] transition-colors"
            >
              Close
            </button>
          </div>
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
            
            {/* Close Button - Top Right */}
            <div className="flex items-center" style={{ marginRight: '20px' }}>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                aria-label="Close window"
                title="Close"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Screen Layout */}
      <div className="relative w-full gap-6" style={{ paddingTop: '100px', paddingLeft: '100px' }}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#3f4299]">
              {notification?.message || 'Notification Details'}
            </h1>
            {notification?.details && (
              <p className="text-gray-600 mt-2">{notification.details}</p>
            )}
          </div>
        </div>

        <div className="flex w-full">
          {/* Left Column - VideoPlayer and ViolationTrack */}
          <div className="flex-1">
            {/* 2-Column Layout: VideoPlayer and ViolationTrack */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6" style={{marginBottom: '30px'}}>
              {/* Left: VideoPlayer */}
              <div className="w-full">
                <VideoPlayer
                  clipUrl={currentClipUrl}
                  placeholder="Loading violation clip..."
                  onEnded={handleClipEnded}
                  autoPlay={true}
                  muted={false}
                />
                {violationEvents.length > 0 && (
                  <div className="mt-4 text-sm text-gray-600 text-center">
                    Clip {currentClipIndex + 1} of {violationEvents.length}
                  </div>
                )}
              </div>

              {/* Right: ViolationTrack */}
              <div className="w-full">
                <ViolationTrack
                  eventsList={violationEvents}
                  activeIndex={currentClipIndex}
                  onEventClick={handleEventClick}
                />
              </div>
            </div>

            {/* Full-Width: FeedbackForm */}
            <div className="w-full">
              <FeedbackForm
                user={user}
                onSubmit={handleFeedbackSubmit}
                notificationId={notification?.id || notification?.message}
              />
            </div>
          </div>

          {/* Right Column - User Profile Card only */}
          <div className="w-80 flex-shrink-0" style={{ marginRight: '100px', marginLeft: '100px' }}>
            <div style={{ marginTop: '0px' }}>
              <div style={{ marginBottom: '20px' }}>
                {user && <UserProfileCard user={user} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailsPage;

