import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import AddMemberModal from '../components/AddMemberModal';
import backgroundEllipse from '../assets/background.svg';

// Simple details modal
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
            <span className={`inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800`}>
              {person.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500 font-semibold">Email</p>
            <p className="text-gray-900">{person.email || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Department</p>
            <p className="text-gray-900">{person.department || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Classification</p>
            <p className="text-gray-900 capitalize">{person.classification || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Violations</p>
            <p className="text-red-600 font-bold">{person.violation_count || 0}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Face Embedding</p>
            <p className="text-gray-900">{person.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500 font-semibold">Added On</p>
            <p className="text-gray-900">{new Date(person.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-[#3f4299] text-white rounded-[8px]">Close</button>
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

  const handleBlacklistToggle = async (person) => {
    const isBlacklisted = person.classification === 'blacklisted';
    const action = isBlacklisted ? 'Unblacklist' : 'Blacklist';
    
    if (window.confirm(`Are you sure you want to ${action} ${person.name}?`)) {
      try {
        if (isBlacklisted) {
          // Unblacklist: need to find the blacklist entry. For simplicity in UI, we might just call a special endpoint or we can find it.
          // Since we don't have the blacklist entry ID easily available here, ideally the backend should handle unblacklisting via person ID.
          // We can do a PATCH or DELETE to the blacklist API. For now, this is a placeholder for the actual API call logic.
          alert("Unblacklist requested. (Backend route needs to accept person_id to delete or you must fetch the blacklist ID first)");
          // Let's assume we can't easily unblacklist without the ID. 
        } else {
          // Blacklist
          const response = await fetch('/api/blacklist/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ person_id: person.id, reason: 'Manually blacklisted from Admin Panel', violation_threshold: 0 })
          });
          if (response.ok) {
            fetchPeople();
          } else {
            alert('Failed to blacklist person.');
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const getClassificationBadge = (classification) => {
    const c = (classification || 'unknown').toLowerCase();
    let bg = 'bg-gray-100 text-gray-800';
    if (c === 'known' || c === 'student' || c === 'employee' || c === 'faculty') bg = 'bg-green-100 text-green-800';
    else if (c === 'unknown') bg = 'bg-red-100 text-red-800';
    else if (c === 'blacklisted') bg = 'bg-purple-100 text-purple-800';
    else if (c === 'visitor') bg = 'bg-blue-100 text-blue-800';
    
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${bg}`}>{c}</span>;
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
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                                    {p.name.charAt(0)}
                                </div>
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
                          <td className="px-4 py-3 text-sm">{getClassificationBadge(p.classification)}</td>
                          <td className="px-4 py-3 text-sm font-bold text-red-600">{p.violation_count}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{p.status}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setSelectedPerson(p)} className="px-2 py-1 text-xs font-medium text-[#3f4299] hover:bg-blue-50 rounded transition-colors">View</button>
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
    </div>
  );
};

export default ManagePeoplePage;
