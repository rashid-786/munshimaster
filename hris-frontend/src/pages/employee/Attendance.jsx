import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';

const Attendance = () => {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    // Fetch attendance records - would need a dedicated endpoint
  }, []);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">My Attendance</h3>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-indigo-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">0</p>
            <p className="text-sm text-gray-500 mt-1">Days Present</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">0</p>
            <p className="text-sm text-gray-500 mt-1">Days Absent</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">0</p>
            <p className="text-sm text-gray-500 mt-1">On Leave</p>
          </div>
        </div>
        <p className="text-gray-400 text-center py-8">Attendance records will appear here</p>
      </div>
    </div>
  );
};

export default Attendance;
