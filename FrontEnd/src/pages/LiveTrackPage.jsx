import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';
import SimpleTrackingFeed from '../components/SimpleTrackingFeed';

const LiveTrackPage = () => {
  const navigate = useNavigate();
  const { personId } = useParams();

  const [personInfo, setPersonInfo] = useState(null);
  const [movementHistory, setMovementHistory] = useState([]);
  const [activeCamera, setActiveCamera] = useState(null);
  const [trackingFeedUrl, setTrackingFeedUrl] = useState(null);
  const [overlayText, setOverlayText] = useState('');
  const [isCurrentlyDetected, setIsCurrentlyDetected] = useState(false);

  const [feedbackText, setFeedbackText] = useState('');
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('success');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Local storage user data
  const userName = localStorage.getItem('userName') || 'User';
  const userEmail = localStorage.getItem('userEmail') || 'user@example.com';
  const userType = localStorage.getItem('userType') || 'admin';

  useEffect(() => {
    let pollInterval;
    let pendingSwitchTimeout;

    const pollData = async (personIdParam, currentActiveCamera) => {
      try {
        const [liveRes, moveRes] = await Promise.all([
          fetch(`/api/live-track/${personIdParam}/`),
          fetch(`/api/movement-history/${personIdParam}/`)
        ]);

        let liveData = null;
        if (liveRes.ok) {
          liveData = await liveRes.json();
          if (liveData.person) setPersonInfo(liveData.person);
          if (liveData.tracking_feed_url) setTrackingFeedUrl(liveData.tracking_feed_url);
        }

        let moveData = [];
        if (moveRes.ok) {
          const moveDataResp = await moveRes.json();
          moveData = moveDataResp.movement_history || [];
          console.log('Movement API response:', moveDataResp);
          setMovementHistory(moveData);
        }

        const camId = liveData?.current_camera_id || liveData?.active_camera_id;
        const camName = liveData?.active_camera_name || camId;
        const currentLoc = camId ? { id: camId, name: camName } : null;

        if (currentLoc && currentLoc.id) {
          setIsCurrentlyDetected(true);
          // We have a current location
          if (currentActiveCamera && currentActiveCamera.id !== currentLoc.id) {
            // Camera is different, show switching overlay, wait 500ms, then switch
            setOverlayText(`Switching to ${currentLoc.name}...`);
            pendingSwitchTimeout = setTimeout(() => {
              setActiveCamera(currentLoc);
              setOverlayText('');
            }, 500);
          } else if (!currentActiveCamera) {
            setActiveCamera(currentLoc);
          } else {
            // Same camera, do nothing but clear overlay
            setOverlayText('');
          }
        } else {
          setIsCurrentlyDetected(false);
          // No current location, keep showing last known camera
          if (moveData.length > 0) {
            const lastMove = moveData[0];
            setOverlayText(`Last seen at ${new Date(lastMove.entered_at).toLocaleTimeString()}`);
            if (!currentActiveCamera) {
              setActiveCamera({ id: lastMove.camera_id || lastMove.camera_name, name: lastMove.camera_name, time: lastMove.entered_at });
            }
          } else {
            setOverlayText('');
          }
        }

      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    const fetchData = async () => {
      setLoading(true);
      if (!personId) {
        setError("No person ID provided.");
        setLoading(false);
        return;
      }

      try {
        // Start tracking
        fetch('/api/live-track/start/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_id: personId })
        }).catch(console.error);

        await pollData(personId, null);
        pollInterval = setInterval(() => {
          setActiveCamera(currentCam => {
            pollData(personId, currentCam);
            return currentCam;
          });
        }, 2000);

      } catch (err) {
        console.error(err);
        setError("Failed to start live tracking.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (pendingSwitchTimeout) clearTimeout(pendingSwitchTimeout);
      fetch('/api/live-track/stop/', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId })
      }).catch(console.error);
    };
  }, [personId]);

  const handlePostFeedback = async () => {
    if (!feedbackText.trim()) return;
    try {
      const response = await fetch('/api/feedback/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violation_id: null,
          userType: userType,
          userId: userEmail,
          thoughts: feedbackText
        })
      });
      if (response.ok) {
        setToast('Feedback submitted');
        setToastType('success');
        setFeedbackText('');
        setTimeout(() => setToast(''), 3000);
      } else {
        setToast('Could not submit feedback');
        setToastType('error');
        setTimeout(() => setToast(''), 3000);
      }
    } catch (e) {
      console.error(e);
      setToast('Could not submit feedback');
      setToastType('error');
      setTimeout(() => setToast(''), 3000);
    }
  };

  const getUserBadgeColor = (role) => {
    switch ((role || '').toLowerCase()) {
      case 'admin': return 'bg-indigo-100 text-[#3f4299] border-indigo-200';
      case 'ssd': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'department-head': return 'bg-green-100 text-green-800 border-green-200';
      case 'guard': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getClassificationBadge = (cls) => {
    switch ((cls || '').toLowerCase()) {
      case 'known':
      case 'student':
      case 'employee': return 'bg-green-100 text-green-800 border-green-200';
      case 'unknown': return 'bg-red-100 text-red-800 border-red-200';
      case 'blacklisted': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'visitor': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#f5f3ff] flex items-center justify-center font-sans">
      <div className="w-8 h-8 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div>
    </div>;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f5f3ff] flex flex-col items-center justify-center font-sans space-y-4">
        <p className="text-red-600 font-bold">{error}</p>
        <button onClick={() => navigate(-1)} className="px-6 py-2 bg-[#3f4299] text-white rounded-lg font-medium">Go Back</button>
      </div>
    );
  }

  const isUnknown = personInfo ? false : true;

  return (
    <div className="min-h-screen bg-[#f5f3ff] relative overflow-hidden font-sans">
      {/* Background styling */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px] pointer-events-none">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* HEADER BAR */}
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full h-[80px] z-10 flex items-center px-6 justify-between">
        <div className="flex items-center gap-4" style={{ marginLeft: '50px' }}>
          <Logo size="large" showText={false} />
        </div>
        <h1 className="text-2xl font-bold text-[#3f4299] absolute left-1/2 -translate-x-1/2">
          Live Tracking Focus
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="page-container relative w-full z-10" style={{ display: 'flex', gap: '20px', padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* === LEFT COLUMN (65%) === */}
        <div className="left-column" style={{ flex: '0 0 65%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SECTION A — Single Live Camera Feed */}
          <div className="bg-gray-900 rounded-lg overflow-hidden shadow-sm relative flex items-center justify-center border border-gray-800" style={{ aspectRatio: '16/9', width: '100%' }}>
            {/* Always render the tracking feed - never unmount it */}
            <SimpleTrackingFeed
              trackingFeedUrl={trackingFeedUrl}
              cameraId={activeCamera?.id || 'CAM-001'}
            />

            {/* Overlay the fallback message ON TOP when not detected */}
            {!isCurrentlyDetected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-70 z-10">
                <div className="w-[200px] h-[200px] rounded-full border-4 border-gray-700 shadow-lg overflow-hidden mb-6 bg-gray-800 flex items-center justify-center">
                  {personInfo?.photo_url ? (
                    <img src={personInfo?.photo_url} alt="Subject Snapshot" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-500 font-bold text-5xl">?</span>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">Subject not currently detected</h2>
                {movementHistory.length > 0 ? (
                  <p className="text-lg text-gray-400">Last seen: {movementHistory[0].camera_name} at {new Date(movementHistory[0].entered_at).toLocaleTimeString()}</p>
                ) : (
                  <p className="text-lg text-gray-400">Last seen: Unknown Location</p>
                )}
              </div>
            )}

            {overlayText && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/75 backdrop-blur-md px-6 py-3 rounded-full text-white text-sm font-medium shadow-lg animate-fade-in-up z-30">
                {overlayText}
              </div>
            )}
          </div>

          {/* SECTION B — Feedback */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-[#3f4299]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Feedback
            </h3>
            <textarea
              className="w-[calc(100%-20px)] h-[100px] border border-[#bab6b6] rounded-[8px] text-[14px] outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299] resize-none mb-4"
              style={{ marginLeft: '10px', marginRight: '10px', marginBottom: '10px', padding: '10px' }}
              placeholder="Share Your Thoughts..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
            />
            <div className="flex items-center justify-between w-full">
              <div className="flex justify-between w-full">
                <button
                  onClick={handlePostFeedback}
                  className="px-8 py-2 h-[48px] bg-[#3f4299] text-white rounded-[8px] text-[14px] font-medium hover:bg-[#2d3170] transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
                  style={{ minWidth: '120px', marginLeft: '10px', marginBottom: '10px' }}
                >
                  Post
                </button>
                <button
                  onClick={() => navigate('/analytics', { state: { personInfo } })}
                  className="px-6 h-[48px] text-[#3f4299] hover:underline text-[14px] font-semibold transition-colors focus:outline-none"
                  style={{ marginLeft: '10px', marginRight: '10px' }}
                >Generate Report
                </button>
              </div>
              {toast && <span className={`font-medium text-sm animate-pulse ${toastType === 'error' ? 'text-red-600' : 'text-green-600'}`}>{toast}</span>}
            </div>
          </div>
        </div>

        {/* === RIGHT COLUMN (35%) === */}
        <div className="right-column" style={{ flex: '0 0 32%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* SECTION C — Logged-In User Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col items-center text-center" style={{ padding: '16px' }}>
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-[#3f4299] font-bold text-2xl mb-3 border-2 border-white shadow-sm">
              {userName.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-md font-bold text-gray-900">{userName}</h2>
            <p className="text-xs text-gray-500 mb-2">{userEmail}</p>
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${getUserBadgeColor(userType)}`}>
              {userType}
            </span>
          </div>

          {/* SECTION D — Person Details Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col text-center" style={{ padding: '16px' }}>
            <div className="mx-auto w-20 h-20 rounded-full border-2 border-white shadow-sm overflow-hidden mb-3 bg-gray-100 flex items-center justify-center">
              {personInfo?.photo_url ? (
                <img src={personInfo?.photo_url} alt="Person" className="w-full h-full object-cover" />
              ) : (
                <span className="text-gray-400 font-bold text-3xl">?</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{isUnknown ? 'Unknown Person' : (personInfo?.name || 'Unknown Person')}</h2>
            <p className="text-xs text-gray-500 font-medium mb-3">{personInfo?.employee_id ? `ID: ${personInfo.employee_id}` : 'ID: N/A'}</p>

            <div className="w-full border-t border-gray-100 pt-3 flex flex-col items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border capitalize shadow-sm ${getClassificationBadge(isUnknown ? 'unknown' : personInfo?.classification)}`}>
                {isUnknown ? 'Unknown' : (personInfo?.classification || 'Unknown')}
              </span>
              {personInfo?.violation_count > 0 && (
               <span className="text-xs font-bold text-red-600">Total Violations: {personInfo.violation_count}</span>
              )}
            </div>
          </div>

          {/* SECTION E — Camera Movement Log */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ maxHeight: '400px', overflowY: 'auto', padding: '16px 36px 16px 40px' }}>
            <h3 className="text-md font-bold text-gray-800 mb-4">Camera Movement Log</h3>
            <div className="relative pl-4 space-y-4">
              {movementHistory.length > 0 ? movementHistory.map((move, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={idx} className="relative flex items-start group">
                    <div className={`absolute -left-[23px] flex items-center justify-center w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 ${isLatest ? 'bg-green-500 animate-[pulse_1.5s_ease-in-out_infinite]' : 'bg-gray-300'}`}></div>
                    <div className="w-full pl-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs ${isLatest ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{move.camera_name}</span>
                          {isLatest && <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-bold tracking-wider">CURRENT</span>}
                        </div>
                      </div>
                      <div className="text-[11px] text-gray-500 mb-1">{move.location_description}</div>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 font-medium">
                        <time>{new Date(move.entered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                        {move.duration && <span>Duration: {move.duration}</span>}
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <p className="text-sm text-gray-500 italic relative z-10 pl-2">No movement history recorded yet.</p>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translate(-50%, 10px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default LiveTrackPage;
