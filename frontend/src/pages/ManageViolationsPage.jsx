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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
  useEffect(() => {
    const fetchViolations = async () => {
      try {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mock violations data
        const mockViolations = [
          {
            id: 'VIOL-001',
            type: 'Unauthorized Access',
            location: 'Building A - Floor 3',
            camera: 'CAM-001',
            severity: 'High',
            status: 'Pending',
            reportedBy: 'System',
            timestamp: new Date(Date.now() - 1000 * 60 * 30),
            description: 'Unauthorized person detected in restricted area'
          },
          {
            id: 'VIOL-002',
            type: 'Security Breach',
            location: 'Building A - Floor 3',
            camera: 'CAM-001',
            severity: 'High',
            status: 'Under Review',
            reportedBy: 'Admin',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
            description: 'Multiple unauthorized access attempts detected'
          },
          {
            id: 'VIOL-003',
            type: 'Suspicious Activity',
            location: 'Building B - Floor 1',
            camera: 'CAM-002',
            severity: 'Medium',
            status: 'Resolved',
            reportedBy: 'System',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4),
            description: 'Person loitering in restricted zone'
          },
          {
            id: 'VIOL-004',
            type: 'Trespassing',
            location: 'Building C - Floor 2',
            camera: 'CAM-003',
            severity: 'High',
            status: 'Pending',
            reportedBy: 'System',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
            description: 'Unauthorized entry detected'
          },
          {
            id: 'VIOL-005',
            type: 'Policy Violation',
            location: 'Building A - Floor 1',
            camera: 'CAM-004',
            severity: 'Low',
            status: 'Resolved',
            reportedBy: 'Admin',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8),
            description: 'Violation of safety protocols'
          },
          {
            id: 'VIOL-006',
            type: 'Unauthorized Access',
            location: 'Building B - Floor 2',
            camera: 'CAM-005',
            severity: 'Medium',
            status: 'Under Review',
            reportedBy: 'System',
            timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12),
            description: 'Access attempt after hours'
          }
        ];
        
        setViolations(mockViolations);
      } catch (error) {
        console.error('Failed to fetch violations:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchViolations();
  }, []);

  // Filter violations
  const filteredViolations = violations.filter(violation => {
    const matchesSearch = !searchTerm || 
      violation.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      violation.status?.toLowerCase() === statusFilter.toLowerCase();
    
    return matchesSearch && matchesStatus;
  });

  const handleViolationClick = (violation) => {
    // Open violation details in a new tab
    const violationKey = `violation_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(violationKey, JSON.stringify({
      violation,
      userType
    }));
    const url = `/notification-details?key=${encodeURIComponent(violationKey)}`;
    window.open(url, '_blank');
  };

  const handleSelectViolation = (violationId) => {
    setSelectedViolations(prev => 
      prev.includes(violationId)
        ? prev.filter(id => id !== violationId)
        : [...prev, violationId]
    );
  };

  const handleSelectAll = () => {
    if (selectedViolations.length === filteredViolations.length) {
      setSelectedViolations([]);
    } else {
      setSelectedViolations(filteredViolations.map(v => v.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedViolations.length === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedViolations.length} violation(s)?`)) {
      setViolations(prev => prev.filter(v => !selectedViolations.includes(v.id)));
      setSelectedViolations([]);
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

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
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
            <div className="flex items-center gap-4" style={{ marginBottom: '20px' }}>
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search violations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                  style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="under review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
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
            ) : filteredViolations.length === 0 ? (
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
                            checked={selectedViolations.length === filteredViolations.length && filteredViolations.length > 0}
                            onChange={handleSelectAll}
                            className="w-4 h-4 text-[#3f4299] border-[#bab6b6] rounded focus:ring-[#3f4299]"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          Violation ID
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          Location
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          Severity
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          Date & Time
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredViolations.map((violation) => (
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
                          <td className="px-4 py-3 text-sm text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                            {violation.id}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                            {violation.type}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                            {violation.location}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-medium ${getSeverityColor(violation.severity)}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>
                              {violation.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={violation.status}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleStatusChange(violation.id, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className={`px-2 py-1 rounded-full text-xs font-medium border-0 outline-none ${getStatusColor(violation.status)}`}
                              style={{ fontFamily: "'Open Sans', sans-serif" }}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Resolved">Resolved</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                            {formatDate(violation.timestamp)}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleViolationClick(violation)}
                                className="px-3 py-1 text-xs font-medium text-[#3f4299] hover:bg-blue-50 rounded transition-colors"
                                style={{ fontFamily: "'Open Sans', sans-serif" }}
                              >
                                View
                              </button>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete ${violation.id}?`)) {
                                    setViolations(prev => prev.filter(v => v.id !== violation.id));
                                  }
                                }}
                                className="px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                                style={{ fontFamily: "'Open Sans', sans-serif" }}
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

            {/* Pagination (if needed) */}
            {!loading && filteredViolations.length > 0 && (
              <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
                <p className="text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  Showing {filteredViolations.length} of {violations.length} violations
                </p>
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

