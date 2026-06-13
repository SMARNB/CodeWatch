// FrontEnd/src/apiService.js

// Ensure this matches your Django URL
const API_BASE_URL = '/api';

// Department-heads see only their department + unknowns; the backend resolves
// that from the logged-in user, so every dashboard call carries their email.
const userParam = () => {
  const email = localStorage.getItem('userEmail') || '';
  return email ? `?user=${encodeURIComponent(email)}` : '';
};
const dashboardStatsUrl = () => `${API_BASE_URL}/dashboard-stats/${userParam()}`;

/**
 * Fetch statistics data for StatCards (CONNECTED TO DB)
 */
export const fetchStatistics = async () => {
  try {
    const response = await fetch(dashboardStatsUrl());
    if (!response.ok) throw new Error('Failed to fetch stats');
    const realData = await response.json();
    const stats = realData.stats;
    return {
      nonViolators: { title: 'Non-Violators', value: stats.nonViolators.value, percentageChange: stats.nonViolators.percentageChange || '', miniChartData: stats.nonViolators.miniChartData || [] },
      unauthorized: { title: 'Total Violations', value: stats.unauthorized.value, percentageChange: stats.unauthorized.percentageChange || '', miniChartData: stats.unauthorized.miniChartData || [] },
      violators: { title: 'Active Violators', value: stats.violators.value, percentageChange: stats.violators.percentageChange || '', miniChartData: stats.violators.miniChartData || [] },
      victors: { title: 'Total Tracked', value: stats.victors.value, percentageChange: stats.victors.percentageChange || '', miniChartData: stats.victors.miniChartData || [] },
    };
  } catch (error) {
    console.error('Using Fallback Data:', error);
    return {
      nonViolators: { title: 'Non-Violators', value: 0, percentageChange: '', miniChartData: [] },
      unauthorized: { title: 'Total Violations', value: 0, percentageChange: '', miniChartData: [] },
      violators: { title: 'Active Violators', value: 0, percentageChange: '', miniChartData: [] },
      victors: { title: 'Total Tracked', value: 0, percentageChange: '', miniChartData: [] },
    };
  }
};

export const fetchPieChartData = async () => {
  try {
    const response = await fetch(dashboardStatsUrl());
    if (!response.ok) throw new Error('Failed to fetch stats');
    const realData = await response.json();
    const pie = realData.pie_chart;
    const colorByLabel = {
      'Non-Violators': '#22C55E',
      'Visitors': '#3B82F6',
      'Unauthorized': '#EF4444',
      'Dress-Code': '#F59E0B',
      'Blacklisted': '#8B5CF6',
    };
    return {
      labels: pie.labels,
      datasets: [{
        label: 'People by Category',
        data: pie.data,
        backgroundColor: pie.labels.map((l) => colorByLabel[l] || '#9CA3AF'),
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    };
  } catch (error) {
    console.error('Pie Chart Error (Using Fallback):', error);
    return {
      labels: ['No Data'],
      datasets: [{ label: 'No Data', data: [1], backgroundColor: ['#cccccc'], borderColor: '#ffffff', borderWidth: 2 }],
    };
  }
};

export const fetchViolationOccurrenceData = async () => {
  try {
    const response = await fetch(dashboardStatsUrl());
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();
    return {
      labels: data.line.labels,
      datasets: [{
        label: 'Violation Occurrence',
        data: data.line.data,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.3)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3B82F6',
        pointBorderWidth: 3,
      }],
    };
  } catch (error) {
    return { labels: [], datasets: [{ label: 'Violation Occurrence', data: [], borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.3)', fill: true, tension: 0.4 }] };
  }
};

export const fetchViolationTrendData = async () => {
  try {
    const response = await fetch(dashboardStatsUrl());
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();
    const t = data.trend;
    return {
      violationCount: t.total,
      period: 'Last 6 Months',
      labels: t.labels,
      datasets: t.datasets.map((ds) => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color,
        backgroundColor: 'transparent',
        fill: false,
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 5,
      })),
    };
  } catch (error) {
    return { violationCount: 0, period: 'Last 6 Months', labels: [], datasets: [] };
  }
};

export const fetchViolationTimelineData = async () => {
  try {
    const response = await fetch(dashboardStatsUrl());
    if (!response.ok) throw new Error('Failed to fetch stats');
    const data = await response.json();
    return data.timeline || [];
  } catch (error) {
    return [];
  }
};

export const fetchVideoFeeds = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/cameras/`);
    if (!response.ok) throw new Error('Failed to fetch cameras');
    const data = await response.json();
    return {
      currentVideo: data.length > 0
        ? { id: data[0].camera_id, title: data[0].name, location: data[0].location, status: data[0].status }
        : { id: 1, title: 'Main Gate', location: 'Entrance', status: 'Live' },
      availableCameras: data,
    };
  } catch (error) {
    return {
      currentVideo: { id: 1, title: 'Main Gate (AI Feed)', location: 'Entrance', status: 'Live' },
      availableCameras: [
        { id: 1, title: 'Main Gate', status: 'Live' },
        { id: 2, title: 'Corridor', status: 'Offline' },
      ],
    };
  }
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