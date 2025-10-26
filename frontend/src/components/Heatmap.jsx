import React from 'react';

const Heatmap = ({ data = [], title = 'Live Violations', showLegend = true, className = '' }) => {
  // Generate default data for demonstration (53 weeks x 7 days)
  const generateDefaultData = () => {
    const weeks = 53;
    const daysPerWeek = 7;
    const defaultData = [];
    
    for (let week = 0; week < weeks; week++) {
      for (let day = 0; day < daysPerWeek; day++) {
        defaultData.push({
          week,
          day,
          value: Math.floor(Math.random() * 6), // 0-5 intensity
          date: new Date(2025, 0, week * 7 + day + 1).toISOString().split('T')[0],
        });
      }
    }
    return defaultData;
  };

  const heatmapData = data.length > 0 ? data : generateDefaultData();

  // Get color based on intensity (0-5)
  const getColor = (value) => {
    const colors = [
      'bg-gray-100', // 0 - no activity
      'bg-green-200', // 1 - very low
      'bg-green-400', // 2 - low
      'bg-green-600', // 3 - medium
      'bg-green-700', // 4 - high
      'bg-green-900', // 5 - very high
    ];
    return colors[Math.min(value, 5)];
  };

  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>

      {/* Heatmap Container */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hours Header */}
          <div className="flex mb-2">
            <div className="w-4"></div>
            <div className="flex-1 flex justify-between px-10">
              {hours.map((hour, index) => (
                <span key={index} className="text-xs text-gray-600 font-medium">
                  {hour}
                </span>
              ))}
            </div>
          </div>

          {/* Days and Heatmap Grid */}
          <div className="flex">
            {/* Day Labels */}
            <div className="flex flex-col justify-between pr-2">
              {days.map((day, index) => (
                <span key={index} className="text-xs text-gray-600 font-medium h-4 flex items-center">
                  {day}
                </span>
              ))}
            </div>

            {/* Heatmap Grid */}
            <div className="flex-1">
              <div className="grid grid-cols-53 gap-1">
                {heatmapData.map((cell, index) => (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-sm ${getColor(cell.value)} hover:ring-2 hover:ring-blue-500 hover:ring-offset-1 transition-all cursor-pointer`}
                    title={`${cell.date}: ${cell.value} violations`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer with Legend */}
          {showLegend && (
            <div className="mt-6 flex items-center justify-between">
              <span className="text-sm text-gray-700 font-medium">{title}</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">Less</span>
                <div className="flex space-x-1">
                  {[0, 1, 2, 3, 4].map((level) => (
                    <div
                      key={level}
                      className={`w-5 h-5 rounded-sm ${getColor(level)}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-600">More</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Violation Types Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <p className="text-sm text-gray-700">
          <span className="font-medium">Types of Violations: </span>
          <span className="inline-flex items-center ml-2">
            <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
            Dress Code Violations
          </span>
          <span className="inline-flex items-center ml-4">
            <span className="w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
            Unauthorized Predestine
          </span>
          <span className="inline-flex items-center ml-4">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
            Visitors
          </span>
          <span className="inline-flex items-center ml-4">
            <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
            Non-Violators
          </span>
        </p>
      </div>
    </div>
  );
};

export default Heatmap;
