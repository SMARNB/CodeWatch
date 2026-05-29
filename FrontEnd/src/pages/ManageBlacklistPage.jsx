import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import UserProfileCard from '../components/UserProfileCard';
import Logo from '../components/Logo';
import backgroundEllipse from '../assets/background.svg';

const ManageBlacklistPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [blacklist, setBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);

  useEffect(() => {
    const userType = localStorage.getItem('userType') || 'admin';
    const userEmail = localStorage.getItem('userEmail') || 'admin@company.com';
    const userDisplayName = localStorage.getItem('userDisplayName') || 'User';
    setUser({ name: userDisplayName, email: userEmail, employeeId: 'ADM001' });
  }, []);

  const fetchBlacklist = async () => {
    try {
      setLoading(true);
      const [blacklistRes, peopleRes] = await Promise.all([
        fetch('/api/blacklist/'),
        fetch('/api/people-db/')
      ]);

      if (!blacklistRes.ok || !peopleRes.ok) throw new Error("Failed to fetch data");

      const blacklistData = await blacklistRes.json();
      const peopleData = await peopleRes.json();

      const peopleMap = peopleData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

      const merged = blacklistData.map(entry => ({
        ...entry,
        employee_id: peopleMap[entry.person_id]?.employee_id || 'N/A',
        department: peopleMap[entry.person_id]?.department || 'N/A',
        photo_url: peopleMap[entry.person_id]?.photo_url || null,
        violation_count: peopleMap[entry.person_id]?.violation_count || 0
      }));

      setBlacklist(merged);
    } catch (err) {
      console.error(err);
      showToast("Failed to load blacklist data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlacklist();
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleRemove = async (id, name) => {
    if (window.confirm(`Are you sure you want to remove ${name} from the blacklist?`)) {
      try {
        const res = await fetch(`/api/blacklist/${id}/`, { method: 'DELETE' });
        if (res.ok) {
          showToast(`Successfully removed ${name} from blacklist`);
          fetchBlacklist();
        } else {
          showToast("Failed to remove from blacklist");
        }
      } catch (err) {
        showToast("Error occurred while deleting");
      }
    }
  };

  const filteredBlacklist = blacklist.filter(entry =>
    !searchTerm ||
    entry.person_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalBlacklisted = blacklist.length;
  const autoBlacklisted = blacklist.filter(e => e.blacklist_type === 'Auto').length;
  const manualBlacklisted = totalBlacklisted - autoBlacklisted;

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden font-['Open_Sans']">
      {/* Background */}
      <div className="absolute h-[1198px] left-1/2 top-[599px] translate-x-[-50%] w-[2040px]">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Navbar */}
      <div className="relative bg-white shadow-sm border-b border-gray-200 w-full h-[100px]">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
          <div className="flex items-center" style={{ marginLeft: '50px' }}>
            <Logo size="default" showText={false} />
          </div>
          <div className="flex-1 flex justify-center">
            <h1 className="text-2xl font-bold text-[#3f4299]">Code Watch</h1>
          </div>
          <div className="w-16"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative w-full pb-12 flex gap-8" style={{ paddingLeft: '64px', paddingRight: '64px', marginTop: '100px' }}>
        <div className="flex-1">

          {/* Header */}
          <div className="flex items-center justify-between" style={{ marginBottom: '30px' }}>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="w-10 h-10 flex items-center justify-center text-gray-600 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-3xl font-bold text-[#3f4299]">Blacklist Management</h2>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-red-600 text-white font-semibold rounded-lg shadow-sm hover:bg-red-700 transition-colors flex items-center gap-2"
              style={{ padding: '5px' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add to Blacklist
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 w-full" style={{ marginBottom: '30px' }}>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-gray-500 text-sm font-semibold mb-1">Total Blacklisted</div>
              <div className="text-3xl font-bold text-gray-900">{totalBlacklisted}</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-gray-500 text-sm font-semibold mb-1">Auto-Blacklisted</div>
              <div className="text-3xl font-bold text-orange-600">{autoBlacklisted}</div>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 text-center">
              <div className="text-gray-500 text-sm font-semibold mb-1">Manually Blacklisted</div>
              <div className="text-3xl font-bold text-red-600">{manualBlacklisted}</div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex flex-wrap items-center gap-4 w-full" style={{ marginBottom: '30px' }}>
            <input
              type="text"
              placeholder="Search by name or employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
              style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-12 h-12 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div></div>
          ) : filteredBlacklist.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">No blacklist entries found.</div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Person</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Employee ID</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Reason</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Threshold</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Date Added</th>
                    <th className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredBlacklist.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors border-b border-gray-100">
                      <td className="px-4 py-3 flex items-center gap-3">
                        {entry.photo_url ? (
                          <img src={entry.photo_url} alt="profile" className="w-10 h-10 rounded-full object-cover shadow-sm" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500">{entry.person_name.charAt(0)}</div>
                        )}
                        <span className="font-semibold text-gray-900">{entry.person_name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.employee_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.department}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={entry.reason}>{entry.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 text-xs font-bold rounded-full ${entry.blacklist_type === 'Auto' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'}`}>
                          {entry.blacklist_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-semibold">{entry.violation_threshold}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(entry.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button onClick={() => { setSelectedEntry(entry); setIsProfileModalOpen(true); }} className="text-gray-400 hover:text-[#3f4299]" title="View Profile">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>
                          <button onClick={() => { setSelectedEntry(entry); setIsEditModalOpen(true); }} className="text-gray-400 hover:text-blue-600" title="Edit">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => handleRemove(entry.id, entry.person_name)} className="text-gray-400 hover:text-red-600" title="Remove">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="w-80 flex-shrink-0">
          <div className="sticky top-8">
            {user && <UserProfileCard user={user} />}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-up">
          {toastMessage}
        </div>
      )}

      {/* Add Modals here */}
      <AddBlacklistModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAdd={() => { setIsAddModalOpen(false); fetchBlacklist(); showToast("Added to blacklist successfully"); }} currentBlacklistIds={blacklist.map(e => e.person_id)} />
      <EditBlacklistModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} entry={selectedEntry} onEdit={() => { setIsEditModalOpen(false); fetchBlacklist(); showToast("Blacklist updated"); }} />
      <ViewProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} entry={selectedEntry} navigate={navigate} />
    </div>
  );
};

/* --- ADD MODAL --- */
const AddBlacklistModal = ({ isOpen, onClose, onAdd, currentBlacklistIds }) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [reason, setReason] = useState('');
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (search.length > 2) {
      fetch(`/api/search/?q=${encodeURIComponent(search)}`)
        .then(r => r.json())
        .then(data => {
          if (data.people) {
            const available = data.people.filter(p => !currentBlacklistIds.includes(p.id));
            setResults(available);
          }
        });
    } else {
      setResults([]);
    }
  }, [search, currentBlacklistIds]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPerson || !reason.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/blacklist/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ person_id: selectedPerson.id, reason, violation_threshold: threshold })
      });
      if (res.ok) onAdd();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" style={{ padding: "10px", paddingLeft: "10px" }}>
        <div className="relative flex justify-center items-center mb-6" style={{ marginBottom: "10px", marginTop: "10px" }}>
          <h3 className="text-[25px] font-bold text-[#3f4299] m-[100px]">Add to Blacklist</h3>
          <button onClick={onClose} className="absolute right-0 text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          {!selectedPerson ? (
            <div className="mb-4">
              <label className="block text-m font-semibold text-gray-700 mb-1" style={{ marginBottom: "5px" }}>Search Person</label>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type name or ID..." className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ marginBottom: "10px", padding: "5px" }} />
              {results.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                  {results.map(p => (
                    <div key={p.id} onClick={() => setSelectedPerson(p)} className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between border-b last:border-b-0">
                      <div><div className="font-semibold text-sm">{p.name}</div><div className="text-xs text-gray-500">{p.employee_id} • {p.department}</div></div>
                      <button type="button" className="text-xs text-[#3f4299] font-bold">Select</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4 bg-gray-50 p-4 rounded-lg flex justify-between items-center border">
              <div>
                <div className="font-bold text-gray-900">{selectedPerson.name}</div>
                <div className="text-xs text-gray-500">{selectedPerson.employee_id}</div>
              </div>
              <button type="button" onClick={() => setSelectedPerson(null)} className="text-sm text-gray-500 underline">Change</button>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-m font-semibold text-gray-700 mb-1" style={{ marginBottom: "5px" }}>Reason for Blacklisting</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} required rows="3" className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ marginBottom: "10px", padding: "5px" }}></textarea>
          </div>
          <div className="mb-4">
            <label className="block text-m font-semibold text-gray-700 mb-1" style={{ marginBottom: "5px" }}>Violation Threshold</label>
            <input type="number" min="1" value={threshold} onChange={e => setThreshold(e.target.value)} required className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]" style={{ marginBottom: "20px", padding: "5px" }} />
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button type="submit" disabled={!selectedPerson || !reason || loading} className="btn btn-primary btn-default text-white font-bold rounded-lg min-w-[100px]">Confirm Blacklist</button>
          </div>
        </form>
      </div>
    </div >
  );
};

/* --- EDIT MODAL --- */
const EditBlacklistModal = ({ isOpen, onClose, entry, onEdit }) => {
  const [reason, setReason] = useState('');
  const [threshold, setThreshold] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (entry) {
      setReason(entry.reason);
      setThreshold(entry.violation_threshold);
    }
  }, [entry]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/blacklist/${entry.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, violation_threshold: threshold })
      });
      if (res.ok) onEdit();
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Edit Blacklist Entry</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border">
            <div>
              <div className="font-bold text-gray-900">{entry.person_name}</div>
              <div className="text-xs text-gray-500">{entry.employee_id} • {entry.department}</div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} required rows="3" className="w-full px-4 py-2 border rounded-lg focus:ring-[#3f4299]"></textarea>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Violation Threshold</label>
            <input type="number" min="1" value={threshold} onChange={e => setThreshold(e.target.value)} required className="w-full px-4 py-2 border rounded-lg focus:ring-[#3f4299]" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-[#3f4299] text-white rounded-lg hover:bg-[#2d3170] disabled:opacity-50">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* --- VIEW PROFILE MODAL --- */
const ViewProfileModal = ({ isOpen, onClose, entry, navigate }) => {
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && entry) {
      setLoading(true);
      fetch(`/api/live-track/${entry.person_id}/`)
        .then(r => r.json())
        .then(data => setProfileData(data))
        .finally(() => setLoading(false));
    }
  }, [isOpen, entry]);

  if (!isOpen || !entry) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50">
      <div className="bg-white h-full w-full max-w-md shadow-2xl p-6 overflow-y-auto animate-fade-in-right">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Blacklisted Profile</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin"></div></div>
        ) : profileData && profileData.person ? (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {profileData.person.profile_picture ? (
                <img src={profileData.person.profile_picture} alt="profile" className="w-20 h-20 rounded-full object-cover shadow-sm border" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-500 text-2xl">{profileData.person.name.charAt(0)}</div>
              )}
              <div>
                <h4 className="font-bold text-xl text-gray-900">{profileData.person.name}</h4>
                <p className="text-sm text-gray-500">{profileData.person.employee_id} • {profileData.person.department}</p>
                <div className="mt-1">
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-800">Blacklisted</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
              <h5 className="font-bold text-sm text-gray-700 mb-2">Blacklist Details</h5>
              <p className="text-sm text-gray-600 mb-1"><span className="font-semibold">Reason:</span> {entry.reason}</p>
              <p className="text-sm text-gray-600 mb-1"><span className="font-semibold">Type:</span> {entry.blacklist_type}</p>
              <p className="text-sm text-gray-600"><span className="font-semibold">Date Added:</span> {new Date(entry.created_at).toLocaleDateString()}</p>
            </div>

            <div>
              <h5 className="font-bold text-sm text-gray-700 mb-3">Recent Movement ({profileData.movement_history?.length || 0})</h5>
              {profileData.movement_history && profileData.movement_history.length > 0 ? (
                <div className="space-y-3 relative pl-4 border-l-2 border-gray-200">
                  {profileData.movement_history.slice(0, 5).map((m, i) => (
                    <div key={i} className="relative">
                      <div className="absolute w-3 h-3 bg-gray-300 rounded-full -left-[23px] top-1 border-2 border-white"></div>
                      <div className="text-sm font-semibold text-gray-800">{m.camera_name}</div>
                      <div className="text-xs text-gray-500">{new Date(m.entered_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No recent movement data.</p>
              )}
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={() => navigate(`/live-track/${entry.person_id}`)}
                className="w-full py-3 bg-[#3f4299] text-white font-bold rounded-xl hover:bg-[#2d3170] transition-colors"
              >
                Start Live Tracking
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Failed to load profile data.</p>
        )}
      </div>
    </div>
  );
};

export default ManageBlacklistPage;
