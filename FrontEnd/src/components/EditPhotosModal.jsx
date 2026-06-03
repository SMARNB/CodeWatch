import React, { useState } from 'react';

const EditPhotosModal = ({ person, onClose, onSuccess }) => {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleUpload = async () => {
    if (files.length === 0) {
      setIsError(true);
      setMessage('Please choose at least one photo.');
      return;
    }
    setUploading(true);
    setMessage('');
    const form = new FormData();
    files.forEach(f => form.append('photos', f));
    try {
      const res = await fetch(`/api/people/${person.id}/add-photos/`, { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsError(false);
        setMessage(`Added ${data.added} photo(s). This person now has ${data.total_embeddings} embedding(s).`);
        if (onSuccess) onSuccess();
        setTimeout(() => { if (onClose) onClose(); }, 1300);
      } else {
        setIsError(true);
        setMessage(data.message || 'Upload failed.');
      }
    } catch (e) {
      console.error(e);
      setIsError(true);
      setMessage('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div
        className="relative bg-white rounded-[8px] shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
          <div className="flex-1"></div>
          <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center whitespace-nowrap" style={{ fontFamily: "'Open Sans', sans-serif" }}>
            Edit Photos
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

        <div className="space-y-5 overflow-y-auto flex-1" style={{ padding: '10px' }}>
          <p className="text-sm text-gray-500 text-center" style={{ fontFamily: "'Open Sans', sans-serif", marginBottom: '10px' }}>
            {person.name} — add one or more clear, front-facing photos to improve recognition. The first valid photo also becomes the profile picture.
          </p>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: "'Open Sans', sans-serif" }}>Upload Photos</label>
            <div className="border-2 border-dashed border-[#bab6b6] rounded-[8px] p-4" style={{ marginBottom: '10px' }}>
              <input
                type="file"
                id="editPhotosInput"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files))}
                className="hidden"
              />
              <label
                htmlFor="editPhotosInput"
                className="flex flex-col items-center justify-center cursor-pointer"
              >
                <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-[#3f4299] hover:text-[#2d3170] font-medium" style={{ fontFamily: "'Open Sans', sans-serif" }}>
                  Click to upload images or drag and drop
                </span>
              </label>
            </div>
            {files.length > 0 && <p className="text-xs text-gray-500 mt-2 text-center" style={{ fontFamily: "'Open Sans', sans-serif" }}>{files.length} file(s) selected.</p>}
            {message && <p className={`text-sm mt-2 text-center ${isError ? 'text-red-600' : 'text-green-600'}`} style={{ fontFamily: "'Open Sans', sans-serif" }}>{message}</p>}
          </div>
        </div>

        <div className="bg-white flex justify-end" style={{ padding: '10px' }}>
          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`h-[48px] w-[190px] px-[10px] bg-[#3f4299] text-white text-[16px] font-bold rounded-[8px] hover:bg-[#2d3170] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2 ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {uploading ? 'Uploading...' : 'Upload Photos'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditPhotosModal;
