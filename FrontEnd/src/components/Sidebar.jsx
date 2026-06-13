import React from "react";
import { FaTimes } from "react-icons/fa"; // Close icon
import './CustomCSS/Sidebar.css';
const Sidebar = ({ isOpen, profilePic, onClose }) => {
    return (
      <div className={`sidebar-container ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <FaTimes className="close-icon" onClick={onClose} />
          <img src={profilePic} alt="User Profile" className="profile-pic" />
        </div>
        <ul className="sidebar-menu">
          <li className="sidebar-item">Profile</li>
          <li className="sidebar-item">Settings</li>
          <li className="sidebar-item">Help</li>
          <li className="sidebar-item logout">Log Out</li>
        </ul>
      </div>
    );
  };
  

export default Sidebar;
