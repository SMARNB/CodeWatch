import React, { useRef, useEffect } from "react";
import Chart from "chart.js/auto";

const PieChart = () => {
  const chartRef = useRef(null);
  let chartInstance = useRef(null);

  useEffect(() => {
    const ctx = chartRef.current.getContext("2d");

    if (chartInstance.current) {
      chartInstance.current.destroy(); // Destroy the old chart instance
    }

    chartInstance.current = new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Red", "Blue", "Yellow"],
        datasets: [
          {
            label: "Votes",
            data: [12, 19, 3],
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
          },
        ],
      },
    });

    return () => {
      chartInstance.current.destroy(); // Cleanup
    };
  }, []);

  return <canvas ref={chartRef}></canvas>;
};

export default PieChart;
