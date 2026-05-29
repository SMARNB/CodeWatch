import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import UserProfileCard from '../components/UserProfileCard';
import ReportItem from '../components/ReportItem';
import backgroundEllipse from '../assets/background.svg';

const PreviousReportsPage = () => {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

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

  // Fetch reports data from localStorage
  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        // Call Django API
        const response = await fetch('/api/get-reports/');
        
        if (response.ok) {
          const data = await response.json();
          
          // Map Backend Data to Frontend Format
          const formattedReports = data.map(r => ({
            id: r.id,               // Database ID (Real ID for deletion)
            displayId: r.custom_id, // Visual ID (e.g., RPT-0001)
            description: r.description, // Mapped from 'subject' in backend
            date: new Date(r.date),
            status: r.status,
            type: r.type,
            priority: r.priority,
            message: r.message,
            snapshot_url: r.snapshot_url,
            movement_summary: r.movement_summary
          }));
          
          setReports(formattedReports);
        } else {
          console.error("Failed to fetch reports from server");
          setReports([]);
        }
      } catch (error) {
        console.error('Network Error:', error);
        setReports([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
    // Note: We removed the 'storage' event listeners because the Database is now the source of truth.
  }, []);

  // Handle update action
  const handleUpdate = (reportId) => {
    console.log('Update report:', reportId);
    // TODO: Implement update logic
    // This could open a modal, navigate to an edit page, etc.
    alert(`Update functionality for ${reportId} - To be implemented`);
  };

  // Handle report click - open report details
  const handleReportClick = (reportId, report) => {
    // Store report data in sessionStorage for the new tab
    const reportKey = `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(reportKey, JSON.stringify(report));
    
    // Open report details page in a new tab with both key and id for fallback
    const url = `/report-details?key=${encodeURIComponent(reportKey)}&id=${encodeURIComponent(reportId)}`;
    window.open(url, '_blank');
  };

  // Handle delete action
  const handleDelete = async (reportId) => {
    if (window.confirm(`Are you sure you want to delete report ${reportId}?`)) {
      try {
        const response = await fetch(`/api/delete-report/${reportId}/`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Remove from state
          setReports(prev => prev.filter(report => report.id !== reportId));
          console.log('Report deleted:', reportId);
          
          // Also update localStorage if applicable
          const reportsJson = localStorage.getItem('analyticsReports');
          if (reportsJson) {
            const reports = JSON.parse(reportsJson);
            const updatedReports = reports.filter(report => report.id !== reportId);
            localStorage.setItem('analyticsReports', JSON.stringify(updatedReports));
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new Event('reportsUpdated'));
          }
        } else {
          console.error('Failed to delete report from server');
        }
      } catch (error) {
        console.error('Error deleting report:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        <div className="flex w-full">
          {/* Left Column - Main Content */}
          <div className="flex-1">
            {/* Page Title */}
            <h2 className="text-3xl font-bold text-[#3f4299] mb-5" style={{ marginBottom: '20px' }}>
              Previous Reports
            </h2>

            {/* Reports List */}
            {loading ? (
              <div className="flex items-center justify-center py-12" style={{ marginBottom: '20px' }}>
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>Loading reports...</p>
                </div>
              </div>
            ) : reports.length === 0 ? (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 p-12 text-center" style={{ marginBottom: '20px' }}>
                <p className="text-gray-500 text-lg" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  No reports found
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div key={report.id} style={{ marginBottom: '20px' }}>
                    <ReportItem
                      reportId={report.id}
                      description={report.description}
                      report={report}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                      onClick={handleReportClick}
                    />
                  </div>
                ))}
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

export default PreviousReportsPage;

