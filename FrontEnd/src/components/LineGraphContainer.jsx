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
import './CustomCSS/LineGraphContainer.css';

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

const LineGraphContainer = ({ chartData, isLoading = false }) => {
  // Default chart data structure (omitted for brevity)
  const defaultChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Violation Occurrence',
        data: [45, 52, 38, 65, 55, 72, 48],
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3B82F6',
        pointBorderWidth: 3,
        pointHoverRadius: 7,
        pointHoverBackgroundColor: '#ffffff',
        pointHoverBorderColor: '#3B82F6',
        pointHoverBorderWidth: 3,
      },
    ],
  };

  // Use provided chartData or default
  const data = chartData || defaultChartData;

  // Chart options (omitted for brevity)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 0, 
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: '600',
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function (context) {
            return `${context.dataset.label}: ${context.parsed.y}`;
          },
        },
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: '#E5E7EB',
          drawBorder: true,
          borderColor: '#E5E7EB',
          borderWidth: 2,
        },
        ticks: {
          color: '#000000',
          font: {
            size: 14,
            family: "'Open Sans', sans-serif",
          },
          padding: 8,
        },
        border: {
          display: true,
          color: '#E5E7EB',
          width: 2,
        },
      },
      y: {
        beginAtZero: true,
        position: 'left',
        grid: {
          display: true,
          color: '#E5E7EB',
          drawBorder: true,
          borderColor: '#E5E7EB',
          borderWidth: 2,
        },
        ticks: {
          color: '#000000',
          font: {
            size: 14,
            family: "'Open Sans', sans-serif",
          },
          padding: 8,
          callback: function (value) {
            return value;
          },
        },
        border: {
          display: true,
          color: '#E5E7EB',
          width: 2,
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
    elements: {
      point: {
        hoverRadius: 7,
        hoverBorderWidth: 3,
      },
      line: {
        borderWidth: 3,
        tension: 0.4,
      },
    },
  };

  // Loading state placeholder (omitted for brevity)
  if (isLoading) {
    return (
      <div className="relative w-full bg-white border border-neutral-300 rounded-lg p-6 box-border h-full">
        <div className="absolute top-6 left-6 text-lg font-semibold text-black leading-[18px] whitespace-nowrap">
          Violation Occurrence
        </div>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 mt-12">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#3f4299] rounded-full animate-spin"></div>
          <p className="text-sm font-normal text-gray-500">Loading chart data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white border border-neutral-300 rounded-lg p-6 box-border hover:shadow-md transition-shadow duration-200 ease-in-out h-full flex flex-col">
      
      {/* Title - FIXED: Now positioned at top-left, sequential, and with margin-bottom */}
      <div 
        className="text-lg font-semibold text-black leading-[18px] whitespace-nowrap"
        style={{ paddingTop: '10px', paddingLeft: '10px', marginBottom: '10px' }}
      >
        Violation Occurrence
      </div>

      {/* Chart Container - FIXED FOR FLUID HEIGHT */}
      <div className="relative w-full h-full flex-grow">
        <div className="w-full h-full px-2">
          <Line data={data} options={chartOptions} />
        </div>
      </div>
    </div>
  );
};

export default LineGraphContainer;