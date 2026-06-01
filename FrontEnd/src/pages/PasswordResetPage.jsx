import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import backgroundEllipse from '../assets/background.svg';
import logoImage from '../assets/Logo.svg';

const EyeButton = ({ show, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    className={`absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center transition-colors duration-200 ${show ? 'text-[#3f4299]' : 'text-gray-400'}`}
    aria-label={show ? 'Hide password' : 'Show password'}
  >
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
  </button>
);

const PasswordInput = ({ name, value, onChange, placeholder, show, onToggle }) => (
  <div className="relative">
    <input
      type={show ? 'text' : 'password'}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299] pr-12"
      style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '16px' }}
    />
    <EyeButton show={show} onToggle={onToggle} />
  </div>
);

const PasswordResetPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const mode = searchParams.get('mode') === 'first' ? 'first' : 'change';
  const email = localStorage.getItem('userEmail') || '';
  const userType = localStorage.getItem('userType') || 'admin';

  const [formData, setFormData] = useState({ oldPassword: '', password: '', confirmPassword: '' });
  const [showOld, setShowOld] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const dashboardRoutes = {
    'admin': '/admin/dashboard',
    'ssd': '/ssd/notifications',
    'department-head': '/department-head/dashboard',
    'guard': '/guard/dashboard'
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('No account is signed in. Please log in again.');
      return;
    }
    if (mode === 'change' && !formData.oldPassword) {
      setError('Please enter your current password');
      return;
    }
    if (!formData.password || !formData.confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const url = mode === 'first' ? '/api/set-initial-password/' : '/api/change-password/';
      const body = mode === 'first'
        ? { email, password: formData.password }
        : { email, old_password: formData.oldPassword, new_password: formData.password };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.status === 'success') {
        setSuccess(true);
        setTimeout(() => { navigate(dashboardRoutes[userType] || '/login'); }, 1800);
      } else {
        setError(data.message || 'Could not update your password. Please try again.');
      }
    } catch (err) {
      console.error('Password update error:', err);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (mode === 'first') navigate('/login');
    else navigate(dashboardRoutes[userType] || '/login');
  };

  const title = mode === 'first' ? 'Set Your Password' : 'Change Password';
  const subtitle = mode === 'first'
    ? 'Create your own password to replace the default'
    : 'Enter your current password and choose a new one';

  return (
    <div className="bg-[#f2f3ff] relative size-full min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Card */}
      <div className="relative z-10 w-[388px] max-w-[92vw] bg-white rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)]" style={{ padding: '32px' }}>
        {success ? (
          <div className="flex flex-col items-center text-center" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <svg className="w-9 h-9 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-[24px] font-bold text-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif" }}>Password Updated</h1>
            <p className="text-[14px] text-[#505050] mt-2 mb-6" style={{ fontFamily: "'Open Sans', sans-serif" }}>Your password has been saved. Redirecting...</p>
            <div className="w-8 h-8 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Logo */}
            <div className="flex justify-center" style={{ marginBottom: '12px' }}>
              <img alt="" className="h-[54px] w-[58px] block" src={logoImage} />
            </div>

            {/* Title + Subtitle */}
            <h1 className="text-[28px] font-bold text-[#3f4299] text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>{title}</h1>
            <p className="text-[14px] text-[#505050] text-center" style={{ fontFamily: "'Open Sans', sans-serif", marginTop: '4px', marginBottom: '24px' }}>{subtitle}</p>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-[8px] flex items-center justify-center" style={{ padding: '8px', marginBottom: '16px' }}>
                <p className="text-sm text-red-600 text-center">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col" style={{ gap: '16px' }}>
              {mode === 'change' && (
                <PasswordInput
                  name="oldPassword"
                  value={formData.oldPassword}
                  onChange={handleInputChange}
                  placeholder="Current password"
                  show={showOld}
                  onToggle={() => setShowOld(!showOld)}
                />
              )}
              <PasswordInput
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="New password"
                show={showPassword}
                onToggle={() => setShowPassword(!showPassword)}
              />
              <PasswordInput
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm new password"
                show={showConfirmPassword}
                onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />

              <p className="text-xs text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Password must be at least 8 characters long
              </p>

              <button
                type="submit"
                disabled={loading}
                className={`h-[48px] bg-[#3f4299] rounded-[8px] text-white text-[16px] font-bold transition-colors hover:bg-[#2d3170] ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                {loading ? 'Saving...' : (mode === 'first' ? 'Set Password' : 'Update Password')}
              </button>
            </form>

            {/* Back link */}
            <div className="text-center" style={{ marginTop: '16px' }}>
              <button
                onClick={handleBack}
                className="text-sm font-medium text-[#3f4299] hover:underline"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                {mode === 'first' ? '← Back to Login' : '← Cancel'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PasswordResetPage;
