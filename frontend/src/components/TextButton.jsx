import React from "react";
import { useNavigate } from "react-router-dom";

const TextButton = ({ to, onClick, children, textColor = "", htextColor = "",className = "" }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) onClick();
    if (to) navigate(to);
  };

  return (
    <button
      onClick={handleClick}
      className={`${textColor} hover:${htextColor} text-xl font-extrabold underline ${className}`}
      style={{ background: "none", border: "none", padding: 0, margin: 0, outline: "none", cursor: "pointer" }}
    >
      {children}
    </button>
  );
};

export default TextButton;
