import React from 'react';

const PersonDetailsModal = ({ person, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[0.3px] bg-white/10" onClick={onClose}>
      <div
        className="relative bg-white rounded-[8px] shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        }}
      >
        <div className="bg-white flex justify-between items-center relative" style={{ padding: '10px' }}>
          <div className="flex-1"></div>
          <h2 className="text-xl font-semibold text-[#3f4299] flex-1 text-center whitespace-nowrap" style={{ fontFamily: "'Open Sans', sans-serif", marginTop: '10px' }}>
            Person Details
          </h2>
          <div className="flex-1 flex justify-end">
          </div>
        </div>

        <div className="overflow-y-auto flex-1" style={{ padding: '20px 10px' }}>
          <div className="flex flex-col items-center text-center" style={{ gap: '20px', marginBottom: '30px' }}>
            {person.photo_url ? (
              <img src={person.photo_url} alt={person.name} className="w-24 h-24 rounded-full object-cover border-2 border-gray-200" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-bold text-2xl">
                {person.name.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.name} {person.employee_id && `#${person.employee_id.replace(/\D/g, '')}`}</h3>
              <p className="text-gray-500" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.employee_id}</p>
              <span className="inline-block mt-2 px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 capitalize" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.role || person.classification || 'unknown'}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 font-semibold" style={{ fontFamily: "'Open Sans', sans-serif" }}>Email</p>
              <p className="text-gray-900 break-words" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold" style={{ fontFamily: "'Open Sans', sans-serif" }}>Department</p>
              <p className="text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.department || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold" style={{ fontFamily: "'Open Sans', sans-serif" }}>Classification</p>
              <p className="text-gray-900 capitalize" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.classification || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold" style={{ fontFamily: "'Open Sans', sans-serif" }}>Violations</p>
              <p className="text-red-600 font-bold" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.violation_count || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold" style={{ fontFamily: "'Open Sans', sans-serif" }}>Face Embedding</p>
              <p className="text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.status || 'Encoded (512-D)'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-semibold" style={{ fontFamily: "'Open Sans', sans-serif" }}>Added On</p>
              <p className="text-gray-900" style={{ fontFamily: "'Open Sans', sans-serif" }}>{person.created_at ? new Date(person.created_at).toLocaleDateString() : '-'}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white flex justify-end" style={{ padding: '10px' }}>
          <button
            onClick={onClose}
            className={`h-[48px] w-[190px] px-[10px] bg-[#3f4299] text-white text-[16px] font-bold rounded-[8px] hover:bg-[#2d3170] transition-colors focus:outline-none focus:ring-2 focus:ring-[#3f4299] focus:ring-offset-2`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonDetailsModal;
