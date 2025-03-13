import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { FaUser } from "react-icons/fa";
import Logo from "./Logo";
import "./CustomCSS/Navbar.css";

const Navbar = ({ toggleSidebar }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <div className="logo-container" onClick={() => setMenuOpen(!menuOpen)}>
        <Logo className="logo" />
        <h1 className="title">Code Watch</h1>
      </div>

      <div className={`nav-links ${menuOpen ? "open" : ""}`}>
        {["Dashboard", "Add User", "Generate Analytics", "Send Report", "Previous Reports"].map((item, index) => (
          <NavLink key={index} to={`/${item.toLowerCase().replace(/\s+/g, "-")}`} className="nav-item">
            {item}
          </NavLink>
        ))}
        <div className="username-container cursor-pointer" onClick={toggleSidebar}>
        <FaUser className="user-icon" />
        </div>
      </div>

      {/* User Profile Icon (Always Visible) */}
      
    </nav>
  );
};

export default Navbar;
