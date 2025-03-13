import React from "react";
import { Line } from "react-chartjs-2";
import  Card  from "./Card";

const LineChart = () => {
  const lineData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        label: "Data",
        data: [80, 120, 100, 90, 110, 130],
        fill: true,
        borderColor: "#6C63FF",
        backgroundColor: "rgba(108,99,255,0.2)",
      },
    ],
  };

  return (
    <Card className="p-2">
      <h2 className="text-md font-semibold">Chart Title Here</h2>
      <Line data={lineData} />
    </Card>
  );
};

export default LineChart;
