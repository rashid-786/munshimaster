import React, { useState } from 'react';
import EmployeeCalendar from './EmployeeCalendar';
import PieceWorkCalendar from './PieceWorkCalendar';

const TABS = [
  { key: 'hourly', label: 'Hourly Attendance' },
  { key: 'piece', label: 'Piece Work Attendance' },
];

const Attendance = () => {
  const [activeTab, setActiveTab] = useState('hourly');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'hourly' ? <EmployeeCalendar /> : <PieceWorkCalendar />}
    </div>
  );
};

export default Attendance;
