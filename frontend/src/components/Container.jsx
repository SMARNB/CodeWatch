import React from "react";

const Container = ({ children }) => {
  return (
    <div className="h-screen w-screen bg-[#f6f6ff] flex justify-center items-center">
      {children}
    </div>
  );
};

export default Container;
