import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Logo from '../components/Logo';
import ConfirmModal from '../components/ConfirmModal';
import Button from '../components/Button';
import backgroundEllipse from '../assets/background.svg';

const RoleDropdown = ({ user, currentVal, onChange, roles }) => {
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
    const dropUp = spaceBelow < 230 && spaceAbove > spaceBelow;
    setMenuPos({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(140, (dropUp ? spaceAbove : spaceBelow) - 16),
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

  const selectedOption = roles.find(o => o.value === currentVal) || { label: 'Select Role', value: currentVal };

  return (
    <div className="inline-block w-[160px]">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`w-full flex items-center justify-between border border-[#bab6b6] rounded px-2 py-1 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299] ${isOpen ? 'ring-2 ring-[#3f4299] border-[#3f4299]' : ''}`}
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
            {roles.map((o) => {
              const isSelected = currentVal === o.value;
              return (
                <div
                  key={o.value}
                  className={`flex items-center justify-center cursor-pointer transition-colors border-b border-gray-100 ${isSelected ? 'bg-[#f8f9ff] hover:bg-gray-50' : 'hover:bg-gray-50 bg-white'}`}
                  style={{ padding: '8px 10px' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(user.id, o.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={`flex-1 text-center ${isSelected ? 'text-[#3f4299] font-bold' : 'text-gray-700 font-medium'}`}
                    style={{ fontSize: '14px' }}
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

const ManageUsersContent = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightEmail = (searchParams.get('highlightEmail') || '').toLowerCase();
  const [highlightId, setHighlightId] = useState(null);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    const userDisplayName = localStorage.getItem('userDisplayName') || localStorage.getItem('userName') || 'Admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    const userEmployeeId = localStorage.getItem('userEmployeeId') || '';
    setUser({ name: userDisplayName, email: userEmail, employeeId: userEmployeeId });
  }, []);

  const fetchUsers = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const response = await fetch('/api/users/');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // Re-poll quietly so Online/Offline tracks heartbeats without flashing the spinner.
    const id = setInterval(() => fetchUsers(false), 15000);
    return () => clearInterval(id);
  }, []);

  // Arriving from a password-reset notification: highlight + scroll to that user
  useEffect(() => {
    if (!highlightEmail || users.length === 0) return;
    const match = users.find(u => (u.email || '').toLowerCase() === highlightEmail);
    if (match) {
      setHighlightId(match.id);
      setTimeout(() => {
        document.getElementById(`user-row-${match.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [highlightEmail, users]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const response = await fetch(`/api/users/${userId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (response.ok) {
        fetchUsers();
      } else {
        setAlertData({ isOpen: true, message: 'Failed to update user role.' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (userObj) => {
    // Block deleting the account you're currently logged in as
    const myEmail = (localStorage.getItem('userEmail') || '').toLowerCase();
    const myName = (localStorage.getItem('userName') || localStorage.getItem('userDisplayName') || '').toLowerCase();
    const isSelf =
      (userObj.email && userObj.email.toLowerCase() === myEmail) ||
      (userObj.username && userObj.username.toLowerCase() === myName);
    if (isSelf) {
      setConfirmState({
        isOpen: true,
        title: 'Action Denied',
        message: "You can't delete the account you're currently logged in as.",
        hideCancel: true,
        confirmText: 'OK',
        isDanger: false,
        onConfirm: () => { }
      });
      return;
    }

    setConfirmState({
      isOpen: true,
      title: 'Delete User',
      message: `Permanently delete "${userObj.username}"? This cannot be undone.`,
      isDanger: true,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/users/${userObj.id}/`, { method: 'DELETE' });
          if (response.ok) {
            fetchUsers();
          } else {
            const data = await response.json().catch(() => ({}));
            setAlertData({ isOpen: true, message: data.message || 'Failed to delete user.' });
          }
        } catch (err) {
          console.error(err);
          setAlertData({ isOpen: true, message: 'Failed to delete user.' });
        }
      }
    });
  };

  const handleResetPassword = (userObj) => {
    setConfirmState({
      isOpen: true,
      title: 'Reset Password',
      message: `Reset ${userObj.username}'s password to the default (password123)?`,
      isDanger: false,
      onConfirm: async () => {
        try {
          const response = await fetch(`/api/users/${userObj.id}/reset-password/`, { method: 'POST' });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            setAlertData({ isOpen: true, message: data.message || 'Password reset to the default.' });
          } else {
            setAlertData({ isOpen: true, message: data.message || 'Failed to reset password.' });
          }
        } catch (err) {
          console.error(err);
          setAlertData({ isOpen: true, message: 'Failed to reset password.' });
        }
      }
    });
  };

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'ssd', label: 'SSD' },
    { value: 'department-head', label: 'Department Head' },
    { value: 'guard', label: 'Guard' }
  ];

  return (
    <div className="w-full">
      {loading ? (
              <div className="flex items-center justify-center py-12"><div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden" style={{ marginBottom: '20px' }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Username</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Email</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Role</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-[15px] align-middle text-center text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          id={`user-row-${u.id}`}
                          className={`leading-[2.5] transition-colors ${u.id === highlightId ? 'bg-indigo-100' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-[15px] align-middle text-center text-sm text-gray-900 font-medium">{u.username}</td>
                          <td className="px-4 py-[15px] align-middle text-center text-sm text-gray-500">{u.email}</td>
                          <td className="px-4 py-[15px] align-middle text-center text-sm">
                            <div className="relative inline-flex items-center justify-center">
                              <RoleDropdown
                                user={u}
                                currentVal={u.role || ''}
                                onChange={handleRoleChange}
                                roles={roles}
                              />
                              {u.role === 'department-head' && u.department && (
                                <span className="absolute left-[calc(100%+20px)] text-xs text-gray-500 font-medium bg-gray-100 px-4 py-1 rounded-full border border-gray-200 whitespace-nowrap min-w-[80px] text-center">
                                  {u.department}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-[15px] align-middle text-center">
                            <span className={`inline-block min-w-[80px] text-center px-4 py-1 rounded-full text-xs font-semibold ${u.is_online ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                              {u.is_online ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td className="px-4 py-[15px] align-middle text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleResetPassword(u)}
                                className="px-3 py-1 text-xs font-medium rounded transition-colors text-[#3f4299] hover:bg-blue-50"
                              >
                                Reset Password
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="px-3 py-1 text-xs font-medium rounded transition-colors text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {users.length === 0 && (
                        <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No users found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <ConfirmModal
              {...confirmState}
              onClose={() => setConfirmState(s => ({ ...s, isOpen: false }))}
            />

            <ConfirmModal
              isOpen={alertData.isOpen}
              onClose={() => setAlertData({ isOpen: false, message: '' })}
              onConfirm={() => setAlertData({ isOpen: false, message: '' })}
              title="Alert"
              message={alertData.message}
              confirmText="OK"
              hideCancel={true}
            />
    </div>
  );
};

export default ManageUsersContent;
