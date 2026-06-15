import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';

const Employees = () => {
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'employee', baseSalary: '' });

  const fetchRoster = async () => {
    try {
      const data = await hrService.getEmployees();
      setEmployees(data);
    } catch (err) {
      setError('Could not download employee records.');
    }
  };

  useEffect(() => { fetchRoster(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await hrService.onboardEmployee(form);
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'employee', baseSalary: '' });
      fetchRoster();
    } catch (err) {
      setError(err.response?.data?.error || 'Onboarding failed.');
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Onboard New Employee</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-4">
            <input type="text" placeholder="First Name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required className="input-field" />
            <input type="text" placeholder="Last Name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required className="input-field" />
            <input type="email" placeholder="Work Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="input-field" />
            <input type="password" placeholder="Temp Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="input-field" />
            <input type="number" placeholder="Monthly Base Salary" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: e.target.value })} required className="input-field" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field">
              <option value="employee">Standard Employee</option>
              <option value="tenant_admin">Company Admin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Onboard Staff</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Employee Directory</h3>
          <p className="text-sm text-gray-500 mt-1">{employees.length} employee(s)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Full Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Role</th>
                <th className="table-header">Base Monthly Salary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell font-medium">{emp.first_name} {emp.last_name}</td>
                  <td className="table-cell text-gray-500">{emp.email}</td>
                  <td className="table-cell">
                    <span className={`badge ${emp.role === 'tenant_admin' ? 'badge-info' : 'badge-success'}`}>
                      {emp.role === 'tenant_admin' ? 'Admin' : 'Employee'}
                    </span>
                  </td>
                  <td className="table-cell font-medium">${(emp.base_salary / 100).toFixed(2)}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Employees;
