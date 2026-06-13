import React, { useState, useEffect } from 'react';

const inputClass =
  'w-full h-[48px] border border-[#bab6b6] rounded-[8px] text-[14px] text-black bg-white outline-none transition-colors placeholder:text-[#bab6b6] focus:ring-2 focus:ring-[#3f4299] focus:border-[#3f4299]';
const labelClass = 'block text-sm font-medium text-gray-700 mb-2';

const EditPhotosModal = ({ person, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    name: person.name || '',
    contact_email: person.contact_email || '',
    phone: person.phone || '',
    department: person.department || '',
    address: person.address || '',
  });
  const [files, setFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  // ESC to close + lock background scroll while open
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    // Light client-side email check (the backend validates too)
    const email = form.contact_email.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIsError(true);
      setMessage('Please enter a valid personal email address.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      // 1. Save the contact / profile details
      const infoRes = await fetch(`/api/people/${person.id}/update-info/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!infoRes.ok) {
        const d = await infoRes.json().catch(() => ({}));
        setIsError(true);
        setMessage(d.message || 'Failed to save details.');
        setSaving(false);
        return;
      }

      // 2. Add any new photos (each becomes an extra embedding)
      let photoMsg = '';
      if (files.length > 0) {
        const fd = new FormData();
        files.forEach((f) => fd.append('photos', f));
        const photoRes = await fetch(`/api/people/${person.id}/add-photos/`, { method: 'POST', body: fd });
        const pd = await photoRes.json().catch(() => ({}));
        if (photoRes.ok) {
          photoMsg = ` Added ${pd.added} photo(s) — ${pd.total_embeddings} embedding(s) total.`;
        } else {
          setIsError(true);
          setMessage((pd.message || 'Photo upload failed.') + ' (Details were saved.)');
          if (onSuccess) onSuccess();
          setSaving(false);
          return;
        }
      }

      setIsError(false);
      setMessage('Saved.' + photoMsg);
      if (onSuccess) onSuccess();
      setTimeout(() => { if (onClose) onClose(); }, 1300);
    } catch (e) {
      console.error(e);
      setIsError(true);
      setMessage('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div
        className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
      >
        <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
          <div className="flex-1"></div>
          <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center whitespace-nowrap" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            Edit Details
          </h2>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-[#3f4299] hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-4 overflow-y-auto flex-1" style={{ padding: '10px' }}>
          <p className="text-sm text-gray-500 text-center" style={{ fontFamily: "'Open Sans', sans-serif", marginBottom: '6px' }}>
            Update {person.name}'s contact details. Adding photos also improves recognition (each becomes an extra face embedding).
          </p>

          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Name</label>
            <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Full name"
              className={inputClass} style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }} />
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>
              Personal Email <span className="text-gray-400 text-xs">(violation alerts are sent here)</span>
            </label>
            <input type="email" value={form.contact_email} onChange={(e) => setField('contact_email', e.target.value)} placeholder="name@example.com"
              className={inputClass} style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }} />
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Phone Number</label>
            <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="e.g. 0300-1234567"
              className={inputClass} style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }} />
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Department</label>
            <input type="text" value={form.department} onChange={(e) => setField('department', e.target.value)} placeholder="Department"
              className={inputClass} style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }} />
          </div>

          <div>
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif" }}>Address</label>
            <input type="text" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Address"
              className={inputClass} style={{ fontFamily: "'Open Sans', sans-serif", padding: '10px' }} />
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className={labelClass} style={{ fontFamily: "'Open Sans', sans-serif", marginTop: '6px' }}>Add Photos (optional)</label>
            <div className="border-2 border-dashed border-[#bab6b6] rounded-[8px] p-4" style={{ marginBottom: '6px' }}>
              <input type="file" id="editPhotosInput" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files))} className="hidden" />
              <label htmlFor="editPhotosInput" className="flex flex-col items-center justify-center cursor-pointer">
                <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-[#3f4299] hover:text-[#2d3170] font-medium" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  Click to upload images
                </span>
              </label>
            </div>
            {files.length > 0 && <p className="text-xs text-gray-500 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>{files.length} file(s) selected.</p>}
          </div>

          {message && <p className={`text-sm text-center ${isError ? 'text-red-600' : 'text-green-600'}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>{message}</p>}
        </div>

        <div className="bg-white flex justify-end" style={{ padding: '10px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`h-[48px] w-[190px] px-[10px] bg-[#3f4299] text-white text-[16px] font-bold rounded-[8px] hover:bg-[#2d3170] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPhotosModal;
