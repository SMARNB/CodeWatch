import React from 'react';
import './CustomCSS/ViolationTimeline.css';

const ViolationTimeline = ({ timelineData = [] }) => {
  // Default data structure: array of objects with week, day, hour, and intensity
  // intensity: 0 = none, 1 = light, 2 = medium, 3 = high
  const generateDefaultData = () => {
    const defaultData = [];
    const weeks = 53;
    const daysPerWeek = 7;
    const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
    
    for (let week = 0; week < weeks; week++) {
      for (let day = 0; day < daysPerWeek; day++) {
        // Random intensity for demo (mostly 0-1, occasional 2-3)
        const intensity = Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0;
        defaultData.push({
          week,
          day,
          hour: hours[Math.floor(Math.random() * hours.length)],
          intensity,
          date: new Date(2025, 0, week * 7 + day + 1).toISOString().split('T')[0],
        });
      }
    }
    return defaultData;
  };

  const data = timelineData.length > 0 ? timelineData : generateDefaultData();

  // Get color based on intensity
  const getBlockStyle = (intensity) => {
    switch (intensity) {
      case 0:
        return {
          backgroundColor: 'transparent',
          border: '1px solid rgba(63, 66, 153, 0.04)',
        };
      case 1:
        return {
          backgroundColor: 'rgba(63, 66, 153, 0.04)',
          border: 'none',
        };
      case 2:
        return {
          backgroundColor: 'rgba(63, 66, 153, 0.32)',
          border: 'none',
        };
      case 3:
        return {
          backgroundColor: '#3f4299',
          border: 'none',
        };
      default:
        return {
          backgroundColor: 'transparent',
          border: '1px solid rgba(63, 66, 153, 0.04)',
        };
    }
  };

  // Organize data by week and day
  // Expected data structure: [{ week: 0-52, day: 0-6, intensity: 0-3 }, ...]
  const organizeDataByWeek = () => {
    const organized = {};
    data.forEach((item) => {
      const week = item.week !== undefined ? item.week : Math.floor((item.day || 0) / 7);
      const day = item.day !== undefined ? item.day % 7 : 0;
      
      if (!organized[week]) {
        organized[week] = {};
      }
      if (!organized[week][day]) {
        organized[week][day] = item;
      } else {
        // If multiple entries for same week/day, use the highest intensity
        if ((item.intensity || 0) > (organized[week][day].intensity || 0)) {
          organized[week][day] = item;
        }
      }
    });
    return organized;
  };

  const organizedData = organizeDataByWeek();
  const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weeks = 53;

  return (
    <div className="relative w-full bg-white border border-neutral-300 rounded-lg p-6 box-border hover:shadow-md transition-shadow duration-200 ease-in-out overflow-x-auto overflow-y-hidden" style={{ minHeight: '350px' }}>
      {/* Hours Header */}
      <div className="absolute top-[77px] left-[42px] flex gap-0.5">
        {hours.map((hour, index) => (
          <div
            key={index}
            className="text-[13px] font-normal text-[rgba(89,115,147,0.5)] leading-[20px] w-[70px]"
            style={{ fontFamily: "'Open Sans', sans-serif" }}
          >
            {hour}
          </div>
        ))}
      </div>

      {/* Day Labels and Heatmap Grid */}
      <div className="absolute top-[107px] left-[24px] flex gap-0.5">
        {/* Day Labels - Show M and F as per design */}
        <div className="flex flex-col gap-0.5 h-[124px] justify-start">
          <div
            className="text-[13px] font-normal text-[rgba(89,115,147,0.5)] leading-[16px] text-center w-[16px] h-[70px] flex items-start justify-center"
            style={{ fontFamily: "'Open Sans', sans-serif" }}
          >
            M
          </div>
          <div
            className="text-[13px] font-normal text-[rgba(89,115,147,0.5)] leading-[16px] text-center w-[16px] h-[16px] flex items-center justify-center"
            style={{ fontFamily: "'Open Sans', sans-serif" }}
          >
            F
          </div>
        </div>

        {/* Heatmap Grid - Weeks as columns, 7 Days as rows per week */}
        <div className="flex gap-0.5 ml-4 min-w-max">
          {Array.from({ length: weeks }, (_, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-0.5">
              {Array.from({ length: 7 }, (_, dayIndex) => {
                const cellData = organizedData[weekIndex]?.[dayIndex] || { intensity: 0 };
                const blockStyle = getBlockStyle(cellData.intensity);
                // Check if this is the first day of a new month (approximately every 4 weeks)
                const isFirstDayOfMonth = dayIndex === 0 && weekIndex > 0 && (weekIndex % 4 === 0 || weekIndex === 1);
                
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    className="w-4 h-4 rounded-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      ...blockStyle,
                      borderRadius: '2px',
                      ...(isFirstDayOfMonth && dayIndex === 0 && {
                        borderTop: '2px solid #e0e4e8',
                      }),
                    }}
                    title={
                      cellData.intensity > 0
                        ? `Week ${weekIndex + 1}, ${dayLabels[dayIndex]}: Intensity ${cellData.intensity}`
                        : `Week ${weekIndex + 1}, ${dayLabels[dayIndex]}: No violations`
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Footer - Live Violations */}
      <div className="absolute top-[241px] left-[42px]">
        <p
          className="text-[17px] font-semibold text-[#3f4299] leading-[30px] whitespace-nowrap"
          style={{ fontFamily: "'Open Sans', sans-serif" }}
        >
          Live Violations
        </p>
      </div>

      {/* Violation Types Legend */}
      <div className="absolute top-[266px] left-[42px]">
        <p
          className="text-[17px] font-semibold text-black leading-[30px] whitespace-pre-wrap"
          style={{ fontFamily: "'Open Sans', sans-serif" }}
        >
          Types of Violations:
          <br />
          {'     '}
          <span className="inline-flex items-center">
            <span className="w-2 h-2 bg-[#3f4299] rounded-full mr-1"></span>
            Dress Code Violations
          </span>
          {'     '}
          <span className="inline-flex items-center">
            <span className="w-2 h-2 bg-[#3f4299] rounded-full mr-1"></span>
            Unauthorized predestine
          </span>
          {' '}
          Visitors
          {'     '}
          Non violators
        </p>
      </div>
    </div>
  );
};

export default ViolationTimeline;

