import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const Navbar = ({ links = [] }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState('Dashboard');

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLinkClick = (linkName) => {
    setActiveLink(linkName);
    setIsMobileMenuOpen(false);
  };

  // Default navigation links if none provided
  const defaultLinks = [
    { name: 'Dashboard', path: '/dashboard', active: true },
    { name: 'Add User', path: '/add-user' },
    { name: 'Generate Analytics', path: '/analytics' },
    { name: 'Send Report', path: '/send-report' },
    { name: 'Previous Reports', path: '/reports' },
    { name: 'Log out', path: '/logout' }
  ];

  const navigationLinks = links.length > 0 ? links : defaultLinks;

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-[0px_0px_6px_4px_rgba(151,151,151,0.12)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo Section */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xl font-bold">G</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-8">
            {navigationLinks.map((link, index) => (
              <NavLink
                key={index}
                to={link.path}
                onClick={() => handleLinkClick(link.name)}
                className={`relative px-3 py-2 text-sm font-medium transition-colors duration-200 ${
                  activeLink === link.name || link.active
                    ? 'text-[#3f4299]'
                    : 'text-gray-700 hover:text-[#3f4299]'
                }`}
              >
                {link.name}
                {/* Active indicator */}
                {activeLink === link.name && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#3f4299] rounded-t"></div>
                )}
              </NavLink>
            ))}
          </div>

          {/* Right Section - Notifications & User Profile */}
          <div className="flex items-center space-x-4">
            {/* Notification Bell */}
            <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 00-15 0v5h5l-5 5-5-5h5v-5a7.5 7.5 0 0115 0v5z" />
              </svg>
              {/* Notification Badge */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700">username</span>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#3f4299]"
              aria-label="Toggle mobile menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
              {navigationLinks.map((link, index) => (
                <NavLink
                  key={index}
                  to={link.path}
                  onClick={() => handleLinkClick(link.name)}
                  className={`block px-3 py-2 text-base font-medium rounded-md transition-colors duration-200 ${
                    activeLink === link.name || link.active
                      ? 'text-[#3f4299] bg-blue-50'
                      : 'text-gray-700 hover:text-[#3f4299] hover:bg-gray-50'
                  }`}
                >
                  {link.name}
                </NavLink>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;