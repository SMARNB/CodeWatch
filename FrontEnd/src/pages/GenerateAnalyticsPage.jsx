import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { useLocation } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import VideoThumbnails from '../components/VideoThumbnails';
import StatCard from '../components/StatCard';
import PieChartContainer from '../components/PieChartContainer';
import LineGraphContainer from '../components/LineGraphContainer';
import ViolationTimeline from '../components/ViolationTimeline';
import backgroundEllipse from '../assets/background.svg';
import '../components/CustomCSS/GenerateAnalyticsPage.css';

const formatOptionText = (text) => {
  if (!text) return '';
  return text.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

// Custom Input for DatePicker to match Dropdown styling
const CustomDateInput = forwardRef(({ value, onClick, placeholder, isActive }, ref) => (
  <button
    onClick={onClick}
    ref={ref}
    type="button"
    className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${
      isActive
        ? 'border-[#3f4299]/50 shadow-sm text-[#3f4299] font-medium'
        : 'border-[#bab6b6] hover:border-[#3f4299]/50 text-gray-700'
    }`}
    style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '10px', paddingRight: '16px', minWidth: '160px' }}
  >
    <span>{value || placeholder}</span>
    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  </button>
));

const GenerateAnalyticsPage = () => {
  const location = useLocation();
  const { personInfo, violationEvents, includeMovementHistory: initialIncludeMovement } = location.state || {};

  // Filter dropdown states
  const [isGenderOpen, setIsGenderOpen] = useState(false);
  const [isDepartmentOpen, setIsDepartmentOpen] = useState(false);
  const [isUserTypeOpen, setIsUserTypeOpen] = useState(false);

  // Selected filter values
  const [selectedGender, setSelectedGender] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState([]);
  const [selectedUserType, setSelectedUserType] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // Chart data states
  const [pieChartData, setPieChartData] = useState(null);
  const [statCardsData, setStatCardsData] = useState(null);
  const [lineGraphData, setLineGraphData] = useState(null);
  const [timelineData, setTimelineData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [includeMovementHistory, setIncludeMovementHistory] = useState(initialIncludeMovement || false);

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
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [userTypeOptions, setUserTypeOptions] = useState([]);

  useEffect(() => {
    fetch('/api/analytics-filters/')
      .then(res => res.json())
      .then(data => {
        setDepartmentOptions(data.departments || []);
        setUserTypeOptions(data.roles || []);
      })
      .catch(err => console.error('Failed to load filter options:', err));
  }, []);

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
  const generateAnalyticsData = (realCounts) => {
    const nonViolators = realCounts.nonViolators || 0;
    const violators = realCounts.violators || 0;
    const unauthorized = realCounts.unauthorized || 0;
    const visitors = realCounts.visitors || 0;
    const monthlyViolations = realCounts.monthlyViolations || [];
    const timelineData = realCounts.timelineData || [];

    const pieChartData = {
      labels: ['Non-Violators', 'Violators', 'Unauthorized', 'Visitors'],
      datasets: [{
        label: 'People',
        data: [nonViolators, violators, unauthorized, visitors],
        backgroundColor: ['#10B981', '#EF4444', '#F59E0B', '#3B82F6'],
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    };

    let momChange = '';
    if (monthlyViolations.length >= 2) {
      const last = monthlyViolations[monthlyViolations.length - 1].count;
      const prev = monthlyViolations[monthlyViolations.length - 2].count;
      if (prev > 0) momChange = `${last - prev >= 0 ? '+' : ''}${(((last - prev) / prev) * 100).toFixed(1)}%`;
      else momChange = last > 0 ? '+100%' : '0%';
    }
    const trend = monthlyViolations.slice(-6).map(mo => mo.count);
    const sparkline = trend.length ? trend : [0];
    const statCardsData = [
      { title: 'Non-Violators', value: nonViolators.toString(), percentageChange: momChange, miniChartData: sparkline },
      { title: 'Violators', value: violators.toString(), percentageChange: momChange, miniChartData: sparkline },
      { title: 'Unauthorized', value: unauthorized.toString(), percentageChange: momChange, miniChartData: sparkline },
      { title: 'Visitors', value: visitors.toString(), percentageChange: momChange, miniChartData: sparkline },
    ];

    const lineGraphData = {
      labels: monthlyViolations.map(mo => mo.month),
      datasets: [{
        label: 'Violation Occurrence',
        data: monthlyViolations.map(mo => mo.count),
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        fill: true, tension: 0.4, pointRadius: 5,
        pointBackgroundColor: '#ffffff', pointBorderColor: '#3B82F6', pointBorderWidth: 3,
      }],
    };

    return { pieChartData, statCardsData, lineGraphData, timelineData };
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
      const start = filters.startDate ? filters.startDate : 'All Time';
      const end = filters.endDate ? filters.endDate : 'Present';
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
      parts.push(`User Type: ${filters.userType.map(formatOptionText).join(', ')}`);
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
      const existingReportsJson = localStorage.getItem('analyticsReports');
      const existingReports = existingReportsJson ? JSON.parse(existingReportsJson) : [];
      const updatedReports = [report, ...existingReports];
      localStorage.setItem('analyticsReports', JSON.stringify(updatedReports));
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('reportsUpdated'));
    } catch (error) {
      console.error('Error saving report to localStorage:', error);
    }
  };

  // Handle Generate Analytics
  const handleGenerateAnalytics = async () => {
    setIsLoading(true);
    setHasGenerated(false);

    // 1. Prepare Filter Payload
    const filters = {
      gender: selectedGender,
      department: selectedDepartment,
      userType: selectedUserType,
      startDate: startDate ? startDate.toISOString().split('T')[0] : '',
      endDate: endDate ? endDate.toISOString().split('T')[0] : ''
    };

    try {
      // 2. Call Django Backend to get Stats
      const response = await fetch('/api/get-analytics/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters)
      });

      let analyticsData;

      if (response.ok) {
        const realCounts = await response.json();
        analyticsData = generateAnalyticsData(realCounts);
      } else {
        console.warn("Backend error, using empty data.");
        analyticsData = generateAnalyticsData({});
      }

      // 3. Update State for Charts
      setPieChartData(analyticsData.pieChartData);
      setStatCardsData(analyticsData.statCardsData);
      setLineGraphData(analyticsData.lineGraphData);
      setTimelineData(analyticsData.timelineData);
      setHasGenerated(true);

      // 4. AUTO-SAVE TO DATABASE
      const summaryMessage = `
Analytics Generated on ${new Date().toLocaleString()}
------------------------------------------------
Filters Applied: 
Dept: ${filters.department.length ? filters.department.join(', ') : 'All'}
User: ${filters.userType.length ? filters.userType.join(', ') : 'All'}
------------------------------------------------
Statistics Summary:
• Non-Violators: ${analyticsData.statCardsData[0].value}
• Violators: ${analyticsData.statCardsData[1].value}
• Unauthorized: ${analyticsData.statCardsData[2].value}
• Visitors: ${analyticsData.statCardsData[3].value}
      `.trim();

      await fetch('/api/send-report/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'Analytics Snapshot',
          recipients: 'System Archive',
          subject: `Analytics Report: ${new Date().toLocaleDateString()}`,
          priority: 'Low',
          message: summaryMessage,
          personId: (includeMovementHistory && personInfo) ? personInfo.id : null,
          analytics_json: JSON.stringify(analyticsData)
        })
      });

      console.log("✅ Analytics Report saved to Database");

    } catch (error) {
      console.error('Error:', error);
      alert("Network Error: Is the Backend running?");
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
        className="absolute bg-white rounded-[8px] z-50 max-h-[400px] flex flex-col border border-gray-200"
        style={{
          top: '100%',
          left: 0,
          minWidth: '100%',
          width: 'max-content',
          marginTop: '4px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          fontFamily: "'Open Sans', sans-serif"
        }}
      >
        <div className="bg-white flex items-center justify-between border-b border-gray-100 rounded-t-[8px]" style={{ padding: '10px', gap: '16px' }}>
          <div className="flex flex-col">
            <h3 className="text-[16px] font-bold text-[#3f4299] whitespace-nowrap">
              {formatOptionText(title.replace('-Options', ''))}
            </h3>
            {someSelected && (
              <p className="text-[12px] text-gray-500 font-medium whitespace-nowrap">
                {selected.length} of {options.length} selected
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectAll();
            }}
            className="text-[14px] font-bold text-[#3f4299] hover:text-[#2d3170] hover:bg-gray-50 px-2 py-1 rounded transition-colors focus:outline-none whitespace-nowrap"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="max-h-[320px] overflow-y-auto custom-scrollbar bg-white">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <label
                key={option}
                className={`flex items-center cursor-pointer transition-colors border-b border-gray-100 ${isSelected
                  ? 'bg-[#f8f9ff] hover:bg-gray-50'
                  : 'hover:bg-gray-50 bg-white'
                  }`}
                style={{ padding: '10px' }}
              >
                <div className="relative flex items-center justify-center flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggle(option)}
                    className="sr-only"
                  />
                  <div
                    className={`w-[18px] h-[18px] rounded flex items-center justify-center transition-colors ${isSelected
                      ? 'bg-[#3f4299]'
                      : 'border border-gray-300 bg-white'
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
                <span
                  className={`flex-1 ${isSelected ? 'text-[#3f4299] font-bold' : 'text-gray-700 font-medium'
                    }`}
                  style={{ marginLeft: '12px', fontSize: '14px' }}
                >
                  {formatOptionText(option)}
                </span>
                {isSelected && (
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3f4299] flex-shrink-0 ml-2" />
                )}
              </label>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="bg-gray-50 border-t border-gray-100 rounded-b-[8px]" style={{ padding: '10px' }}>
            <p className="text-[12px] text-gray-600 text-center font-bold">
              {selected.length} item{selected.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>
      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: '100px', paddingRight: '100px' }}>
        {/* Video Thumbnails Section */}
        <div className="mb-6" style={{ marginBottom: '20px' }}>
          <VideoThumbnails />
        </div>

        {/* Filter Bar */}
        <div className="mb-6" style={{ marginBottom: '20px' }}>
          <div className="flex flex-wrap items-center gap-4">
            {/* Select Gender Dropdown */}
            <div className="relative" ref={genderRef} style={{ width: '200px' }}>
              <button
                onClick={() => {
                  setIsGenderOpen(!isGenderOpen);
                  setIsDepartmentOpen(false);
                  setIsUserTypeOpen(false);
                }}
                className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${isGenderOpen
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
                className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${isDepartmentOpen
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
                className={`h-[48px] border-2 rounded-[8px] text-[14px] bg-white outline-none transition-all duration-200 flex items-center justify-between w-full ${isUserTypeOpen
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
            <DatePicker
              selected={startDate}
              onChange={(date) => setStartDate(date)}
              customInput={<CustomDateInput isActive={!!startDate} />}
              placeholderText="Start Date"
              dateFormat="MM/dd/yyyy"
            />

            {/* End Date Picker */}
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              customInput={<CustomDateInput isActive={!!endDate} />}
              placeholderText="End Date"
              dateFormat="MM/dd/yyyy"
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

            {/* Include Movement History Checkbox */}
            {personInfo && (
              <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMovementHistory}
                  onChange={(e) => setIncludeMovementHistory(e.target.checked)}
                  className="w-4 h-4 text-[#3f4299] border-gray-300 rounded focus:ring-[#3f4299]"
                />
                <span style={{ fontFamily: "'Open Sans', sans-serif" }}>Include Movement History for {personInfo.name}</span>
              </label>
            )}

            {/* Generate Analytics Button */}
            <button
              onClick={handleGenerateAnalytics}
              disabled={isLoading}
              className={`h-[48px] rounded-[8px] text-[14px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 ${isLoading
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

