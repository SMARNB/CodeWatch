// FrontEnd/src/apiService.js

// Ensure this matches your Django URL
const API_BASE_URL = 'http://127.0.0.1:8000/api';

/**
 * Fetch statistics data for StatCards (CONNECTED TO DB)
 */
export const fetchStatistics = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard-stats/`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    
    const realData = await response.json();
    const stats = realData.stats;

    // Return in the exact format your UI expects
    return {
      nonViolators: {
        title: 'Non-Violators',
        value: stats.nonViolators.value,
        percentageChange: '+5%',
        miniChartData: [10, 20, 15, 25, 30, 20, 35], // Keep mock visual
      },
      unauthorized: {
        title: 'Total Violations', // Renamed for clarity
        value: stats.unauthorized.value,
        percentageChange: '+12%',
        miniChartData: [15, 10, 20, 12, 18, 14, 16],
      },
      violators: {
        title: 'Active Violators',
        value: stats.violators.value,
        percentageChange: '+8%',
        miniChartData: [5, 8, 6, 10, 7, 9, 12],
      },
      victors: {
        title: 'Total Tracked', // Renamed for clarity
        value: stats.victors.value,
        percentageChange: '+3%',
        miniChartData: [12, 15, 14, 18, 16, 17, 20],
      },
    };
  } catch (error) {
    console.error('Using Fallback Data:', error);
    // Fallback so the app doesn't crash if DB is empty
    return {
       nonViolators: { title: 'Non-Violators', value: 0, miniChartData: [] },
       unauthorized: { title: 'Unauthorized', value: 0, miniChartData: [] },
       violators: { title: 'Violators', value: 0, miniChartData: [] },
       victors: { title: 'Victors', value: 0, miniChartData: [] },
    };
  }
};

/**
 * Fetch pie chart data (CONNECTED TO DB)
 */
export const fetchPieChartData = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard-stats/`);
    if (!response.ok) throw new Error('Failed to fetch stats'); // Triggers catch block on 404
    
    const realData = await response.json();
    const pie = realData.pie_chart;

    return {
      labels: pie.labels,
      datasets: [
        {
          label: 'Violations by Type',
          data: pie.data,
          backgroundColor: ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6'],
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    };
  } catch (error) {
    console.error("Pie Chart Error (Using Fallback):", error);
    
    // --- THE FIX: RETURN VALID DUMMY DATA INSTEAD OF EMPTY OBJECTS ---
    // This prevents "Cannot read properties of undefined" errors
    return {
      labels: ["System Offline"],
      datasets: [{
        label: 'No Data',
        data: [1], // Dummy number so chart can render
        backgroundColor: ['#cccccc'],
        borderColor: '#ffffff',
        borderWidth: 2,
      }]
    };
  }
};

/**
 * Fetch video feeds data (MOCK - We use CameraFeed.jsx for real video)
 */
export const fetchVideoFeeds = async () => {
    return {
      currentVideo: {
        id: 1,
        title: 'Main Gate (AI Feed)',
        location: 'Entrance',
        status: 'Live'
      },
      availableCameras: [
        { id: 1, title: 'Main Gate', status: 'Live' },
        { id: 2, title: 'Corridor', status: 'Offline' },
      ],
    };
};

/**
 * KEEPING THESE MOCKED FOR THE DEMO
 * (Because a new database has no history, real charts would be empty/ugly)
 */
export const fetchViolationOccurrenceData = async () => {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      datasets: [{
          label: 'Violation Occurrence',
          data: [45, 52, 38, 65, 55, 72, 48],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
          fill: true,
          tension: 0.4,
        }],
    };
};

export const fetchViolationTrendData = async () => {
    return {
      violationCount: 5000.00,
      subViolations: 50,
      period: 'This Week',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'],
      datasets: [
        { label: 'Dataset 1', data: [20, 30, -10, 40, -20, 50], borderColor: '#7987FF', fill: true },
        { label: 'Dataset 2', data: [-15, 25, 35, -5, 30, 45], borderColor: '#E697FF', fill: true },
      ],
    };
};

export const fetchViolationTimelineData = async () => {
    const timelineData = [];
    for (let week = 0; week < 53; week++) {
      for (let day = 0; day < 7; day++) {
        timelineData.push({ week, day, intensity: Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0 });
      }
    }
    return timelineData;
};

export const fetchAllDashboardData = async () => {
  try {
    const [statistics, pieChartData, violationOccurrenceData, violationTrendData, violationTimelineData, videoFeeds] = 
      await Promise.all([
        fetchStatistics(),
        fetchPieChartData(),
        fetchViolationOccurrenceData(),
        fetchViolationTrendData(),
        fetchViolationTimelineData(),
        fetchVideoFeeds(),
      ]);

    return { statistics, pieChartData, violationOccurrenceData, violationTrendData, violationTimelineData, videoFeeds };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};