import React from 'react';
import CodeWatchLogo from '../assets/logo.svg';

const Logo = ({ size = 'md', showText = true, className = '' }) => {
  // Size mapping for logo image and text (increased by 10px)
  const sizeClasses = {
    sm: { img: 'h-[34px] w-[34px]', text: 'text-sm' },
    md: { img: 'h-[42px] w-[42px]', text: 'text-lg' },
    lg: { img: 'h-[50px] w-[50px]', text: 'text-xl' },
    xl: { img: 'h-[74px] w-[74px]', text: 'text-2xl' },
    // Support legacy size names for backward compatibility
    small: { img: 'h-[34px] w-[34px]', text: 'text-sm' },
    default: { img: 'h-[64px] w-[64px]', text: 'text-lg' }, // 80% of navbar height (80px)
    large: { img: 'h-[50px] w-[50px]', text: 'text-xl' }
  };

  // Get size classes, default to 'md' if size not found
  const currentSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <img 
        src={CodeWatchLogo} 
        alt="Code Watch Logo" 
        className={`${currentSize.img} object-contain block`}
      />
      {showText && (
        <span className={`${currentSize.text} font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#3f4299] to-[#4f46e5]`}>
          Code Watch
        </span>
      )}
    </div>
  );
};

export default Logo;
