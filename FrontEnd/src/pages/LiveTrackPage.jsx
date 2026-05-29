import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';

const LiveTrackPage = () => {
  const navigate = useNavigate();
  const { personId } = useParams();

  const [personInfo, setPersonInfo] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [movementHistory, setMovementHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [activeCameraId, setActiveCameraId] = useState(null);

  useEffect(() => {
    const userType = localStorage.getItem('userType') || 'admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    const userDisplayName = localStorage.getItem('userDisplayName') || 'User';
    setUser({ name: userDisplayName, email: userEmail, employeeId: 'ADM001' });
  }, []);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!personId) {
        setError("No person ID provided.");
        setLoading(false);
        return;
      }

      try {
        // Fetch Cameras
        const camRes = await fetch('/api/cameras/');
        if (camRes.ok) {
          setCameras(await camRes.json());
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load initial data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [personId]);

  // Polling for live track and movement history
  useEffect(() => {
    if (!personId) return;

    const pollData = async () => {
      try {
        const liveRes = await fetch(`/api/live-track/${personId}/`);
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          setPersonInfo(liveData.person);
          setActiveCameraId(liveData.active_camera_id);
        }

        const moveRes = await fetch(`/api/movement-history/${personId}/`);
        if (moveRes.ok) {
          const moveData = await moveRes.json();
          setMovementHistory(moveData);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    pollData();
    const interval = setInterval(pollData, 2000);
    return () => clearInterval(interval);
  }, [personId]);

  const handleStartTrack = async () => {
    if (!personId) return;
    try {
      await fetch('/api/live-track/start/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId })
      });
      alert('Live tracking started.');
    } catch (e) { console.error(e); }
  };

  const handleStopTrack = async () => {
    if (!personId) return;
    try {
      await fetch('/api/live-track/stop/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: personId })
      });
      alert('Live tracking stopped.');
      setActiveCameraId(null);
    } catch (e) { console.error(e); }
  };

  const getClassificationColor = (classification) => {
    const c = (classification || '').toLowerCase();
    if (c === 'known' || c === 'student' || c === 'employee') return 'bg-green-100 text-green-800 border-green-200';
    if (c === 'unknown') return 'bg-red-100 text-red-800 border-red-200';
    if (c === 'blacklisted') return 'bg-purple-100 text-purple-800 border-purple-200';
    if (c === 'visitor') return 'bg-blue-100 text-blue-800 border-blue-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) return <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full h-[100px]">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
          <div className="flex items-center" style={{ marginLeft: '20px' }}>
            <Logo size="default" showText={false} />
          </div>
          <h1 className="text-2xl font-bold text-[#3f4299]">Live Tracking Focus</h1>
          <div className="flex items-center" style={{ marginRight: '20px' }}>
             <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100">
               ✕
             </button>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-[1920px] mx-auto px-6 lg:px-12 pt-8 pb-12 flex gap-8">
        <div className="flex-1 space-y-8">
          
          {/* A. Person Info Panel */}
          {personInfo && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-6">
              {personInfo.photo_url ? (
                <img src={personInfo.photo_url} alt="Person" className="w-32 h-32 rounded-xl object-cover shadow-sm" />
              ) : (
                <div className="w-32 h-32 rounded-xl bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-3xl">
                  {personInfo.name?.charAt(0) || '?'}
                </div>
              )}
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{personInfo.name || 'Unknown Person'}</h2>
                    <p className="text-gray-500">ID: {personInfo.employee_id || 'N/A'}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold border ${getClassificationColor(personInfo.classification)} capitalize`}>
                    {personInfo.classification || 'Unknown'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-y-2 mt-4 text-sm text-gray-700">
                  <p><strong>Department:</strong> {personInfo.department || '-'}</p>
                  <p><strong>Gender:</strong> {personInfo.gender || '-'}</p>
                  <p><strong>Semester:</strong> {personInfo.semester || '-'}</p>
                  <p><strong>Violations:</strong> <span className="text-red-600 font-bold">{personInfo.violation_count || 0}</span></p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <p className="font-semibold text-gray-800">
                    Status: <span className={activeCameraId ? 'text-green-600' : 'text-gray-500'}>
                      {activeCameraId ? `Currently detected on ${cameras.find(c => c.camera_id === activeCameraId)?.name || activeCameraId}` : 'Not currently detected'}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleStartTrack} className="px-4 py-2 bg-[#3f4299] text-white rounded-lg hover:bg-[#2d3170] text-sm font-medium transition-colors">Start Live Track</button>
                    <button onClick={handleStopTrack} className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium transition-colors">Stop Tracking</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* B. Multi-Camera Feed */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-[#3f4299] mb-4">Live Camera Grid</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cameras.map(cam => {
                const isActive = cam.camera_id === activeCameraId;
                return (
                  <div key={cam.camera_id} className={`h-48 rounded-xl overflow-hidden relative transition-all duration-300 ${isActive ? 'border-4 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)] animate-[pulse_2s_ease-in-out_infinite]' : 'border border-gray-200'}`}>
                    <VideoPlayer
                      streamUrl={cam.stream_url}
                      cameraId={cam.camera_id}
                      cameraName={cam.name}
                      autoPlay={true}
                      muted={true}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* C. Live Movement Timeline */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-[#3f4299] mb-4">Live Movement Timeline</h3>
            <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
              {movementHistory.length > 0 ? movementHistory.map((move, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${isLatest ? 'bg-green-500 animate-pulse' : 'bg-[#3f4299]'}`}></div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-gray-200 bg-gray-50 shadow-sm">
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="font-bold text-gray-900">{move.camera_name}</div>
                        <time className="text-xs font-medium text-indigo-600">{new Date(move.entered_at).toLocaleTimeString()}</time>
                      </div>
                      <div className="text-sm text-gray-500">{move.location_description}</div>
                    </div>
                  </div>
                );
              }) : <p className="text-gray-500 text-center relative z-10 bg-white inline-block px-4">No movement history recorded yet.</p>}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-80 flex-shrink-0">
          <div className="sticky top-8">
            {user && <UserProfileCard user={user} />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTrackPage;
