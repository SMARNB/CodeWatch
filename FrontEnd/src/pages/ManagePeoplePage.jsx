import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import AddMemberModal from '../components/AddMemberModal';
import PersonDetailsModal from '../components/PersonDetailsModal';
import EditPhotosModal from '../components/EditPhotosModal';
import ConfirmModal from '../components/ConfirmModal';
import backgroundEllipse from '../assets/background.svg';

const ManagePeoplePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editPerson, setEditPerson] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });

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

  const handleBlacklistToggle = (person) => {
    const isBlacklisted = person.classification === 'blacklisted';
    const action = isBlacklisted ? 'Unblacklist' : 'Blacklist';
    
    setConfirmState({
      isOpen: true,
      title: `${action} Person`,
      message: `Are you sure you want to ${action.toLowerCase()} ${person.name}?`,
      isDanger: !isBlacklisted, // Red button if blacklisting
      onConfirm: async () => {
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
    });
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
      </div>      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        <div className="flex w-full">
          <div className="flex-1">
            <div className="flex items-center justify-end" style={{ marginBottom: '20px' }}>
              <button 
                onClick={() => setShowAddModal(true)} 
                className="h-[48px] px-[10px] bg-[#3f4299] text-white text-[16px] font-bold rounded-[8px] hover:bg-[#2d3170] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
                style={{ fontFamily: "'Open Sans', sans-serif", width: '200px' }}
              >
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
        </div>
      </div>
      {showAddModal && <AddMemberModal onClose={() => { setShowAddModal(false); fetchPeople(); }} />}
      {selectedPerson && <PersonDetailsModal person={selectedPerson} onClose={() => setSelectedPerson(null)} />}
      {editPerson && (
        <EditPhotosModal
          person={editPerson}
          onClose={() => setEditPerson(null)}
          onSuccess={() => {
            setEditPerson(null);
            fetchPeople();
          }}
        />
      )}

      <ConfirmModal
        {...confirmState}
        onClose={() => setConfirmState(s => ({ ...s, isOpen: false }))}
      />
    </div>
  );
};

export default ManagePeoplePage;
