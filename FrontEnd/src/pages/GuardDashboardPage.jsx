import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';

const GuardDashboardPage = () => {
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [stats, setStats] = useState({
    activeCount: 0,
    checkedOutToday: 0,
    expectedDepartures: 0
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const navigate = useNavigate();

  const fetchActiveVisitors = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/visitors/active/');
      if (response.ok) {
        const data = await response.json();
        setActiveVisitors(data);

        // Calculate stats
        const activeCount = data.length;
        const expectedDepartures = data.filter(v => v.time_remaining_sec > 0 && v.time_remaining_sec <= 3600).length;

        setStats(prev => ({ ...prev, activeCount, expectedDepartures }));
      }
    } catch (error) {
      console.error('Error fetching active visitors:', error);
    }
  };

  const fetchAllVisitors = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/visitors/');
      if (response.ok) {
        const data = await response.json();
        const today = new Date().toDateString();
        const checkedOutToday = data.filter(v => !v.is_active && new Date(v.check_out).toDateString() === today).length;
        setStats(prev => ({ ...prev, checkedOutToday }));
      }
    } catch (error) {
      console.error('Error fetching all visitors:', error);
    }
  };

  useEffect(() => {
    fetchActiveVisitors();
    fetchAllVisitors();

    const interval = setInterval(() => {
      fetchActiveVisitors();
      setCurrentTime(new Date());
    }, 30000); // refresh every 30 seconds

    const timerInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timerInterval);
    };
  }, []);

  const handleCheckout = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/api/visitors/checkout/${id}/`, {
        method: 'POST',
      });
      if (response.ok) {
        fetchActiveVisitors();
        fetchAllVisitors();
      } else {
        alert('Failed to checkout visitor');
      }
    } catch (error) {
      console.error('Error checking out visitor:', error);
    }
  };

  const handleExtend = async (id) => {
    try {
      const response = await fetch(`http://localhost:8000/api/visitors/extend/${id}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ additional_hours: 1 })
      });
      if (response.ok) {
        fetchActiveVisitors();
      } else {
        alert('Failed to extend visitor');
      }
    } catch (error) {
      console.error('Error extending visitor:', error);
    }
  };

  const getTimerStyle = (sec, isOverdue) => {
    if (isOverdue) return 'text-red-600 font-bold';
    if (sec < 1800) return 'text-yellow-600 font-bold'; // less than 30 mins
    return 'text-green-600 font-bold';
  };

  return (
    <div className="font-sans pb-10">
      <div className="w-full mx-auto" style={{ paddingLeft: '150px', paddingRight: '150px', marginTop: '40px' }}>
        <div style={{ marginBottom: '20px' }}>
          <h1 className="text-3xl font-bold text-[#3f4299]">Guard Dashboard</h1>
          <p className="text-gray-600 text-lg font-medium mt-1">{currentTime.toLocaleString()}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6" style={{ marginBottom: '20px' }}>
          <div className="w-full">
            <StatCard
              title="Active Visitors"
              value={stats.activeCount}
              percentageChange={"+0%"}
            />
          </div>
          <div className="w-full">
            <StatCard
              title="Checked Out Today"
              value={stats.checkedOutToday}
              percentageChange={"+0%"}
            />
          </div>
          <div className="w-full">
            <StatCard
              title="Expected Departures (1h)"
              value={stats.expectedDepartures}
              percentageChange={"+0%"}
            />
          </div>
        </div>

        <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden mb-[10px] p-[10px]">
          <div className="pb-[10px] border-b border-gray-200 pl-[10px]">
            <h2 className="text-xl font-bold text-[#3f4299]" style={{ paddingLeft: '10px', }}>Active Visitors</h2>
          </div>
          <div className="overflow-x-auto pt-[10px]" style={{ paddingLeft: '10px', paddingRight: '10px' }}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Purpose</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Host</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Department</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Check-in Time</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Time Remaining</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {activeVisitors.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>No active visitors right now.</td>
                  </tr>
                ) : (
                  activeVisitors.map(visitor => (
                    <tr key={visitor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.phone}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.purpose}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.host_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.host_department}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{new Date(visitor.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className={`px-4 py-3 text-sm ${getTimerStyle(visitor.time_remaining_sec, visitor.is_overdue)}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${visitor.is_overdue ? 'bg-red-100 text-red-800 border-red-200' : visitor.time_remaining_sec < 1800 ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
                          {visitor.time_remaining}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center space-x-2">
                        <button
                          onClick={() => handleCheckout(visitor.id)}
                          className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded text-xs font-medium transition-colors shadow-sm"
                          style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                          Checkout
                        </button>
                        <button
                          onClick={() => handleExtend(visitor.id)}
                          className="px-3 py-1 bg-indigo-50 text-[#3f4299] hover:bg-[#3f4299] hover:text-white border border-[#3f4299] rounded text-xs font-medium transition-colors shadow-sm"
                          style={{ fontFamily: "'Open Sans', sans-serif" }}
                        >
                          +1h
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardDashboardPage;
