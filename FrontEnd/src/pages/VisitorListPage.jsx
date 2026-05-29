import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const VisitorListPage = () => {
  const [visitors, setVisitors] = useState([]);
  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'all'
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

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
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.host_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Purpose', 'Host', 'Check-in', 'Check-out', 'Duration (hrs)', 'Status'];
    const rows = filteredVisitors.map(v => [
      v.name, 
      v.phone, 
      v.purpose, 
      v.host_name, 
      new Date(v.check_in).toLocaleString(), 
      v.check_out ? new Date(v.check_out).toLocaleString() : 'N/A', 
      activeTab === 'active' ? v.expected_duration : v.duration,
      activeTab === 'active' || v.is_active ? 'Active' : 'Checked Out'
    ]);
    
    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `visitor_logs_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-[#3f4299]">Visitor Directory</h1>
          <button 
            onClick={() => navigate('/guard/dashboard')}
            className="text-gray-600 hover:text-[#3f4299] font-medium transition-colors"
          >
            &larr; Back to Dashboard
          </button>
        </div>

        <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-6 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
            
            <div className="flex bg-gray-100 rounded-lg p-1 w-full md:w-auto h-[48px] items-center border border-gray-200">
              <button 
                onClick={() => setActiveTab('active')}
                className={`flex-1 md:w-32 h-[38px] text-center rounded-[6px] text-[14px] font-semibold transition-all ${activeTab === 'active' ? 'bg-white shadow-sm text-[#3f4299]' : 'text-gray-500 hover:text-gray-700'}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                Active
              </button>
              <button 
                onClick={() => setActiveTab('all')}
                className={`flex-1 md:w-32 h-[38px] text-center rounded-[6px] text-[14px] font-semibold transition-all ${activeTab === 'all' ? 'bg-white shadow-sm text-[#3f4299]' : 'text-gray-500 hover:text-gray-700'}`}
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                All History
              </button>
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <input 
                type="text" 
                placeholder="Search name or host..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 md:w-64 h-[48px] px-4 border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              />
              <button 
                onClick={exportCSV}
                className="px-6 h-[48px] bg-indigo-50 text-[#3f4299] border border-[#3f4299] rounded-[8px] text-[14px] font-medium hover:bg-[#3f4299] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 shadow-sm flex items-center gap-2"
                style={{ fontFamily: "'Open Sans', sans-serif" }}
              >
                Export CSV
              </button>
            </div>

          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Purpose</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Host</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Check-in</th>
                  {activeTab === 'all' && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Check-out</th>}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Duration (hrs)</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700" style={{ fontFamily: "'Open Sans', sans-serif" }}>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredVisitors.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'all' ? 7 : 6} className="p-8 text-center text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>
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
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.purpose}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{visitor.host_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>{new Date(visitor.check_in).toLocaleString([], {hour: '2-digit', minute:'2-digit'})}</td>
                      {activeTab === 'all' && (
                        <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                          {visitor.check_out ? new Date(visitor.check_out).toLocaleString([], {hour: '2-digit', minute:'2-digit'}) : '-'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-600" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                        {activeTab === 'active' ? visitor.expected_duration : visitor.duration} h
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(activeTab === 'active' || visitor.is_active) ? (
                          <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-semibold border border-green-200">Active</span>
                        ) : (
                          <span className="inline-block bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-semibold border border-gray-200">Checked Out</span>
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
