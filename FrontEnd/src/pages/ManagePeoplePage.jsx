import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import AddMemberModal from '../components/AddMemberModal';
import PersonDetailsModal from '../components/PersonDetailsModal';
import EditPhotosModal from '../components/EditPhotosModal';
import ConfirmModal from '../components/ConfirmModal';
import Button from '../components/Button';
import ManageUsersContent from './ManageUsersContent';
import CleanDuplicatesButton from '../components/CleanDuplicatesButton';
import backgroundEllipse from '../assets/background.svg';

const CLASS_OPTIONS = [
  { value: 'student', label: 'Student' },
  { value: 'employee', label: 'Employee' },
  { value: 'employee_admin', label: 'Employee · Admin' },
  { value: 'employee_ssd', label: 'Employee · SSD' },
  { value: 'employee_dept_head', label: 'Employee · Dept Head' },
  { value: 'employee_guard', label: 'Employee · Guard' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'blacklisted', label: 'Blacklisted' },
  { value: 'unknown', label: 'Unknown' },
];

const classFamily = (c) => {
  c = (c || 'unknown').toLowerCase();
  if (c === 'unknown' || c === 'blacklisted' || c === 'visitor') return c;
  return 'known';
};

const getClassColor = (c) => {
  switch (classFamily(c)) {
    case 'unknown': return 'text-red-700';
    case 'blacklisted': return 'text-purple-700';
    case 'visitor': return 'text-blue-700';
    default: return 'text-green-700';
  }
};

const ClassificationDropdown = ({ person, currentVal, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);

  // Render the menu in a fixed-position portal so it is never clipped by the table's
  // horizontal scroll container (overflow-x: auto forces overflow-y to auto, which would
  // otherwise crop the dropdown on the lower rows).
  const computePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const dropUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    setMenuPos({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(160, (dropUp ? spaceAbove : spaceBelow) - 16),
      ...(dropUp
        ? { bottom: window.innerHeight - rect.top + 4 }
        : { top: rect.bottom + 4 }),
    });
  };

  const handleToggle = () => {
    if (!isOpen) computePosition();
    setIsOpen((v) => !v);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (!buttonRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const close = () => setIsOpen(false);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true); // capture: also catch the table's own scroll
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [isOpen]);

  const selectedOption = CLASS_OPTIONS.find(o => o.value === currentVal) || { label: currentVal, value: currentVal };

  return (
    <div className="w-[160px] mx-auto">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between border border-[#bab6b6] rounded px-2 py-1 text-xs font-semibold bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299] ${getClassColor(person.classification)} ${isOpen ? 'ring-2 ring-[#3f4299] border-[#3f4299]' : ''}`}
        style={{ fontFamily: "'Open Sans', sans-serif" }}
      >
        <span className="truncate mr-2 text-center flex-1">{selectedOption.label}</span>
        <svg className={`w-3 h-3 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && menuPos && createPortal(
        <div
          ref={menuRef}
          className="bg-white rounded-[8px] border border-gray-200 overflow-y-auto"
          style={{
            position: 'fixed',
            left: menuPos.left,
            minWidth: menuPos.width,
            maxHeight: menuPos.maxHeight,
            ...(menuPos.top != null ? { top: menuPos.top } : { bottom: menuPos.bottom }),
            zIndex: 1000,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            fontFamily: "'Open Sans', sans-serif"
          }}
        >
          <div className="bg-white rounded-[8px] py-1">
            {CLASS_OPTIONS.map((o) => {
              const isSelected = currentVal === o.value;
              return (
                <div
                  key={o.value}
                  className={`flex items-center cursor-pointer transition-colors border-b border-gray-100 ${isSelected ? 'bg-[#f8f9ff] hover:bg-gray-50' : 'hover:bg-gray-50 bg-white'}`}
                  style={{ padding: '8px 10px' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(person.id, o.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={`flex-1 ${isSelected ? 'text-[#3f4299] font-bold' : 'text-gray-700 font-medium'}`}
                    style={{ fontSize: '13px' }}
                  >
                    {o.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};


const ManagePeoplePage = () => {
  const navigate = useNavigate();
  const isAdmin = (localStorage.getItem('userType') || '').toLowerCase() === 'admin';
  const [activeTab, setActiveTab] = useState('people');
  const [user, setUser] = useState(null);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [editPerson, setEditPerson] = useState(null);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    const userDisplayName = localStorage.getItem('userDisplayName') || localStorage.getItem('userName') || 'Admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    const userEmployeeId = localStorage.getItem('userEmployeeId') || '';
    setUser({ name: userDisplayName, email: userEmail, employeeId: userEmployeeId });
  }, []);

  const fetchPeople = async () => {
    try {
      setLoading(true);
      const userEmail = encodeURIComponent(localStorage.getItem('userEmail') || '');
      const response = await fetch(`/api/people-db/?user=${userEmail}`);
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
        setAlertData({ isOpen: true, message: 'Failed to update classification.' });
      }
    } catch (err) {
      console.error(err);
      setAlertData({ isOpen: true, message: 'Failed to update classification.' });
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
            setAlertData({ isOpen: true, message: data.message || `Failed to ${action.toLowerCase()} person.` });
          }
        } catch (err) {
          console.error(err);
          setAlertData({ isOpen: true, message: `Failed to ${action.toLowerCase()} person.` });
        }
      }
    });
  };

  const handleDeletePerson = (person) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Person',
      message: `Permanently delete ${person.name}? This also removes their violation and movement history, and can't be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/people/${person.id}/delete/`, { method: 'POST' });
          if (response.ok) {
            fetchPeople();
          } else {
            const data = await response.json().catch(() => ({}));
            setAlertData({ isOpen: true, message: data.message || 'Failed to delete person.' });
          }
        } catch (err) {
          console.error(err);
          setAlertData({ isOpen: true, message: 'Failed to delete person.' });
        }
      }
    });
  };



  // Value to show as selected; fall back for legacy values not in the list.
  const currentClassValue = (c) => {
    c = (c || 'unknown').toLowerCase();
    if (CLASS_OPTIONS.some((o) => o.value === c)) return c;
    if (c === 'known' || c === 'faculty') return 'employee';
    return 'unknown';
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="fixed bottom-0 left-0 w-full z-0">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: 'clamp(16px, 5vw, 100px)', paddingRight: 'clamp(16px, 5vw, 100px)' }}>
        <div className="flex w-full">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3" style={{ marginBottom: '20px' }}>
              {/* Left area: Clean Duplicates Button */}
              <div className="flex-1 flex justify-start">
                {isAdmin && activeTab === 'people' && (
                  <CleanDuplicatesButton />
                )}
              </div>
              
              {/* Centered Toggle Buttons */}
              <div className="flex items-center justify-center gap-2 flex-1">
                {isAdmin && (
                  <>
                    <Button variant={activeTab === 'users' ? 'primary' : 'outline'} onClick={() => setActiveTab('users')}>
                      USERS
                    </Button>
                    <Button variant={activeTab === 'people' ? 'primary' : 'outline'} onClick={() => setActiveTab('people')}>
                      PEOPLE
                    </Button>
                  </>
                )}
              </div>
              
              {/* Right-aligned Add Member button */}
              <div className="flex-1 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setShowAddModal(true)}
                  style={{ width: '200px', height: '48px', fontSize: '16px', fontFamily: "'Open Sans', sans-serif" }}
                >
                  + Add Member
                </Button>
              </div>
            </div>

            {activeTab === 'people' ? (
              <>
                {loading ? (
              <div className="flex items-center justify-center py-12"><div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden" style={{ marginBottom: '20px' }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Photo</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Name</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">ID / Email</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Dept / Role</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Classification</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Violations</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {people.map((p) => (
                        <tr key={p.id} className="leading-[2.5] hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-center align-middle">
                            <div className="flex justify-center w-full">
                              {p.photo_url ? (
                                <img src={p.photo_url} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold">{p.name.charAt(0)}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900 font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="font-medium text-gray-900">{p.employee_id || '-'}</div>
                            <div className="text-gray-500">{p.email || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <div className="text-gray-900">{p.department || '-'}</div>
                            <div className="text-gray-500 capitalize">{p.role || '-'}</div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center align-middle">
                            <div className="flex justify-center w-full">
                              <ClassificationDropdown
                                person={p}
                                currentVal={currentClassValue(p.classification)}
                                onChange={handleClassificationChange}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-center font-bold text-red-600">{p.violation_count}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">{p.status}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => setSelectedPerson(p)} className="px-2 py-1 text-xs font-medium text-[#3f4299] hover:bg-blue-50 rounded transition-colors">View</button>
                              <button onClick={() => setEditPerson(p)} className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded transition-colors">Edit</button>
                              <button onClick={() => handleBlacklistToggle(p)} className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors">
                                {p.classification === 'blacklisted' ? 'Unblacklist' : 'Blacklist'}
                              </button>
                              <button onClick={() => handleDeletePerson(p)} className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors">
                                Delete
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
              </>
            ) : (
              <ManageUsersContent />
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

export default ManagePeoplePage;
