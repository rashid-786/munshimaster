import React, { useState, useEffect, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR, formatPhone } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';

const Icons = {
  search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  userAdd: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
  users: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  userCheck: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  userX: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  edit: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  trash: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  save: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
  x: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
};

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
  const [showOnboard, setShowOnboard] = useState(false);

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
      setShowOnboard(false);
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
      id, name, variant: 'warning',
      title: 'Deactivate Employee',
      message: `Deactivate ${name}? They will not be able to log in until reactivated.`,
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        setModalLoading(true);
        try { await hrService.deactivateEmployee(id); setModal(null); fetchRoster(); }
        catch (err) { setError(err.response?.data?.error || 'Failed to deactivate employee.'); setModal(null); }
        finally { setModalLoading(false); }
      },
    });
  };

  const handleActivate = async (id) => {
    try { await hrService.activateEmployee(id); fetchRoster(); }
    catch (err) { setError(err.response?.data?.error || 'Failed to activate employee.'); }
  };

  const handleDelete = (id, name) => {
    setModal({
      id, name, variant: 'danger',
      title: 'Delete Employee',
      message: `Permanently delete ${name}? All employee data will be removed and this cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try { await hrService.deleteEmployee(id); setModal(null); fetchRoster(); }
        catch (err) { setError(err.response?.data?.error || 'Failed to delete employee.'); setModal(null); }
        finally { setModalLoading(false); }
      },
    });
  };

  const saveEdit = async (id) => {
    try {
      await hrService.updateEmployee(id, {
        firstName: editForm.firstName, lastName: editForm.lastName,
        email: editForm.email, phone: editForm.phone,
        role: editForm.role, baseSalary: editForm.baseSalary
      });
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

  const activeCount = employees.filter(e => e.status !== 'deactivated').length;
  const deactivatedCount = employees.length - activeCount;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between animate-slide-up">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-4 shrink-0">&times;</button>
        </div>
      )}

      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 md:p-8 text-white">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-200 mb-1">Welcome back,</p>
          <h2 className="text-2xl md:text-3xl font-bold">{user?.firstName} {user?.lastName}</h2>
          <p className="text-indigo-200 mt-1 text-sm">Manage your team and workspace from one place.</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">{Icons.users}</div>
          <div>
            <p className="text-sm text-gray-500">Total Staff</p>
            <p className="text-2xl font-bold text-gray-900">{employees.length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">{Icons.userCheck}</div>
          <div>
            <p className="text-sm text-gray-500">Active</p>
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">{Icons.userX}</div>
          <div>
            <p className="text-sm text-gray-500">Deactivated</p>
            <p className="text-2xl font-bold text-red-500">{deactivatedCount}</p>
          </div>
        </div>
      </div>

      {/* Staff Directory */}
      <div className="card animate-slide-up">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Staff Directory</h3>
              <p className="text-sm text-gray-500 mt-0.5">{activeCount} active &middot; {employees.length} total</p>
            </div>
            {isAdmin && (
              <button onClick={() => setShowOnboard(true)} className="btn-primary">
                {Icons.userAdd}
                Onboard Staff
              </button>
            )}
          </div>
        </div>

        {/* Search & filters */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{Icons.search}</span>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none hover:text-gray-800 transition-colors">
              <input
                type="checkbox"
                checked={includeDeactivated}
                onChange={e => setIncludeDeactivated(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Show deactivated
            </label>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200">
                <th className="table-header">Staff</th>
                <th className="table-header">Email</th>
                <th className="table-header">Phone</th>
                <th className="table-header">Role</th>
                <th className="table-header">Monthly Salary</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(emp => (
                <tr key={emp.id} className={`table-row-hover ${emp.status === 'deactivated' ? 'opacity-60' : ''}`}>
                  {editId === emp.id ? (
                    <>
                      <td className="table-cell min-w-[200px]">
                        <div className="flex gap-2">
                          <input type="text" name="firstName" value={editForm.firstName} onChange={handleEditChange} placeholder="First" className="input-field !py-1.5 text-sm w-1/2" />
                          <input type="text" name="lastName" value={editForm.lastName} onChange={handleEditChange} placeholder="Last" className="input-field !py-1.5 text-sm w-1/2" />
                        </div>
                      </td>
                      <td className="table-cell">
                        <input type="email" name="email" value={editForm.email} onChange={handleEditChange} className="input-field !py-1.5 text-sm max-w-[180px]" />
                      </td>
                      <td className="table-cell">
                        <input type="tel" name="phone" value={editForm.phone} onChange={handleEditChange} className="input-field !py-1.5 text-sm max-w-[140px]" />
                      </td>
                      <td className="table-cell">
                        <select name="role" value={editForm.role} onChange={handleEditChange} className="input-field !py-1.5 text-sm max-w-[130px]">
                          <option value="employee">Employee</option>
                          <option value="tenant_admin">Admin</option>
                        </select>
                      </td>
                      <td className="table-cell">
                        <input type="number" name="baseSalary" value={editForm.baseSalary} onChange={handleEditChange} className="input-field !py-1.5 text-sm max-w-[140px]" />
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${emp.status === 'deactivated' ? 'badge-danger' : 'badge-success'}`}>
                          {emp.status === 'deactivated' ? 'Deactivated' : 'Active'}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => saveEdit(emp.id)} className="btn-success !py-1.5 !px-3 text-xs">{Icons.save} Save</button>
                          <button onClick={cancelEdit} className="btn-secondary !py-1.5 !px-3 text-xs">{Icons.x} Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
                            {emp.first_name?.[0]}{emp.last_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-gray-500">{emp.email}</td>
                      <td className="table-cell text-gray-500">{formatPhone(emp.phone) || '—'}</td>
                      <td className="table-cell">
                        <span className={`badge ${emp.role === 'tenant_admin' ? 'badge-info' : 'badge-success'}`}>
                          {emp.role === 'tenant_admin' ? 'Admin' : 'Employee'}
                        </span>
                      </td>
                      <td className="table-cell font-medium text-gray-900">{formatINR(emp.base_salary)}</td>
                      <td className="table-cell">
                        <span className={`badge ${emp.status === 'deactivated' ? 'badge-danger' : 'badge-success'}`}>
                          {emp.status === 'deactivated' ? 'Deactivated' : 'Active'}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex gap-1.5 justify-end">
                          <button onClick={() => startEdit(emp)} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Edit">{Icons.edit}</button>
                          {isAdmin && emp.status === 'active' && (
                            <button onClick={() => handleDeactivate(emp.id, `${emp.first_name} ${emp.last_name}`)} className="btn-warning !py-1.5 !px-2.5 text-xs">Deactivate</button>
                          )}
                          {isAdmin && emp.status === 'deactivated' && (
                            <button onClick={() => handleActivate(emp.id)} className="btn-success !py-1.5 !px-2.5 text-xs">Activate</button>
                          )}
                          {isAdmin && (
                            <button onClick={() => handleDelete(emp.id, `${emp.first_name} ${emp.last_name}`)} className="btn-ghost !py-1.5 !px-2.5 text-xs !text-red-500 hover:!bg-red-50" title="Delete">{Icons.trash}</button>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-12">
                  <p className="text-base font-medium mb-1">No staff found</p>
                  <p className="text-sm">{search ? 'Try a different search term.' : 'Click "Onboard Staff" to add your first team member.'}</p>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard modal */}
      {showOnboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowOnboard(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Onboard New Staff</h3>
                <p className="text-sm text-gray-500 mt-0.5">Add a new team member to your organization.</p>
              </div>
              <button onClick={() => setShowOnboard(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required className="input-field" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field">
                    <option value="employee">Employee</option>
                    <option value="tenant_admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Temp Password</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (Rs.)</label>
                  <input type="number" min="0" step="0.01" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: e.target.value })} required className="input-field" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowOnboard(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{Icons.userAdd} Onboard Staff</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
