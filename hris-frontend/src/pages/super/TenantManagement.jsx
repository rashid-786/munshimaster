import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { Link } from 'react-router-dom';
import useIsMobile from '../../hooks/useIsMobile';

const TenantManagement = () => {
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    companyName: '', subdomain: '', firstName: '', lastName: '', email: '', phone: '', password: '', color: '#4f46e5'
  });
  const limit = 20;
  const isMobile = useIsMobile();

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await superService.getTenants({ page, limit, search });
      setTenants(data.tenants);
      setTotal(data.total);
    } catch (err) {
      setError('Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, [page, search]);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently delete "${name}" and ALL associated data? This cannot be undone.`)) return;
    try {
      await superService.deleteTenant(id);
      fetchTenants();
    } catch (err) {
      setError('Failed to delete tenant.');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await superService.createTenant({
        companyName: form.companyName,
        subdomain: form.subdomain.toLowerCase().replace(/[^a-z0-9-]/g, ''),
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        settings: { primaryColor: form.color }
      });
      setShowForm(false);
      setForm({ companyName: '', subdomain: '', firstName: '', lastName: '', email: '', phone: '', password: '', color: '#4f46e5' });
      fetchTenants();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create tenant.');
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
      </div>}

      {showForm && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Create New Tenant</h3>
          </div>
          <form onSubmit={handleCreate} className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} required className="input-field" placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subdomain</label>
                <input type="text" value={form.subdomain} onChange={e => setForm({...form, subdomain: e.target.value})} required className="input-field" placeholder="acme-corp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Brand Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-12 h-10 rounded border border-gray-300 cursor-pointer" />
                  <code className="text-xs text-gray-500">{form.color}</code>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin First Name</label>
                <input type="text" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required className="input-field" placeholder="Raj" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Last Name</label>
                <input type="text" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required className="input-field" placeholder="Sharma" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required className="input-field" placeholder="raj@acme.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Phone</label>
                <input type="text" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" placeholder="+91 98765 43210" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required className="input-field" placeholder="Set password" />
              </div>
            </div>
            <button type="submit" className="btn-primary">Create Tenant</button>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 w-full">
            <input
              type="text"
              placeholder="Search by company name or subdomain..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input-field max-w-md flex-1"
            />
            <button onClick={() => setShowForm(!showForm)} className="btn-primary shrink-0">
              {showForm ? 'Cancel' : '+ New Tenant'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
          </div>
        ) : isMobile ? (
          <>
            <div className="divide-y divide-gray-100">
              {tenants.map((tenant) => (
                <div key={tenant.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 truncate flex-1">{tenant.company_name}</p>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <Link to={`/super/tenants/${tenant.id}`} className="btn-secondary !py-1 !px-2.5 text-xs">Manage</Link>
                      <button onClick={() => handleDelete(tenant.id, tenant.company_name)} className="btn-danger !py-1 !px-2.5 text-xs">Delete</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{tenant.subdomain}</span>
                    <span>&middot;</span>
                    <span>{tenant.employee_count} employees</span>
                    <span>&middot;</span>
                    <span>{new Date(tenant.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {tenants.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No tenants found</div>}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <span className="text-sm text-gray-500">{total} total</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="btn-secondary !py-1 text-xs">Prev</button>
                  <span className="text-sm text-gray-600 self-center">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-secondary !py-1 text-xs">Next</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-header">Company Name</th>
                    <th className="table-header">Subdomain</th>
                    <th className="table-header">Admin Email</th>
                    <th className="table-header">Employees</th>
                    <th className="table-header">Created</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium">{tenant.company_name}</td>
                      <td className="table-cell text-gray-500">{tenant.subdomain}</td>
                      <td className="table-cell text-gray-500 text-sm">{tenant.admin_email || '-'}</td>
                      <td className="table-cell">
                        <span className="badge badge-info">{tenant.employee_count}</span>
                      </td>
                      <td className="table-cell text-gray-500">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/super/tenants/${tenant.id}`}
                            className="btn-secondary !py-1 !px-3 text-xs"
                          >
                            Manage
                          </Link>
                          <button
                            onClick={() => handleDelete(tenant.id, tenant.company_name)}
                            className="btn-danger !py-1 !px-3 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tenants.length === 0 && (
                    <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">No tenants found</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary !py-1.5 text-sm"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary !py-1.5 text-sm"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TenantManagement;
