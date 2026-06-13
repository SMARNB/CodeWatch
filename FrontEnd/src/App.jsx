import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Page imports
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import PasswordResetPage from './pages/PasswordResetPage';

import NotificationsPage from './pages/NotificationsPage';
import DashboardPage from './pages/DashboardPage';
import NotificationDetailsPage from './pages/NotificationDetailsPage';
import ManageViolationsPage from './pages/ManageViolationsPage';
import Reports from './pages/Reports';
import GenerateAnalyticsPage from './pages/GenerateAnalyticsPage';
import ReportDetailsPage from './pages/ReportDetailsPage';
import ManageCamerasPage from './pages/ManageCamerasPage';
import ManagePeoplePage from './pages/ManagePeoplePage';
import ManageBlacklistPage from './pages/ManageBlacklistPage';
import LiveTrackPage from './pages/LiveTrackPage';
import GuardDashboardPage from './pages/GuardDashboardPage';
import AddVisitorPage from './pages/AddVisitorPage';
import VisitorListPage from './pages/VisitorListPage';
import GuardLayout from './components/GuardLayout';
import AppLayout from './components/AppLayout';
import ConfirmModal from './components/ConfirmModal';
// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
            <details className="whitespace-pre-wrap">
              <summary className="cursor-pointer text-gray-700 font-semibold mb-2">
                Error Details
              </summary>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {this.state.error && this.state.error.toString()}
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


// Placeholder components for new routes
const FeedbackPage = () => (
  <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">
    <div className="bg-white rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)] p-8 text-center">
      <h1 className="text-2xl font-bold text-[#3f4299] mb-4">Violation Feedback</h1>
      <p className="text-[#505050]">Feedback form - to be implemented</p>
    </div>
  </div>
);


const AddCameraPage = () => (
  <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">
    <div className="bg-white rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)] p-8 text-center">
      <h1>Add Camera Page - To Be Implemented</h1>
    </div>
  </div>
);


// Protected Route Component
const ProtectedRoute = ({ children, requiredRole, allowedRoles }) => {
  const userType = localStorage.getItem('userType');

  if (!userType) {
    return <Navigate to="/login" replace />;
  }

  let hasAccess = true;
  if (allowedRoles) {
    hasAccess = allowedRoles.includes(userType);
  } else if (requiredRole) {
    hasAccess = userType === requiredRole;
  }

  if (!hasAccess) {
    const roleRoutes = {
      'admin': '/admin/dashboard',
      'ssd': '/ssd/dashboard',
      'department-head': '/department-head/dashboard',
      'guard': '/guard/dashboard'
    };
    return <Navigate to={roleRoutes[userType] || '/login'} replace />;
  }

  return children;
};

// Main App Component
function App() {
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    const handleSessionExpired = (e) => {
      setAlertData({ isOpen: true, message: e.detail || "Session expired, please log in again" });
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => window.removeEventListener('sessionExpired', handleSessionExpired);
  }, []);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<PasswordResetPage />} />

            {/* Main app pages — share ONE persistent Navbar via AppLayout */}
            <Route element={<AppLayout />}>
              <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><DashboardPage /></ProtectedRoute>} />
              <Route path="/department-head/dashboard" element={<ProtectedRoute requiredRole="department-head"><DashboardPage /></ProtectedRoute>} />
              <Route path="/ssd/dashboard" element={<ProtectedRoute requiredRole="ssd"><DashboardPage /></ProtectedRoute>} />
              <Route path="/admin/manage-violations" element={<ProtectedRoute allowedRoles={['admin', 'ssd', 'department-head']}><ManageViolationsPage /></ProtectedRoute>} />
              <Route path="/admin/manage-blacklist" element={<ProtectedRoute allowedRoles={['admin', 'department-head']}><ManageBlacklistPage /></ProtectedRoute>} />
              <Route path="/admin/manage-cameras" element={<ProtectedRoute requiredRole="admin"><ManageCamerasPage /></ProtectedRoute>} />
              <Route path="/admin/manage-people" element={<ProtectedRoute allowedRoles={['admin', 'department-head']}><ManagePeoplePage /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><GenerateAnalyticsPage /></ProtectedRoute>} />
            </Route>

            {/* Guard pages — their own layout */}
            <Route element={<ProtectedRoute requiredRole="guard"><GuardLayout /></ProtectedRoute>}>
              <Route path="/guard/dashboard" element={<GuardDashboardPage />} />
              <Route path="/guard/add-visitor" element={<AddVisitorPage />} />
              <Route path="/guard/visitors" element={<VisitorListPage />} />
            </Route>

            {/* Standalone / new-tab views — NO Navbar (they have their own close button) */}
            <Route path="/admin/notifications" element={<ProtectedRoute requiredRole="admin"><NotificationsPage userType="admin" /></ProtectedRoute>} />
            <Route path="/ssd/notifications" element={<ProtectedRoute requiredRole="ssd"><NotificationsPage userType="ssd" /></ProtectedRoute>} />
            <Route path="/department-head/notifications" element={<ProtectedRoute requiredRole="department-head"><NotificationsPage userType="department-head" /></ProtectedRoute>} />
            <Route path="/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
            <Route path="/notification-details" element={<ProtectedRoute><NotificationDetailsPage /></ProtectedRoute>} />
            <Route path="/add-camera" element={<ProtectedRoute><AddCameraPage /></ProtectedRoute>} />
            <Route path="/report-details" element={<ProtectedRoute><ReportDetailsPage /></ProtectedRoute>} />
            <Route path="/live-track/:personId" element={<ProtectedRoute><LiveTrackPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </BrowserRouter>

      <ConfirmModal
        isOpen={alertData.isOpen}
        onClose={() => setAlertData(s => ({ ...s, isOpen: false }))}
        onConfirm={() => setAlertData(s => ({ ...s, isOpen: false }))}
        title="Session Expired"
        message={alertData.message}
        confirmText="OK"
        hideCancel={true}
      />
    </ErrorBoundary>
  );
}

export default App;
