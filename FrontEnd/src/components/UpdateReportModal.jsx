import React, { useState, useEffect, useRef } from 'react';
import ConfirmModal from './ConfirmModal';

const INCIDENT_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
];
const ANALYTICS_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'archived', label: 'Archived' },
];

const StatusDropdown = ({ value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || { label: value, value: value };

  return (
    <div className="relative w-full" ref={dropdownRef} style={{ marginBottom: '16px' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border rounded-[8px] h-[48px] text-[14px] font-normal bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299] text-gray-900 ${isOpen ? 'ring-2 ring-[#3f4299] border-[#3f4299]' : 'border-[#bab6b6]'}`}
        style={{ padding: '0 10px', fontFamily: "'Open Sans', sans-serif" }}
      >
        <span className="truncate mr-2 flex-1 text-left">{selectedOption.label}</span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {isOpen && (
        <div
          className="absolute bg-white rounded-[8px] z-50 flex flex-col border border-gray-200"
          style={{
            top: '100%',
            left: 0,
            minWidth: '100%',
            marginTop: '4px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            fontFamily: "'Open Sans', sans-serif"
          }}
        >
          <div className="bg-white rounded-[8px] py-1 max-h-[200px] overflow-y-auto">
            {options.map((o) => {
              const isSelected = value === o.value;
              return (
                <div
                  key={o.value}
                  className={`flex items-center cursor-pointer transition-colors border-b border-gray-100 ${isSelected ? 'bg-[#f8f9ff] hover:bg-gray-50' : 'hover:bg-gray-50 bg-white'}`}
                  style={{ padding: '12px 10px' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onChange(o.value);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={`flex-1 ${isSelected ? 'text-[#3f4299] font-bold' : 'text-gray-700 font-medium'}`}
                    style={{ fontSize: '14px' }}
                  >
                    {o.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const UpdateReportModal = ({ isOpen, onClose, report, onSaved }) => {
  const isAnalytics = ((report?.type || '')).toLowerCase().includes('analytics');
  const statuses = isAnalytics ? ANALYTICS_STATUSES : INCIDENT_STATUSES;
  const canBlacklist = !!report?.related_person_id;

  const [status, setStatus] = useState('new');
  const [note, setNote] = useState('');
  const [blacklist, setBlacklist] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertData, setAlertData] = useState({ isOpen: false, message: '' });

  useEffect(() => {
    if (isOpen && report) {
      setStatus(report.status || 'new');
      setNote(report.note || '');
      setBlacklist(false);
      setPinned(!!report.isPinned);
    }
  }, [isOpen, report]);

  if (!isOpen || !report) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/update-report/${report.id}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note, blacklist, is_pinned: pinned }),
      });
      if (res.ok) {
        if (onSaved) onSaved({ status, note, is_pinned: pinned });
        onClose();
      } else {
        setAlertData({ isOpen: true, message: 'Failed to update the report.' });
      }
    } catch (e) {
      console.error(e);
      setAlertData({ isOpen: true, message: 'Failed to update the report.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div
        className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        style={{ fontFamily: "'Open Sans', sans-serif", boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white flex justify-between items-center relative border-b border-gray-100" style={{ padding: '16px 20px' }}>
          <div className="flex-1"></div>
          <h2 className="text-[18px] font-semibold text-[#3f4299] flex-1 text-center whitespace-nowrap">
            Update Report {report.displayId || `#${report.id}`}
          </h2>
          <div className="flex-1 flex justify-end"></div>
        </div>

        <div className="overflow-y-auto flex-1" style={{ padding: '20px' }}>
          <p className="text-[13px] text-gray-500" style={{ marginBottom: '16px' }}>
            {isAnalytics
              ? 'Analytics snapshot — set its review state and add any context. The figures do not change.'
              : canBlacklist
                ? 'Violation report — set its resolution status, add a note, and act on the person involved if needed.'
                : 'Set the resolution status and add a note for this report.'}
          </p>

          <label className="block text-[13px] font-semibold text-gray-700" style={{ marginBottom: '4px' }}>Status</label>
          <StatusDropdown
            value={status}
            options={statuses}
            onChange={(val) => setStatus(val)}
          />

          <label className="block text-[13px] font-semibold text-gray-700" style={{ marginBottom: '4px' }}>
            {isAnalytics ? 'Annotation' : 'Resolution note'}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={isAnalytics ? 'e.g. The spike on 03/06 was a scheduled maintenance event.' : 'What was done about this?'}
            className="w-full h-[100px] border border-[#bab6b6] rounded-[8px] text-[14px] outline-none resize-none focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]"
            style={{ padding: '10px', marginBottom: '16px' }}
          />

          {canBlacklist && (
            <label className="flex items-center gap-2 cursor-pointer select-none" style={{ marginBottom: '12px' }}>
              <input type="checkbox" checked={blacklist} onChange={(e) => setBlacklist(e.target.checked)} className="w-4 h-4 accent-[#3f4299]" />
              <span className="text-[14px] text-gray-700">Blacklist {report.related_person_name || 'this person'}</span>
            </label>
          )}

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4 accent-[#3f4299]" />
            <span className="text-[14px] text-gray-700">Pin to top of the list</span>
          </label>
        </div>

        <div className="bg-white flex justify-center gap-4" style={{ padding: '10px' }}>
          <button 
            onClick={onClose} 
            className="h-[48px] px-[10px] w-[200px] text-gray-600 border border-gray-300 text-[16px] font-bold rounded-[8px] hover:bg-gray-50 transition-colors focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`h-[48px] px-[10px] w-[200px] text-white text-[16px] font-bold rounded-[8px] transition-colors focus:outline-none ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#3f4299] hover:bg-[#2d3170]'}`}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>

      <ConfirmModal
        isOpen={alertData.isOpen}
        onClose={() => setAlertData(s => ({ ...s, isOpen: false }))}
        onConfirm={() => setAlertData(s => ({ ...s, isOpen: false }))}
        title="Alert"
        message={alertData.message}
        confirmText="OK"
        hideCancel={true}
      />
    </>
  );
};

export default UpdateReportModal;
