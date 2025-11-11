import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Heading from '../components/Heading';
import TextButton from '../components/TextButton';
import backgroundEllipse from '../assets/background.svg';
import logoImage from '../assets/Logo.svg';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Get user type from location state or default to 'admin'
  const userType = location.state?.userType || 'admin';

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate inputs
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ ...formData, userType })
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mock authentication - route based on user type
      const dashboardRoutes = {
        admin: '/admin/dashboard',
        ssd: '/ssd/notifications',
        'department-head': '/department-head/dashboard'
      };

      // Extract display name from email (part before @)
      const emailName = formData.email.split('@')[0];
      const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);

      // Store user info in localStorage (replace with proper auth management)
      localStorage.setItem('userType', userType);
      localStorage.setItem('userEmail', formData.email);
      localStorage.setItem('userName', formData.email); // Store email as userName for Navbar
      localStorage.setItem('userDisplayName', displayName); // Store display name for avatar initials
      localStorage.setItem('username', formData.email); // Alternative key for compatibility

      // Dispatch custom event to notify Navbar of user data update
      window.dispatchEvent(new Event('userDataUpdated'));

      // Navigate to appropriate dashboard
      navigate(dashboardRoutes[userType] || '/dashboard');
    } catch (error) {
      setError('Login failed. Please check your credentials.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate('/forgot-password', { state: { userType, email: formData.email } });
  };

  const handleBackToRoleSelection = () => {
    navigate('/');
  };

  const getUserTypeLabel = () => {
    const labels = {
      admin: 'Admin',
      ssd: 'SSD',
      'department-head': 'Department Head'
    };
    return labels[userType] || 'User';
  };

  return (
    <div className="bg-[#f2f3ff] relative size-full min-h-screen flex items-center justify-center" data-name="Admin Log In">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Login Card */}
      <div className="absolute h-[449px] left-1/2 top-[calc(50%-0.5px)] translate-x-[-50%] translate-y-[-50%] w-[388px]" data-name="Log In">
        <div className="absolute bg-white inset-0 rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)]" />
        
        {/* Logo */}
        <div className="absolute h-[54px] left-[1px] top-[8px] w-[58px]">
          <img alt="" className="block max-w-none size-full" src={logoImage} />
        </div>

        {/* Title */}
        <div className="absolute flex flex-col font-['Open_Sans:Bold',_sans-serif] font-bold inset-[13.81%_21.39%_68.6%_21.91%] justify-center leading-[0] text-[#3f4299] text-[32px] text-center">
          <p className="leading-[normal]">{getUserTypeLabel()} Log In</p>
        </div>

        {/* Subtitle */}
        <div className="absolute flex flex-col font-['Open_Sans:Regular',_sans-serif] font-normal inset-[31.4%_19.33%_64.59%_19.33%] justify-center leading-[0] text-[#505050] text-[16px] text-center">
          <p className="leading-[20px]">Log In to your account</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute inset-[25%_7.73%_70%_7.73%] bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        {/* Email Input */}
        <div className="absolute bg-white border border-[#3f4299] border-solid h-[48px] left-[30px] rounded-[8px] top-[191px] w-[328px]">
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="example@email.com"
            className="w-full h-full pl-[36px] pr-4 text-[14px] text-black bg-transparent border-none outline-none"
            required
          />
        </div>

        {/* Password Input */}
        <div className="absolute bg-white border border-[#bab6b6] border-solid h-[48px] left-[30px] rounded-[8px] top-[255px] w-[328px]">
          <input
            type={showPassword ? 'text' : 'password'}
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            placeholder="Enter your password"
            className="w-full h-full pl-[36px] pr-4 text-[14px] text-black bg-transparent border-none outline-none"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center transition-colors duration-200 ${
              showPassword ? 'text-[#3f4299]' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              {showPassword ? (
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              ) : (
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              )}
            </svg>
          </button>
        </div>

        {/* Forgot Password Link */}
        <div className="absolute inset-[68.82%_7.73%_28.51%_50%] flex justify-end items-center">
          <TextButton 
            variant="primary" 
            size="small"
            className="text-right"
            onClick={handleForgotPassword}
          >
            Forgot Password ?
          </TextButton>
        </div>

        {/* Login Button */}
        <div className="absolute bg-[#3f4299] inset-[76.84%_7.73%_12.47%_7.73%] rounded-[8px]" data-name="Button">
          <button 
            className="absolute flex items-center justify-center font-['Open_Sans:Bold',_sans-serif] font-bold inset-0 text-[16px] text-center text-white w-full h-full"
            onClick={handleSubmit}
            disabled={loading}
          >
            <span className="leading-[18px]">{loading ? 'Logging in...' : 'Log In'}</span>
          </button>
        </div>

        {/* Back to Role Selection */}
        <div className="absolute inset-[88%_20%_5%_20%] flex justify-center items-center">
          <TextButton 
            variant="secondary" 
            size="small"
            className="text-center"
            onClick={handleBackToRoleSelection}
          >
            ← Back to Role Selection
          </TextButton>
        </div>
      </div>
    </div>
  );
};

export default Login;