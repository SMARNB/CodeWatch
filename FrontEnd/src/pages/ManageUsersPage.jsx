import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';

const ManageUsersPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userDisplayName = localStorage.getItem('userDisplayName') || localStorage.getItem('userName') || 'Admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    setUser({ name: userDisplayName, email: userEmail, employeeId: 'ADM001' });
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users/');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
        alert('Failed to update user role.');
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
      alert("You can't delete the account you're currently logged in as.");
      return;
    }

    if (window.confirm(`Permanently delete "${userObj.username}"? This cannot be undone.`)) {
      try {
        const response = await fetch(`/api/users/${userObj.id}/`, { method: 'DELETE' });
        if (response.ok) {
          fetchUsers();
        } else {
          const data = await response.json().catch(() => ({}));
          alert(data.message || 'Failed to delete user.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to delete user.');
      }
    }
  };

  const handleResetPassword = async (userObj) => {
    if (window.confirm(`Reset ${userObj.username}'s password to the default (password123)?`)) {
      try {
        const response = await fetch(`/api/users/${userObj.id}/reset-password/`, { method: 'POST' });
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          alert(data.message || 'Password reset to the default.');
        } else {
          alert(data.message || 'Failed to reset password.');
        }
      } catch (err) {
        console.error(err);
        alert('Failed to reset password.');
      }
    }
  };

  const roles = [
    { value: 'admin', label: 'Admin' },
    { value: 'ssd', label: 'SSD' },
    { value: 'department-head', label: 'Department Head' },
    { value: 'guard', label: 'Guard' }
  ];

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
                <h2 className="text-3xl font-bold text-[#3f4299]">Manage Users</h2>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12"><div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div></div>
            ) : (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden" style={{ marginBottom: '20px' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Username</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Role</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{u.username}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                          <td className="px-4 py-3 text-sm">
                            <select 
                              value={u.role || ''} 
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              className="border border-gray-300 rounded px-2 py-1 text-sm bg-white"
                            >
                              <option value="">Select Role</option>
                              {roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
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
          </div>
          <div className="w-80 flex-shrink-0" style={{ marginLeft: '100px' }}>
            <div>{user && <UserProfileCard user={user} />}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageUsersPage;
