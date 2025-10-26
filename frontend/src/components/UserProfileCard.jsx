import React from 'react';

const UserProfileCard = ({ user }) => {
  const { name, email, employeeId } = user || {};

  // Generate initials from name
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 w-full" style={{ height: '150px' }}>
      {/* Avatar and Content Container */}
      <div className="flex items-center space-x-4 h-full">
        {/* Avatar with Purple Border */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-full border-3 border-purple-500 bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center" style={{margin: '20px'}}>
            <span className="text-white font-bold text-lg">
              {getInitials(name)}
            </span>
          </div>
        </div>

        {/* Text Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {/* Name */}
          <h3 className="text-lg font-bold text-gray-900 truncate mb-2">
            {name || 'User Name'}
          </h3>
          
          {/* Email */}
          <p className="text-sm text-gray-600 truncate mb-1">
            {email || 'user@example.com'}
          </p>
          
          {/* Employee ID */}
          <p className="text-sm text-gray-500 truncate">
            ID: {employeeId || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default UserProfileCard;