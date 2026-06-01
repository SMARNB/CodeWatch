import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const VisitorListPage = () => {
  const [visitors, setVisitors] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [knownPeople, setKnownPeople] = useState([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchKnownPeople = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/people-db/');
        if (response.ok) {
          const data = await response.json();
          setKnownPeople(data);
        }
      } catch (error) {
        console.error('Error fetching people:', error);
      }
    };
    fetchKnownPeople();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchVisitors = async () => {
    try {
      const endpoint = activeTab === 'active' 
        ? 'http://localhost:8000/api/visitors/active/' 
        : 'http://localhost:8000/api/visitors/';
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setVisitors(data);
      }
    } catch (error) {
      console.error('Error fetching visitors:', error);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, [activeTab]);

  const filteredVisitors = visitors.filter(v => 
    v.name.toLowerCase().includes(debouncedQuery.toLowerCase()) || 
    v.host_name.toLowerCase().includes(debouncedQuery.toLowerCase())
  );

  const exportCSV = (data) => {
    const headers = ['Name', 'Phone', 'Purpose', 'Host', 'Check-in', 'Check-out', 'Duration (hrs)', 'Status'];
    const rows = data.map(v => [
      v.name, 
      v.phone,
      v.purpose, 
      v.host_name, 
      v.check_in ? new Date(v.check_in).toLocaleString() : 'N/A', 
      v.check_out ? new Date(v.check_out).toLocaleString() : 'N/A', 
      activeTab === 'active' ? v.expected_duration : v.duration,
      activeTab === 'active' || v.is_active ? 'Active' : 'Checked Out'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visitor-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportByPeriod = (period) => {
    const now = new Date();
    let dataToExport = filteredVisitors;
    
    if (period === 'today') {
      dataToExport = filteredVisitors.filter(v => {
        if (!v.check_in) return false;
        const checkInDate = new Date(v.check_in);
        return checkInDate.toDateString() === now.toDateString();
      });
    } else if (period === 'month') {
      dataToExport = filteredVisitors.filter(v => {
        if (!v.check_in) return false;
        const checkInDate = new Date(v.check_in);
        return checkInDate.getMonth() === now.getMonth() && checkInDate.getFullYear() === now.getFullYear();
      });
    } else if (period === 'year') {
      dataToExport = filteredVisitors.filter(v => {
        if (!v.check_in) return false;
        const checkInDate = new Date(v.check_in);
        return checkInDate.getFullYear() === now.getFullYear();
      });
    }
    
    exportCSV(dataToExport);
    setShowExportMenu(false);
  };

  const handleExportClick = () => {
    if (searchQuery) {
      exportCSV(filteredVisitors);
    } else {
      setShowExportMenu(!showExportMenu);
    }
  };

  return (
    <div className="font-sans">
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 32px' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: '20px' }}>
          <h1 className="text-3xl font-bold text-[#3f4299]" style={{ fontFamily: "'Open Sans', sans-serif" }}>Visitor Directory</h1>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-4" style={{ marginBottom: '20px' }}>
          <div className="flex bg-white rounded-lg shadow-sm px-4 h-[48px] items-center border border-gray-100">
            <button 
              onClick={() => setActiveTab('active')}
              className={`md:w-32 h-full flex items-center justify-center text-sm transition-all ${activeTab === 'active' ? 'text-[#3f4299] border-b-2 border-[#3f4299] font-semibold' : 'text-gray-400 hover:text-[#3f4299] border-b-2 border-transparent'}`}
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              Active
            </button>
            <button 
              onClick={() => setActiveTab('all')}
              className={`md:w-32 h-full flex items-center justify-center text-sm transition-all ${activeTab === 'all' ? 'text-[#3f4299] border-b-2 border-[#3f4299] font-semibold' : 'text-gray-400 hover:text-[#3f4299] border-b-2 border-transparent'}`}
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            >
              All History
            </button>
          </div>

          <div className="flex gap-4 w-full md:w-auto relative">
            <input 
              type="text" 
              list="known-people-list"
              placeholder="Search name or host..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 md:w-80 h-[40px] px-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
              style={{ fontFamily: "'Open Sans', sans-serif" }}
            />
            <datalist id="known-people-list">
              {knownPeople.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <div className="relative">
              <button 
                onClick={handleExportClick}
                className="px-4 py-2 bg-[#3f4299] text-white rounded-md text-sm font-medium hover:bg-[#2d3170] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 flex items-center justify-center gap-2 h-[40px]"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                Export CSV
              </button>
              {showExportMenu && !searchQuery && (
                <div className="absolute right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                  <button onClick={() => exportByPeriod('today')} className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors">Today</button>
                  <button onClick={() => exportByPeriod('month')} className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors">This Month</button>
                  <button onClick={() => exportByPeriod('year')}  className="block w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors">This Year</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Purpose</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Host</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Check-in</th>
                  {activeTab === 'all' && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Check-out</th>}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Duration (hrs)</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'all' ? 7 : 6} className="py-10 text-center text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                      No visitors found.
                    </td>
                  </tr>
                ) : (
                  filteredVisitors.map(visitor => (
                    <tr key={visitor.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-sm text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.name}</p>
                        <p className="text-xs text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.purpose}</td>
                      <td className="px-4 py-3 text-sm text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.host_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>{new Date(visitor.check_in).toLocaleString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      {activeTab === 'all' && (
                        <td className="px-4 py-3 text-sm text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          {visitor.check_out ? new Date(visitor.check_out).toLocaleString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        {activeTab === 'active' ? visitor.expected_duration : visitor.duration} h
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(activeTab === 'active' || visitor.is_active) ? (
                          <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold border border-green-200" style={{ fontFamily: "'Open Sans', sans-serif" }}>Active</span>
                        ) : (
                          <span className="inline-block bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold border border-gray-200" style={{ fontFamily: "'Open Sans', sans-serif" }}>Checked Out</span>
                        )}
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

export default VisitorListPage;
