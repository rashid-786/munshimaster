import React, { useState, useEffect, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';

const Employees = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'tenant_admin';
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [includeDeactivated, setIncludeDeactivated] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'employee', baseSalary: '' });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: '', baseSalary: '' });
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchRoster = async () => {
    try {
      const data = await hrService.getEmployees(includeDeactivated);
      setEmployees(data);
    } catch (err) {
      setError('Could not download employee records.');
    }
  };

  useEffect(() => { fetchRoster(); }, [includeDeactivated]);

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

  const startEdit = (emp) => {
    setEditId(emp.id);
    setEditForm({
      firstName: emp.first_name,
      lastName: emp.last_name,
      email: emp.email,
      phone: emp.phone || '',
      role: emp.role,
      baseSalary: (emp.base_salary / 100).toFixed(2)
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ firstName: '', lastName: '', email: '', phone: '', role: '', baseSalary: '' });
  };

  const handleEditChange = (e) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleDeactivate = (id, name) => {
    setModal({
      id,
      name,
      variant: 'warning',
      title: 'Deactivate Employee',
      message: `Deactivate ${name}? They will not be able to log in until reactivated.`,
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          await hrService.deactivateEmployee(id);
          setModal(null);
          fetchRoster();
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to deactivate employee.');
          setModal(null);
        } finally {
          setModalLoading(false);
        }
      },
    });
  };

  const handleActivate = async (id) => {
    try {
      await hrService.activateEmployee(id);
      fetchRoster();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to activate employee.');
    }
  };

  const handleDelete = (id, name) => {
    setModal({
      id,
      name,
      variant: 'danger',
      title: 'Delete Employee',
      message: `Permanently delete ${name}? All employee data will be removed and this cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          await hrService.deleteEmployee(id);
          setModal(null);
          fetchRoster();
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to delete employee.');
          setModal(null);
        } finally {
          setModalLoading(false);
        }
      },
    });
  };

  const saveEdit = async (id) => {
    try {
      const payload = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        phone: editForm.phone,
        role: editForm.role,
        baseSalary: editForm.baseSalary
      };
      await hrService.updateEmployee(id, payload);
      setEditId(null);
      fetchRoster();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update employee.');
    }
  };

  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      e.first_name?.toLowerCase().includes(q) ||
      e.last_name?.toLowerCase().includes(q) ||
      `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.phone?.includes(q)
    );
  }, [employees, search]);

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
      </div>}

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Onboard New Employee</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <input type="text" placeholder="First Name" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required className="input-field w-1/2" />
            <input type="text" placeholder="Last Name" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required className="input-field w-1/2" />
            <input type="email" placeholder="Work Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="input-field w-1/2" />
            <input type="tel" placeholder="Phone (optional)" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field w-1/2" />
            <input type="password" placeholder="Temp Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="input-field w-1/2" />
            <input type="number" placeholder="Monthly Base Salary" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: e.target.value })} required className="input-field w-1/2" />
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field sm:col-span-2 w-1/4">
              <option value="employee">Standard Employee</option>
              <option value="tenant_admin">Company Admin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">Onboard Staff</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Employee Directory</h3>
            <p className="text-sm text-gray-500 mt-1">{employees.filter(e => e.status !== 'deactivated').length} active / {employees.length} total</p>
          </div>
        </div>
        <div className="px-6 pt-2 pb-1 flex items-center gap-4">
          <input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="input-field max-w-xs text-sm" />
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={includeDeactivated} onChange={e => setIncludeDeactivated(e.target.checked)} className="rounded" />
              Show deactivated
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Full Name</th>
                <th className="table-header">Email</th>
                <th className="table-header">Phone</th>
                <th className="table-header">Role</th>
                <th className="table-header">Base Monthly Salary</th>
                <th className="table-header">Status</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(emp => (
                <tr key={emp.id} className={`hover:bg-gray-50 transition-colors ${emp.status === 'deactivated' ? 'opacity-60' : ''}`}>
                  {editId === emp.id ? (
                    <>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <input type="text" name="firstName" value={editForm.firstName} onChange={handleEditChange} className="input-field !py-1 text-sm w-1/2" />
                          <input type="text" name="lastName" value={editForm.lastName} onChange={handleEditChange} className="input-field !py-1 text-sm w-1/2" />
                        </div>
                      </td>
                      <td className="table-cell">
                        <input type="email" name="email" value={editForm.email} onChange={handleEditChange} className="input-field !py-1 text-sm w-1/2" />
                      </td>
                      <td className="table-cell">
                        <input type="tel" name="phone" value={editForm.phone} onChange={handleEditChange} className="input-field !py-1 text-sm w-1/2" />
                      </td>
                      <td className="table-cell">
                        <select name="role" value={editForm.role} onChange={handleEditChange} className="input-field !py-1 text-sm w-1/4">
                          <option value="employee">Employee</option>
                          <option value="tenant_admin">Admin</option>
                        </select>
                      </td>
                      <td className="table-cell">
                        <input type="number" name="baseSalary" value={editForm.baseSalary} onChange={handleEditChange} className="input-field !py-1 text-sm w-1/2" />
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${emp.status === 'deactivated' ? 'badge-danger' : 'badge-success'}`}>
                          {emp.status === 'deactivated' ? 'Deactivated' : 'Active'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(emp.id)} className="btn-success !py-1 !px-3 text-xs">Save</button>
                          <button onClick={cancelEdit} className="btn-secondary !py-1 !px-3 text-xs">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="table-cell font-medium">{emp.first_name} {emp.last_name}</td>
                      <td className="table-cell text-gray-500">{emp.email}</td>
                      <td className="table-cell text-gray-500">{emp.phone || '—'}</td>
                      <td className="table-cell">
                        <span className={`badge ${emp.role === 'tenant_admin' ? 'badge-info' : 'badge-success'}`}>
                          {emp.role === 'tenant_admin' ? 'Admin' : 'Employee'}
                        </span>
                      </td>
                      <td className="table-cell font-medium">{formatINR(emp.base_salary)}</td>
                      <td className="table-cell">
                        <span className={`badge ${emp.status === 'deactivated' ? 'badge-danger' : 'badge-success'}`}>
                          {emp.status === 'deactivated' ? 'Deactivated' : 'Active'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(emp)} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
                          {isAdmin && emp.status === 'active' && (
                            <button onClick={() => handleDeactivate(emp.id, `${emp.first_name} ${emp.last_name}`)} className="btn-warning !py-1 !px-3 text-xs">Deactivate</button>
                          )}
                          {isAdmin && emp.status === 'deactivated' && (
                            <button onClick={() => handleActivate(emp.id)} className="btn-success !py-1 !px-3 text-xs">Activate</button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDelete(emp.id, `${emp.first_name} ${emp.last_name}`)} className="btn-danger !py-1 !px-3 text-xs">Delete</button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-8">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={!!modal}
        title={modal?.title}
        message={modal?.message}
        confirmLabel={modal?.confirmLabel}
        variant={modal?.variant}
        loading={modalLoading}
        onConfirm={modal?.onConfirm || (() => {})}
        onCancel={() => setModal(null)}
      />
    </div>
  );
};

export default Employees;
