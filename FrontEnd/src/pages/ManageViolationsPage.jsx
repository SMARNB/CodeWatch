import React, { useState, useEffect, useRef, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Button from '../components/Button';
import Logo from '../components/Logo';
import ConfirmModal from '../components/ConfirmModal';
import backgroundEllipse from '../assets/background.svg';

// Custom Input for DatePicker to match Dropdown styling
const CustomDateInput = forwardRef(({ value, onClick, placeholder, isActive }, ref) => (
  <button
    onClick={onClick}
    ref={ref}
    type="button"
    className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${
      isActive
        ? 'border-[#3f4299]/50 shadow-sm text-[#3f4299] font-medium'
        : 'border-[#bab6b6] hover:border-[#3f4299]/50 text-gray-700'
    }`}
    style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px', minWidth: '160px' }}
  >
    <span>{value || placeholder}</span>
    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  </button>
));

const CustomSelect = ({ value, onChange, options, placeholder, width = '200px' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="relative" ref={ref} style={{ width }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${isOpen
          ? 'border-[#3f4299] shadow-md'
          : value && value !== 'all'
            ? 'border-[#3f4299]/50 shadow-sm'
            : 'border-[#bab6b6] hover:border-[#3f4299]/50'
          }`}
        style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px' }}
      >
        <span className={value && value !== 'all' ? 'text-[#3f4299] font-medium' : 'text-gray-700'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute bg-white rounded-[8px] z-50 max-h-[400px] flex flex-col border border-gray-200"
          style={{
            top: '100%',
            left: 0,
            minWidth: '100%',
            width: 'max-content',
            marginTop: '4px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            fontFamily: "'Open Sans', sans-serif"
          }}
        >
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar bg-white rounded-[8px]">
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <div
                  key={option.value}
                  className={`flex items-center cursor-pointer transition-colors border-b border-gray-100 ${isSelected
                    ? 'bg-[#f8f9ff] hover:bg-gray-50'
                    : 'hover:bg-gray-50 bg-white'
                    }`}
                  style={{ padding: '10px' }}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={`flex-1 ${isSelected ? 'text-[#3f4299] font-bold' : 'text-gray-700 font-medium'}`}
                    style={{ fontSize: '14px' }}
                  >
                    {option.label}
                  </span>
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#3f4299] flex-shrink-0 ml-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const ManageViolationsPage = () => {
  const navigate = useNavigate();
  const [confirmState, setConfirmState] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: false });
  const [user, setUser] = useState(null);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [typeFilter, setTypeFilter] = useState('all');
  const [cameraFilter, setCameraFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);

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
        ...(dateFrom && { date_from: dateFrom.toISOString().split('T')[0] }),
        ...(dateTo && { date_to: dateTo.toISOString().split('T')[0] }),
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

  const handleDeleteSelected = () => {
    if (selectedViolations.length === 0) return;
    setConfirmState({
      isOpen: true,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete ${selectedViolations.length} violation(s)?`,
      isDanger: true,
      onConfirm: async () => {
        try {
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
    });
  };

  const handleStatusChange = (violationId, newStatus) => {
    setViolations(prev =>
      prev.map(v => v.id === violationId ? { ...v, status: newStatus } : v)
    );
  };

  const handleBackClick = () => {
    navigate(-1);
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

      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        <div className="flex w-full">
          {/* Left Column - Main Content */}
          <div className="flex-1">


            {/* Search and Filter Bar */}
            <div className="flex flex-wrap items-center gap-4" style={{ marginBottom: '20px' }}>
              <CustomSelect
                value={typeFilter}
                onChange={(val) => { setTypeFilter(val); handleFilterChange(); }}
                options={[
                  { value: 'all', label: 'All Violation Types' },
                  { value: 'Unauthorized Access', label: 'Unauthorized Access' },
                  { value: 'Dress Code Violation', label: 'Dress Code Violation' },
                  { value: 'Restricted Area', label: 'Restricted Area' }
                ]}
                placeholder="Violation Type"
                width="220px"
              />

              <CustomSelect
                value={cameraFilter}
                onChange={(val) => { setCameraFilter(val); handleFilterChange(); }}
                options={[
                  { value: 'all', label: 'All Cameras' },
                  { value: 'CAM-001', label: 'CAM-001 (Main Entrance)' },
                  { value: 'CAM-002', label: 'CAM-002 (Server Room)' },
                  { value: 'CAM-003', label: 'CAM-003 (Hallway A)' }
                ]}
                placeholder="Camera"
                width="220px"
              />

              <div className="flex items-center gap-2">
                <DatePicker
                  selected={dateFrom}
                  onChange={(date) => { setDateFrom(date); handleFilterChange(); }}
                  customInput={<CustomDateInput isActive={!!dateFrom} />}
                  placeholderText="Start Date"
                  dateFormat="MM/dd/yyyy"
                />
                <span className="text-gray-500 font-medium">to</span>
                <DatePicker
                  selected={dateTo}
                  onChange={(date) => { setDateTo(date); handleFilterChange(); }}
                  customInput={<CustomDateInput isActive={!!dateTo} />}
                  placeholderText="End Date"
                  dateFormat="MM/dd/yyyy"
                />
              </div>
            </div>

            {/* Actions Bar */}
            {selectedViolations.length > 0 && (
              <div className="flex items-center justify-between px-2 py-2" style={{ marginBottom: '20px' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#3f4299]/10 flex items-center justify-center text-[#3f4299]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-[15px] font-semibold text-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                    {selectedViolations.length} violation(s) selected
                  </span>
                </div>
                <button
                  onClick={handleDeleteSelected}
                  className="py-2 bg-white border-2 border-red-500 text-red-500 rounded-[8px] hover:bg-red-50 transition-colors text-[14px] font-bold flex items-center gap-2 outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '10px', width: '175px', justifyContent: 'center' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
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
                            style={{ marginLeft: '10px', marginTop: '5px' }}
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
                              style={{ marginLeft: '10px', marginTop: '5px' }}
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
                                  setConfirmState({
                                    isOpen: true,
                                    title: 'Delete Violation',
                                    message: 'Are you sure you want to delete this violation record?',
                                    isDanger: true,
                                    onConfirm: async () => {
                                      try {
                                        await fetch(`/api/violations/${violation.id}/`, { method: 'DELETE' });
                                        setViolations(prev => prev.filter(v => v.id !== violation.id));
                                        alert("Record Deleted");
                                      } catch (err) {
                                        console.error("Failed to delete:", err);
                                        alert("Failed to delete violation.");
                                      }
                                    }
                                  });
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


        </div>
      </div>
      <ConfirmModal
        {...confirmState}
        onClose={() => setConfirmState(s => ({ ...s, isOpen: false }))}
      />
    </div>
  );
};

export default ManageViolationsPage;

