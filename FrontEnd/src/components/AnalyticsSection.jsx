import React from "react";
import  Card  from "./Card";

const AnalyticsSection = ({ title, value }) => {
  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
};

export default AnalyticsSection;
