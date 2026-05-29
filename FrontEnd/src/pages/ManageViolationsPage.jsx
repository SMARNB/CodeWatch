import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfileCard from '../components/UserProfileCard';
import Button from '../components/Button';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';

const ManageViolationsPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const [typeFilter, setTypeFilter] = useState('all');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const [selectedViolations, setSelectedViolations] = useState([]);

  const userType = localStorage.getItem('userType') || 'admin';

  // Get user data from localStorage
  useEffect(() => {
    const getUserData = () => {
      const userEmail = localStorage.getItem('userEmail') ||
        localStorage.getItem('userName') ||
        localStorage.getItem('username') ||
        '';

      const userDisplayName = localStorage.getItem('userDisplayName') ||
        localStorage.getItem('userFullName') ||
        localStorage.getItem('displayName') ||
        localStorage.getItem('fullName') ||
        userEmail.split('@')[0] ||
        'User';

      const employeeId = localStorage.getItem('employeeId') ||
        localStorage.getItem('employeeID') ||
        (() => {
          const prefix = userType === 'admin' ? 'ADM' :
            userType === 'ssd' ? 'SSD' : 'DHD';
          if (userEmail) {
            const emailPart = userEmail.split('@')[0];
            const numbers = emailPart.match(/\d/g);
            if (numbers && numbers.length > 0) {
              return `${prefix}${numbers.slice(-3).join('').padStart(3, '0')}`;
            }
          }
          return `${prefix}001`;
        })();

      const userData = {
        name: userDisplayName,
        email: userEmail || 'admin@company.com',
        employeeId: employeeId,
      };

      setUser(userData);
    };

    getUserData();

    const handleStorageChange = (e) => {
      const userDataKeys = [
        'userName', 'userEmail', 'username', 'user_email',
        'userFullName', 'userDisplayName', 'displayName', 'fullName',
        'employeeId', 'employeeID'
      ];

      if (userDataKeys.includes(e.key)) {
        getUserData();
      }
    };

    const handleCustomStorage = () => {
      getUserData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userDataUpdated', handleCustomStorage);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userDataUpdated', handleCustomStorage);
    };
  }, [userType]);

  // Fetch violations data
  const fetchViolations = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams({
        page,
        page_size: 50,
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(cameraFilter !== 'all' && { camera_id: cameraFilter }),
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo }),
      });
      
      const response = await fetch(`/api/violations/?${queryParams.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch violations");

      const data = await response.json();
      
      setViolations(data.results || []);
      setTotalPages(data.pages || 1);
      setTotalCount(data.total || 0);
      
    } catch (error) {
      console.error('Failed to fetch violations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();
  }, [page, typeFilter, cameraFilter, dateFrom, dateTo]);

  const handleFilterChange = () => {
    setPage(1); // Reset to page 1 on filter change
  };

  const handleViolationClick = (violation) => {
    if (violation.notification_id) {
       navigate(`/notification-details?id=${violation.notification_id}`);
    } else {
       alert("No linked notification for this violation.");
    }
  };

  const handleSelectViolation = (violationId) => {
    setSelectedViolations(prev =>
      prev.includes(violationId)
        ? prev.filter(id => id !== violationId)
        : [...prev, violationId]
    );
  };

  const handleSelectAll = () => {
    if (selectedViolations.length === violations.length) {
      setSelectedViolations([]);
    } else {
      setSelectedViolations(violations.map(v => v.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedViolations.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedViolations.length} violation(s)?`)) {
      try {
        // Delete sequentially or parallel
        const violationIdsToDelete = selectedViolations;

        await Promise.all(violationIdsToDelete.map(id =>
          fetch(`/api/violations/${id}/`, { method: 'DELETE' })
        ));

        setViolations(prev => prev.filter(v => !selectedViolations.includes(v.id)));
        setSelectedViolations([]);
      } catch (err) {
        console.error("Failed to delete violations:", err);
        alert("Failed to delete some violations.");
      }
    }
  };

  const handleStatusChange = (violationId, newStatus) => {
    setViolations(prev =>
      prev.map(v => v.id === violationId ? { ...v, status: newStatus } : v)
    );
  };

  const handleBackClick = () => {
    navigate('/admin/notifications');
  };

  // Helper to safely format date string or object
  const formatDate = (dateInput) => {
    if (!dateInput) return '-';
    // If it's already a formatted string from backend (e.g. "Jan 23, 2026..."), return as is
    if (typeof dateInput === 'string' && dateInput.includes(',')) return dateInput;

    return new Date(dateInput).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const statusColors = {
      'Pending': 'bg-yellow-100 text-yellow-800',
      'Under Review': 'bg-blue-100 text-blue-800',
      'Resolved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity) => {
    const severityColors = {
      'High': 'text-red-600',
      'Medium': 'text-yellow-600',
      'Low': 'text-green-600'
    };
    return severityColors[severity] || 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Navbar */}
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            {/* Logo - Left */}
            <div className="flex items-center" style={{ marginLeft: '20px' }}>
              <Logo size="default" showText={false} />
            </div>

            {/* Code Watch - Center */}
            <div className="flex-1 flex justify-center">
              <h1 className="text-2xl font-bold text-[#3f4299] text-center">
                Code Watch
              </h1>
            </div>

            {/* Right side - Empty for balance */}
            <div className="w-16"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        <div className="flex w-full">
          {/* Left Column - Main Content */}
          <div className="flex-1">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackClick}
                  className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors"
                  aria-label="Back"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="text-3xl font-bold text-[#3f4299]">
                  Manage Violations
                </h2>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-wrap items-center gap-4" style={{ marginBottom: '20px' }}>
              <select
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); handleFilterChange(); }}
                className="h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                <option value="all">All Violation Types</option>
                <option value="Unauthorized Access">Unauthorized Access</option>
                <option value="Dress Code Violation">Dress Code Violation</option>
                <option value="Restricted Area">Restricted Area</option>
              </select>

              <select
                value={cameraFilter}
                onChange={(e) => { setCameraFilter(e.target.value); handleFilterChange(); }}
                className="h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                <option value="all">All Cameras</option>
                <option value="CAM-001">CAM-001 (Main Entrance)</option>
                <option value="CAM-002">CAM-002 (Server Room)</option>
                <option value="CAM-003">CAM-003 (Hallway A)</option>
              </select>
              
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); handleFilterChange(); }}
                  className="h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299]"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); handleFilterChange(); }}
                  className="h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299]"
                />
              </div>
            </div>

            {/* Actions Bar */}
            {selectedViolations.length > 0 && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-[8px] p-3" style={{ marginBottom: '20px' }}>
                <span className="text-sm font-medium text-blue-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  {selectedViolations.length} violation(s) selected
                </span>
                <button
                  onClick={handleDeleteSelected}
                  className="px-4 py-2 bg-red-500 text-white rounded-[8px] hover:bg-red-600 transition-colors text-sm font-medium"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Delete Selected
                </button>
              </div>
            )}

            {/* Violations Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12" style={{ marginBottom: '20px' }}>
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>Loading violations...</p>
                </div>
              </div>
            ) : violations.length === 0 ? (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 p-12 text-center" style={{ marginBottom: '20px' }}>
                <p className="text-gray-500 text-lg" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  No violations found
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden" style={{ marginBottom: '20px' }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={selectedViolations.length === violations.length && violations.length > 0}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-[#3f4299] border-[#bab6b6] rounded focus:ring-[#3f4299]"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Person</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Camera</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Confidence</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Timestamp</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Snapshot</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {violations.map((violation) => (
                        <tr
                          key={violation.id}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                          onClick={() => handleViolationClick(violation)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedViolations.includes(violation.id)}
                              onChange={() => handleSelectViolation(violation.id)}
                              className="w-4 h-4 text-[#3f4299] border-[#bab6b6] rounded focus:ring-[#3f4299]"
                            />
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{violation.id}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{violation.violation_type}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {violation.person_name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{violation.camera_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                             {(violation.confidence * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {violation.timestamp}
                          </td>
                          <td className="px-4 py-3">
                            {violation.snapshot_url ? (
                              <img src={violation.snapshot_url} alt="snapshot" className="w-12 h-12 rounded object-cover border" />
                            ) : (
                              <span className="text-xs text-gray-400 italic">No Image</span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={async () => {
                                  if (window.confirm('Are you sure you want to delete this violation record?')) {
                                    try {
                                      await fetch(`/api/violations/${violation.id}/`, { method: 'DELETE' });
                                      setViolations(prev => prev.filter(v => v.id !== violation.id));
                                      alert("Record Deleted");
                                    } catch (err) {
                                      console.error("Failed to delete:", err);
                                      alert("Failed to delete violation.");
                                    }
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
                <p className="text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  Showing {violations.length} of {totalCount} violations
                </p>
                <div className="flex gap-2">
                  <button 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-4 py-2 border rounded text-sm bg-white disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">Page {page} of {totalPages}</span>
                  <button 
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-4 py-2 border rounded text-sm bg-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - User Profile Card */}
          <div className="w-80 flex-shrink-0" style={{ marginLeft: '100px' }}>
            <div style={{ marginTop: '0px' }}>
              <div style={{ marginBottom: '20px' }}>
                {user && <UserProfileCard user={user} />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageViolationsPage;

