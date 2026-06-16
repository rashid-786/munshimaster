import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';

const PayrollConsole = () => {
  const [payPeriod, setPayPeriod] = useState({ startDate: '', endDate: '' });
  const [history, setHistory] = useState([]);
  const [message, setMessage] = useState('');
  const [payrun, setPayrun] = useState(null);

  useEffect(() => {
    hrService.getPayrollHistory().then(setHistory).catch(() => {});
  }, []);

  const handleRunPayroll = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.runPayroll(payPeriod);
      setMessage(res.message);
      setPayrun(res);
      hrService.getPayrollHistory().then(setHistory).catch(() => {});
    } catch (err) {
      setMessage(err.response?.data?.error || 'Payroll run failed.');
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => { setMessage(''); setPayrun(null); }} className="text-blue-500 hover:text-blue-700">&times;</button>
        </div>
      )}

      {payrun && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Payroll Results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">Employee</th>
                  <th className="table-header">Rate</th>
                  <th className="table-header">Worked</th>
                  <th className="table-header">Std Hrs</th>
                  <th className="table-header">Gross</th>
                  <th className="table-header">Deductions</th>
                  <th className="table-header">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payrun.runs?.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{r.employeeName}</td>
                    <td className="table-cell">₹{r.hourlyRate}/hr</td>
                    <td className="table-cell">{r.hoursWorked}h</td>
                    <td className="table-cell">{r.standardHours}h</td>
                    <td className="table-cell">{formatINR(Math.round(parseFloat(r.gross) * 100))}</td>
                    <td className="table-cell text-red-600">{formatINR(Math.round(parseFloat(r.deductions) * 100))}</td>
                    <td className="table-cell font-bold text-emerald-600">{formatINR(Math.round(parseFloat(r.net) * 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card max-w-xl">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Run Payroll</h3>
        </div>
        <form onSubmit={handleRunPayroll} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
              <input type="date" value={payPeriod.startDate} onChange={e => setPayPeriod({ ...payPeriod, startDate: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
              <input type="date" value={payPeriod.endDate} onChange={e => setPayPeriod({ ...payPeriod, endDate: e.target.value })} className="input-field" required />
            </div>
          </div>
          <p className="text-xs text-gray-500">Working days (Mon-Fri) are auto-calculated. Hours tracked via attendance determine pay.</p>
          <button type="submit" className="btn-primary">Calculate & Process Payroll</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Payroll History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Employee</th>
                <th className="table-header">Period</th>
                <th className="table-header">Rate</th>
                <th className="table-header">Hrs</th>
                <th className="table-header">Gross</th>
                <th className="table-header">Deductions</th>
                <th className="table-header">Net</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {history.map(slip => (
                <tr key={slip.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium">{slip.first_name} {slip.last_name}</td>
                  <td className="table-cell text-gray-500">{(slip.pay_period_start || '').split('T')[0]} to {(slip.pay_period_end || '').split('T')[0]}</td>
                  <td className="table-cell">₹{(slip.hourly_rate / 100).toFixed(2)}/hr</td>
                  <td className="table-cell">{slip.total_hours_worked}h / {slip.standard_hours}h</td>
                  <td className="table-cell">{formatINR(slip.gross_salary)}</td>
                  <td className="table-cell text-red-600">{formatINR(slip.deductions)}</td>
                  <td className="table-cell font-bold text-emerald-600">{formatINR(slip.net_salary)}</td>
                  <td className="table-cell"><span className="badge-success">Paid</span></td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-8">No payroll history</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PayrollConsole;
