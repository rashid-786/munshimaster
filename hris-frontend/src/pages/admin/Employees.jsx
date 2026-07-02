import React, { useState, useEffect, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR, formatPhone } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import ConfirmModal from '../../components/ConfirmModal';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import SearchableSelect from '../../components/SearchableSelect';
import useIsMobile from '../../hooks/useIsMobile';
import PhoneField, { isValidPhoneNumber } from '../../components/PhoneInput';
import UpgradeBanner from '../../components/UpgradeBanner';

const PROFESSIONS = [
  'Accountant', 'Administrator', 'Architect', 'Business Analyst', 'Chef',
  'Customer Service', 'Data Analyst', 'Designer', 'Doctor', 'Driver',
  'Engineer', 'Finance Manager', 'HR Manager', 'IT Specialist', 'Janitor',
  'Lawyer', 'Logistics Coordinator', 'Manager', 'Marketing', 'Nurse',
  'Operations Manager', 'Pharmacist', 'Receptionist', 'Sales Executive',
  'Security Guard', 'Software Developer', 'Teacher', 'Technician',
  'Trainer', 'Warehouse Worker',
].map(p => ({ value: p, label: p }));

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
  const isMobile = useIsMobile();
  const isAdmin = user?.role === 'tenant_admin';
  const hideTempPassword = localStorage.getItem('hide_temp_password') === 'true';
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [search, setSearch] = useState('');
  const [includeDeactivated, setIncludeDeactivated] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'employee', jobType: 'permanent', baseSalary: '', profession: '', otherProfession: '' });
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [duplicateAction, setDuplicateAction] = useState('skip');
  const [importResult, setImportResult] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const fetchRoster = async () => {
    setLoading(true);
    try {
      const data = await hrService.getEmployees(includeDeactivated);
      setEmployees(data);
    } catch (err) {
      setError('Could not download employee records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoster(); }, [includeDeactivated]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPhoneErr('');
    if (form.phone && !isValidPhoneNumber(form.phone)) {
      setPhoneErr('Please enter a valid phone number.');
      return;
    }
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        role: form.role,
        jobType: form.jobType,
        baseSalary: form.baseSalary,
        profession: form.profession === 'Other' ? form.otherProfession : form.profession,
        otherProfession: form.profession === 'Other' ? form.otherProfession : null,
      };
      if (editingEmployee) {
        await hrService.updateEmployee(editingEmployee.id, payload);
      } else {
        payload.password = form.password || 'Welcome@123';
        await hrService.onboardEmployee(payload);
      }
      setForm({ firstName: '', lastName: '', email: '', password: '', role: 'employee', jobType: 'permanent', baseSalary: '', profession: '', otherProfession: '' });
      setShowOnboard(false);
      setEditingEmployee(null);
      fetchRoster();
    } catch (err) {
      setError(err.response?.data?.error || 'Onboarding failed.');
    }
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

  const handleImportPreview = async () => {
    if (!importFile) return;
    setImportLoading(true);
    setError('');
    try {
      const res = await hrService.previewImport(importFile);
      setImportPreview(res);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to preview import.');
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportExecute = async () => {
    if (!importPreview || importPreview.validCount === 0) return;
    setImportLoading(true);
    setError('');
    try {
      const res = await hrService.executeImport({ rows: importPreview.rows.filter(r => r.valid), duplicateAction });
      setImportResult(res);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    } finally {
      setImportLoading(false);
    }
  };

  const mobileEdit = (emp) => {
    setSelectedRecord(null);
    setEditingEmployee(emp);
    const profession = PROFESSIONS.some(p => p.value === emp.profession) ? emp.profession : 'Other';
    setForm({
      firstName: emp.first_name,
      lastName: emp.last_name,
      email: emp.email,
      phone: emp.phone || '',
      password: '',
      role: emp.role,
      jobType: emp.job_type || 'permanent',
      baseSalary: (emp.base_salary / 100).toFixed(2),
      profession: profession,
      otherProfession: profession === 'Other' ? (emp.profession || '') : '',
    });
    setShowOnboard(true);
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

  const statusBadge = (v) => v === 'deactivated' ? 'badge-danger' : 'badge-success';

  const columns = [
    { key: 'name', label: 'Staff', render: (_, emp) => (
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm shrink-0">
          {emp.first_name?.[0]}{emp.last_name?.[0]}
        </div>
        <div>
          <p className="font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
        </div>
      </div>
    )},
    { key: 'phone', label: 'Phone', render: (v) => <span className="text-gray-500">{formatPhone(v) || '—'}</span> },
    { key: 'role', label: 'Role', render: (v) => {
      const b = v === 'tenant_admin' ? 'badge-info' : 'badge-success';
      return <span className={b}>{v === 'tenant_admin' ? 'Admin' : 'Employee'}</span>;
    }},
    { key: 'salary', label: 'Monthly Salary', render: (_, r) => <span className="font-medium">{formatINR(r.base_salary)}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={statusBadge(v)}>{v === 'deactivated' ? 'Deactivated' : 'Active'}</span> },
    { key: 'actions', label: 'Actions', render: (_, emp) => (
      <div className="flex gap-1.5 justify-end">
        <button onClick={(e) => { e.stopPropagation(); mobileEdit(emp); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Edit">{Icons.edit}</button>
        {isAdmin && emp.status === 'active' && (
          <button onClick={(e) => { e.stopPropagation(); handleDeactivate(emp.id, `${emp.first_name} ${emp.last_name}`); }} className="btn-warning !py-1.5 !px-2.5 text-xs">Deactivate</button>
        )}
        {isAdmin && emp.status === 'deactivated' && (
          <button onClick={(e) => { e.stopPropagation(); handleActivate(emp.id); }} className="btn-success !py-1.5 !px-2.5 text-xs">Activate</button>
        )}
        {isAdmin && (
          <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, `${emp.first_name} ${emp.last_name}`); }} className="btn-ghost !py-1.5 !px-2.5 text-xs !text-red-500 hover:!bg-red-50" title="Delete">{Icons.trash}</button>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Error banner */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between animate-slide-up">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-4 shrink-0">&times;</button>
        </div>
      )}
      <UpgradeBanner type="feature" feature="Staff Management" plan="pro" />

      {/* Welcome hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-6 md:p-8 text-white hidden sm:block">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.15) 0%, transparent 50%)' }} />
        <div className="relative">
          <p className="text-sm font-medium text-indigo-200 mb-1">Welcome back,</p>
          <h2 className="text-2xl md:text-3xl font-bold">{user?.firstName} {user?.lastName}</h2>
          <p className="text-indigo-200 mt-1 text-sm">Manage your team and workspace from one place.</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="stat-card flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-indigo-50 items-center justify-center text-indigo-600 shrink-0 hidden sm:flex">{Icons.users}</div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Total</p>
            <p className="text-base sm:text-2xl font-bold text-gray-900">{employees.length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-emerald-50 items-center justify-center text-emerald-600 shrink-0 hidden sm:flex">{Icons.userCheck}</div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Active</p>
            <p className="text-base sm:text-2xl font-bold text-emerald-600">{activeCount}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-2 sm:gap-4 p-3 sm:p-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-xl bg-red-50 items-center justify-center text-red-500 shrink-0 hidden sm:flex">{Icons.userX}</div>
          <div>
            <p className="text-xs sm:text-sm text-gray-500">Deactivated</p>
            <p className="text-base sm:text-2xl font-bold text-red-500">{deactivatedCount}</p>
          </div>
        </div>
      </div>

      {/* Staff Directory */}
      <div className="card animate-slide-up">
        <div className="card-header">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Staff Directory</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{activeCount} active &middot; {employees.length} total</p>
            </div>
            {isAdmin && (
              <div className="flex items-center gap-2">
                <button onClick={() => { setEditingEmployee(null); setForm({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'employee', jobType: 'permanent', baseSalary: '', profession: '', otherProfession: '' }); setShowOnboard(true); }} className="btn-primary">
                  {Icons.userAdd}
                  <span className="hidden sm:inline">Onboard Staff</span>
                </button>
                <button onClick={() => setShowImport(true)} className="btn-secondary">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                  <span className="hidden sm:inline">Import Staff</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search & filters */}
        <div className="px-4 sm:px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{Icons.search}</span>
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          {isAdmin && (
            <label className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer select-none hover:text-gray-800 transition-colors ml-auto sm:ml-0">
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

        {isMobile ? (
          <div className="p-4">
            <ResponsiveTable
              columns={columns}
              data={filtered}
              keyField="id"
              searchKeys={['first_name', 'last_name', 'email', 'phone']}
              loading={loading}
              mobilePrimary="name"
              mobileSecondary="status"
              onRowClick={(emp) => setSelectedRecord(emp)}
              emptyMessage="No staff found"
            />
          </div>
        ) : (
          <>
            {/* Desktop inline-edit table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200">
                    <th className="table-header">Staff</th>
                    <th className="table-header">Phone</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Monthly Salary</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(emp => (
                    <tr key={emp.id} className={`table-row-hover cursor-pointer ${emp.status === 'deactivated' ? 'opacity-60' : ''}`} onClick={() => setSelectedRecord(emp)}>
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
                          <button onClick={(e) => { e.stopPropagation(); mobileEdit(emp); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Edit">{Icons.edit}</button>
                          {isAdmin && emp.status === 'active' && (
                            <button onClick={(e) => { e.stopPropagation(); handleDeactivate(emp.id, `${emp.first_name} ${emp.last_name}`); }} className="btn-warning !py-1.5 !px-2.5 text-xs">Deactivate</button>
                          )}
                          {isAdmin && emp.status === 'deactivated' && (
                            <button onClick={(e) => { e.stopPropagation(); handleActivate(emp.id); }} className="btn-success !py-1.5 !px-2.5 text-xs">Activate</button>
                          )}
                          {isAdmin && (
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, `${emp.first_name} ${emp.last_name}`); }} className="btn-ghost !py-1.5 !px-2.5 text-xs !text-red-500 hover:!bg-red-50" title="Delete">{Icons.trash}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-12">
                      <p className="text-base font-medium mb-1">No staff found</p>
                      <p className="text-sm">{search ? 'Try a different search term.' : 'Click "Onboard Staff" to add your first team member.'}</p>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Onboard modal (also used for editing on mobile) */}
      {showOnboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => { setShowOnboard(false); setEditingEmployee(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editingEmployee ? 'Edit Staff' : 'Onboard New Staff'}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{editingEmployee ? 'Update team member details.' : 'Add a new team member to your organization.'}</p>
              </div>
              <button onClick={() => { setShowOnboard(false); setEditingEmployee(null); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
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
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <PhoneField
                    value={form.phone}
                    onChange={v => { setForm({ ...form, phone: v }); setPhoneErr(''); }}
                    error={phoneErr}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="input-field">
                    <option value="employee">Employee</option>
                    <option value="tenant_admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Type</label>
                  <select value={form.jobType} onChange={e => setForm({ ...form, jobType: e.target.value })} className="input-field">
                    <option value="permanent">Permanent</option>
                    <option value="adhoc">Adhoc (Temporary)</option>
                  </select>
                </div>
                {!editingEmployee && !hideTempPassword && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Temp Password</label>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required className="input-field" />
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Salary (Rs.)</label>
                  <input type="number" min="0" step="0.01" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: e.target.value })} required className="input-field" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profession</label>
                  <SearchableSelect
                    options={[...PROFESSIONS, { value: 'Other', label: 'Other (specify)' }]}
                    value={form.profession}
                    onChange={(val) => setForm({ ...form, profession: val, otherProfession: val === 'Other' ? form.otherProfession : '' })}
                    placeholder="Select profession..."
                  />
                  {form.profession === 'Other' && (
                    <input
                      type="text"
                      value={form.otherProfession}
                      onChange={e => setForm({ ...form, otherProfession: e.target.value })}
                      placeholder="Enter profession"
                      className="input-field mt-2"
                      required
                    />
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowOnboard(false); setEditingEmployee(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{Icons.userAdd} {editingEmployee ? 'Update' : 'Onboard Staff'}</button>
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

      {isMobile ? (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={selectedRecord ? `${selectedRecord.first_name} ${selectedRecord.last_name}` : 'Staff Details'}
          actions={
            <>
              <button onClick={() => mobileEdit(selectedRecord)} className="flex-1 btn-primary justify-center">Edit</button>
              {isAdmin && selectedRecord?.status === 'active' && (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDeactivate(r.id, `${r.first_name} ${r.last_name}`); }} className="flex-1 btn-warning justify-center">Deactivate</button>
              )}
              {isAdmin && selectedRecord?.status === 'deactivated' && (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleActivate(r.id); }} className="flex-1 btn-success justify-center">Activate</button>
              )}
              {isAdmin && (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDelete(r.id, `${r.first_name} ${r.last_name}`); }} className="flex-1 btn-danger justify-center">Delete</button>
              )}
            </>
          }
        >
          {selectedRecord && (
            <div className="space-y-3">
              <DetailRow label="Name" value={`${selectedRecord.first_name} ${selectedRecord.last_name}`} />
              <DetailRow label="Phone" value={formatPhone(selectedRecord.phone)} />
              <DetailRow label="Role" value={selectedRecord.role === 'tenant_admin' ? 'Admin' : 'Employee'} />
              <DetailRow label="Profession" value={selectedRecord.profession || '—'} />
              <DetailRow label="Salary">{formatINR(selectedRecord.base_salary)}</DetailRow>
              <DetailRow label="Status">
                <span className={statusBadge(selectedRecord.status)}>
                  {selectedRecord.status === 'deactivated' ? 'Deactivated' : 'Active'}
                </span>
              </DetailRow>
              <DetailRow label="Onboarded" value={selectedRecord.created_at ? new Date(selectedRecord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
            </div>
          )}
        </BottomSheet>
      ) : !!selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedRecord(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedRecord.first_name} {selectedRecord.last_name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">Staff Details</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <DetailRow label="Name" value={`${selectedRecord.first_name} ${selectedRecord.last_name}`} />
              <DetailRow label="Phone" value={formatPhone(selectedRecord.phone)} />
              <DetailRow label="Role" value={selectedRecord.role === 'tenant_admin' ? 'Admin' : 'Employee'} />
              <DetailRow label="Profession" value={selectedRecord.profession || '—'} />
              <DetailRow label="Salary">{formatINR(selectedRecord.base_salary)}</DetailRow>
              <DetailRow label="Status">
                <span className={statusBadge(selectedRecord.status)}>
                  {selectedRecord.status === 'deactivated' ? 'Deactivated' : 'Active'}
                </span>
              </DetailRow>
              <DetailRow label="Onboarded" value={selectedRecord.created_at ? new Date(selectedRecord.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => mobileEdit(selectedRecord)} className="btn-primary">{Icons.edit} Edit</button>
              {isAdmin && selectedRecord.status === 'active' && (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDeactivate(r.id, `${r.first_name} ${r.last_name}`); }} className="btn-warning">Deactivate</button>
              )}
              {isAdmin && selectedRecord.status === 'deactivated' && (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleActivate(r.id); }} className="btn-success">Activate</button>
              )}
              {isAdmin && (
                <button onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleDelete(r.id, `${r.first_name} ${r.last_name}`); }} className="btn-danger">Delete</button>
              )}
            </div>
          </div>
        </div>
      )}

      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { if (!importLoading) setShowImport(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="text-lg font-semibold text-gray-900">Import Staff</h3>
              <button onClick={() => { if (!importLoading) { setShowImport(false); setImportPreview(null); setImportFile(null); setImportResult(null); } }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400" disabled={importLoading}>{Icons.x}</button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!importPreview && !importResult && (
                <div className="space-y-5">
                  <p className="text-sm text-gray-600">Upload an Excel (.xlsx) or CSV file to create multiple staff members at once. <a href="#!" onClick={(e) => { e.preventDefault(); hrService.downloadImportTemplate(); }} className="text-indigo-600 hover:text-indigo-700 font-medium underline">Download sample template</a></p>
                  <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors">
                    <input type="file" accept=".xlsx,.csv" className="hidden" onChange={e => { setImportFile(e.target.files[0]); setImportPreview(null); setImportResult(null); }} />
                    <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" /></svg>
                    <p className="text-sm text-gray-600 font-medium">{importFile ? importFile.name : 'Click to select file'}</p>
                    <p className="text-xs text-gray-400 mt-1">.xlsx or .csv</p>
                  </label>
                  {importFile && (
                    <div className="flex justify-end">
                      <button onClick={handleImportPreview} className="btn-primary">Preview</button>
                    </div>
                  )}
                </div>
              )}

              {importPreview && !importResult && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">
                        <span className="text-emerald-600 font-medium">{importPreview.validCount}</span> valid · <span className={importPreview.invalidCount > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>{importPreview.invalidCount}</span> invalid · <span className="text-gray-600 font-medium">{importPreview.totalRows}</span> total
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Duplicates:</label>
                      <select value={duplicateAction} onChange={e => setDuplicateAction(e.target.value)} className="input-field text-sm py-1.5">
                        <option value="skip">Skip</option>
                        <option value="overwrite">Overwrite</option>
                      </select>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="max-h-80 overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">#</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Name</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Email</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Job Type</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Salary</th>
                            <th className="text-left px-3 py-2 text-gray-500 font-medium text-xs uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {importPreview.rows.map((row, i) => (
                            <tr key={i} className={row.valid ? '' : 'bg-red-50'}>
                              <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                              <td className="px-3 py-2">
                                <span className="text-gray-900">{row.firstName} {row.lastName}</span>
                                {row.errors.length > 0 && (
                                  <div className="text-xs text-red-500 mt-0.5">{row.errors.join('; ')}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{row.email}</td>
                              <td className="px-3 py-2"><span className={`badge ${row.jobType === 'adhoc' ? 'badge-warning' : 'badge-info'}`}>{row.jobType}</span></td>
                              <td className="px-3 py-2 text-gray-600">{formatINR(Number(row.baseSalary) * 100)}</td>
                              <td className="px-3 py-2"><span className={`badge ${row.status === 'active' ? 'badge-success' : 'badge-danger'}`}>{row.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    <button onClick={() => { setShowImport(false); setImportPreview(null); setImportFile(null); }} className="btn-secondary">Cancel</button>
                    <button onClick={handleImportExecute} disabled={importPreview.validCount === 0 || importLoading} className="btn-primary">{importLoading ? 'Importing...' : `Import ${importPreview.validCount} Staff`}</button>
                  </div>
                </div>
              )}

              {importResult && (
                <div className="space-y-5 text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900">Import Complete</h4>
                    <p className="text-sm text-gray-500 mt-1">{importResult.total} records processed</p>
                  </div>
                  <div className="flex justify-center gap-6">
                    <div className="text-center"><p className="text-2xl font-bold text-emerald-600">{importResult.created}</p><p className="text-xs text-gray-500">Created</p></div>
                    <div className="text-center"><p className="text-2xl font-bold text-indigo-600">{importResult.updated}</p><p className="text-xs text-gray-500">Updated</p></div>
                    <div className="text-center"><p className="text-2xl font-bold text-gray-400">{importResult.skipped}</p><p className="text-xs text-gray-500">Skipped</p></div>
                    <div className="text-center"><p className={`text-2xl font-bold ${importResult.failed?.length > 0 ? 'text-red-500' : 'text-gray-400'}`}>{importResult.failed?.length || 0}</p><p className="text-xs text-gray-500">Failed</p></div>
                  </div>
                  {importResult.failed?.length > 0 && (
                    <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-left">
                      <p className="text-sm font-medium text-red-700 mb-2">Failed Records</p>
                      {importResult.failed.map((f, i) => (
                        <p key={i} className="text-xs text-red-600">{f.email}: {f.reason}</p>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { setShowImport(false); setImportPreview(null); setImportFile(null); setImportResult(null); fetchRoster(); }} className="btn-primary">Done</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default Employees;
