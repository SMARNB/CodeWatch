import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const GuardLayout = () => {
  return (
    <div className="min-h-screen bg-[#eef0fb]">
      <Navbar />
      <Outlet />
    </div>
  );
};

export default GuardLayout;
