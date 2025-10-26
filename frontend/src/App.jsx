import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RoleSelectionPage from './pages/RoleSelectionPage';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import PasswordResetPage from './pages/PasswordResetPage';
import SignUpPage from './pages/SignUp';
import NotificationsPage from './pages/NotificationsPage';
import AdminHome from './pages/Home/AdminHome';
import DashboardPage from './pages/DashboardPage';
import './App.css';

// Placeholder components for dashboard pages
const AdminDashboardPage = () => (
  <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">
    <div className="bg-white rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)] p-8 text-center">
      <h1 className="text-2xl font-bold text-[#3f4299] mb-4">Admin Dashboard</h1>
      <p className="text-[#505050]">Admin dashboard page - to be implemented</p>
    </div>
  </div>
);

const DepartmentHeadDashboardPage = () => (
  <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">
    <div className="bg-white rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)] p-8 text-center">
      <h1 className="text-2xl font-bold text-[#3f4299] mb-4">Department Head Dashboard</h1>
      <p className="text-[#505050]">Department Head dashboard page - to be implemented</p>
    </div>
  </div>
);

// Placeholder components for new routes
const FeedbackPage = () => (
  <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">
    <div className="bg-white rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)] p-8 text-center">
      <h1 className="text-2xl font-bold text-[#3f4299] mb-4">Violation Feedback</h1>
      <p className="text-[#505050]">Feedback form - to be implemented</p>
    </div>
  </div>
);

const NotificationDetailsPage = () => (
  <div className="min-h-screen bg-[#f2f3ff] flex items-center justify-center">
    <div className="bg-white rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)] p-8 text-center">
      <h1 className="text-2xl font-bold text-[#3f4299] mb-4">Notification Details</h1>
      <p className="text-[#505050]">Notification details page - to be implemented</p>
    </div>
  </div>
);


// Component to handle role selection and navigation
const RoleSelectorWrapper = () => {
  const handleRoleSelect = (role) => {
    // This will be handled by the routing system
    console.log('Role selected:', role);
  };

  return <RoleSelectionPage onRoleSelect={handleRoleSelect} />;
};

// Main App Component
function App() {
  // State to simulate current logged-in user's role
  const [userRole, setUserRole] = useState('Admin');

  return (
    <BrowserRouter>
      <div className="min-h-screen">
        {/* Navbar - shown on all pages except role selection and auth pages */}
        <Routes>
          <Route path="/" element={<RoleSelectorWrapper />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<PasswordResetPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          <Route path="/admin/notifications" element={<NotificationsPage userType="admin" />} />
          <Route path="/admin/home" element={<AdminHome />} />
          
          {/* Department Head Routes */}
          <Route path="/depthead/dashboard" element={<DepartmentHeadDashboardPage />} />
          <Route path="/depthead/notifications" element={<NotificationsPage userType="department-head" />} />
          
          {/* SSD Routes */}
          <Route path="/ssd/dashboard" element={<DashboardPage />} />
          <Route path="/ssd/notifications" element={<NotificationsPage userType="ssd" />} />
          
          {/* Legacy routes for backward compatibility */}
          <Route path="/department-head/dashboard" element={<DepartmentHeadDashboardPage />} />
          <Route path="/department-head/notifications" element={<NotificationsPage userType="department-head" />} />
          
          {/* New Routes */}
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/notification-details" element={<NotificationDetailsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
