import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userType = location.state?.userType || 'admin';
  
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const getUserTypeLabel = () => {
    const labels = {
      admin: 'Admin',
      ssd: 'SSD',
      'department-head': 'Department Head'
    };
    return labels[userType] || 'User';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email) {
      setError('Please enter your email address');
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
      await new Promise(resolve => setTimeout(resolve, 1500));

      setSubmitted(true);
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login', { state: { userType } });
  };

  if (submitted) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
        {/* Background Ellipses */}
        <div className="absolute bottom-0 left-0 w-full h-[110%] -translate-x-[3%] translate-y-[55%]">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-500/20 blur-3xl"></div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-[110%] -translate-x-[3%] translate-y-[55%]">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400/10 to-purple-500/10 blur-2xl"></div>
        </div>

        {/* Success Card */}
        <div className="relative z-10 w-full max-w-md mx-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            {/* Logo */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-center text-gray-900 mb-4">
              {getUserTypeLabel()}
            </h1>
            
            {/* Success Message */}
            <div className="text-center mb-8">
              <p className="text-gray-700 leading-relaxed">
                Password Reset Mail has been sent to your mailing Id.
              </p>
            </div>

            {/* Back to Login Button */}
            <button
              onClick={handleBackToLogin}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Background Ellipses */}
      <div className="absolute bottom-0 left-0 w-full h-[110%] -translate-x-[3%] translate-y-[55%]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-500/20 blur-3xl"></div>
      </div>
      <div className="absolute bottom-0 left-0 w-full h-[110%] -translate-x-[3%] translate-y-[55%]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400/10 to-purple-500/10 blur-2xl"></div>
      </div>

      {/* Forgot Password Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex items-center justify-center mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
              </svg>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">
            {getUserTypeLabel()}
          </h1>
          <h2 className="text-lg font-semibold text-center text-gray-700 mb-2">
            Forgot Password?
          </h2>
          <p className="text-center text-gray-600 mb-8">
            Enter your email to receive a password reset link
          </p>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={handleBackToLogin}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

