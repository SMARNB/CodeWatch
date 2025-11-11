import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import VideoThumbnails from '../components/VideoThumbnails';
import StatCard from '../components/StatCard';
import PieChartContainer from '../components/PieChartContainer';
import LineGraphContainer from '../components/LineGraphContainer';
import ViolationTimeline from '../components/ViolationTimeline';
import './GenerateAnalyticsPage.css';

const GenerateAnalyticsPage = () => {
  // Filter dropdown states
  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isDepartmentOpen, setIsDepartmentOpen] = useState(false);
  const [isUserTypeOpen, setIsUserTypeOpen] = useState(false);

  // Selected filter values
  const [selectedGender, setSelectedGender] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState([]);
  const [selectedUserType, setSelectedUserType] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Chart data states
  const [pieChartData, setPieChartData] = useState(null);
  const [statCardsData, setStatCardsData] = useState(null);
  const [lineGraphData, setLineGraphData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Refs for dropdown menus to handle click outside
  const genderRef = useRef(null);
  const departmentRef = useRef(null);
  const userTypeRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (genderRef.current && !genderRef.current.contains(event.target)) {
        setIsGenderOpen(false);
      }
      if (departmentRef.current && !departmentRef.current.contains(event.target)) {
        setIsDepartmentOpen(false);
      }
      if (userTypeRef.current && !userTypeRef.current.contains(event.target)) {
        setIsUserTypeOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter options
  const genderOptions = ['Male', 'Female', 'Other'];
  const departmentOptions = ['RSCI', 'Law', 'Engineering', 'Business', 'Arts', 'Science'];
  const userTypeOptions = ['Students', 'Employees', 'Visitors', 'Contractors'];

  // Handle option selection for multi-select dropdowns
  const handleGenderToggle = (option) => {
    setSelectedGender(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const handleDepartmentToggle = (option) => {
    setSelectedDepartment(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  const handleUserTypeToggle = (option) => {
    setSelectedUserType(prev =>
      prev.includes(option)
        ? prev.filter(item => item !== option)
        : [...prev, option]
    );
  };

  // Handle Select All
  const handleSelectAll = (type) => {
    if (type === 'gender') {
      setSelectedGender(selectedGender.length === genderOptions.length ? [] : [...genderOptions]);
    } else if (type === 'department') {
      setSelectedDepartment(selectedDepartment.length === departmentOptions.length ? [] : [...departmentOptions]);
    } else if (type === 'userType') {
      setSelectedUserType(selectedUserType.length === userTypeOptions.length ? [] : [...userTypeOptions]);
    }
  };

  // Generate analytics data based on filters
  const generateAnalyticsData = (filters) => {
    // This function generates data based on the selected filters
    // In a real application, this would call an API with the filter parameters
    
    // Calculate multiplier based on filters to simulate different data
    let multiplier = 1;
    
    // Adjust multiplier based on number of selected options
    if (filters.gender.length > 0) multiplier *= (1 + filters.gender.length * 0.1);
    if (filters.department.length > 0) multiplier *= (1 + filters.department.length * 0.15);
    if (filters.userType.length > 0) multiplier *= (1 + filters.userType.length * 0.2);
    
    // Base values
    const baseNonViolators = 5565;
    const baseViolators = 154;
    const baseUnauthorized = 565;
    const baseVisitors = 234;
    const baseVictors = 454;
    
    // Generate filtered data
    const nonViolators = Math.round(baseNonViolators * multiplier);
    const violators = Math.round(baseViolators * multiplier);
    const unauthorized = Math.round(baseUnauthorized * multiplier);
    const visitors = Math.round(baseVisitors * multiplier);
    const victors = Math.round(baseVictors * multiplier);
    
    // Generate pie chart data
    const newPieChartData = {
      labels: ['Non-Violators', 'Unauthorized', 'Victors', 'Violators'],
      datasets: [
        {
          label: 'Detection per Anum',
          data: [nonViolators, unauthorized, victors, violators],
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
    
    // Generate stat cards data with trends
    const generateTrendData = (baseValue, currentValue) => {
      const trend = [];
      const steps = 6;
      const difference = currentValue - baseValue;
      for (let i = 0; i < steps; i++) {
        const progress = i / (steps - 1);
        trend.push(Math.round(baseValue + difference * progress));
      }
      return trend;
    };
    
    const calculatePercentageChange = (baseValue, currentValue) => {
      if (baseValue === 0) return '+0%';
      const change = ((currentValue - baseValue) / baseValue) * 100;
      return change >= 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
    };
    
    const newStatCardsData = [
      {
        title: 'Non-Violators',
        value: nonViolators.toString(),
        percentageChange: calculatePercentageChange(baseNonViolators, nonViolators),
        miniChartData: generateTrendData(baseNonViolators, nonViolators)
      },
      {
        title: 'Violators',
        value: violators.toString(),
        percentageChange: calculatePercentageChange(baseViolators, violators),
        miniChartData: generateTrendData(baseViolators, violators)
      },
      {
        title: 'Unauthorized',
        value: unauthorized.toString(),
        percentageChange: calculatePercentageChange(baseUnauthorized, unauthorized),
        miniChartData: generateTrendData(baseUnauthorized, unauthorized)
      },
      {
        title: 'Visitors',
        value: visitors.toString(),
        percentageChange: calculatePercentageChange(baseVisitors, visitors),
        miniChartData: generateTrendData(baseVisitors, visitors)
      }
    ];
    
    // Generate Line Graph Data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const baseLineData = [45, 52, 38, 65, 55, 72, 48, 60, 55, 68, 62, 70];
    const newLineGraphData = {
      labels: months,
      datasets: [
        {
          label: 'Violation Occurrence',
          data: baseLineData.map(value => Math.round(value * multiplier)),
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
    
    // Generate Timeline Data (Heatmap)
    const generateTimelineData = () => {
      const timelineDataArray = [];
      const weeks = 53;
      const daysPerWeek = 7;
      const hours = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
      
      // Adjust intensity based on multiplier (more filters = more violations)
      const intensityMultiplier = Math.min(multiplier, 2); // Cap at 2x for realistic data
      
      for (let week = 0; week < weeks; week++) {
        for (let day = 0; day < daysPerWeek; day++) {
          // Generate intensity based on multiplier
          const baseIntensity = Math.random();
          let intensity = 0;
          
          if (baseIntensity > 0.85) {
            intensity = Math.floor(Math.random() * 4 * intensityMultiplier);
            intensity = Math.min(intensity, 3); // Cap at 3
          } else if (baseIntensity > 0.7) {
            intensity = Math.floor(Math.random() * 3 * intensityMultiplier);
            intensity = Math.min(intensity, 2); // Cap at 2
          } else if (baseIntensity > 0.5) {
            intensity = Math.floor(Math.random() * 2 * intensityMultiplier);
            intensity = Math.min(intensity, 1); // Cap at 1
          }
          
          timelineDataArray.push({
            week,
            day,
            hour: hours[Math.floor(Math.random() * hours.length)],
            intensity,
            date: new Date(2025, 0, week * 7 + day + 1).toISOString().split('T')[0],
          });
        }
      }
      
      return timelineDataArray;
    };
    
    const newTimelineData = generateTimelineData();
    
    return { 
      pieChartData: newPieChartData, 
      statCardsData: newStatCardsData,
      lineGraphData: newLineGraphData,
      timelineData: newTimelineData
    };
  };

  // Generate report ID
  const generateReportId = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RPT-${timestamp}-${random}`;
  };

  // Create report description based on filters
  const createReportDescription = (filters, analyticsData) => {
    const parts = [];
    
    // Add date range if provided
    if (filters.startDate || filters.endDate) {
      const start = filters.startDate ? new Date(filters.startDate).toLocaleDateString() : 'All Time';
      const end = filters.endDate ? new Date(filters.endDate).toLocaleDateString() : 'Present';
      parts.push(`Date Range: ${start} - ${end}`);
    }
    
    // Add gender filters
    if (filters.gender && filters.gender.length > 0) {
      parts.push(`Gender: ${filters.gender.join(', ')}`);
    }
    
    // Add department filters
    if (filters.department && filters.department.length > 0) {
      parts.push(`Department: ${filters.department.join(', ')}`);
    }
    
    // Add user type filters
    if (filters.userType && filters.userType.length > 0) {
      parts.push(`User Type: ${filters.userType.join(', ')}`);
    }
    
    // Add summary statistics
    if (analyticsData && analyticsData.statCardsData) {
      const stats = analyticsData.statCardsData;
      const violators = stats.find(s => s.title === 'Violators')?.value || '0';
      const nonViolators = stats.find(s => s.title === 'Non-Violators')?.value || '0';
      parts.push(`Statistics: ${nonViolators} Non-Violators, ${violators} Violators`);
    }
    
    // Create description
    if (parts.length > 0) {
      return `Analytics Report - ${parts.join(' | ')}`;
    }
    
    return 'Analytics Report - All Data';
  };

  // Save report to localStorage
  const saveReport = (report) => {
    try {
      // Get existing reports from localStorage
      const existingReportsJson = localStorage.getItem('analyticsReports');
      const existingReports = existingReportsJson ? JSON.parse(existingReportsJson) : [];
      
      // Add new report at the beginning (most recent first)
      const updatedReports = [report, ...existingReports];
      
      // Save back to localStorage
      localStorage.setItem('analyticsReports', JSON.stringify(updatedReports));
      
      // Trigger storage event for other tabs/windows
      window.dispatchEvent(new Event('storage'));
      // Trigger custom event for same-tab updates
      window.dispatchEvent(new Event('reportsUpdated'));
      
      console.log('Report saved:', report.id);
    } catch (error) {
      console.error('Error saving report to localStorage:', error);
    }
  };

  // Handle Generate Analytics
  const handleGenerateAnalytics = async () => {
    setIsLoading(true);
    setHasGenerated(false);
    
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Generate data based on filters
      const filters = {
        gender: selectedGender,
        department: selectedDepartment,
        userType: selectedUserType,
        startDate,
        endDate
      };
      
      const analyticsData = generateAnalyticsData(filters);
      
      // Update chart data
      setPieChartData(analyticsData.pieChartData);
      setStatCardsData(analyticsData.statCardsData);
      setLineGraphData(analyticsData.lineGraphData);
      setTimelineData(analyticsData.timelineData);
      setHasGenerated(true);
      
      // Create and save report
      const reportId = generateReportId();
      const timestamp = new Date();
      const description = createReportDescription(filters, analyticsData);
      
      const report = {
        id: reportId,
        description: description,
        timestamp: timestamp.toISOString(),
        date: timestamp.toISOString(), // Store as ISO string for localStorage
        filters: filters,
        analyticsData: {
          pieChartData: analyticsData.pieChartData,
          statCardsData: analyticsData.statCardsData,
          lineGraphData: analyticsData.lineGraphData,
          timelineData: analyticsData.timelineData
        },
        status: 'Completed',
        type: 'Analytics Report'
      };
      
      // Save report to localStorage
      saveReport(report);
      
      console.log('Analytics generated with filters:', filters);
      console.log('Generated data:', analyticsData);
      console.log('Report created:', report);
    } catch (error) {
      console.error('Error generating analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Use generated data only (no default data before generation)
  const displayStatCardsData = statCardsData;

  // Custom Dropdown Menu Component
  const DropdownMenu = ({ isOpen, options, selected, onToggle, onSelectAll, title, menuRef }) => {
    if (!isOpen) return null;

    const allSelected = selected.length === options.length;
    const someSelected = selected.length > 0 && selected.length < options.length;

    return (
      <div
        ref={menuRef}
        className="absolute bg-white rounded-[12px] shadow-xl z-50 max-h-[400px] overflow-hidden border border-gray-100"
        style={{
          top: '100%',
          left: 0,
          width: '100%',
          marginTop: '4px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#3f4299] to-[#5a5fb8] px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              {title.replace('-Options', '')}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectAll();
              }}
              className="text-xs text-white hover:text-gray-100 font-medium px-2 py-1 rounded-md hover:bg-white/20 transition-colors"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          </div>
          {someSelected && (
            <p className="text-xs text-white/90 mt-1" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              {selected.length} of {options.length} selected
            </p>
          )}
        </div>

        {/* Options List */}
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
          <div className="py-2">
            {options.map((option, index) => {
              const isSelected = selected.includes(option);
              return (
                <label
                  key={option}
                  className={`flex items-center px-4 py-2.5 cursor-pointer transition-all duration-150 ${
                    isSelected 
                      ? 'bg-[#3f4299]/5 hover:bg-[#3f4299]/10' 
                      : 'hover:bg-gray-50'
                  }`}
                  style={{ fontFamily: "'Open Sans', sans-serif" }}
                >
                  {/* Custom Checkbox */}
                  <div className="relative flex items-center justify-center flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(option)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                        isSelected
                          ? 'bg-[#3f4299] border-[#3f4299]'
                          : 'border-gray-300 bg-white hover:border-[#3f4299]/50'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          className="w-3.5 h-3.5 text-white"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  
                  {/* Option Text */}
                  <span
                    className={`ml-3 text-sm flex-1 ${
                      isSelected ? 'text-[#3f4299] font-medium' : 'text-gray-700'
                    }`}
                    style={{ fontFamily: "'Open Sans', sans-serif" }}
                  >
                    {option}
                  </span>

                  {/* Selected Indicator Dot */}
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-[#3f4299] flex-shrink-0 ml-2" />
                  )}
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer (if needed) */}
        {selected.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-2.5 bg-gray-50/50">
            <p className="text-xs text-gray-600 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>
              {selected.length} item{selected.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        {/* Video Thumbnails Section */}
        <div className="mb-6" style={{ marginBottom: '20px' }}>
          <VideoThumbnails />
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-[8px] p-4 mb-6" style={{ marginBottom: '20px' }}>
          <div className="flex flex-wrap items-center gap-4">
            {/* Select Gender Dropdown */}
            <div className="relative" ref={genderRef} style={{ width: '200px' }}>
              <button
                onClick={() => {
                  setIsGenderOpen(!isGenderOpen);
                  setIsDepartmentOpen(false);
                  setIsUserTypeOpen(false);
                }}
                className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${
                  isGenderOpen
                    ? 'border-[#3f4299] shadow-md'
                    : selectedGender.length > 0
                    ? 'border-[#3f4299]/50 shadow-sm'
                    : 'border-[#bab6b6] hover:border-[#3f4299]/50'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px' }}
              >
                <span className={selectedGender.length > 0 ? 'text-[#3f4299] font-medium' : 'text-gray-700'}>
                  {selectedGender.length > 0 
                    ? `${selectedGender.length} selected` 
                    : 'Select Gender'}
                </span>
                <div className="flex items-center gap-2">
                  {selectedGender.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#3f4299]" />
                  )}
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${isGenderOpen ? 'transform rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <DropdownMenu
                isOpen={isGenderOpen}
                options={genderOptions}
                selected={selectedGender}
                onToggle={handleGenderToggle}
                onSelectAll={() => handleSelectAll('gender')}
                title="Select Gender-Options"
                menuRef={genderRef}
              />
            </div>

            {/* Select Department Dropdown */}
            <div className="relative" ref={departmentRef} style={{ width: '200px' }}>
              <button
                onClick={() => {
                  setIsDepartmentOpen(!isDepartmentOpen);
                  setIsGenderOpen(false);
                  setIsUserTypeOpen(false);
                }}
                className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${
                  isDepartmentOpen
                    ? 'border-[#3f4299] shadow-md'
                    : selectedDepartment.length > 0
                    ? 'border-[#3f4299]/50 shadow-sm'
                    : 'border-[#bab6b6] hover:border-[#3f4299]/50'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px' }}
              >
                <span className={selectedDepartment.length > 0 ? 'text-[#3f4299] font-medium' : 'text-gray-700'}>
                  {selectedDepartment.length > 0 
                    ? `${selectedDepartment.length} selected` 
                    : 'Select Department'}
                </span>
                <div className="flex items-center gap-2">
                  {selectedDepartment.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#3f4299]" />
                  )}
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${isDepartmentOpen ? 'transform rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <DropdownMenu
                isOpen={isDepartmentOpen}
                options={departmentOptions}
                selected={selectedDepartment}
                onToggle={handleDepartmentToggle}
                onSelectAll={() => handleSelectAll('department')}
                title="Select Department-Options"
                menuRef={departmentRef}
              />
            </div>

            {/* User Type Dropdown */}
            <div className="relative" ref={userTypeRef} style={{ width: '200px' }}>
              <button
                onClick={() => {
                  setIsUserTypeOpen(!isUserTypeOpen);
                  setIsGenderOpen(false);
                  setIsDepartmentOpen(false);
                }}
                className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${
                  isUserTypeOpen
                    ? 'border-[#3f4299] shadow-md'
                    : selectedUserType.length > 0
                    ? 'border-[#3f4299]/50 shadow-sm'
                    : 'border-[#bab6b6] hover:border-[#3f4299]/50'
                }`}
                style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px' }}
              >
                <span className={selectedUserType.length > 0 ? 'text-[#3f4299] font-medium' : 'text-gray-700'}>
                  {selectedUserType.length > 0 
                    ? `${selectedUserType.length} selected` 
                    : 'User Type'}
                </span>
                <div className="flex items-center gap-2">
                  {selectedUserType.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#3f4299]" />
                  )}
                  <svg 
                    className={`w-4 h-4 transition-transform duration-200 ${isUserTypeOpen ? 'transform rotate-180' : ''}`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              <DropdownMenu
                isOpen={isUserTypeOpen}
                options={userTypeOptions}
                selected={selectedUserType}
                onToggle={handleUserTypeToggle}
                onSelectAll={() => handleSelectAll('userType')}
                title="User Type-Options"
                menuRef={userTypeRef}
              />
            </div>

            {/* Start Date Picker */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors hover:border-[#3f4299] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
              style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px' }}
              placeholder="Start Date"
            />

            {/* End Date Picker */}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors hover:border-[#3f4299] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
              style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px' }}
              placeholder="End Date"
            />

            {/* Select All Button */}
            <button
              onClick={() => {
                handleSelectAll('gender');
                handleSelectAll('department');
                handleSelectAll('userType');
              }}
              className="h-[48px] border border-[#3f4299] text-[#3f4299] rounded-[8px] text-[14px] font-medium hover:bg-[#3f4299] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
              style={{ fontFamily: "'Open Sans', sans-serif", minWidth: '240px', width: '240px' }}
            >
              Select All
            </button>

            {/* Generate Analytics Button */}
            <button
              onClick={handleGenerateAnalytics}
              disabled={isLoading}
              className={`h-[48px] rounded-[8px] text-[14px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 ${
                isLoading
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-[#3f4299] text-white hover:bg-[#2d3170]'
              }`}
              style={{ fontFamily: "'Open Sans', sans-serif", minWidth: '240px', width: '240px' }}
            >
              {isLoading ? 'Generating...' : 'Generate Analytics'}
            </button>
          </div>
        </div>

        {/* Analytics Display Section - Only show after generation */}
        {hasGenerated || isLoading ? (
          <>
            {/* Chart Grid */}
            <div className="grid grid-cols-3 gap-6" style={{ marginBottom: '20px' }}>
              {/* Left Side - Pie Chart */}
              <div className="col-span-1">
                {isLoading ? (
                  <div className="bg-white border border-neutral-300 rounded-lg p-12 h-[400px] flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>Loading pie chart...</p>
                    </div>
                  </div>
                ) : pieChartData ? (
                  <PieChartContainer chartData={pieChartData} isLoading={false} />
                ) : null}
              </div>

              {/* Right Side - Stat Cards Grid (2x2) */}
              <div className="col-span-2">
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((index) => (
                      <div key={index} className="bg-white border border-neutral-300 rounded-lg p-6 h-[148px] flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    ))}
                  </div>
                ) : displayStatCardsData ? (
                  <div className="grid grid-cols-2 gap-4">
                    {displayStatCardsData.map((stat, index) => (
                      <StatCard
                        key={index}
                        title={stat.title}
                        value={stat.value}
                        percentageChange={stat.percentageChange}
                        miniChartData={stat.miniChartData}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Line Graph Section */}
            <div className="mb-6" style={{ marginBottom: '20px' }}>
              {isLoading ? (
                <div className="bg-white border border-neutral-300 rounded-lg p-12 h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>Loading line graph...</p>
                  </div>
                </div>
              ) : lineGraphData ? (
                <LineGraphContainer chartData={lineGraphData} isLoading={false} />
              ) : null}
            </div>

            {/* Heatmap Section */}
            <div className="mb-6" style={{ marginBottom: '20px' }}>
              {isLoading ? (
                <div className="bg-white border border-neutral-300 rounded-lg p-12 h-[400px] flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>Loading heatmap...</p>
                  </div>
                </div>
              ) : timelineData && timelineData.length > 0 ? (
                <ViolationTimeline timelineData={timelineData} />
              ) : null}
            </div>
          </>
        ) : (
          /* Empty State - Before generating analytics */
          <div className="mt-12 mb-12">
            <div className="bg-white border border-gray-200 rounded-lg p-16 text-center" style={{ minHeight: '500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div className="mb-6">
                <svg className="w-24 h-24 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-gray-700 mb-3" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                No Analytics Generated Yet
              </h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                Select your filters above and click "Generate Analytics" to view data based on your selected criteria.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Analytics will be filtered based on your selections</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerateAnalyticsPage;

