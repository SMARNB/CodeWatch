import React from 'react';
import './CustomCSS/TextButton.css';

const TextButton = ({ 
  children,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const variantClasses = {
    default: 'text-btn-default',
    primary: 'text-btn-primary',
    secondary: 'text-btn-secondary',
    muted: 'text-btn-muted',
    danger: 'text-btn-danger',
    success: 'text-btn-success'
  };

  const sizeClasses = {
    small: 'text-btn-small',
    default: 'text-btn-default-size',
    large: 'text-btn-large'
  };

  const disabledClass = disabled || loading ? 'text-btn-disabled' : '';
  const loadingClass = loading ? 'text-btn-loading' : '';

  const handleClick = (e) => {
    if (disabled || loading) {
      e.preventDefault();
      return;
    }
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type={type}
      className={`
        text-btn
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${disabledClass}
        ${loadingClass}
        ${className}
      `}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="text-btn-spinner">
          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"/>
          </svg>
        </span>
      )}
      
      {!loading && (
        <span className="text-btn-text">
          {children}
        </span>
      )}
    </button>
  );
};

export default TextButton;