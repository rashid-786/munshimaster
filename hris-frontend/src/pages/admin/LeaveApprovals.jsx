import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';

const LeaveApprovals = () => {
  const [leaves, setLeaves] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    hrService.getLeaves().then(setLeaves).catch(() => {});
  }, []);

  const handleReview = async (id, status) => {
    try {
      const res = await hrService.reviewLeave(id, status);
      setMessage(res.message);
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } catch (err) {
      setMessage(err.response?.data?.error || 'Action failed.');
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      default: return 'badge-warning';
    }
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">Leave Applications</h3>
      </div>
      {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Employee</th>
              <th className="table-header">Type</th>
              <th className="table-header">Start Date</th>
              <th className="table-header">End Date</th>
              <th className="table-header">Status</th>
              <th className="table-header">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leaves.map(leave => (
              <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell font-medium">{leave.first_name} {leave.last_name}</td>
                <td className="table-cell">{leave.leave_type}</td>
                <td className="table-cell text-gray-500">{new Date(leave.start_date).toLocaleDateString()}</td>
                <td className="table-cell text-gray-500">{new Date(leave.end_date).toLocaleDateString()}</td>
                <td className="table-cell">
                  <span className={statusBadge(leave.status)}>{leave.status}</span>
                </td>
                <td className="table-cell">
                  {leave.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(leave.id, 'approved')} className="btn-success text-xs !px-3 !py-1">Approve</button>
                      <button onClick={() => handleReview(leave.id, 'rejected')} className="btn-danger text-xs !px-3 !py-1">Reject</button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">Done</span>
                  )}
                </td>
              </tr>
            ))}
            {leaves.length === 0 && (
              <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">No leave applications</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaveApprovals;
