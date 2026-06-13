import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import PieChartContainer from '../components/PieChartContainer';
import LineGraphContainer from '../components/LineGraphContainer';
import ViolationTrendChart from '../components/ViolationTrendChart';
import ViolationTimeline from '../components/ViolationTimeline';
import VideoPlayer from '../components/VideoPlayer';
import VideoThumbnails from '../components/VideoThumbnails';
import { fetchAllDashboardData } from '../services/apiService';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';

const DashboardPage = () => {
  const currentUserType = (localStorage.getItem('userType') || '').toLowerCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Data states
  const [statistics, setStatistics] = useState(null);
  const [pieChartData, setPieChartData] = useState(null);
  const [violationOccurrenceData, setViolationOccurrenceData] = useState(null);
  const [violationTrendData, setViolationTrendData] = useState(null);
  const [violationTimelineData, setViolationTimelineData] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [currentCamera, setCurrentCamera] = useState(null);

  // Fetch all dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchAllDashboardData();

        setStatistics(data.statistics);
        setPieChartData(data.pieChartData);
        setViolationOccurrenceData(data.violationOccurrenceData);
        setViolationTrendData(data.violationTrendData);
        setViolationTimelineData(data.violationTimelineData);

        // Fetch cameras if not ssd
        if (currentUserType !== 'ssd') {
          const camRes = await fetch('/api/cameras/');
          if (camRes.ok) {
            const camData = await camRes.json();
            setCameras(camData);
            if (camData.length > 0) {
              setCurrentCamera(camData[0]);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
        setError('Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);



  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
        <div className="fixed bottom-0 left-0 w-full z-0">
          <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
        </div>
        <div className="relative flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
        <div className="fixed bottom-0 left-0 w-full z-0">
          <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
        </div>
        <div className="relative flex items-center justify-center min-h-[calc(100vh-80px)]">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</p>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#3f4299] text-white rounded-lg hover:bg-[#2d3170] transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden">
      <div className="fixed bottom-0 left-0 w-full z-0">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>
      {/* Main Dashboard Content */}
      <div className="relative w-full scale-x-85" style={{ zoom: 0.73, marginTop: "20px" }}>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-[50px]">
          {statistics && (
            <>
              {/* Apply scale to StatCard wrappers */}
              <div className="scale-[0.8] origin-top-left w-[125%] h-[125%]">
                <StatCard
                  title={statistics.nonViolators.title}
                  value={statistics.nonViolators.value}
                  percentageChange={statistics.nonViolators.percentageChange}
                  miniChartData={statistics.nonViolators.miniChartData}
                />
              </div>
              <div className="scale-[0.8] origin-top-left w-[125%] h-[125%]">
                <StatCard
                  title={statistics.unauthorized.title}
                  value={statistics.unauthorized.value}
                  percentageChange={statistics.unauthorized.percentageChange}
                  miniChartData={statistics.unauthorized.miniChartData}
                />
              </div>
              <div className="scale-[0.8] origin-top-left w-[125%] h-[125%]">
                <StatCard
                  title={statistics.violators.title}
                  value={statistics.violators.value}
                  percentageChange={statistics.violators.percentageChange}
                  miniChartData={statistics.violators.miniChartData}
                />
              </div>
              <div className="scale-[0.8] origin-top-left w-[125%] h-[125%]">
                <StatCard
                  title={statistics.victors.title}
                  value={statistics.victors.value}
                  percentageChange={statistics.victors.percentageChange}
                  miniChartData={statistics.victors.miniChartData}
                />
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* Left: Pie Chart (1/2 Width) */}
          <div className="col-span-1 w-full flex items-center justify-center">
            <PieChartContainer
              chartData={pieChartData}
              isLoading={loading}
            />
          </div>

          {/* Right: Line Graph (1/2 Width) */}
          <div className="col-span-1 w-full flex items-center justify-center">
            <LineGraphContainer
              chartData={violationOccurrenceData}
              isLoading={loading}
            />
          </div>
        </div>

        <div style={{ height: '40px' }}></div>

        {currentUserType !== 'ssd' && (
        <div className="flex flex-col">
          {/* Top: Camera Selection/Thumbnail Scroller */}
          <div className="w-full mb-2">
            <VideoThumbnails
              selectedCameraId={currentCamera?.camera_id}
              onSelectCamera={(cam) => {
                setCurrentCamera(cam);
              }}
            />
          </div>

          {/* Bottom: Main Video Player */}
          <div className="w-full whitespace-wrap mb-4">
            <VideoPlayer
              streamUrl={currentCamera?.stream_url}
              cameraId={currentCamera?.camera_id}
              cameraName={currentCamera?.name}
              placeholder="Select a camera to view feed"
            />
          </div>
        </div>
        )}
        {/* Bottom Section: ViolationTrendChart (left) and ViolationTimeline (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-5" style={{ marginTop: '20px', marginBottom: '20px' }}>

          {/* Left Column: Violation Trend Chart */}
          <div className="col-span-1 w-full">
            <ViolationTrendChart
              trendData={violationTrendData}
              isLoading={loading}

            />
          </div>

          {/* Right Column: Violation Timeline (Heatmap) */}
          <div className="col-span-1 w-full flex items-center justify-center" style={{ marginBottom: '20px' }}>
            <ViolationTimeline
              timelineData={violationTimelineData}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
