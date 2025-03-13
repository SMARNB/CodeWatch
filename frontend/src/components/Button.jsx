import React from "react";

const Button = ({ children, variant = "primary", onClick }) => {
  const baseClass = "w-full py-2 rounded-md transition font-semibold text-center";

  const variants = {
    primary: "bg-indigo-500 text-white hover:text-green-400",
    outline: "border border-indigo-500 text-indigo-600 hover:bg-indigo-100 hover:border-blue-500",
    secondary: "border border-gray-300 text-gray-700 hover:bg-gray-200",
  };

  return (
    <button className={`${baseClass} ${variants[variant]} !important`} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
