import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import AddCameraModal from '../components/AddCameraModal';
import backgroundEllipse from '../assets/background.svg';

// Simple Edit Camera Modal component internal to the page for simplicity
const EditCameraModal = ({ camera, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: camera.name || '',
    location: camera.location || '',
    ip_address: camera.ip_address || '',
    status: camera.status || '',
    stream_url: camera.stream_url || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/cameras/${camera.camera_id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onSave();
        onClose();
      } else {
        const errorData = await response.json();
        alert("❌ Error: " + (errorData.message || "Failed to update camera"));
      }
    } catch (error) {
      console.error("Error:", error);
      alert("❌ Network Error: Is the Backend running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  const statuses = ['Active', 'Inactive', 'Maintenance'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-[#3f4299] text-center mb-4" style={{ fontFamily: "'Open Sans', sans-serif" }}>Edit Camera ({camera.camera_id})</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input type="text" name="name" value={formData.name} onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input type="text" name="location" value={formData.location} onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IP Address</label>
            <input type="text" name="ip_address" value={formData.ip_address} onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select name="status" value={formData.status} onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2">
              <option value="">Select Status</option>
              {statuses.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stream URL</label>
            <input type="text" name="stream_url" value={formData.stream_url} onChange={handleInputChange} className="w-full border border-gray-300 rounded p-2" />
          </div>
        </div>
        <div className="flex justify-end mt-4 gap-2">
          <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded text-sm">Cancel</button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="px-4 py-2 bg-[#3f4299] text-white rounded text-sm">{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  );
};

const ManageCamerasPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);

  useEffect(() => {
    const userDisplayName = localStorage.getItem('userDisplayName') || localStorage.getItem('userName') || 'Admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    setUser({ name: userDisplayName, email: userEmail, employeeId: 'ADM001' });
  }, []);

  const fetchCameras = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cameras/');
      if (response.ok) {
        const data = await response.json();
        setCameras(data);
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  const handleDelete = async (cameraId) => {
    if (window.confirm(`Are you sure you want to delete camera ${cameraId}?`)) {
      try {
        const response = await fetch(`/api/cameras/${cameraId}/`, { method: 'DELETE' });
        if (response.ok) {
          fetchCameras();
        } else {
          alert('Failed to delete camera.');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'bg-green-500';
    if (s === 'maintenance') return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            <div className="flex items-center" style={{ marginLeft: '20px' }}>
              <Logo size="default" showText={false} />
            </div>
            <div className="flex-1 flex justify-center">
              <h1 className="text-2xl font-bold text-[#3f4299] text-center">Code Watch Admin</h1>
            </div>
            <div className="w-16"></div>
          </div>
        </div>
      </div>

      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        <div className="flex w-full">
          <div className="flex-1">
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 className="text-3xl font-bold text-[#3f4299]">Manage Cameras</h2>
              </div>
              <button onClick={() => setShowAddCameraModal(true)} className="px-4 py-2 bg-[#3f4299] text-white rounded-[8px] hover:bg-[#2d3170] transition-colors font-medium">
                + Add Camera
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden" style={{ marginBottom: '20px' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Camera ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Location</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">IP Address</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Stream URL</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {cameras.map((camera) => (
                        <tr key={camera.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900">{camera.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{camera.camera_id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{camera.location}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{camera.ip_address}</td>
                          <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate" title={camera.stream_url}>{camera.stream_url || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getStatusColor(camera.status)}`}></div>
                              <span className="text-sm capitalize text-gray-700">{camera.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
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
          <div className="w-80 flex-shrink-0" style={{ marginLeft: '100px' }}>
            <div>{user && <UserProfileCard user={user} />}</div>
          </div>
        </div>
      </div>

      {showAddCameraModal && <AddCameraModal onClose={() => { setShowAddCameraModal(false); fetchCameras(); }} />}
      {editingCamera && <EditCameraModal camera={editingCamera} onClose={() => setEditingCamera(null)} onSave={fetchCameras} />}
    </div>
  );
};

export default ManageCamerasPage;
