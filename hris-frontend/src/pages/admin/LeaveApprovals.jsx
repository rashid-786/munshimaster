import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';

const LeaveApprovals = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'tenant_admin';
  const [leaves, setLeaves] = useState([]);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  useEffect(() => {
    hrService.getLeaves().then(setLeaves).catch(() => {});
  }, []);

  const monthOptions = useMemo(() => {
    const set = new Set();
    for (const l of leaves) {
      const d = new Date(l.start_date);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return [...set].sort().reverse();
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (filterStatus && l.status !== filterStatus) return false;
      if (filterType && l.leave_type !== filterType) return false;
      if (filterMonth) {
        const d = new Date(l.start_date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (ym !== filterMonth) return false;
      }
      return true;
    });
  }, [leaves, filterStatus, filterType, filterMonth]);

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
        <h3 className="text-lg font-semibold text-gray-900">{isAdmin ? 'Leave Applications' : 'My Leave Requests'}</h3>
      </div>
      {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
      <div className="px-6 pt-4 flex flex-wrap gap-2">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field max-w-[130px] text-sm">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field max-w-[130px] text-sm">
          <option value="">All Types</option>
          <option value="Annual">Annual</option>
          <option value="Sick">Sick</option>
          <option value="Casual">Casual</option>
          <option value="Unpaid">Unpaid</option>
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field max-w-[150px] text-sm">
          <option value="">All Months</option>
          {monthOptions.map(m => {
            const [y, mo] = m.split('-');
            const label = new Date(y, mo - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
            return <option key={m} value={m}>{label}</option>;
          })}
        </select>
      </div>
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
            {filteredLeaves.map(leave => (
              <tr key={leave.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell font-medium">{leave.first_name} {leave.last_name}</td>
                <td className="table-cell">{leave.leave_type}</td>
                <td className="table-cell text-gray-500">{new Date(leave.start_date).toLocaleDateString()}</td>
                <td className="table-cell text-gray-500">{new Date(leave.end_date).toLocaleDateString()}</td>
                <td className="table-cell">
                  <span className={statusBadge(leave.status)}>{leave.status}</span>
                </td>
                <td className="table-cell">
                  {isAdmin && leave.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(leave.id, 'approved')} className="btn-success text-xs !px-3 !py-1">Approve</button>
                      <button onClick={() => handleReview(leave.id, 'rejected')} className="btn-danger text-xs !px-3 !py-1">Reject</button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">{leave.status === 'pending' ? 'Awaiting approval' : 'Done'}</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredLeaves.length === 0 && (
              <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">No leave applications</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaveApprovals;
