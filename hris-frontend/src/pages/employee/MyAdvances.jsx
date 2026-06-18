import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';

const MyAdvances = () => {
  const [advances, setAdvances] = useState([]);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    hrService.getAdvances().then(setAdvances).catch(() => {});
  }, []);

  const handleRequest = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await hrService.createAdvance({ amount, reason });
      setMessage(res.message);
      setAmount('');
      setReason('');
      hrService.getAdvances().then(setAdvances).catch(() => {});
    } catch (err) {
      setMessage(err.response?.data?.error || 'Request failed.');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Advance Payments</h2>

      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>
      )}

      <div className="card max-w-lg">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Request Advance</h3>
        </div>
        <form onSubmit={handleRequest} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
            <input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <input type="text" value={reason} onChange={e => setReason(e.target.value)} className="input-field" placeholder="Why do you need this advance?" />
          </div>
          <button type="submit" className="btn-primary">Submit Request</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">My Requests</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Amount</th>
                <th className="table-header">Remaining</th>
                <th className="table-header">Reason</th>
                <th className="table-header">Status</th>
                <th className="table-header">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {advances.map(adv => (
                <tr key={adv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium">{formatINR(adv.amount)}</td>
                  <td className="table-cell">{formatINR(adv.remaining_balance)}</td>
                  <td className="table-cell text-gray-500">{adv.reason || '-'}</td>
                  <td className="table-cell">
                    <span className={`badge-${adv.status === 'approved' ? 'success' : adv.status === 'pending' ? 'warning' : adv.status === 'rejected' ? 'danger' : 'info'}`}>
                      {adv.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="table-cell text-gray-500">{(adv.created_at || '').split('T')[0]}</td>
                </tr>
              ))}
              {advances.length === 0 && (
                <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">No advance requests</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MyAdvances;
