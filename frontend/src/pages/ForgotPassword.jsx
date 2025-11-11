import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '../components/Card';
import Button from '../components/Button';
import Heading from '../components/Heading';
import TextButton from '../components/TextButton';
import backgroundEllipse from '../assets/background.svg';
import logoImage from '../assets/Logo.svg';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [autoSend, setAutoSend] = useState(false);

  // Get user type and email from location state
  const userType = location.state?.userType || 'admin';
  const userEmail = location.state?.email || '';

  // Auto-send email on component mount if email is provided
  useEffect(() => {
    if (userEmail && !autoSend) {
      setEmail(userEmail);
      setAutoSend(true);
      handleAutoSend(userEmail);
    }
  }, [userEmail, autoSend]);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };

  const handleAutoSend = async (emailToSend) => {
    setError('');
    setLoading(true);

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/auth/forgot-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email: emailToSend, userType })
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock success - show success message
      setSuccess(true);
      
      // Store email for potential use in password reset
      localStorage.setItem('resetEmail', emailToSend);
      localStorage.setItem('resetUserType', userType);

    } catch (error) {
      setError('Failed to send reset email. Please try again.');
      console.error('Forgot password error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate email
    if (!email) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/auth/forgot-password', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, userType })
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock success - show success message
      setSuccess(true);
      
      // Store email for potential use in password reset
      localStorage.setItem('resetEmail', email);
      localStorage.setItem('resetUserType', userType);

    } catch (error) {
      setError('Failed to send reset email. Please try again.');
      console.error('Forgot password error:', error);
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

      {/* Forgot Password Card */}
      <div className="absolute h-[387px] left-1/2 top-[calc(50%-31.5px)] translate-x-[-50%] translate-y-[-50%] w-[388px]" data-name="Log In">
        <div className="absolute bg-white inset-0 rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)]" />
        
        {/* Logo */}
        <div className="absolute h-[54px] left-[1px] top-[8px] w-[58px]">
          <img alt="" className="block max-w-none size-full" src={logoImage} />
        </div>

         {/* Title */}
         <div className="absolute flex flex-col font-['Open_Sans:Bold',_sans-serif] font-bold inset-[13.81%_21.39%_78.6%_21.91%] justify-center leading-[0] text-[#3f4299] text-[28px] text-center">
           <p className="leading-[normal]">{getUserTypeLabel()}</p>
         </div>

         {/* Success Message */}
         {success ? (
           <div className="absolute flex flex-col font-['Open_Sans:Regular',_sans-serif] font-normal inset-[10%_19.33%_25.28%_19.33%] justify-center leading-[0] text-[#505050] text-[16px] text-center">
             <p className="leading-[20px]">Password Reset Mail has been sent to your mailing Id.</p>
           </div>
         ) : (
           <>
             {/* Loading State */}
             {loading && autoSend ? (
               <div className="absolute flex flex-col font-['Open_Sans:Regular',_sans-serif] font-normal inset-[10%_19.33%_35.28%_19.33%] justify-center leading-[0] text-[#505050] text-[16px] text-center">
                 <p className="leading-[20px]">Sending password reset email...</p>
               </div>
             ) : (
               <>
                   {/* Subtitle */}
                    <div className="absolute flex flex-col font-['Open_Sans:Regular',_sans-serif] font-normal inset-[10%_0%_35.28%_0%] justify-center leading-[0] text-[#505050] text-[16px] text-center" style={{bottom: '249px', top: '100px'}}>
                     <p className="leading-[20px]">Enter your email to receive password reset instructions</p>
                   </div>

                {/* Error Message */}
                {error && (
                  <div className="absolute inset-[45%_7.73%_45%_7.73%] bg-red-50 border border-red-200 rounded-lg flex items-center justify-center py-0">
                    <p className="text-sm text-red-600 text-center">{error}</p>
                  </div>
                )}

                {/* Email Input */}
                <div className="absolute bg-white border border-[#3f4299] border-solid h-[48px] left-[30px] rounded-[8px] top-[167px] w-[328px]" style={{paddingRight: '10px', paddingLeft: '10px'}}>
                  <input
                    type="email"
                    name="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="Enter your email address"
                    className="w-full h-full pl-[36px] pr-4 text-[14px] text-black bg-transparent border-none outline-none"
                    required
                  />
                </div>

                {/* Send Reset Email Button */}
                <div className="absolute bg-[#3f4299] inset-[65%_7.73%_15%_7.73%] rounded-[8px]" data-name="Button" style={{bottom: '95px', top: '250px'}}>
                  <button 
                    className="absolute flex items-center justify-center font-['Open_Sans:Bold',_sans-serif] font-bold inset-0 text-[16px] text-center text-white w-full h-full"
                    onClick={handleSubmit}
                    disabled={loading}
                  >
                    <span className="leading-[18px]">{loading ? 'Sending...' : 'Send Reset Email'}</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Back to Login Button */}
        <div className="absolute bg-[#3f4299] inset-[78.84%_7.73%_10.47%_7.73%] rounded-[8px]" data-name="Button">
          <button 
            className="absolute flex items-center justify-center font-['Open_Sans:Bold',_sans-serif] font-bold inset-0 text-[16px] text-center text-white w-full h-full"
            onClick={handleBackToLogin}
          >
            <span className="leading-[18px]">Back to Login</span>
          </button>
        </div>

        {/* Back to Role Selection */}
        <div className="absolute inset-[88%_20%_5%_20%] flex justify-center items-center" style={{bottom: '10px', top: '360px'}}>
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

export default ForgotPassword;
