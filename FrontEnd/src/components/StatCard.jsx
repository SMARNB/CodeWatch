import React from 'react';
import './CustomCSS/StatCard.css';

const StatCard = ({ title, value, percentageChange, miniChartData = [] }) => {
  // Determine if percentage change is positive or negative
  const isPositive = percentageChange && (percentageChange.startsWith('+') || !percentageChange.startsWith('-'));

  // Format value with commas
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  // Render mini chart if data is provided
  const renderMiniChart = () => {
    if (!miniChartData || miniChartData.length === 0) {
      return null;
    }

    const maxValue = Math.max(...miniChartData);
    const minValue = Math.min(...miniChartData);
    const range = maxValue - minValue || 1;
    const width = 151;
    const height = 83;
    const padding = 10;

    // Calculate points for the chart
    const points = miniChartData.map((point, index) => {
      const x = padding + (index / (miniChartData.length - 1 || 1)) * (width - padding * 2);
      const y = height - padding - ((point - minValue) / range) * (height - padding * 2);
      return `${x},${y}`;
    });

    // Create path for area chart
    const areaPath = `M ${points[0]?.split(',')[0] || padding},${height - padding} ${points.join(' L ')} L ${points[points.length - 1]?.split(',')[0] || width - padding},${height - padding} Z`;

    // Create path for line chart
    const linePath = `M ${points.join(' L ')}`;

    const chartId = `gradient-${title?.replace(/\s+/g, '-') || 'chart'}`;

    return (
      <div className="w-[151px] h-[83px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full block">
          <defs>
            <linearGradient id={chartId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3f4299" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3f4299" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Area fill */}
          <path
            d={areaPath}
            fill={`url(#${chartId})`}
            className="transition-opacity duration-200 ease-in-out"
          />
          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3f4299"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-colors duration-200 ease-in-out"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="relative w-full h-[148px] bg-white border border-neutral-300 rounded-lg p-6 box-border hover:shadow-md transition-shadow duration-200 ease-in-out">
      {/* Title */}
      <div className="absolute top-6 left-6 text-2xl font-semibold text-black leading-[24px] whitespace-nowrap" style={{ fontFamily: "'Poppins', sans-serif" }}>
        {title}
      </div>

      {/* Value */}
      <div className="absolute top-[52px] left-6 text-5xl font-bold leading-none whitespace-nowrap text-[#3f4299]">
        {formattedValue}
      </div>

      {/* Percentage Change */}
      {percentageChange && (
        <div className="absolute bottom-[30px] left-6 flex items-center gap-1.5 h-3">
          {/* Arrow Icon */}
          <svg
            width="11"
            height="6"
            viewBox="0 0 11 6"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <path
              d={isPositive ? "M5.5 0L11 6H0L5.5 0Z" : "M5.5 6L0 0H11L5.5 6Z"}
              fill={isPositive ? "#419958" : "#ef4444"}
            />
          </svg>
          
          {/* Percentage Text */}
          <span className={`text-base font-semibold leading-4 ${isPositive ? 'text-[#419958]' : 'text-red-500'}`}>
            {percentageChange}
          </span>
          
          {/* "than last month" text */}
          <span className="text-base font-normal text-[#7b7b7b] leading-4"> than last month</span>
        </div>
      )}

      {/* Mini Chart */}
      {miniChartData && miniChartData.length > 0 && (
        <div className="absolute top-[41px] right-6">
          {renderMiniChart()}
        </div>
      )}
    </div>
  );
};

export default StatCard;

