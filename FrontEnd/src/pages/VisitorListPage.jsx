import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';

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
        const response = await fetch('/api/people-db/');
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
        ? '/api/visitors/active/'
        : '/api/visitors/';
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
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px clamp(16px, 4vw, 32px)' }}>
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

          <div className="flex gap-6 w-full md:w-auto relative items-center">
            <div className="relative flex items-center flex-1 md:w-80">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                list="known-people-list"
                placeholder="Search name or host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-4 py-[7px] text-sm bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-transparent focus:bg-white transition-all"
                style={{ fontFamily: "'Open Sans', sans-serif", paddingLeft: '32px' }}
              />
            </div>
            <datalist id="known-people-list">
              {knownPeople.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <div className="relative flex-shrink-0">
              <Button 
                variant="primary"
                onClick={handleExportClick}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                Export CSV
              </Button>
              {showExportMenu && !searchQuery && (
                <div 
                  className="absolute right-0 mt-2 bg-white rounded-[8px] z-50 flex flex-col border border-gray-200 overflow-hidden" 
                  style={{ 
                    minWidth: '160px', 
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', 
                    fontFamily: "'Open Sans', sans-serif" 
                  }}
                >
                  <button onClick={() => exportByPeriod('today')} className="w-full text-left cursor-pointer transition-colors border-b border-gray-100 hover:bg-gray-50 bg-white" style={{ padding: '10px 16px' }}>
                    <span className="text-gray-700 font-medium" style={{ fontSize: '14px' }}>Today</span>
                  </button>
                  <button onClick={() => exportByPeriod('month')} className="w-full text-left cursor-pointer transition-colors border-b border-gray-100 hover:bg-gray-50 bg-white" style={{ padding: '10px 16px' }}>
                    <span className="text-gray-700 font-medium" style={{ fontSize: '14px' }}>This Month</span>
                  </button>
                  <button onClick={() => exportByPeriod('year')} className="w-full text-left cursor-pointer transition-colors hover:bg-gray-50 bg-white" style={{ padding: '10px 16px' }}>
                    <span className="text-gray-700 font-medium" style={{ fontSize: '14px' }}>This Year</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Name</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Purpose</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Host</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Check-in</th>
                  {activeTab === 'all' && <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Check-out</th>}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "'Open Sans', sans-serif" }}>Duration (hrs)</th>
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
                      <td className="px-4 py-3 text-center">
                        <p className="font-semibold text-sm text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.name}</p>
                        <p className="text-xs text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.phone}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.purpose}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.host_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>{new Date(visitor.check_in).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      {activeTab === 'all' && (
                        <td className="px-4 py-3 text-sm text-gray-700 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          {visitor.check_out ? new Date(visitor.check_out).toLocaleString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-700 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>
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
