import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';

// Page imports
import RoleSelectionPage from './pages/RoleSelectionPage';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import PasswordResetPage from './pages/PasswordResetPage';
import SignUpPage from './pages/SignUp';
import NotificationsPage from './pages/NotificationsPage';
import DashboardPage from './pages/DashboardPage';
import NotificationDetailsPage from './pages/NotificationDetailsPage';
import ManageViolationsPage from './pages/ManageViolationsPage';
import PreviousReportsPage from './pages/PreviousReportsPage';
import GenerateAnalyticsPage from './pages/GenerateAnalyticsPage';
import ReportDetailsPage from './pages/ReportDetailsPage';

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


// Main App Component
function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <div className="min-h-screen">
          <Routes>
            <Route path="/" element={<RoleSelectionPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<PasswordResetPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/admin/dashboard" element={<DashboardPage />} />
            <Route path="/admin/notifications" element={<NotificationsPage userType="admin" />} />
            <Route path="/ssd/notifications" element={<NotificationsPage userType="ssd" />} />
            <Route path="/department-head/dashboard" element={<DashboardPage />} />
            <Route path="/department-head/notifications" element={<NotificationsPage userType="department-head" />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/notification-details" element={<NotificationDetailsPage />} />
            <Route path="/add-camera" element={<AddCameraPage />} />
            <Route path="/admin/manage-violations" element={<ManageViolationsPage />} />
            <Route path="/reports" element={<PreviousReportsPage />} />
            <Route path="/report-details" element={<ReportDetailsPage />} />
            <Route path="/analytics" element={<GenerateAnalyticsPage />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
