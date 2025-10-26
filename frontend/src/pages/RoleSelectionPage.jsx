import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/Logo';
import Card from '../components/Card';
import Button from '../components/Button';
import Heading from '../components/Heading';
import TextButton from '../components/TextButton';

const RoleSelectionPage = ({ onRoleSelect }) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState('');


  const handleRoleSelect = (roleId) => {
    setSelectedRole(roleId);
  };

  const handleContinue = () => {
    if (selectedRole) {
      if (onRoleSelect) {
        onRoleSelect(selectedRole);
      } else {
        navigate('/login', { state: { userType: selectedRole } });
      }
    }
  };

  return (
    <div className="bg-[#f2f3ff] relative size-full min-h-screen flex items-center justify-center" data-name="Admin-User Type">
      {/* Background Ellipse */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src="http://localhost:3845/assets/69bd5562076a8da41563ffca97f57699d1b0caeb.svg" />
      </div>

      {/* Role Selection Card */}
      <div className="absolute h-[541px] left-1/2 top-[calc(50%-0.5px)] translate-x-[-50%] translate-y-[-50%] w-[388px]" data-name="Log In">
        <div className="absolute bg-white inset-0 rounded-[16px] shadow-[5px_5px_52px_-12px_rgba(51,51,51,0.24)]" />
        
        {/* Logo */}
        <div className="absolute h-[54px] left-[2px] top-[6px] w-[58px]">
          <img alt="" className="block max-w-none size-full" src="http://localhost:3845/assets/5734e3b2cc45b448a25ee3c66b3839f4aec268f5.svg" />
        </div>

        {/* Code Watch Title */}
        <div className="absolute aspect-[298/61] flex flex-col font-[var(--static/display-medium/font,'Roboto:Bold',_sans-serif)] font-bold justify-center leading-[0] left-[15.46%] right-[7.73%] text-[#3f4299] text-[48px] text-center top-[calc(50%-165px)] tracking-[var(--static/display-medium/tracking,0px)] translate-y-[-50%]">
          <p className="leading-[var(--static/display-medium/line-height,52px)]">Code Watch</p>
        </div>

        {/* User Type Heading */}
        <div className="absolute flex flex-col font-['Open_Sans:SemiBold',_sans-serif] font-semibold inset-[25%_37.63%_69.5%_37.63%] justify-center leading-[0] text-[20px] text-black text-center text-nowrap">
          <p className="leading-[normal] whitespace-pre">User Type</p>
        </div>

        {/* Subtitle */}
        <div className="absolute flex flex-col font-['Open_Sans:Regular',_sans-serif] font-normal inset-[32%_19.33%_63.5%_19.33%] justify-center leading-[0] text-[#505050] text-[16px] text-center">
          <p className="leading-[20px]">Select a user type to continue</p>
        </div>

        {/* Role Options */}
        <button 
          className="absolute block cursor-pointer h-[53px] left-[30px] overflow-visible top-[223px] w-[328px]" 
          data-name="admin"
          onClick={() => handleRoleSelect('admin')}
        >
          <div className={`absolute border-2 border-solid inset-0 rounded-[8px] ${selectedRole === 'admin' ? 'border-[#3f4299]' : 'border-[#b5b5b5]'}`} />
          <div className={`absolute flex flex-col font-['Open_Sans:SemiBold',_sans-serif] font-semibold inset-[33.96%_40.55%_35.85%_40.55%] justify-center leading-[0] text-[16px] text-center ${selectedRole === 'admin' ? 'text-[#3f4299]' : 'text-[#b5b5b5]'}`}>
            <p className="leading-[16px]">Admin</p>
          </div>
        </button>

        <button 
          className="absolute block cursor-pointer h-[53px] left-[30px] overflow-visible top-[296px] w-[328px]" 
          data-name="ssd"
          onClick={() => handleRoleSelect('ssd')}
        >
          <div className={`absolute border border-solid inset-0 rounded-[8px] ${selectedRole === 'ssd' ? 'border-[#3f4299]' : 'border-[#b5b5b5]'}`} />
          <div className={`absolute flex flex-col font-['Open_Sans:SemiBold',_sans-serif] font-semibold inset-[33.96%_40.55%_35.85%_40.55%] justify-center leading-[0] text-[16px] text-center ${selectedRole === 'ssd' ? 'text-[#3f4299]' : 'text-[#b5b5b5]'}`}>
            <p className="leading-[16px]">SSD</p>
          </div>
        </button>

        <button 
          className="absolute block cursor-pointer h-[53px] left-[30px] overflow-visible top-[369px] w-[328px]" 
          data-name="department-head"
          onClick={() => handleRoleSelect('department-head')}
        >
          <div className={`absolute border border-solid inset-0 rounded-[8px] ${selectedRole === 'department-head' ? 'border-[#3f4299]' : 'border-[#b5b5b5]'}`} />
          <div className={`absolute flex flex-col font-['Open_Sans:SemiBold',_sans-serif] font-semibold inset-[33.96%_28.66%_35.85%_28.66%] justify-center leading-[0] text-[16px] text-center text-nowrap ${selectedRole === 'department-head' ? 'text-[#3f4299]' : 'text-[#b5b5b5]'}`}>
            <p className="leading-[16px] whitespace-pre">Department Head</p>
          </div>
        </button>

        {/* Continue Button */}
        <div className={`absolute inset-[82%_7.73%_8%_7.73%] rounded-[8px] ${selectedRole ? 'bg-[#3f4299]' : 'bg-[#b5b5b5]'}`} data-name="Button">
          <button 
            className={`absolute flex items-center justify-center font-['Open_Sans:Bold',_sans-serif] font-bold inset-0 text-[16px] text-center text-white w-full h-full ${!selectedRole ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            onClick={handleContinue}
            disabled={!selectedRole}
          >
            <span className="leading-[18px]">Continue</span>
          </button>
        </div>

        {/* New User Link */}
        <div className="absolute inset-[94%_20%_2%_20%] flex justify-center items-center">
          <TextButton 
            variant="primary" 
            size="small"
            className="text-center"
            onClick={() => {
              if (selectedRole) {
                navigate('/signup', { state: { userType: selectedRole } });
              } else {
                // If no role selected, show alert or handle differently
                alert('Please select a role first');
              }
            }}
          >
            New User
          </TextButton>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectionPage;

