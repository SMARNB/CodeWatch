// API Service for fetching dashboard analytics data

// Vite uses import.meta.env instead of process.env
// Environment variables must be prefixed with VITE_ to be exposed
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

/**
 * Fetch statistics data for StatCards
 */
export const fetchStatistics = async () => {
  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`${API_BASE_URL}/statistics/`);
    // if (!response.ok) throw new Error('Failed to fetch statistics');
    // return await response.json();
    
    // Mock data for now
    return {
      nonViolators: {
        title: 'Non-Violators',
        value: 5565,
        percentageChange: '+5%',
        miniChartData: [10, 20, 15, 25, 30, 20, 35],
      },
      unauthorized: {
        title: 'Unauthorized',
        value: 565,
        percentageChange: '-2%',
        miniChartData: [15, 10, 20, 12, 18, 14, 16],
      },
      violators: {
        title: 'Violators',
        value: 154,
        percentageChange: '+8%',
        miniChartData: [5, 8, 6, 10, 7, 9, 12],
      },
      victors: {
        title: 'Victors',
        value: 454,
        percentageChange: '+3%',
        miniChartData: [12, 15, 14, 18, 16, 17, 20],
      },
    };
  } catch (error) {
    console.error('Error fetching statistics:', error);
    throw error;
  }
};

/**
 * Fetch pie chart data
 */
export const fetchPieChartData = async () => {
  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`${API_BASE_URL}/pie-chart/`);
    // if (!response.ok) throw new Error('Failed to fetch pie chart data');
    // return await response.json();
    
    // Mock data
    return {
      labels: ['Non-Violators', 'Unauthorized', 'Victors', 'Violators'],
      datasets: [
        {
          label: 'Detection per Anum',
          data: [5565, 565, 454, 154],
          backgroundColor: [
            '#10B981',
            '#F59E0B',
            '#3B82F6',
            '#EF4444',
          ],
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    };
  } catch (error) {
    console.error('Error fetching pie chart data:', error);
    throw error;
  }
};

/**
 * Fetch line chart data for violation occurrence
 */
export const fetchViolationOccurrenceData = async () => {
  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`${API_BASE_URL}/violation-occurrence/`);
    // if (!response.ok) throw new Error('Failed to fetch violation occurrence data');
    // return await response.json();
    
    // Mock data
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      datasets: [
        {
          label: 'Violation Occurrence',
          data: [45, 52, 38, 65, 55, 72, 48],
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.3)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#3B82F6',
          pointBorderWidth: 3,
        },
      ],
    };
  } catch (error) {
    console.error('Error fetching violation occurrence data:', error);
    throw error;
  }
};

/**
 * Fetch violation trend chart data
 */
export const fetchViolationTrendData = async () => {
  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`${API_BASE_URL}/violation-trend/`);
    // if (!response.ok) throw new Error('Failed to fetch violation trend data');
    // return await response.json();
    
    // Mock data
    return {
      violationCount: 5000.00,
      subViolations: 50,
      period: 'This Week',
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun'],
      datasets: [
        {
          label: 'Dataset 1',
          data: [20, 30, -10, 40, -20, 50],
          borderColor: '#7987FF',
          backgroundColor: 'rgba(121, 135, 255, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Dataset 2',
          data: [-15, 25, 35, -5, 30, 45],
          borderColor: '#E697FF',
          backgroundColor: 'rgba(230, 151, 255, 0.1)',
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Dataset 3',
          data: [10, -20, 20, 30, 10, -10],
          borderColor: '#FFA5CB',
          backgroundColor: 'rgba(255, 165, 203, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  } catch (error) {
    console.error('Error fetching violation trend data:', error);
    throw error;
  }
};

/**
 * Fetch violation timeline data
 */
export const fetchViolationTimelineData = async () => {
  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`${API_BASE_URL}/violation-timeline/`);
    // if (!response.ok) throw new Error('Failed to fetch violation timeline data');
    // return await response.json();
    
    // Mock data - generate timeline data for 53 weeks
    const timelineData = [];
    const weeks = 53;
    const daysPerWeek = 7;
    
    for (let week = 0; week < weeks; week++) {
      for (let day = 0; day < daysPerWeek; day++) {
        const intensity = Math.random() > 0.7 ? Math.floor(Math.random() * 4) : 0;
        timelineData.push({
          week,
          day,
          intensity,
        });
      }
    }
    
    return timelineData;
  } catch (error) {
    console.error('Error fetching violation timeline data:', error);
    throw error;
  }
};

/**
 * Fetch video feeds data
 */
export const fetchVideoFeeds = async () => {
  try {
    // TODO: Replace with actual API endpoint
    // const response = await fetch(`${API_BASE_URL}/video-feeds/`);
    // if (!response.ok) throw new Error('Failed to fetch video feeds');
    // return await response.json();
    
    // Mock data
    return {
      currentVideo: {
        id: 1,
        streamUrl: null, // Replace with actual stream URL
        title: 'Camera 1',
        location: 'Main Entrance',
      },
      availableCameras: [
        { id: 1, title: 'Camera 1', status: 'Live' },
        { id: 2, title: 'Camera 2', status: 'Live' },
        { id: 3, title: 'Camera 3', status: 'Live' },
        { id: 4, title: 'Camera 4', status: 'Live' },
      ],
    };
  } catch (error) {
    console.error('Error fetching video feeds:', error);
    throw error;
  }
};

/**
 * Fetch all dashboard data in parallel
 */
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

    return {
      statistics,
      pieChartData,
      violationOccurrenceData,
      violationTrendData,
      violationTimelineData,
      videoFeeds,
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw error;
  }
};

