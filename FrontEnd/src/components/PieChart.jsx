import React from 'react';

const PieChart = ({ data = [], title = 'Predestine Detection per Anum', className = '' }) => {
  const defaultData = [
    { label: 'Non-Violators', value: 5565, color: '#10B981' },
    { label: 'Unauthorized', value: 565, color: '#F59E0B' },
    { label: 'Visitors', value: 454, color: '#3B82F6' },
    { label: 'Violators', value: 154, color: '#EF4444' },
  ];

  const chartData = data.length > 0 ? data : defaultData;
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  // Calculate pie chart segments
  let currentAngle = -90; // Start from top
  const segments = chartData.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    return {
      ...item,
      percentage,
      startAngle,
      endAngle,
    };
  });

  // Convert polar to cartesian coordinates
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // Create SVG arc path
  const describeArc = (x, y, radius, startAngle, endAngle) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

    return [
      'M',
      start.x,
      start.y,
      'A',
      radius,
      radius,
      0,
      largeArcFlag,
      0,
      end.x,
      end.y,
      'L',
      x,
      y,
      'Z',
    ].join(' ');
  };

  const centerX = 160;
  const centerY = 160;
  const radius = 120;
  const innerRadius = 60;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {/* Title */}
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>

      <div className="flex flex-col items-center">
        {/* Pie Chart SVG */}
        <svg width="320" height="320" viewBox="0 0 320 320" className="mb-6">
          {/* Outer Ring */}
          {segments.map((segment, index) => (
            <g key={index}>
              <path
                d={describeArc(centerX, centerY, radius, segment.startAngle, segment.endAngle)}
                fill={segment.color}
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>
                  {segment.label}: {segment.value} ({segment.percentage.toFixed(1)}%)
                </title>
              </path>
            </g>
          ))}

          {/* Inner Circle (Donut hole) */}
          <circle cx={centerX} cy={centerY} r={innerRadius} fill="white" />

          {/* Center Text */}
          <text
            x={centerX}
            y={centerY - 10}
            textAnchor="middle"
            className="text-2xl font-bold fill-gray-900"
          >
            {total.toLocaleString()}
          </text>
          <text
            x={centerX}
            y={centerY + 15}
            textAnchor="middle"
            className="text-sm fill-gray-600"
          >
            Total
          </text>
        </svg>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                <p className="text-xs text-gray-600">
                  {item.value.toLocaleString()} (
                  {((item.value / total) * 100).toFixed(1)}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChart;
