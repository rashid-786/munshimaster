import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { Link } from 'react-router-dom';
import { formatINR } from '../../utils/currency';

const AllEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');
  const [tenants, setTenants] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', role: '', baseSalary: '' });
  const limit = 50;

  useEffect(() => {
    superService.getTenants({ limit: 100 })
      .then(data => setTenants(data.tenants || []))
      .catch(() => {});
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const params = { page, limit, search };
      if (tenantFilter) params.tenantId = tenantFilter;
      const data = await superService.getAllEmployees(params);
      setEmployees(data.employees);
      setTotal(data.total);
    } catch {
      setError('Failed to load employees.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, [page, search, tenantFilter]);

  const startEdit = (emp) => {
    setEditId(emp.id);
    setEditForm({
      firstName: emp.first_name,
      lastName: emp.last_name,
      email: emp.email,
      role: emp.role,
      baseSalary: (emp.base_salary / 100).toFixed(2)
    });
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditForm({ firstName: '', lastName: '', email: '', role: '', baseSalary: '' });
  };

  const saveEdit = async (id) => {
    try {
      await superService.updateEmployee(id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        email: editForm.email,
        role: editForm.role,
        baseSalary: editForm.baseSalary
      });
      setEditId(null);
      fetchEmployees();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update employee.');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">All Employees</h2>
        <span className="text-sm text-gray-500">{total} employee(s)</span>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
      </div>}

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search by name, email, or company..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input-field max-w-md"
            />
            <select
              value={tenantFilter}
              onChange={e => { setTenantFilter(e.target.value); setPage(1); }}
              className="input-field max-w-xs"
            >
              <option value="">All Tenants</option>
              {tenants.map(t => (
                <option key={t.id} value={t.id}>{t.company_name}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-header">Name</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Company</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Salary</th>
                    <th className="table-header">Joined</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {employees.map(emp => (
                    <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                      {editId === emp.id ? (
                        <>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <input type="text" name="firstName" value={editForm.firstName} onChange={e => setEditForm({...editForm, firstName: e.target.value})} className="input-field !py-1 text-sm w-24" />
                              <input type="text" name="lastName" value={editForm.lastName} onChange={e => setEditForm({...editForm, lastName: e.target.value})} className="input-field !py-1 text-sm w-24" />
                            </div>
                          </td>
                          <td className="table-cell">
                            <input type="email" name="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="input-field !py-1 text-sm" />
                          </td>
                          <td className="table-cell text-gray-500">{emp.company_name}</td>
                          <td className="table-cell">
                            <select name="role" value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="input-field !py-1 text-sm">
                              <option value="employee">Employee</option>
                              <option value="tenant_admin">Admin</option>
                            </select>
                          </td>
                          <td className="table-cell">
                            <input type="number" name="baseSalary" value={editForm.baseSalary} onChange={e => setEditForm({...editForm, baseSalary: e.target.value})} className="input-field !py-1 text-sm w-28" />
                          </td>
                          <td className="table-cell text-gray-500">{new Date(emp.created_at).toLocaleDateString()}</td>
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
                          <td className="table-cell">
                            <Link to={`/super/tenants/${emp.tenant_id}`} className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                              {emp.company_name}
                            </Link>
                          </td>
                          <td className="table-cell">
                            <span className={`badge ${emp.role === 'tenant_admin' ? 'badge-info' : 'badge-success'}`}>
                              {emp.role === 'tenant_admin' ? 'Admin' : 'Employee'}
                            </span>
                          </td>
                          <td className="table-cell font-medium">{formatINR(emp.base_salary)}</td>
                          <td className="table-cell text-gray-500">{new Date(emp.created_at).toLocaleDateString()}</td>
                          <td className="table-cell">
                            <button onClick={() => startEdit(emp)} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={7} className="table-cell text-center text-gray-400 py-8">No employees found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary !py-1.5 text-sm">Previous</button>
                <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary !py-1.5 text-sm">Next</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AllEmployees;
