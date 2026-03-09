import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import StatCard from '../components/StatCard';
import PieChartContainer from '../components/PieChartContainer';
import LineGraphContainer from '../components/LineGraphContainer';
import ViolationTimeline from '../components/ViolationTimeline';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';

const ReportDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for report data
  const [reportData, setReportData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
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
  }, [userType]);

  // Load report data
 // --- REPLACEMENT 1: FETCH REPORT FROM DATABASE ---
  useEffect(() => {
    const loadReportData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get Report ID from URL (e.g., ?id=5)
        const urlParams = new URLSearchParams(location.search);
        const reportId = urlParams.get('id');

        if (!reportId) {
            throw new Error("No Report ID provided");
        }

        // 2. Fetch ALL reports from API
        const response = await fetch('http://127.0.0.1:8000/api/get-reports/');
        
        if (response.ok) {
            const data = await response.json();
            
            // 3. Find the specific report (Loose equality for string vs int)
            const report = data.find(r => r.id == reportId);

            if (report) {
                // Parse the JSON string back into an Object
                let parsedAnalytics = null;
                try {
                    if (report.analytics_json) {
                        parsedAnalytics = JSON.parse(report.analytics_json);
                    }
                } catch (e) {
                    console.error("Could not parse analytics data", e);
                }

                setReportData({
                    id: report.custom_id,
                    description: report.description,
                    message: report.message,
                    date: new Date(report.date),
                    status: report.status,
                    type: report.type,
                    priority: report.priority,
                    
                    // Filters are usually part of the analytics data now
                    filters: parsedAnalytics ? parsedAnalytics.filters : null,
                    
                    // Pass the parsed data to the charts
                    analyticsData: parsedAnalytics 
                });
            } else {
                setError('Report not found in database');
            }
        } else {
            setError('Failed to connect to database');
        }
      } catch (err) {
        console.error('Error loading report:', err);
        setError(err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };

    loadReportData();
  }, [location]);

  const handleClose = () => {
    // Try to close the window (if opened in new tab)
    if (window.opener) {
      window.close();
    } else {
      // If not opened in new tab, navigate back to reports page
      navigate('/reports');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Loading state
  if (loading) {
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
              <div className="flex items-center" style={{ marginLeft: '20px' }}>
                <Logo size="default" showText={false} />
              </div>
              <div className="flex-1 flex justify-center">
                <h1 className="text-2xl font-bold text-[#3f4299] text-center">Code Watch</h1>
              </div>
              <div className="w-16"></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading report details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !reportData) {
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
              <div className="flex items-center" style={{ marginLeft: '20px' }}>
                <Logo size="default" showText={false} />
              </div>
              <div className="flex-1 flex justify-center">
                <h1 className="text-2xl font-bold text-[#3f4299] text-center">Code Watch</h1>
              </div>
              <div className="flex items-center" style={{ marginRight: '20px' }}>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center min-h-[calc(100vh-100px)]">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">Report Not Found</p>
            <p className="text-gray-600 mb-4">{error || 'The requested report could not be found.'}</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-[#3f4299] text-white rounded-lg hover:bg-[#2d3170] transition-colors"
            >
              {window.opener ? 'Close' : 'Back to Reports'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main content
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Navbar */}
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            <div className="flex items-center" style={{ marginLeft: '20px' }}>
              <Logo size="default" showText={false} />
            </div>
            <div className="flex-1 flex justify-center">
              <h1 className="text-2xl font-bold text-[#3f4299] text-center">Code Watch</h1>
            </div>
            <div className="flex items-center" style={{ marginRight: '20px' }}>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                aria-label="Close"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        <div className="flex w-full">
          {/* Left Column - Main Content */}
          <div className="flex-1">
            {/* Header */}
            <div className="mb-6" style={{ marginBottom: '20px' }}>
              <h2 className="text-3xl font-bold text-[#3f4299] mb-2">
                Report Details
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                <span className="font-semibold text-[#3f4299]">{reportData.id}</span>
                <span>•</span>
                <span>{formatDate(reportData.timestamp || reportData.date)}</span>
                <span>•</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  {reportData.status || 'Completed'}
                </span>
              </div>
              <p className="text-gray-700 mt-3" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                {reportData.description}
              </p>
              <div className="mt-6 bg-gray-50 rounded-lg p-6 border border-gray-200">
                 <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Report Content</h4>
                 <div className="prose max-w-none text-gray-800 whitespace-pre-wrap font-mono text-sm">
                    {reportData.message || "No content available."}
                 </div>
              </div>
            </div>

            {/* Filters Section */}
            {reportData.filters && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6" style={{ marginBottom: '20px' }}>
                <h3 className="text-lg font-semibold text-[#3f4299] mb-3" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  Filter Criteria
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {reportData.filters.gender && reportData.filters.gender.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Gender: </span>
                      <span className="text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        {reportData.filters.gender.join(', ')}
                      </span>
                    </div>
                  )}
                  {reportData.filters.department && reportData.filters.department.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Department: </span>
                      <span className="text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        {reportData.filters.department.join(', ')}
                      </span>
                    </div>
                  )}
                  {reportData.filters.userType && reportData.filters.userType.length > 0 && (
                    <div>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>User Type: </span>
                      <span className="text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        {reportData.filters.userType.join(', ')}
                      </span>
                    </div>
                  )}
                  {reportData.filters.startDate && (
                    <div>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Start Date: </span>
                      <span className="text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        {new Date(reportData.filters.startDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {reportData.filters.endDate && (
                    <div>
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>End Date: </span>
                      <span className="text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        {new Date(reportData.filters.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Analytics Charts */}
            {reportData.analyticsData && (
              <>
                {/* Chart Grid - Pie Chart and Stat Cards */}
                <div className="grid grid-cols-3 gap-6 mb-6" style={{ marginBottom: '20px' }}>
                  {/* Left Side - Pie Chart */}
                  <div className="col-span-1">
                    {reportData.analyticsData.pieChartData && (
                      <PieChartContainer chartData={reportData.analyticsData.pieChartData} isLoading={false} />
                    )}
                  </div>

                  {/* Right Side - Stat Cards Grid (2x2) */}
                  <div className="col-span-2">
                    {reportData.analyticsData.statCardsData && (
                      <div className="grid grid-cols-2 gap-4">
                        {reportData.analyticsData.statCardsData.map((stat, index) => (
                          <StatCard
                            key={index}
                            title={stat.title}
                            value={stat.value}
                            percentageChange={stat.percentageChange}
                            miniChartData={stat.miniChartData}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Line Graph Section */}
                {reportData.analyticsData.lineGraphData && (
                  <div className="mb-6" style={{ marginBottom: '20px' }}>
                    <LineGraphContainer chartData={reportData.analyticsData.lineGraphData} isLoading={false} />
                  </div>
                )}

                {/* Heatmap Section */}
                {reportData.analyticsData.timelineData && reportData.analyticsData.timelineData.length > 0 && (
                  <div className="mb-6" style={{ marginBottom: '20px' }}>
                    <ViolationTimeline timelineData={reportData.analyticsData.timelineData} />
                  </div>
                )}
              </>
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

export default ReportDetailsPage;

