import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';

const ManualAttendance = () => {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ employeeId: '', date: '', clockIn: '', clockOut: '' });
  const [message, setMessage] = useState('');

  useEffect(() => {
    hrService.getEmployees().then(setEmployees).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.logEmployeeHoursManually(form);
      setMessage(res.message);
      setForm({ employeeId: '', date: '', clockIn: '', clockOut: '' });
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to log hours.');
    }
  };

  return (
    <div className="card max-w-xl">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">Manual Attendance Entry</h3>
      </div>
      {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="input-field" required>
            <option value="">Select employee</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name} ({emp.email})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input-field" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clock In Time</label>
            <input type="time" value={form.clockIn} onChange={e => setForm({ ...form, clockIn: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clock Out Time</label>
            <input type="time" value={form.clockOut} onChange={e => setForm({ ...form, clockOut: e.target.value })} className="input-field" required />
          </div>
        </div>
        <button type="submit" className="btn-primary">Record Attendance</button>
      </form>
    </div>
  );
};

export default ManualAttendance;
