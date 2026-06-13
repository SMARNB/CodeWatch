import React from 'react';
import './CustomCSS/Card.css';

const Card = ({ 
  children, 
  className = '', 
  variant = 'default',
  padding = 'default',
  shadow = 'default',
  rounded = 'default',
  hover = false,
  onClick
}) => {
  const variantClasses = {
    default: 'card-default',
    elevated: 'card-elevated',
    outlined: 'card-outlined',
    filled: 'card-filled'
  };

  const paddingClasses = {
    none: 'p-0',
    small: 'p-4',
    default: 'p-6',
    large: 'p-8',
    xl: 'p-10'
  };

  const shadowClasses = {
    none: 'shadow-none',
    small: 'shadow-sm',
    default: 'shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)]',
    large: 'shadow-lg',
    xl: 'shadow-2xl'
  };

  const roundedClasses = {
    none: 'rounded-none',
    small: 'rounded-sm',
    default: 'rounded-2xl',
    large: 'rounded-3xl',
    full: 'rounded-full'
  };

  const hoverClasses = hover ? 'card-hover' : '';

  return (
    <div 
      className={`
        card-container 
        ${variantClasses[variant]} 
        ${paddingClasses[padding]} 
        ${shadowClasses[shadow]} 
        ${roundedClasses[rounded]} 
        ${hoverClasses}
        ${className}
      `}
      onClick={onClick}
      data-node-id="65:601"
    >
      {children}
    </div>
  );
};

export default Card;
