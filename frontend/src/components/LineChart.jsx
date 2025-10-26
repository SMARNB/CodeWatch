import React from 'react';

const LineChart = ({ data = [], title = 'Violation Occurrence', className = '' }) => {
  const defaultData = [
    { month: 'Jan', value: 45 },
    { month: 'Feb', value: 52 },
    { month: 'Mar', value: 38 },
    { month: 'Apr', value: 65 },
    { month: 'May', value: 55 },
    { month: 'Jun', value: 72 },
    { month: 'Jul', value: 48 },
  ];

  const chartData = data.length > 0 ? data : defaultData;
  const maxValue = Math.max(...chartData.map((d) => d.value));
  const minValue = Math.min(...chartData.map((d) => d.value));
  const range = maxValue - minValue;

  // Chart dimensions
  const width = 985;
  const height = 381;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate points for the line
  const points = chartData.map((item, index) => {
    const x = padding.left + (index / (chartData.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((item.value - minValue) / range) * chartHeight;
    return { x, y, value: item.value };
  });

  // Create path for line
  const linePath = points.map((point, index) => {
    return `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
  }).join(' ');

  // Create path for area
  const areaPath = `
    M ${padding.left} ${padding.top + chartHeight}
    ${points.map((point) => `L ${point.x} ${point.y}`).join(' ')}
    L ${padding.left + chartWidth} ${padding.top + chartHeight}
    Z
  `;

  // Y-axis labels
  const yAxisLabels = [0, 60, 120, 180];

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>

      {/* Chart Container */}
      <div className="relative">
        <svg width="100%" height="400" viewBox={`0 0 ${width} ${height + 50}`} className="overflow-visible">
          <defs>
            {/* Gradient for area fill */}
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.05" />
            </linearGradient>

            {/* Shadow filter */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="2" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.2" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          {yAxisLabels.map((label, index) => {
            const y = padding.top + chartHeight - (index / (yAxisLabels.length - 1)) * chartHeight;
            return (
              <g key={index}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                />
              </g>
            );
          })}

          {/* Vertical grid lines */}
          {chartData.map((_, index) => {
            const x = padding.left + (index / (chartData.length - 1)) * chartWidth;
            return (
              <line
                key={index}
                x1={x}
                y1={padding.top}
                x2={x}
                y2={padding.top + chartHeight}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#areaGradient)" />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#shadow)"
          />

          {/* Data points */}
          {points.map((point, index) => (
            <g key={index}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="white"
                stroke="#3B82F6"
                strokeWidth="3"
                className="hover:r-7 transition-all cursor-pointer"
              >
                <title>{chartData[index].month}: {point.value}</title>
              </circle>
            </g>
          ))}

          {/* Y-axis labels */}
          {yAxisLabels.map((label, index) => {
            const y = padding.top + chartHeight - (index / (yAxisLabels.length - 1)) * chartHeight;
            return (
              <text
                key={index}
                x={padding.left - 10}
                y={y + 5}
                textAnchor="end"
                className="text-sm fill-gray-600"
              >
                {label}
              </text>
            );
          })}

          {/* X-axis labels */}
          {chartData.map((item, index) => {
            const x = padding.left + (index / (chartData.length - 1)) * chartWidth;
            return (
              <text
                key={index}
                x={x}
                y={padding.top + chartHeight + 25}
                textAnchor="middle"
                className="text-sm fill-gray-600"
              >
                {item.month}
              </text>
            );
          })}

          {/* Chart border */}
          <rect
            x={padding.left}
            y={padding.top}
            width={chartWidth}
            height={chartHeight}
            fill="none"
            stroke="#E5E7EB"
            strokeWidth="2"
          />
        </svg>
      </div>
    </div>
  );
};

export default LineChart;
