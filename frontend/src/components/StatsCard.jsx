import React from "react";
import Card from "./Card";
import "./CustomCSS/StatsCard.css";

const StatsCard = ({ title, value, percentage, increase }) => {
  return (
    <Card className="stats-card">
      <h2 className="stats-title">{title}</h2>
      <p className="stats-value">{value}</p>
      <p className={`stats-percentage ${increase ? "stats-increase" : "stats-decrease"}`}>
        {percentage} than last month
      </p>
    </Card>
  );
};

export default StatsCard;
