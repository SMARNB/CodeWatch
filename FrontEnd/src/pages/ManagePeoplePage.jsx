import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import AddMemberModal from '../components/AddMemberModal';
import backgroundEllipse from '../assets/background.svg';

// Person details modal
const PersonDetailsModal = ({ person, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div className="relative bg-white rounded-[8px] shadow-xl w-full max-w-lg mx-4 overflow-hidden flex flex-col p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold text-[#3f4299] mb-4 text-center">Person Details</h2>
        <div className="flex items-center gap-6 mb-6">
          {person.photo_url ? (
            <img src={person.photo_url} alt={person.name} className="w-24 h-24 rounded-full object-cover border-2 border-gray-200" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl">
              {person.name.charAt(0)}
            </div>
          )}
          <div>
            <h3 className="text-xl font-bold text-gray-900">{person.name}</h3>
            <p className="text-gray-500">{person.employee_id}</p>
            <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{person.role}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div><p className="text-sm text-gray-500 font-semibold">Email</p><p className="text-gray-900">{person.email || '-'}</p></div>
          <div><p className="text-sm text-gray-500 font-semibold">Department</p><p className="text-gray-900">{person.department || '-'}</p></div>
          <div><p className="text-sm text-gray-500 font-semibold">Classification</p><p className="text-gray-900 capitalize">{person.classification || '-'}</p></div>
          <div><p className="text-sm text-gray-500 font-semibold">Violations</p><p className="text-red-600 font-bold">{person.violation_count || 0}</p></div>
          <div><p className="text-sm text-gray-500 font-semibold">Face Embedding</p><p className="text-gray-900">{person.status}</p></div>
          <div><p className="text-sm text-gray-500 font-semibold">Added On</p><p className="text-gray-900">{new Date(person.created_at).toLocaleDateString()}</p></div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-[#3f4299] text-white rounded-[8px]">Close</button>
        </div>
      </div>
    </div>
  );
};

// Edit / add-photos modal
const EditPhotosModal = ({ person, onClose, onSuccess }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) {
      setIsError(true);
      setMessage('Please choose at least one photo.');
      return;
    }
    setUploading(true);
    setMessage('');
    const form = new FormData();
    files.forEach(f => form.append('photos', f));
    try {
      const res = await fetch(`/api/people/${person.id}/add-photos/`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsError(false);
        setMessage(`Added ${data.added} photo(s). This person now has ${data.total_embeddings} embedding(s).`);
        if (onSuccess) onSuccess();
        setTimeout(() => { if (onClose) onClose(); }, 1300);
      } else {
        setIsError(true);
        setMessage(data.message || 'Upload failed.');
      }
    } catch (e) {
      console.error(e);
      setIsError(true);
      setMessage('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-semibold text-[#3f4299] mb-2 text-center">Edit Photos</h2>
        <p className="text-sm text-gray-500 text-center mb-4">{person.name} — add one or more clear, front-facing photos to improve recognition. The first valid photo also becomes the profile picture.</p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files))}
          className="w-full text-sm text-gray-700 mb-3 border border-gray-300 rounded-[8px] p-2"
        />
        {files.length > 0 && <p className="text-xs text-gray-500 mb-3">{files.length} file(s) selected.</p>}
        {message && <p className={`text-sm mb-3 ${isError ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 rounded-[8px] hover:bg-gray-100">Cancel</button>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`px-4 py-2 bg-[#3f4299] text-white rounded-[8px] hover:bg-[#2d3170] ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {uploading ? 'Uploading...' : 'Upload Photos'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ManagePeoplePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editPerson, setEditPerson] = useState(null);

  useEffect(() => {
    const userDisplayName = localStorage.getItem('userDisplayName') || localStorage.getItem('userName') || 'Admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    setUser({ name: userDisplayName, email: userEmail, employeeId: 'ADM001' });
  }, []);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/people-db/');
      if (response.ok) {
        const data = await response.json();
        setPeople(data);
      }
    } catch (error) {
      console.error('Failed to fetch people:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeople();
  }, []);

  const handleClassificationChange = async (personId, newClassification) => {
    try {
      const response = await fetch(`/api/people/${personId}/classification/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classification: newClassification })
      });
      if (response.ok) {
        fetchPeople();
      } else {
        alert('Failed to update classification.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to update classification.');
    }
  };

  const handleBlacklistToggle = async (person) => {
    const isBlacklisted = person.classification === 'blacklisted';
    const action = isBlacklisted ? 'Unblacklist' : 'Blacklist';
    if (window.confirm(`Are you sure you want to ${action} ${person.name}?`)) {
      try {
        const response = await fetch('/api/blacklist/toggle/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ person_id: person.id, reason: 'Manually blacklisted from Admin Panel', violation_threshold: 0 })
        });
        if (response.ok) {
          fetchPeople();
        } else {
          const data = await response.json().catch(() => ({}));
          alert(data.message || `Failed to ${action.toLowerCase()} person.`);
        }
      } catch (err) {
        console.error(err);
        alert(`Failed to ${action.toLowerCase()} person.`);
      }
    }
  };

  const normClass = (c) => {
    c = (c || 'unknown').toLowerCase();
    if (c === 'student' || c === 'employee' || c === 'faculty') return 'known';
    if (['known', 'unknown', 'blacklisted', 'visitor'].includes(c)) return c;
    return 'unknown';
  };

  const getClassColor = (c) => {
    switch (normClass(c)) {
      case 'known': return 'text-green-700';
      case 'unknown': return 'text-red-700';
      case 'blacklisted': return 'text-purple-700';
      case 'visitor': return 'text-blue-700';
      default: return 'text-gray-700';
    }
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
                <h2 className="text-3xl font-bold text-[#3f4299]">Manage People</h2>
              </div>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-[#3f4299] text-white rounded-[8px] hover:bg-[#2d3170] transition-colors font-medium">
                + Add Member
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
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Photo</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID / Email</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dept / Role</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Classification</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Violations</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {people.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            {p.photo_url ? (
                                <img src={p.photo_url} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">{p.name.charAt(0)}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-sm">
                            <div className="font-medium text-gray-900">{p.employee_id || '-'}</div>
                            <div className="text-gray-500">{p.email || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="text-gray-900">{p.department || '-'}</div>
                            <div className="text-gray-500 capitalize">{p.role || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <select
                              value={normClass(p.classification)}
                              onChange={(e) => handleClassificationChange(p.id, e.target.value)}
                              className={`border border-gray-300 rounded px-2 py-1 text-xs font-semibold uppercase bg-white ${getClassColor(p.classification)}`}
                            >
                              <option value="known">Known</option>
                              <option value="unknown">Unknown</option>
                              <option value="blacklisted">Blacklisted</option>
                              <option value="visitor">Visitor</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm font-bold text-red-600">{p.violation_count}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.status}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setSelectedPerson(p)} className="px-2 py-1 text-xs font-medium text-[#3f4299] hover:bg-blue-50 rounded transition-colors">View</button>
                              <button onClick={() => setEditPerson(p)} className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors">Edit</button>
                              <button onClick={() => handleBlacklistToggle(p)} className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors">
                                {p.classification === 'blacklisted' ? 'Unblacklist' : 'Blacklist'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {people.length === 0 && (
                        <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-500">No people found.</td></tr>
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
      {showAddModal && <AddMemberModal onClose={() => { setShowAddModal(false); fetchPeople(); }} />}
      {selectedPerson && <PersonDetailsModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
      {editPerson && <EditPhotosModal person={editPerson} onClose={() => setEditPerson(null)} onSuccess={fetchPeople} />}
    </div>
  );
};

export default ManagePeoplePage;
