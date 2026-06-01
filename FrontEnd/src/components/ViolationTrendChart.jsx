import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import './CustomCSS/ViolationTrendChart.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const ViolationTrendChart = ({ trendData, isLoading = false }) => {
  // Default chart data structure
  const defaultTrendData = {
    violationCount: 5000.00,
    subViolations: 50,
    period: 'This Week',
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'],
    datasets: [
      {
        label: 'Dataset 1',
        data: [20, 30, -10, 40, -20, 50],
        borderColor: '#7987FF',
        backgroundColor: 'rgba(121, 135, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4, 
        pointHoverRadius: 6,
      },
      {
        label: 'Dataset 2',
        data: [-15, 25, 35, -5, 30, 45],
        borderColor: '#E697FF',
        backgroundColor: 'rgba(230, 151, 255, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
      {
        label: 'Dataset 3',
        data: [10, -20, 20, 30, 10, -10],
        borderColor: '#FFA5CB',
        backgroundColor: 'rgba(255, 165, 203, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  // Use provided trendData or default
  const data = trendData || defaultTrendData;

  // Format violation count with European formatting
  const formatViolationCount = (count) => {
    return typeof count === 'number' ? count.toLocaleString() : count;
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Use custom legend below the chart
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 12,
          weight: '600',
        },
        bodyFont: {
          size: 11,
        },
        displayColors: true,
      },
    },
    scales: {
      x: {
        // --- X-Axis Configuration (Native) ---
        grid: {
          display: false, // Hide vertical grid lines
        },
        ticks: {
          display: true, // Show X-axis labels (Jan, Feb, etc.)
          color: '#000000',
          font: {
            size: 10,
            family: "'Inter', sans-serif",
          },
        },
        border: {
          display: false,
        },
      },
      y: {
        // --- Y-Axis Configuration (Native) ---
        beginAtZero: true,
        grid: {
          // Show horizontal grid lines to align with the data points
          display: true, 
          color: 'rgba(0, 0, 0, 0.1)', // Subtle grey color for grid lines
        },
        ticks: {
          display: true, // Show Y-axis labels (60, 40, 20, 0, -20, etc.)
          color: '#000000',
          font: {
            size: 12,
            family: "'Inter', sans-serif",
          },
          callback: function (value) {
            return value;
          },
        },
        border: {
          display: true, // Show the vertical line for the Y-axis
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    elements: {
      line: {
        borderWidth: 2,
      },
    },
  };

  // Chart data structure
  const chartData = {
    labels: data.labels || defaultTrendData.labels,
    datasets: data.datasets || defaultTrendData.datasets,
  };

  // Loading state placeholder
  if (isLoading) {
    return (
      <div className="relative w-full bg-white border border-neutral-300 rounded-lg p-6 box-border">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#165baa] rounded-full animate-spin"></div>
          <p className="text-sm font-normal text-gray-500">Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    // Applied custom padding-left: pl-10 (10px)
    <div className="relative w-full bg-white border border-neutral-300 rounded-lg p-6 pl-10 box-border hover:shadow-md transition-shadow duration-200 ease-in-out">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-4">
        <div className="w-24">
          <p className="text-base font-medium text-black leading-normal whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Violations
          </p>
        </div>
        <div className="flex items-center justify-end gap-2.5">
          <div className="h-[18px] w-[61px] flex items-center justify-end">
            <p className="text-xs font-medium text-black text-right whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {data.period || 'This Week'}
            </p>
          </div>
          {/* Dropdown Icon */}
          <div className="bg-white relative w-6 h-6 flex items-center justify-center">
            <svg width="8" height="4" viewBox="0 0 8 4" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0L4 4L8 0H0Z" fill="#000000" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Value */}
      <div className="flex items-center gap-2.5 h-12 mb-2.5">
        <p className="text-[32px] font-normal text-[#165baa] leading-normal tracking-[-1.2px] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {formatViolationCount(data.violationCount || 0)}
        </p>
        <span className="text-base font-normal text-black leading-normal whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Violations
        </span>
      </div>

      {/* Sub Content Removed */}

      {/* Chart Container */}
      {/* Increased height from min-h-[200px] to min-h-[220px] (20px increase) */}
      <div className="flex flex-col gap-2.5">
        <div className="h-[220px]">
          <div className="w-full h-full">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 pt-6">
          <div className="flex flex-wrap gap-x-4 gap-y-2 items-center pb-2 pr-2.5">
            {data.datasets?.map((dataset, index) => {
              const colors = ['#7987FF', '#E697FF', '#FFA5CB'];
              const color = dataset.borderColor || colors[index] || '#7987FF';
              
              return (
                <div key={index} className="bg-white flex items-center px-0 py-px">
                  <div className="bg-white relative w-4 h-4 flex items-center justify-center shrink-0">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <p className="text-xs font-medium text-black whitespace-nowrap leading-normal" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {dataset.label || `Content ${index + 1}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViolationTrendChart;