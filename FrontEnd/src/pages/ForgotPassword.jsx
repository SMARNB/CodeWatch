import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import backgroundEllipse from '../assets/background.svg';
import logoImage from '../assets/Logo.svg';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch('/api/forgot-password/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.message || 'Could not send the request. Please try again.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError('Could not send the request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  return (
    <div className="bg-[#f2f3ff] relative size-full min-h-screen flex items-center justify-center" data-name="Forgot Password">
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      <div className="absolute h-[387px] left-1/2 top-[calc(50%-31.5px)] translate-x-[-50%] translate-y-[-50%] w-[388px]" data-name="Forgot Password Card">
        <div className="absolute bg-white inset-0 rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)]" />

        <div className="absolute h-[54px] left-[1px] top-[8px] w-[58px]">
          <img alt="" className="block max-w-none size-full" src={logoImage} />
        </div>

        <div className="absolute flex flex-col font-['Open_Sans:Bold',_sans-serif] font-bold inset-[13.81%_21.39%_78.6%_21.91%] justify-center leading-[0] text-[#3f4299] text-[28px] text-center">
          <p className="leading-[normal]">Reset Password</p>
        </div>

        {success ? (
          <div className="absolute flex flex-col font-['Open_Sans:Regular',_sans-serif] font-normal inset-[10%_10%_20%_10%] justify-center leading-[0] text-[#505050] text-[16px] text-center" style={{ top: '95px' }}>
            <p className="leading-[22px]">Your request has been sent to the administrator, who will reset your password to the default.</p>
          </div>
        ) : (
          <>
            <div className="absolute flex flex-col font-['Open_Sans:Regular',_sans-serif] font-normal inset-[10%_0%_35.28%_0%] justify-center leading-[0] text-[#505050] text-[16px] text-center" style={{ bottom: '249px', top: '100px' }}>
              <p className="leading-[20px]">Enter your email to request a password reset</p>
            </div>

            {error && (
              <div className="absolute inset-[45%_7.73%_45%_7.73%] bg-red-50 border border-red-200 rounded-lg flex items-center justify-center py-0">
                <p className="text-sm text-red-600 text-center px-2">{error}</p>
              </div>
            )}

            <div className="absolute bg-white border border-[#3f4299] border-solid h-[48px] left-[30px] rounded-[8px] top-[167px] w-[328px]" style={{ paddingRight: '10px', paddingLeft: '10px' }}>
              <input
                type="email"
                name="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="Enter your email address"
                className="w-full h-full pl-[6px] pr-4 text-[14px] text-black bg-transparent border-none outline-none"
                required
              />
            </div>

            <div className="absolute bg-[#3f4299] inset-[65%_7.73%_15%_7.73%] rounded-[8px]" data-name="Button" style={{ bottom: '95px', top: '250px' }}>
              <button
                className="absolute flex items-center justify-center font-['Open_Sans:Bold',_sans-serif] font-bold inset-0 text-[16px] text-center text-white w-full h-full"
                onClick={handleSubmit}
                disabled={loading}
              >
                <span className="leading-[18px]">{loading ? 'Sending...' : 'Send Request'}</span>
              </button>
            </div>
          </>
        )}

        <div className="absolute bg-[#3f4299] inset-[78.84%_7.73%_10.47%_7.73%] rounded-[8px]" data-name="Button">
          <button
            className="absolute flex items-center justify-center font-['Open_Sans:Bold',_sans-serif] font-bold inset-0 text-[16px] text-center text-white w-full h-full"
            onClick={handleBackToLogin}
          >
            <span className="leading-[18px]">Back to Login</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
