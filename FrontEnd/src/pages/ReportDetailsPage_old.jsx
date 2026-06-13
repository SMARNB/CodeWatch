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

        // 2. Fetch specific report from API
        const response = await fetch(`/api/reports/${reportId}/`);
        
        if (response.ok) {
            const report = await response.json();
            
            // Parse the JSON string back into an Object if not already parsed by backend
            // Our backend now returns 'analytics_data' directly, but let's be safe
            let parsedAnalytics = report.analytics_data;
            if (!parsedAnalytics && report.analytics_json) {
                try {
                    parsedAnalytics = JSON.parse(report.analytics_json);
                } catch (e) {
                    console.error("Could not parse analytics data", e);
                }
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
            setError('Failed to connect to database or report not found');
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
                <span>GÇó</span>
                <span>{formatDate(reportData.timestamp || reportData.date)}</span>
                <span>GÇó</span>
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
                
                {/* Violator Movement Summary */}
                {reportData.analyticsData.movement_summary && reportData.analyticsData.movement_summary.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6" style={{ marginBottom: '20px' }}>
                    <h3 className="text-xl font-bold text-[#3f4299] mb-4">Violator Movement Summary</h3>
                    
                    {reportData.analyticsData.violator_details && (
                        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100 grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-gray-500">Name</p>
                                <p className="font-semibold text-gray-900">{reportData.analyticsData.violator_details.name}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">ID</p>
                                <p className="font-semibold text-gray-900">{reportData.analyticsData.violator_details.employee_id}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Department</p>
                                <p className="font-semibold text-gray-900">{reportData.analyticsData.violator_details.department}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Classification</p>
                                <p className="font-semibold capitalize px-2 py-0.5 inline-block rounded bg-indigo-100 text-indigo-800">{reportData.analyticsData.violator_details.classification}</p>
                            </div>
                            <div>
                                <p className="text-gray-500">Total Time on Premises</p>
                                <p className="font-semibold text-gray-900">
                                    {reportData.analyticsData.total_time_seconds 
                                        ? Math.round(reportData.analyticsData.total_time_seconds / 60) + ' minutes' 
                                        : 'Unknown'}
                                </p>
                            </div>
                            <div>
                                <p className="text-gray-500">Cameras Visited</p>
                                <p className="font-semibold text-gray-900">{reportData.analyticsData.cameras_visited_count || 0}</p>
                            </div>
                        </div>
                    )}
                    
                    <h4 className="font-semibold text-gray-800 mb-4">Movement Path</h4>
                    <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-300 before:to-transparent">
                      {reportData.analyticsData.movement_summary.map((move, idx) => {
                        const isLatest = idx === 0;
                        return (
                          <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                            <div className={`flex items-center justify-center w-6 h-6 rounded-full border-4 border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${isLatest ? 'bg-green-500 animate-pulse' : 'bg-[#3f4299]'}`}></div>
                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-gray-200 bg-gray-50 shadow-sm">
                              <div className="flex items-center justify-between space-x-2 mb-1">
                                <div className="font-bold text-gray-900">{move.camera_name}</div>
                                <time className="text-xs font-medium text-indigo-600">{move.entered_at ? new Date(move.entered_at).toLocaleTimeString() : 'Unknown'}</time>
                              </div>
                              <div className="text-sm text-gray-500">{move.location}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {reportData.analyticsData.snapshots && reportData.analyticsData.snapshots.length > 0 && (
                        <div className="mt-8">
                            <h4 className="font-semibold text-gray-800 mb-4">Violation Snapshots</h4>
                            <div className="flex flex-wrap gap-4">
                                {reportData.analyticsData.snapshots.map((snap, idx) => (
                                    <div key={idx} className="w-[120px] h-[120px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                        <img src={snap} alt={`Snapshot ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                  </div>
                )}

                {/* Standalone snapshot block GÇö shows for reports that have a snapshot but no movement data (e.g. Violation Feedback posts) */}
                {(!reportData.analyticsData.movement_summary || reportData.analyticsData.movement_summary.length === 0) &&
                  reportData.analyticsData.snapshots && reportData.analyticsData.snapshots.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6" style={{ marginBottom: '20px' }}>
                    <h4 className="font-semibold text-gray-800 mb-4">Violation Snapshot</h4>
                    <div className="flex flex-wrap gap-4">
                      {reportData.analyticsData.snapshots.map((snap, idx) => (
                        <div key={idx} className="w-[180px] h-[180px] rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                          <img src={snap} alt={`Snapshot ${idx}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
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

