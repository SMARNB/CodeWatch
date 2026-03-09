import React from 'react';
import './CustomCSS/Heading.css';

const Heading = ({ 
  children,
  level = 1,
  size = 'default',
  variant = 'default',
  color = 'default',
  weight = 'default',
  align = 'left',
  className = '',
  ...props
}) => {
  const sizeClasses = {
    xs: 'heading-xs',
    sm: 'heading-sm',
    default: 'heading-default',
    lg: 'heading-lg',
    xl: 'heading-xl',
    '2xl': 'heading-2xl',
    '3xl': 'heading-3xl',
    '4xl': 'heading-4xl',
    '5xl': 'heading-5xl'
  };

  const variantClasses = {
    default: 'heading-default-variant',
    primary: 'heading-primary',
    secondary: 'heading-secondary',
    muted: 'heading-muted',
    gradient: 'heading-gradient'
  };

  const colorClasses = {
    default: 'text-gray-900',
    primary: 'text-blue-600',
    secondary: 'text-gray-600',
    muted: 'text-gray-500',
    white: 'text-white',
    black: 'text-black'
  };

  const weightClasses = {
    light: 'font-light',
    normal: 'font-normal',
    default: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold'
  };

  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  };

  const Tag = `h${level}`;

  return (
    <Tag
      className={`
        heading
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${colorClasses[color]}
        ${weightClasses[weight]}
        ${alignClasses[align]}
        ${className}
      `}
      {...props}
    >
      {children}
    </Tag>
  );
};

export default Heading;