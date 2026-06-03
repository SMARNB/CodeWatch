import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

function AppLayout() {
  return (
    <div className="min-h-screen bg-[#f2f3ff]">
      <Navbar />
      <Outlet />
    </div>
  );
}

export default AppLayout;
