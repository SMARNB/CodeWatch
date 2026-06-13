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
import ConfirmModal from '../components/ConfirmModal';
import UpdateReportModal from '../components/UpdateReportModal';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';
import SendReportModal from '../components/SendReportModal';

const STATUS_BADGE = {
  new: { label: 'New', cls: 'bg-gray-100 text-gray-700' },
  in_review: { label: 'In Review', cls: 'bg-amber-100 text-amber-800' },
  resolved: { label: 'Resolved', cls: 'bg-green-100 text-green-800' },
  dismissed: { label: 'Dismissed', cls: 'bg-slate-100 text-slate-700' },
  reviewed: { label: 'Reviewed', cls: 'bg-blue-100 text-blue-800' },
  archived: { label: 'Archived', cls: 'bg-slate-100 text-slate-700' },
};

const ReportDetailsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // State for report data
  const [reportData, setReportData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [updateOpen, setUpdateOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [includeNoteInPdf, setIncludeNoteInPdf] = useState(true);
  const [pdfNoteVisible, setPdfNoteVisible] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const reportRef = React.useRef(null);

  const generatePdf = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    if (includeNoteInPdf) {
      setPdfNoteVisible(true);
      await new Promise((r) => setTimeout(r, 60)); // let the note block render
    }
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH, 'rpt', 'FAST');
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH, 'rpt', 'FAST');
        heightLeft -= pageH;
      }
      const fileId = reportData?.displayId || reportData?.custom_id || `report-${reportData?.id || ''}`;
      pdf.save(`${fileId}.pdf`);
    } catch (e) {
      console.error('PDF generation failed', e);
      alert('Could not generate the PDF. Please try again.');
    } finally {
      setPdfNoteVisible(false);
      setGeneratingPdf(false);
      setDownloadOpen(false);
    }
  };

  // Capture the on-screen report as a PDF (base64) for emailing as an attachment.
  const captureReportPdf = async () => {
    if (!reportRef.current) return null;
    const canvas = await html2canvas(reportRef.current, {
      scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH, 'rpt', 'FAST');
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH, 'rpt', 'FAST');
      heightLeft -= pageH;
    }
    const fileId = reportData?.displayId || reportData?.custom_id || `report-${reportData?.id || ''}`;
    const base64 = pdf.output('datauristring');
    return { report_id: reportData?.id, filename: `${fileId}.pdf`, base64 };
  };

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

        // 1. Get Report ID and Key from URL
        const urlParams = new URLSearchParams(location.search);
        const reportId = urlParams.get('id');
        const reportKey = urlParams.get('key');

        if (!reportId && !reportKey) {
            throw new Error("No Report ID provided");
        }

        let report = null;
        // Prefer the API — it returns the FULL report including analytics_json (the charts need this).
        if (reportId) {
            try {
                const response = await fetch(`/api/reports/${reportId}/`);
                if (response.ok) report = await response.json();
            } catch (e) {
                console.error("Failed to fetch report from API", e);
            }
        }
        // Fall back to the sessionStorage copy only if the API returned nothing.
        if (!report && reportKey) {
            try {
                const stored = sessionStorage.getItem(reportKey);
                if (stored) report = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse sessionStorage report", e);
            }
        }
        
        if (report) {
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
                ...report,
                id: report.id || report.custom_id,
                displayId: report.custom_id,
                description: report.description,
                message: report.message,
                date: report.date ? new Date(report.date) : new Date(),
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
        <div className="fixed bottom-0 left-0 w-full z-0">
          <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
        </div>

        {/* Navbar */}
        <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
          <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
            <div className="flex justify-between items-center h-full w-full">
              <div 
                className="flex items-center cursor-pointer transition-transform hover:scale-105" 
                style={{ marginLeft: '20px' }}
                onClick={() => {
                  const role = localStorage.getItem('userType') || 'admin';
                  const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                  navigate(roleRoutes[role] || '/admin/dashboard');
                }}
                title="Go to Dashboard"
              >
                <Logo size="default" showText={false} />
              </div>
              <div 
                className="flex-1 flex justify-center cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => {
                  const role = localStorage.getItem('userType') || 'admin';
                  const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                  navigate(roleRoutes[role] || '/admin/dashboard');
                }}
                title="Go to Dashboard"
              >
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#3f4299] to-[#4f46e5] text-center">Code Watch</h1>
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
        <div className="fixed bottom-0 left-0 w-full z-0">
          <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
        </div>

        {/* Navbar */}
        <div className="relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
          <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
            <div className="flex justify-between items-center h-full w-full">
              <div 
                className="flex items-center cursor-pointer transition-transform hover:scale-105" 
                style={{ marginLeft: '20px' }}
                onClick={() => {
                  const role = localStorage.getItem('userType') || 'admin';
                  const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                  navigate(roleRoutes[role] || '/admin/dashboard');
                }}
                title="Go to Dashboard"
              >
                <Logo size="default" showText={false} />
              </div>
              <div 
                className="flex-1 flex justify-center cursor-pointer transition-transform hover:scale-[1.02]"
                onClick={() => {
                  const role = localStorage.getItem('userType') || 'admin';
                  const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                  navigate(roleRoutes[role] || '/admin/dashboard');
                }}
                title="Go to Dashboard"
              >
                <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#3f4299] to-[#4f46e5] text-center">Code Watch</h1>
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

  const status            = reportData.status;
  const note              = reportData.note || reportData.resolution_note;
  const isPinned          = reportData.is_pinned || reportData.isPinned;
  const displayId         = reportData.displayId || reportData.custom_id || `#${reportData.id}`;
  const relatedPersonName = reportData.related_person_name;
  
  const badge = STATUS_BADGE[(status||'').toLowerCase()] || { label: status||'New', cls:'bg-gray-100 text-gray-700' };

  // Main content
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      <style>
        {`
          @media print {
            .no-print { display: none !important; }
            body { background: #ffffff !important; }
          }
        `}
      </style>
      {/* Navbar */}
      <div className="no-print relative bg-white shadow-sm border-b border-gray-200 w-full" style={{ height: '100px' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full">
          <div className="flex justify-between items-center h-full w-full">
            <div 
              className="flex items-center cursor-pointer transition-transform hover:scale-105" 
              style={{ marginLeft: '20px' }}
              onClick={() => {
                const role = localStorage.getItem('userType') || 'admin';
                const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                navigate(roleRoutes[role] || '/admin/dashboard');
              }}
              title="Go to Dashboard"
            >
              <Logo size="default" showText={false} />
            </div>
            <div 
              className="flex-1 flex justify-center cursor-pointer transition-transform hover:scale-[1.02]"
              onClick={() => {
                const role = localStorage.getItem('userType') || 'admin';
                const roleRoutes = { 'admin': '/admin/dashboard', 'ssd': '/ssd/dashboard', 'department-head': '/department-head/dashboard', 'guard': '/guard/dashboard' };
                navigate(roleRoutes[role] || '/admin/dashboard');
              }}
              title="Go to Dashboard"
            >
              <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#3f4299] to-[#4f46e5] text-center">Code Watch</h1>
            </div>
            <div className="flex items-center" style={{ marginRight: '20px' }}>
              <button
                onClick={handleClose}
                className="no-print w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
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
          <div className="flex-1" ref={reportRef}>
            {/* Header */}
            <div className="mb-6" style={{ marginBottom: '20px' }}>
              <h2 className="text-3xl font-bold text-[#3f4299] mb-2 flex items-center gap-2">
                Report Details {isPinned && <span className="text-xl">📌</span>}
              </h2>
              <div className="flex items-center gap-4 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                <span className="font-semibold text-[#3f4299]">{displayId}</span>
                <span>•</span>
                <span>{formatDate(reportData.timestamp || reportData.date)}</span>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                  {badge.label}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Person Type: </span>
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
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6" style={{ marginBottom: '20px' }}>
                  {/* Left Side - Pie Chart */}
                  <div className="col-span-1">
                    {reportData.analyticsData.pieChartData && (
                      <PieChartContainer chartData={reportData.analyticsData.pieChartData} isLoading={false} />
                    )}
                  </div>

                  {/* Right Side - Stat Cards Grid (2x2) */}
                  <div className="col-span-2">
                    {reportData.analyticsData.statCardsData && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
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

                {/* Standalone snapshot block — shows for reports that have a snapshot but no movement data (e.g. Violation Feedback posts) */}
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

            {/* Print-only note block — rendered into the captured area only while generating the PDF */}
            {pdfNoteVisible && note && (
              <div className="bg-gray-50 rounded-lg border border-gray-200" style={{ marginTop: '8px', marginBottom: '20px', padding: '16px' }}>
                <h3 className="text-sm font-bold text-[#3f4299] mb-2">Note</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{note}</p>
              </div>
            )}
          </div>

          {/* Right Column - User Profile Card */}
          <div className="w-80 flex-shrink-0" style={{ marginLeft: '100px' }}>
            <div style={{ marginTop: '0px' }}>
              <div style={{ marginBottom: '20px' }}>
                {user && <UserProfileCard user={user} />}
              </div>
              {note && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ marginBottom: '20px', padding: '16px' }}>
                  <h3 className="text-sm font-bold text-[#3f4299] mb-2">Note</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{note}</p>
                </div>
              )}
              {/* Action buttons (stacked) */}
              <div className="no-print flex flex-col gap-3">
                <button
                  onClick={() => setUpdateOpen(true)}
                  className="w-full h-[44px] bg-[#3f4299] text-white rounded-[8px] hover:bg-[#2d3170] font-medium transition-colors"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Update
                </button>
                <button
                  onClick={() => setSendOpen(true)}
                  className="w-full h-[44px] bg-white border border-[#3f4299] text-[#3f4299] rounded-[8px] hover:bg-[#3f4299]/5 font-medium transition-colors"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Send Report
                </button>
                <button
                  onClick={() => setDownloadOpen(true)}
                  className="w-full h-[44px] bg-white border border-[#3f4299] text-[#3f4299] rounded-[8px] hover:bg-[#3f4299]/5 font-medium transition-colors"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Download PDF
                </button>
                <button
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="w-full h-[44px] bg-red-600 text-white rounded-[8px] hover:bg-red-700 font-medium transition-colors"
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={async () => {
          try {
            await fetch(`/api/delete-report/${reportData.id}/`, { method: 'DELETE' });
            navigate('/reports');
          } catch (e) {
            console.error('Failed to delete', e);
          }
        }}
        title="Delete Report"
        message="Are you sure you want to delete this report? This cannot be undone."
        confirmText="Delete"
        isDanger={true}
      />

      <UpdateReportModal
        isOpen={updateOpen}
        report={reportData}
        onClose={() => setUpdateOpen(false)}
        onSaved={(f) => setReportData(prev => ({ ...prev, status: f.status, note: f.note, isPinned: f.is_pinned }))}
      />
      {sendOpen && (
        <SendReportModal
          onClose={() => setSendOpen(false)}
          getClientPdf={captureReportPdf}
          showReportPicker={false}
        />
      )}

      {/* Download PDF options modal */}
      {downloadOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10"
          onClick={(e) => { if (e.target === e.currentTarget && !generatingPdf) setDownloadOpen(false); }}
        >
          <div
            className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
          >
            {/* Header */}
            <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
              <div className="flex-1"></div>
              <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center whitespace-nowrap" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Download PDF
              </h2>
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => { if (!generatingPdf) setDownloadOpen(false); }}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
                  aria-label="Close"
                  title="Close"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ padding: '20px 24px' }}>
              <p className="text-sm text-gray-600 mb-6" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Export this report as a PDF. Charts and the report content are always included.
              </p>
              
              <div className="w-full text-left">
                <label 
                  className={`flex items-center justify-between rounded-[8px] border ${note ? 'border-[#bab6b6] cursor-pointer hover:bg-gray-50' : 'border-gray-200 opacity-60 cursor-not-allowed'}`}
                  style={{ padding: '16px 20px', boxSizing: 'border-box' }}
                >
                  <span>
                    <span className="block text-[16px] font-bold text-gray-800" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                      Include note
                    </span>
                    <span className="block text-sm text-gray-500">
                      {note ? 'Adds the report note to the PDF' : 'This report has no note'}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={!!note && includeNoteInPdf}
                    disabled={!note}
                    onChange={(e) => setIncludeNoteInPdf(e.target.checked)}
                    className="w-5 h-5 accent-[#3f4299] cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white flex justify-center gap-4" style={{ padding: '10px' }}>
              <button
                onClick={() => { if (!generatingPdf) setDownloadOpen(false); }}
                disabled={generatingPdf}
                className="h-[48px] px-[10px] w-[200px] text-gray-600 border border-gray-300 text-[16px] font-bold rounded-[8px] hover:bg-gray-50 transition-colors focus:outline-none disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={generatePdf}
                disabled={generatingPdf}
                className={`h-[48px] px-[10px] w-[200px] text-white text-[16px] font-bold rounded-[8px] transition-colors focus:outline-none ${generatingPdf ? 'bg-[#2d3170] opacity-70 cursor-not-allowed' : 'bg-[#3f4299] hover:bg-[#2d3170]'}`}
              >
                {generatingPdf ? 'Generating…' : 'Download'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportDetailsPage;

