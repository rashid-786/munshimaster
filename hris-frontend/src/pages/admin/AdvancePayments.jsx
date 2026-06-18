import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';

const AdvancePayments = () => {
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showGrant, setShowGrant] = useState(false);
  const [form, setForm] = useState({ employeeId: '', amount: '', reason: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    hrService.getAdvances().then(setAdvances).catch(() => {});
    hrService.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const loadAdvances = () => {
    hrService.getAdvances().then(setAdvances).catch(() => {});
  };

  const handleGrant = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await hrService.createAdvance({ employeeId: form.employeeId, amount: form.amount, reason: form.reason });
      setMessage(res.message);
      setShowGrant(false);
      setForm({ employeeId: '', amount: '', reason: '' });
      loadAdvances();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to grant advance.');
    }
  };

  const handleApprove = async (id) => {
    try {
      await hrService.approveAdvance(id);
      loadAdvances();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to approve.');
    }
  };

  const handleReject = async (id) => {
    try {
      await hrService.rejectAdvance(id);
      loadAdvances();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to reject.');
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-blue-500 hover:text-blue-700">&times;</button>
        </div>
      )}

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Advance Payments</h3>
          <button onClick={() => setShowGrant(!showGrant)} className="btn-primary text-sm">
            {showGrant ? 'Cancel' : 'Grant Advance'}
          </button>
        </div>

        {showGrant && (
          <form onSubmit={handleGrant} className="p-6 border-b border-gray-200 space-y-4 bg-gray-50">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="input-field" required>
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
                <input type="number" min="1" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-field" placeholder="Optional" />
              </div>
            </div>
            <button type="submit" className="btn-primary">Grant Advance</button>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Employee</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Remaining</th>
                <th className="table-header">Reason</th>
                <th className="table-header">Status</th>
                <th className="table-header">Date</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {advances.map(adv => (
                <tr key={adv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium">{adv.first_name} {adv.last_name}</td>
                  <td className="table-cell">{formatINR(adv.amount)}</td>
                  <td className="table-cell">{formatINR(adv.remaining_balance)}</td>
                  <td className="table-cell text-gray-500 max-w-[200px] truncate">{adv.reason || '-'}</td>
                  <td className="table-cell">
                    <span className={`badge-${adv.status === 'approved' ? 'success' : adv.status === 'pending' ? 'warning' : adv.status === 'rejected' ? 'danger' : 'info'}`}>
                      {adv.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="table-cell text-gray-500">{(adv.created_at || '').split('T')[0]}</td>
                  <td className="table-cell">
                    {adv.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(adv.id)} className="text-sm text-green-600 hover:text-green-800 font-medium">Approve</button>
                        <button onClick={() => handleReject(adv.id)} className="text-sm text-red-600 hover:text-red-800 font-medium">Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {advances.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-8">No advance payment records</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdvancePayments;
