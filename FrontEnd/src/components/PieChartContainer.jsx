import React from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import './CustomCSS/PieChartContainer.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const PieChartContainer = ({ chartData, isLoading = false }) => {
  // Default chart data structure
  const defaultChartData = {
    labels: ['Non-Violators', 'Unauthorized', 'Victors', 'Violators'],
    datasets: [
      {
        label: 'Detection per Anum',
        data: [5565, 565, 454, 154],
        backgroundColor: [
          '#10B981', // Green for Non-Violators
          '#F59E0B', // Orange for Unauthorized
          '#3B82F6', // Blue for Victors
          '#EF4444', // Red for Violators
        ],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  // Use provided chartData or default
  const data = chartData || defaultChartData;

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We'll use custom legend
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 20,
        titleFont: {
          size: 14,
          weight: '600',
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
    cutout: '60%', // Makes it a donut chart
  };

  // Loading state placeholder
  if (isLoading) {
    return (
      <div className="relative w-full bg-white border border-neutral-300 rounded-lg p-6 box-border">
        <div className="absolute top-6 left-6 text-lg font-semibold text-black leading-[18px] whitespace-nowrap">
          Predestine Detection per Anum
        </div>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 mt-12">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#3f4299] rounded-full animate-spin"></div>
          <p className="text-sm font-normal text-gray-500">Loading chart data...</p>
        </div>
      </div>
    );
  }

  // Calculate total for display
  const total = data.datasets[0].data.reduce((sum, value) => sum + value, 0);

  return (
    <div className="relative w-full bg-white border border-neutral-300 rounded-lg p-6 box-border hover:shadow-md transition-shadow duration-200 ease-in-out h-[400px]">
      {/* Title */}
      <div className="absolute top-6 left-6 text-lg font-semibold text-black leading-[18px] whitespace-nowrap">
        Predestine Detection per Anum
      </div>

      {/* Chart Container */}
      <div className="relative  flex justify-center items-center mt-12 mb-6 h-[350px]">
        <div className="relative flex justify-center items-center">
          <div className="w-full h-full">
            
            <Pie data={data} options={chartOptions} style={{height: '250px', width:'500px'}}/>
          </div>
          
          {/* Center Total Display (for donut chart) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-800 leading-tight mb-1">
                {total.toLocaleString()}
              </div>
              <div className="text-sm font-normal text-gray-500 leading-tight">
                Total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Legend - Split into two columns matching Figma design */}
      <div className="w-full flex justify-center items-start">
        {/* The main wrapper is now a single, horizontal Flex container */}
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 w-full max-w-full"> 
          
          {/* Combine all labels into one map loop */}
          {data.labels.map((label, index) => {
            const backgroundColor = data.datasets[0].backgroundColor[index];
            return (
              <div key={index} className="flex items-center gap-1.5 flex-shrink-0">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor }}
                />
                {/* Ensure text does not wrap */}
                <span className="text-sm font-normal text-black leading-[14px] whitespace-nowrap">
                  {label}
                </span>
              </div>
            );
          })}

          {/* The old Left Column and Right Column divs are completely removed. */}
        </div>
      </div>
    </div>
  );
};

export default PieChartContainer;

