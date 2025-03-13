import React from "react";
import  Card  from "./Card";

const Heatmap = () => {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">Heatmap Data</h2>
      <div className="h-20 bg-gray-300 rounded-lg"></div>
    </Card>
  );
};

export default Heatmap;
