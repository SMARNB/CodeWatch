import React from 'react';

const StatsCard = ({
  title,
  value,
  change,
  changeType = 'increase', // 'increase' or 'decrease'
  icon,
  chartData = [],
  className = '',
}) => {
  const isPositive = changeType === 'increase';

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${className}`}>
      <div className="flex items-start justify-between">
        {/* Left Content */}
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-600 mb-2">{title}</h3>
          <p className="text-4xl font-bold text-gray-900 mb-3">{value}</p>
          
          {/* Change Indicator */}
          {change && (
            <div className="flex items-center space-x-1">
              <svg
                className={`w-3 h-3 ${isPositive ? 'text-green-500' : 'text-red-500'} ${isPositive ? '' : 'rotate-180'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {change}
              </span>
              <span className="text-xs text-gray-500">than last month</span>
            </div>
          )}
        </div>

        {/* Right Content - Mini Chart or Icon */}
        <div className="ml-4">
          {chartData.length > 0 ? (
            <div className="w-36 h-20">
              <svg viewBox="0 0 150 80" className="w-full h-full">
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Area */}
                <path
                  d={`M 0 80 ${chartData.map((point, i) => `L ${(i / (chartData.length - 1)) * 150} ${80 - (point / Math.max(...chartData)) * 60}`).join(' ')} L 150 80 Z`}
                  fill={`url(#gradient-${title})`}
                />
                
                {/* Line */}
                <path
                  d={`M ${chartData.map((point, i) => `${(i / (chartData.length - 1)) * 150} ${80 - (point / Math.max(...chartData)) * 60}`).join(' L ')}`}
                  fill="none"
                  stroke="#3B82F6"
                  strokeWidth="2"
                />
              </svg>
            </div>
          ) : icon ? (
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              {icon}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
