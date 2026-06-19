import React, { useState, useEffect } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import backgroundEllipse from '../assets/background.svg';

// Mirrors the backend DressCodeRule choices. Status carries the colour vocabulary used across the
// app (green=ok, red=violation, grey=neutral) shown as a dot + tinted text in a segmented control.
const STATUS_OPTIONS = [
  { value: 'compliant', label: 'Compliant', dot: 'bg-green-500', text: 'text-green-700' },
  { value: 'violation', label: 'Violation', dot: 'bg-red-500', text: 'text-red-600' },
  { value: 'neutral', label: 'Neutral', dot: 'bg-gray-400', text: 'text-gray-700' },
];
const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'any', label: 'Any' },
];

// 'm-button-down' -> 'Button Down', 'outerwear' -> 'Outerwear'
const humanize = (cls) =>
  cls.replace(/^[mw]-/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

const ManageDressCodePage = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [toast, setToast] = useState('');
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });

  const fetchRules = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const response = await fetch('/api/dress-code-rules/');
      if (response.ok) {
        setRules(await response.json());
      } else {
        setAlertData({ isOpen: true, message: 'Failed to load dress-code policy.' });
      }
    } catch (error) {
      console.error('Failed to fetch dress-code rules:', error);
      setAlertData({ isOpen: true, message: 'Failed to load dress-code policy.' });
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // PATCH one field, optimistically updating the row and reverting on failure.
  const updateRule = async (rule, changes) => {
    const prev = { status: rule.status, gender: rule.gender };
    setSavingId(rule.id);
    setRules(rs => rs.map(r => (r.id === rule.id ? { ...r, ...changes } : r)));
    try {
      const response = await fetch(`/api/dress-code-rules/${rule.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!response.ok) {
        setRules(rs => rs.map(r => (r.id === rule.id ? { ...r, ...prev } : r)));
        setAlertData({
          isOpen: true,
          message: response.status === 403
            ? 'You do not have permission to change the dress-code policy (admin / SSD only).'
            : 'Failed to save change.',
        });
      } else {
        const saved = await response.json();
        setRules(rs => rs.map(r => (r.id === rule.id ? { ...r, ...saved } : r)));
        showToast(`${humanize(rule.clothing_class)} updated`);
      }
    } catch (err) {
      console.error(err);
      setRules(rs => rs.map(r => (r.id === rule.id ? { ...r, ...prev } : r)));
      setAlertData({ isOpen: true, message: 'Failed to save change.' });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f3ff] relative overflow-hidden font-['Open_Sans']">
      {/* Background */}
      <div className="fixed bottom-0 left-0 w-full z-0">
        <img alt="" className="block max-w-none size-full" src={backgroundEllipse} />
      </div>

      {/* Main Content */}
      <div className="relative w-full" style={{ paddingTop: '100px', paddingLeft: 'clamp(16px, 5vw, 100px)', paddingRight: 'clamp(16px, 5vw, 100px)' }}>
        <div className="flex w-full">
          <div className="flex-1 min-w-0">

            <p className="text-sm text-gray-500" style={{ marginBottom: '16px' }}>
              Set how the detector treats each clothing item. Changes save instantly and the detection engine applies them within about a minute.
            </p>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-12" style={{ marginBottom: '20px' }}>
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-[#3f4299] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading dress-code policy...</p>
                </div>
              </div>
            ) : rules.length === 0 ? (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 p-12 text-center" style={{ marginBottom: '20px' }}>
                <p className="text-gray-500 text-lg">No dress-code rules found.</p>
              </div>
            ) : (
              <div className="bg-white rounded-[8px] shadow-sm border border-gray-200 overflow-hidden" style={{ marginBottom: '20px' }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-8 align-middle text-center text-base font-semibold text-gray-700">Clothing Item</th>
                        <th className="px-4 py-8 align-middle text-center text-base font-semibold text-gray-700">Applies To</th>
                        <th className="px-4 py-8 align-middle text-center text-base font-semibold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rules.map((rule) => {
                        const busy = savingId === rule.id;
                        return (
                          <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-8 align-middle text-center">
                              <div className="text-sm font-medium text-gray-900">{humanize(rule.clothing_class)}</div>
                              <div className="text-xs text-gray-400 font-mono mt-0.5">{rule.clothing_class}</div>
                            </td>

                            {/* Applies To (gender) — segmented control */}
                            <td className="px-4 py-8 align-middle text-center">
                              <div className={`inline-flex items-center gap-3 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                                {GENDER_OPTIONS.map(opt => {
                                  const active = rule.gender === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      onClick={() => { if (!active) updateRule(rule, { gender: opt.value }); }}
                                      className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${active ? 'text-[#3f4299]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                                    >
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Status — segmented control with status dot */}
                            <td className="px-4 py-8 align-middle text-center">
                              <div className={`inline-flex items-center gap-3 ${busy ? 'opacity-60 pointer-events-none' : ''}`}>
                                {STATUS_OPTIONS.map(opt => {
                                  const active = rule.status === opt.value;
                                  return (
                                    <button
                                      key={opt.value}
                                      onClick={() => { if (!active) updateRule(rule, { status: opt.value }); }}
                                      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full transition-all ${active ? opt.text : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                                    >
                                      <span className={`w-2 h-2 rounded-full ${active ? opt.dot : 'bg-gray-300'}`}></span>
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in-up">
          {toast}
        </div>
      )}

      <ConfirmModal
        isOpen={alertData.isOpen}
        onClose={() => setAlertData(s => ({ ...s, isOpen: false }))}
        onConfirm={() => setAlertData(s => ({ ...s, isOpen: false }))}
        title="Notice"
        message={alertData.message}
        confirmText="OK"
        hideCancel={true}
      />
    </div>
  );
};

export default ManageDressCodePage;
