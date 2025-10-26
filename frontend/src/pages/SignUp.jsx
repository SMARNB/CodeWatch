import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import TextButton from '../components/TextButton';

const SignUpPage = ({ userType: propUserType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get user type from prop, location state, or default to 'admin'
  const userType = propUserType || location.state?.userType || 'admin';
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    // Validate based on user type
    if (userType === 'admin') {
      if (!formData.email || !formData.username || !formData.password || !formData.confirmPassword) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }
    } else {
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        setError('Please fill in all fields');
        setLoading(false);
        return;
      }
    }

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/auth/signup', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ ...formData, userType })
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock success - store user info and navigate
      localStorage.setItem('userType', userType);
      localStorage.setItem('userEmail', formData.email || '');
      localStorage.setItem('userName', formData.username || '');

      // Navigate to appropriate dashboard
      const dashboardRoutes = {
        admin: '/admin/dashboard',
        ssd: '/ssd/dashboard',
        'department-head': '/department-head/dashboard'
      };

      navigate(dashboardRoutes[userType] || '/dashboard');
    } catch (error) {
      setError('Sign up failed. Please try again.');
      console.error('Sign up error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login', { state: { userType } });
  };

  const handleBackToRoleSelection = () => {
    navigate('/');
  };

  const getTitle = () => {
    const titles = {
      admin: 'Admin Sign Up',
      ssd: 'SSD',
      'department-head': 'Department Head Sign Up'
    };
    return titles[userType] || 'Sign Up';
  };

  const imgEllipse9 = "http://localhost:3845/assets/69bd5562076a8da41563ffca97f57699d1b0caeb.svg";
  const imgGroup1000001689 = "http://localhost:3845/assets/5734e3b2cc45b448a25ee3c66b3839f4aec268f5.svg";

  return (
    <div className="bg-[#f2f3ff] relative size-full min-h-screen flex items-center justify-center" data-name="Admin Sign Up">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={imgEllipse9} />
      </div>

      {/* Sign Up Card */}
      <div className="absolute h-[500px] left-1/2 top-[calc(50%-0.5px)] translate-x-[-50%] translate-y-[-50%] w-[388px]" data-name="Sign Up">
        <div className="absolute bg-white inset-0 rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)]" />
        
        {/* Logo */}
        <div className="absolute h-[54px] left-[1px] top-[8px] w-[58px]">
          <img alt="" className="block max-w-none size-full" src={imgGroup1000001689} />
        </div>

        {/* Title */}
        <div className="absolute flex flex-col font-['Open_Sans:Bold',_sans-serif] font-bold inset-[13.81%_21.39%_78.6%_21.91%] justify-center leading-[0] text-[#3f4299] text-[28px] text-center">
          <p className="leading-[normal]">{getTitle()}</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="absolute inset-[25%_7.73%_70%_7.73%] bg-red-50 border border-red-200 rounded-lg flex items-center justify-center py-0">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        )}

        {/* Form Fields */}
        <div className="absolute inset-[30%_7.73%_20%_7.73%] space-y-4">
          {/* Email Field - For all user types */}
          <div className="bg-white border border-[#3f4299] border-solid h-[48px] rounded-[8px] w-full mb-3" style={{marginBottom: '10px', paddingLeft: '10px'}}>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Email"
              className="w-full h-full pl-[46px] pr-4 text-[14px] text-black bg-transparent border-none outline-none"
              required
            />
          </div>

          {/* Username Field - Only for Admin */}
          {userType === 'admin' && (
            <div className="bg-white border border-[#3f4299] border-solid h-[48px] rounded-[8px] w-full mb-3" style={{marginBottom: '10px', paddingLeft: '10px'}}>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                className="w-full h-full pl-[46px] pr-4 text-[14px] text-black bg-transparent border-none outline-none"
                required
              />
            </div>
          )}

          {/* Password Field */}
          <div className="bg-white border border-[#bab6b6] border-solid h-[48px] rounded-[8px] w-full mb-3 relative" style={{marginBottom: '10px', paddingLeft: '10px'}}>
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter your password"
              className="w-full h-full pl-[46px] pr-12 text-[14px] text-black bg-transparent border-none outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center transition-colors duration-200 ${
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

          {/* Confirm Password Field */}
          <div className="bg-white border border-[#bab6b6] border-solid h-[48px] rounded-[8px] w-full mb-3 relative" style={{marginBottom: '10px', paddingLeft: '10px'}}>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              className="w-full h-full pl-[46px] pr-12 text-[14px] text-black bg-transparent border-none outline-none"
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center transition-colors duration-200 ${
                showConfirmPassword ? 'text-[#3f4299]' : 'text-gray-400'
              }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                {showConfirmPassword ? (
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                ) : (
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Sign Up Button */}
        <div className="absolute bg-[#3f4299] inset-[78%_7.73%_12%_7.73%] rounded-[8px]" data-name="Button">
          <button 
            className="absolute flex items-center justify-center font-['Open_Sans:Bold',_sans-serif] font-bold inset-0 text-[16px] text-center text-white w-full h-full"
            onClick={handleSubmit}
            disabled={loading}
          >
            <span className="leading-[18px]">{loading ? 'Creating Account...' : 'Sign Up'}</span>
          </button>
        </div>

        {/* Back to Login */}
        <div className="absolute inset-[87%_20%_8%_20%] flex justify-center items-center">
          <TextButton 
            variant="secondary" 
            size="small"
            className="text-center"
            onClick={handleBackToLogin}
          >
            ← Back to Login
          </TextButton>
        </div>

        {/* Back to Role Selection */}
        <div className="absolute inset-[94%_20%_3%_20%] flex justify-center items-center">
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

export default SignUpPage;
