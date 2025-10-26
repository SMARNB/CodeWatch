import React, { useState } from 'react';

const DashboardPage = () => {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  
  // Mock data for demonstration
  const videoFeeds = [
    { id: 1, title: 'Camera 1', status: 'Live' },
    { id: 2, title: 'Camera 2', status: 'Live' },
    { id: 3, title: 'Camera 3', status: 'Live' },
    { id: 4, title: 'Camera 4', status: 'Live' }
  ];

  const violationLogs = [
    { id: 1, time: '14:30', type: 'Dress Code Violation', location: 'Main Entrance', severity: 'Medium' },
    { id: 2, time: '14:25', type: 'Unauthorized Access', location: 'Side Door', severity: 'High' },
    { id: 3, time: '14:20', type: 'Visitor Without Badge', location: 'Reception', severity: 'Low' },
    { id: 4, time: '14:15', type: 'Dress Code Violation', location: 'Cafeteria', severity: 'Medium' },
    { id: 5, time: '14:10', type: 'Unauthorized Access', location: 'Parking Lot', severity: 'High' }
  ];

  const violationStats = {
    total: 50,
    thisWeek: 12,
    today: 5
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Security Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <button className="p-2 text-gray-400 hover:text-gray-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 00-15 0v5h5l-5 5-5-5h5v-5a7.5 7.5 0 0115 0v5z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">U</span>
                </div>
                <span className="text-sm font-medium text-gray-700">username</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Live Video Feed Section - 1/3 width on desktop */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Live Video Feed</h2>
                <p className="text-sm text-gray-500">Real-time monitoring</p>
              </div>
              
              {/* Video Player */}
              <div className="p-4">
                <div className="relative bg-gray-900 rounded-lg aspect-video mb-4">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-2">
                        <div className="w-4 h-4 bg-white rounded-full animate-pulse"></div>
                      </div>
                      <p className="text-sm">LIVE</p>
                      <p className="text-xs text-gray-300">Camera {currentVideoIndex + 1}</p>
                    </div>
                  </div>
                  {/* Video controls overlay */}
                  <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                    <button className="bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                      {videoFeeds[currentVideoIndex]?.title}
                    </button>
                    <div className="flex space-x-1">
                      <button className="bg-black bg-opacity-50 text-white p-1 rounded">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button className="bg-black bg-opacity-50 text-white p-1 rounded">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Camera Selection */}
                <div className="grid grid-cols-2 gap-2">
                  {videoFeeds.map((feed, index) => (
                    <button
                      key={feed.id}
                      onClick={() => setCurrentVideoIndex(index)}
                      className={`p-2 rounded border text-left transition-colors ${
                        currentVideoIndex === index
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{feed.title}</span>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-xs text-gray-500">{feed.status}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Violation Log Section - 2/3 width on desktop */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Real-Time Violation Log</h2>
                    <p className="text-sm text-gray-500">Live security monitoring</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-blue-600">{violationStats.today}</p>
                      <p className="text-xs text-gray-500">Today</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-600">{violationStats.thisWeek}</p>
                      <p className="text-xs text-gray-500">This Week</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-800">{violationStats.total}</p>
                      <p className="text-xs text-gray-500">Total</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Violation Log List */}
              <div className="p-4">
                <div className="space-y-3">
                  {violationLogs.map((violation) => (
                    <div
                      key={violation.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          violation.severity === 'High' ? 'bg-red-500' :
                          violation.severity === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{violation.type}</p>
                          <p className="text-xs text-gray-500">{violation.location}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">{violation.time}</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          violation.severity === 'High' ? 'bg-red-100 text-red-800' :
                          violation.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {violation.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                <div className="mt-4 text-center">
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Load More Violations
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Stats Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Cameras</p>
                <p className="text-2xl font-bold text-gray-900">{videoFeeds.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">System Status</p>
                <p className="text-2xl font-bold text-green-600">Online</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Last Update</p>
                <p className="text-2xl font-bold text-gray-900">2 min ago</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
