import React from "react";
import './CustomCSS/Card.css';
const Card = ({ children }) => {
  return (
    <div className="bg-white shadow-lg rounded-lg p-8 w-96 text-center">
      {children}
    </div>
  );
};
const CardContent = ({ children, className }) => {
  return <div className={`p-4 ${className}`}>{children}</div>;
};

export default Card;
