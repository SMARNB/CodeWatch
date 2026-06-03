import React from 'react';
import './CustomCSS/ViolationTimeline.css';

const ViolationTimeline = ({ timelineData = [] }) => {
  const data = timelineData || [];

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
    <div className="relative w-full h-full bg-white border border-neutral-300 rounded-lg p-8 box-border hover:shadow-md transition-shadow duration-200 ease-in-out overflow-x-auto overflow-y-hidden flex flex-col justify-between" style={{ minHeight: '350px', paddingLeft: '42px', paddingRight: '42px' }}>

      {/* Header */}
      <div className="flex items-center justify-center pb-2 mb-4" style={{ marginTop: '20px' }}>
        <p className="text-2xl font-bold text-black leading-normal whitespace-nowrap text-center" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Violation Activity (Past Year)
        </p>
      </div>

      {/* Heatmap Area */}
      <div className="flex flex-col items-center w-full flex-grow pb-4" style={{ marginTop: '20px' }}>
        {/* Hours Header */}
        <div className="flex gap-0.5 mb-2 w-full max-w-fit" style={{ paddingLeft: '28px' }}>
          {hours.map((hour, index) => (
            <div
              key={index}
              className="text-[14px] font-medium text-[rgba(89,115,147,0.8)] leading-[20px] w-[70px]"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              {hour}
            </div>
          ))}
        </div>

        {/* Day Labels and Heatmap Grid */}
        <div className="flex gap-0.5 w-full max-w-fit">
          {/* Day Labels - Show M and F as per design */}
          <div className="flex flex-col gap-0.5 h-[138px] justify-start">
            <div
              className="text-[14px] font-medium text-[rgba(89,115,147,0.8)] leading-[16px] text-center w-[16px] h-[80px] flex items-start justify-center"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              M
            </div>
            <div
              className="text-[14px] font-medium text-[rgba(89,115,147,0.8)] leading-[16px] text-center w-[16px] h-[18px] flex items-center justify-center"
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
                      className="w-[18px] h-[18px] rounded-sm flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
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
      </div>

      {/* Footer - Intensity Legend */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-base font-medium text-[rgba(89,115,147,0.9)]" style={{ fontFamily: "'Open Sans', sans-serif" }}>Fewer</span>
        <span className="w-[18px] h-[18px] rounded-sm" style={{ backgroundColor: 'transparent', border: '1px solid rgba(63, 66, 153, 0.15)' }}></span>
        <span className="w-[18px] h-[18px] rounded-sm" style={{ backgroundColor: 'rgba(63, 66, 153, 0.04)' }}></span>
        <span className="w-[18px] h-[18px] rounded-sm" style={{ backgroundColor: 'rgba(63, 66, 153, 0.32)' }}></span>
        <span className="w-[18px] h-[18px] rounded-sm" style={{ backgroundColor: '#3f4299' }}></span>
        <span className="text-base font-medium text-[rgba(89,115,147,0.9)]" style={{ fontFamily: "'Open Sans', sans-serif" }}>More</span>
      </div>
    </div>
  );
};

export default ViolationTimeline;

