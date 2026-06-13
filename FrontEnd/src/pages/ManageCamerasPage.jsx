import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import AddCameraModal from '../components/AddCameraModal';
import ConfirmModal from '../components/ConfirmModal';
import backgroundEllipse from '../assets/background.svg';

// Simple Edit Camera Modal component internal to the page for simplicity
import EditCameraModal from '../components/EditCameraModal';

const ManageCamerasPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    const userDisplayName = localStorage.getItem('userDisplayName') || localStorage.getItem('userName') || 'Admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    const userEmployeeId = localStorage.getItem('userEmployeeId') || '';
    setUser({ name: userDisplayName, email: userEmail, employeeId: userEmployeeId });
  }, []);

  const fetchCameras = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const response = await fetch('/api/cameras/');
      if (response.ok) {
        const data = await response.json();
        setCameras(data);
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
    // Re-poll quietly so Online/Offline tracks heartbeats without flashing the spinner.
    const id = setInterval(() => fetchCameras(false), 15000);
    return () => clearInterval(id);
  }, []);

  const handleDelete = (cameraId) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Camera',
      message: `Are you sure you want to delete camera ${cameraId}?`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/cameras/${cameraId}/`, { method: 'DELETE' });
          if (response.ok) {
            fetchCameras();
          } else {
            setAlertData({ isOpen: true, message: 'Failed to delete camera.' });
          }
        } catch (err) {
          console.error(err);
        }
      }
    });
  };



  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="fixed bottom-0 left-0 w-full z-0">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: 'clamp(16px, 5vw, 100px)', paddingRight: 'clamp(16px, 5vw, 100px)' }}>
        <div className="flex w-full">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-end" style={{ marginBottom: '20px' }}>
              <button 
                onClick={() => setShowAddCameraModal(true)} 
                className="h-[48px] px-[10px] bg-[#3f4299] text-white text-[16px] font-bold rounded-[8px] hover:bg-[#2d3170] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
                style={{ fontFamily: "'Open Sans', sans-serif", width: '200px' }}
              >
                + Add Camera
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden" style={{ marginBottom: '20px' }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Camera ID</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Location</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">IP Address</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Stream URL</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cameras.map((camera) => (
                        <tr key={camera.id} className="leading-[2.5] hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-[15px] align-middle text-center text-sm text-gray-900">{camera.name}</td>
                          <td className="px-4 py-[15px] align-middle text-center text-sm text-gray-900 font-medium">{camera.camera_id}</td>
                          <td className="px-4 py-[15px] align-middle text-center text-sm text-gray-900">{camera.location}</td>
                          <td className="px-4 py-[15px] align-middle text-center text-sm text-gray-900">{camera.ip_address}</td>
                          <td className="px-4 py-[15px] align-middle text-center text-sm text-gray-500 max-w-[150px] truncate mx-auto" title={camera.stream_url}>{camera.stream_url || '-'}</td>
                          <td className="px-4 py-[15px] align-middle text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${camera.is_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                              <span className="text-sm text-gray-700">{camera.is_online ? 'Online' : 'Offline'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-[15px] align-middle text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setEditingCamera(camera)} className="px-3 py-1 text-xs font-medium text-[#3f4299] hover:bg-blue-50 rounded transition-colors">Edit</button>
                              <button onClick={() => handleDelete(camera.camera_id)} className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {cameras.length === 0 && (
                        <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">No cameras found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {showAddCameraModal && <AddCameraModal onClose={() => { setShowAddCameraModal(false); fetchCameras(); }} />}
      {editingCamera && <EditCameraModal camera={editingCamera} onClose={() => setEditingCamera(null)} onSave={fetchCameras} />}
      <ConfirmModal {...confirmState} onClose={() => setConfirmState(s => ({ ...s, isOpen: false }))} />

      <ConfirmModal
        isOpen={alertData.isOpen}
        onClose={() => setAlertData(s => ({ ...s, isOpen: false }))}
        onConfirm={() => setAlertData(s => ({ ...s, isOpen: false }))}
        title="Alert"
        message={alertData.message}
        confirmText="OK"
        hideCancel={true}
      />
    </div>
  );
};

export default ManageCamerasPage;
