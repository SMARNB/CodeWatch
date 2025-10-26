import React from 'react';
import './CustomCSS/Logo.css';

const Logo = ({ 
  size = 'default', 
  variant = 'default', 
  className = '',
  showText = true,
  text = 'Code Watch'
}) => {
  const sizeClasses = {
    small: 'w-8 h-8',
    default: 'w-12 h-12',
    large: 'w-16 h-16',
    xl: 'w-20 h-20'
  };

  const textSizeClasses = {
    small: 'text-sm',
    default: 'text-lg',
    large: 'text-xl',
    xl: 'text-2xl'
  };

  // Figma image URL
  const figmaImage = "http://localhost:3845/assets/c077738cabbb16a6cb7491609cbe75b8b0352852.svg";

  return (
    <div className={`logo-container flex items-center space-x-3 ${className}`}>
      {/* Logo Icon */}
      <div className={`logo-icon ${sizeClasses[size]} flex items-center justify-center`}>
        <img 
          src={figmaImage}
          alt="Code Watch Logo"
          className="w-full h-full object-contain"
          data-node-id="2017:875"
        />
      </div>
      
      {/* Logo Text */}
      {showText && (
        <div className={`logo-text ${textSizeClasses[size]} font-bold text-gray-800`}>
          <span className="text-primary-600">{text.split(' ')[0]}</span>
          {text.split(' ').length > 1 && (
            <span className="text-gray-600 ml-1">{text.split(' ').slice(1).join(' ')}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;