import React, { useState, useEffect } from 'react';
import ReportItem from '../components/ReportItem';
import ConfirmModal from '../components/ConfirmModal';
import UpdateReportModal from '../components/UpdateReportModal';
import SendReportModal from '../components/SendReportModal';
import Button from '../components/Button';
import backgroundEllipse from '../assets/background.svg';

const Reports = () => {
  const [user, setUser] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Confirm Modal states
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState(null);
  const [updateModal, setUpdateModal] = useState({ isOpen: false, report: null });
  const [showSendReport, setShowSendReport] = useState(false);
  const [mainFilter, setMainFilter] = useState('all');   // all | analytics | violation | email
  const [subFilter, setSubFilter] = useState('all');     // analytics/email: all|daily|weekly|monthly · violation: all|resolved|unresolved

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

  // Fetch reports from the database (source of truth)
  const fetchReports = async () => {
    try {
      setLoading(true);
      const userEmail = encodeURIComponent(localStorage.getItem('userEmail') || '');
      const response = await fetch(`/api/get-reports/?user=${userEmail}`);
      if (response.ok) {
        const data = await response.json();
        const formattedReports = data.map(r => ({
          id: r.id,
          displayId: r.custom_id,
          description: r.description,
          date: new Date(r.date),
          status: r.status,
          note: r.note,
          isPinned: r.is_pinned,
          type: r.type,
          category: r.category,
          recipients: r.recipients,
          priority: r.priority,
          message: r.message,
          related_person_id: r.related_person_id,
          related_person_name: r.related_person_name,
          analytics_json: r.analytics_json,
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

  useEffect(() => {
    fetchReports();
  }, []);

  // Handle update action — open the context-aware Update modal
  const handleUpdate = (reportId) => {
    const report = reports.find(r => r.id === reportId);
    if (report) setUpdateModal({ isOpen: true, report });
  };

  // Handle report click - open report details
  const handleReportClick = (reportId, report) => {
    // Store report data in sessionStorage for the new tab
    const reportKey = `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(reportKey, JSON.stringify(report));

    // Open report details page in a new tab with both key and id for fallback
    const url = `/report-details?key=${encodeURIComponent(reportKey)}&id=${encodeURIComponent(reportId)}`;
    window.open(url, '_blank', 'popup,width=1280,height=820');
  };

  // Handle delete click - Open Modal
  const handleDelete = (reportId) => {
    setReportToDelete(reportId);
    setIsConfirmModalOpen(true);
  };

  // Execute actual deletion
  const executeDelete = async () => {
    if (!reportToDelete) return;

    try {
      const response = await fetch(`/api/delete-report/${reportToDelete}/`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Remove from state
        setReports(prev => prev.filter(report => report.id !== reportToDelete));
        console.log('Report deleted:', reportToDelete);

        // Also update localStorage if applicable
        const reportsJson = localStorage.getItem('analyticsReports');
        if (reportsJson) {
          const reports = JSON.parse(reportsJson);
          const updatedReports = reports.filter(report => report.id !== reportToDelete);
          localStorage.setItem('analyticsReports', JSON.stringify(updatedReports));
          window.dispatchEvent(new Event('storage'));
          window.dispatchEvent(new Event('reportsUpdated'));
        }
      } else {
        console.error('Failed to delete report from server');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
    } finally {
      setIsConfirmModalOpen(false);
      setReportToDelete(null);
    }
  };

  // Apply the active main + sub filters.
  const RESOLVED_STATUSES = ['resolved', 'dismissed'];
  const visibleReports = reports.filter((r) => {
    if (mainFilter !== 'all' && r.category !== mainFilter) return false;
    if (mainFilter === 'analytics' || mainFilter === 'email') {
      if (subFilter !== 'all' && (r.type || '').toLowerCase() !== subFilter) return false;
    } else if (mainFilter === 'violation') {
      const resolved = RESOLVED_STATUSES.includes((r.status || '').toLowerCase());
      if (subFilter === 'resolved' && !resolved) return false;
      if (subFilter === 'unresolved' && resolved) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      {/* Background Ellipse */}
      <div className="fixed bottom-0 left-0 w-full z-0">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        <div className="flex w-full">
          {/* Left Column - Main Content */}
          <div className="flex-1">
            {/* Toolbar: filters (left) + Send Report (right) */}
            <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: '16px' }}>
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: 'all', label: 'All' },
                  { key: 'analytics', label: 'Analytics' },
                  { key: 'violation', label: 'Violations' },
                  { key: 'email', label: 'Sent Emails' },
                ].map((t) => (
                  <Button
                    key={t.key}
                    onClick={() => { setMainFilter(t.key); setSubFilter('all'); }}
                    variant={mainFilter === t.key ? 'primary' : 'outline'}
                    size="default"
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <Button variant="primary" size="default" onClick={() => setShowSendReport(true)}>
                Send Report
              </Button>
            </div>

            {/* Sub-filters */}
            {mainFilter !== 'all' && (
              <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: '24px' }}>
                {(mainFilter === 'violation'
                  ? [
                    { key: 'all', label: 'All' },
                    { key: 'unresolved', label: 'Unresolved' },
                    { key: 'resolved', label: 'Resolved' },
                  ]
                  : [
                    { key: 'all', label: 'All' },
                    { key: 'daily', label: 'Daily' },
                    { key: 'weekly', label: 'Weekly' },
                    { key: 'monthly', label: 'Monthly' },
                    { key: 'quarterly', label: 'Quarterly' },
                    { key: 'half-yearly', label: 'Half-Yearly' },
                    { key: 'yearly', label: 'Yearly' },
                  ]
                ).map((s) => (
                  <Button
                    key={s.key}
                    onClick={() => setSubFilter(s.key)}
                    variant={subFilter === s.key ? 'secondary' : 'outline'}
                    size="small"
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            )}
            {/* Reports List */}
            {loading ? (
              <div className="flex items-center justify-center py-12" style={{ marginBottom: '20px' }}>
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>Loading reports...</p>
                </div>
              </div>
            ) : visibleReports.length === 0 ? (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 p-12 text-center" style={{ marginBottom: '20px' }}>
                <p className="text-gray-500 text-lg" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  {reports.length === 0 ? 'No reports found' : 'No reports in this category'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleReports.map((report, index) => (
                  <div key={report.id} style={{ marginBottom: '20px' }}>
                    <ReportItem
                      displayNumber={visibleReports.length - index}
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


        </div>
      </div>

      <ConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={executeDelete}
        title="Delete Report"
        message={`Are you sure you want to completely delete this analytics report? This action cannot be undone.`}
        confirmText="Delete"
        isDanger={true}
      />

      <UpdateReportModal
        isOpen={updateModal.isOpen}
        report={updateModal.report}
        onClose={() => setUpdateModal({ isOpen: false, report: null })}
        onSaved={fetchReports}
      />

      {showSendReport && (
        <SendReportModal onClose={() => { setShowSendReport(false); fetchReports(); }} />
      )}
    </div>
  );
};

export default Reports;

