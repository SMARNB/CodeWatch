import React from "react";

const Text = ({ children, variant = "normal" }) => {
  const styles = {
    normal: "text-gray-500 text-sm",
    bold: "text-gray-900 text-lg font-semibold",
  };

  return <p className={styles[variant]}>{children}</p>;
};

export default Text;
