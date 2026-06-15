import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';

const Workspace = () => {
  const { logout } = useAuth();
  const [message, setMessage] = useState('');
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'Annual', startDate: '', endDate: '' });
  const [payslips, setPayslips] = useState([]);

  useEffect(() => {
    hrService.getPayrollHistory().then(data => setPayslips(data)).catch(() => {});
  }, []);

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.applyLeave(leaveForm);
      setMessage(res.message);
      setLeaveForm({ leaveType: 'Annual', startDate: '', endDate: '' });
    } catch (err) { setMessage(err.response?.data?.error || 'Failed to submit leave request.'); }
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
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Request Time Off</h3>
        </div>
        <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4">
            <select value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} className="input-field">
              <option value="Annual">Annual Leave</option>
              <option value="Sick">Sick Leave</option>
              <option value="Casual">Casual Leave</option>
              <option value="Unpaid">Unpaid Leave</option>
            </select>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required className="input-field" />
              <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required className="input-field" />
            </div>
            <button type="submit" className="btn-primary w-full">Submit Request</button>
          </form>
        </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Payslip History</h3>
        </div>
        <div className="p-6">
          {payslips.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No payslips available</p>
          ) : (
            <div className="space-y-3">
              {payslips.map(slip => (
                <div key={slip.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {(slip.pay_period_start || '').split('T')[0]} to {(slip.pay_period_end || '').split('T')[0]}
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1">${(slip.net_salary / 100).toFixed(2)}</p>
                  </div>
                  <button onClick={() => hrService.downloadPayslipFile(slip.id)} className="btn-secondary">
                    Download PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Workspace;
