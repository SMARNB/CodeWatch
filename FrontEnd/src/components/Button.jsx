import React from 'react';
import './CustomCSS/Button.css';

const Button = ({ 
  children,
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  className = '',
  onClick,
  type = 'button',
  ...props
}) => {
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success',
    warning: 'btn-warning'
  };

  const sizeClasses = {
    small: 'btn-small',
    default: 'btn-default',
    large: 'btn-large',
    xl: 'btn-xl'
  };

  const iconClasses = {
    left: 'btn-icon-left',
    right: 'btn-icon-right',
    only: 'btn-icon-only'
  };

  const fullWidthClass = fullWidth ? 'btn-full-width' : '';
  const disabledClass = disabled || loading ? 'btn-disabled' : '';
  const loadingClass = loading ? 'btn-loading' : '';

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
        btn
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${iconClasses[iconPosition]}
        ${fullWidthClass}
        ${disabledClass}
        ${loadingClass}
        ${className}
      `}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="btn-spinner">
          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
            <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"/>
          </svg>
        </span>
      )}
      
      {!loading && icon && iconPosition === 'left' && (
        <span className="btn-icon">
          {icon}
        </span>
      )}
      
      {!loading && children && (
        <span className="btn-text">
          {children}
        </span>
      )}
      
      {!loading && icon && iconPosition === 'right' && (
        <span className="btn-icon">
          {icon}
        </span>
      )}
    </button>
  );
};

export default Button;