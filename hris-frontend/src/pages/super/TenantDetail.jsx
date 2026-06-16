import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { superService } from '../../services/super.service';
import { formatINR } from '../../utils/currency';

const TABS = ['Employees', 'Calendar', 'Leaves', 'Payroll', 'Settings'];

const TenantDetail = () => {
  const { id } = useParams();
  const [tenant, setTenant] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [activeTab, setActiveTab] = useState('Employees');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [calendarData, setCalendarData] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  const [leaves, setLeaves] = useState([]);
  const [payroll, setPayroll] = useState([]);

  const [companyName, setCompanyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminMsg, setAdminMsg] = useState('');

  useEffect(() => {
    superService.getTenantDetail(id)
      .then(data => {
        setTenant(data.tenant);
        setEmployees(data.employees);
        setAdmin(data.admin);
        setCompanyName(data.tenant.company_name);
        setPrimaryColor(data.tenant.settings?.primaryColor || '#4f46e5');
        if (data.admin) {
          setAdminEmail(data.admin.email || '');
        }
      })
      .catch(() => setError('Failed to load tenant details'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (activeTab === 'Calendar') {
      superService.getTenantCalendar(id, { month: calendarMonth, year: calendarYear })
        .then(setCalendarData)
        .catch(() => {});
    }
    if (activeTab === 'Leaves') {
      superService.getTenantLeaves(id).then(setLeaves).catch(() => {});
    }
    if (activeTab === 'Payroll') {
      superService.getTenantPayroll(id).then(setPayroll).catch(() => {});
    }
  }, [activeTab, id, calendarMonth, calendarYear]);

  const handleSaveSettings = async () => {
    try {
      await superService.updateTenant(id, {
        companyName,
        settings: { primaryColor }
      });
      setSettingsMsg('Settings saved.');
    } catch {
      setSettingsMsg('Failed to save.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !tenant) {
    return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error || 'Tenant not found'}</div>;
  }

  const renderCalendar = () => {
    if (!calendarData) return <div className="p-4 text-gray-400">Loading calendar...</div>;

    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    return (
      <div>
        <div className="flex items-center gap-4 mb-4">
          <button onClick={() => {
            if (calendarMonth === 1) { setCalendarMonth(12); setCalendarYear(calendarYear - 1); }
            else setCalendarMonth(calendarMonth - 1);
          }} className="btn-secondary !py-1 text-sm">&larr; Prev</button>
          <span className="font-medium">{monthNames[calendarMonth - 1]} {calendarYear}</span>
          <button onClick={() => {
            if (calendarMonth === 12) { setCalendarMonth(1); setCalendarYear(calendarYear + 1); }
            else setCalendarMonth(calendarMonth + 1);
          }} className="btn-secondary !py-1 text-sm">Next &rarr;</button>
        </div>

        {calendarData.employees?.map(emp => (
          <div key={emp.employee.id} className="mb-4 pb-4 border-b border-gray-100 last:border-0">
            <p className="font-medium text-sm text-gray-700 mb-2">
              {emp.employee.firstName} {emp.employee.lastName}
              <span className="text-gray-400 ml-2 text-xs">({emp.employee.role})</span>
            </p>
            <div className="flex flex-wrap gap-1">
              {emp.days.map(d => {
                const colors = {
                  present: 'bg-emerald-400',
                  absent: 'bg-red-400',
                  sick: 'bg-amber-400',
                  annual: 'bg-blue-400',
                  weekend: 'bg-gray-200',
                  idle: 'bg-gray-100',
                };
                const dayNum = String(d.day).padStart(2, '0');
                return (
                  <div
                    key={d.date}
                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${colors[d.type] || 'bg-gray-100'}`}
                    title={`${d.date}: ${d.label || d.type}`}
                  >
                    {dayNum}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {(!calendarData.employees || calendarData.employees.length === 0) && (
          <p className="text-gray-400 text-sm">No employees found for this period.</p>
        )}

        <div className="flex gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block"></span> Present</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block"></span> Absent</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block"></span> Sick</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-400 inline-block"></span> Annual</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block"></span> Weekend</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/super/tenants" className="text-sm text-indigo-600 hover:text-indigo-500 font-medium">&larr; Back to Tenants</Link>
          <h2 className="text-2xl font-bold text-gray-900 mt-1">{tenant.company_name}</h2>
          <p className="text-sm text-gray-500">Subdomain: {tenant.subdomain} | ID: {tenant.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-info">{tenant.employee_count} employees</span>
          <span className="badge badge-warning">{tenant.leave_count || 0} leaves</span>
        </div>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-indigo-600 border-b-2 border-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="card">
        <div className="p-6">
          {activeTab === 'Employees' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-header">Name</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Base Salary</th>
                    <th className="table-header">Joined</th>
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
                      <td className="table-cell font-medium">{formatINR(emp.base_salary)}</td>
                      <td className="table-cell text-gray-500">
                        {new Date(emp.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">No employees</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Calendar' && renderCalendar()}

          {activeTab === 'Leaves' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-header">Employee</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">From</th>
                    <th className="table-header">To</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td className="table-cell">{l.first_name} {l.last_name}</td>
                      <td className="table-cell">{l.leave_type}</td>
                      <td className="table-cell text-gray-500">{new Date(l.start_date).toLocaleDateString()}</td>
                      <td className="table-cell text-gray-500">{new Date(l.end_date).toLocaleDateString()}</td>
                      <td className="table-cell">
                        <span className={`badge ${
                          l.status === 'approved' ? 'badge-success' :
                          l.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                        }`}>{l.status}</span>
                      </td>
                    </tr>
                  ))}
                  {leaves.length === 0 && (
                    <tr><td colSpan={5} className="table-cell text-center text-gray-400 py-8">No leaves</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Payroll' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="table-header">Employee</th>
                    <th className="table-header">Period</th>
                    <th className="table-header">Gross</th>
                    <th className="table-header">Deductions</th>
                    <th className="table-header">Net</th>
                    <th className="table-header">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payroll.map(p => (
                    <tr key={p.id}>
                      <td className="table-cell">{p.first_name} {p.last_name}</td>
                      <td className="table-cell text-gray-500">{new Date(p.pay_period_start).toLocaleDateString()} - {new Date(p.pay_period_end).toLocaleDateString()}</td>
                      <td className="table-cell">{formatINR(p.gross_salary)}</td>
                      <td className="table-cell text-red-600">-{formatINR(p.deductions)}</td>
                      <td className="table-cell font-medium">{formatINR(p.net_salary)}</td>
                      <td className="table-cell"><span className="badge badge-info">{p.status}</span></td>
                    </tr>
                  ))}
                  {payroll.length === 0 && (
                    <tr><td colSpan={6} className="table-cell text-center text-gray-400 py-8">No payroll records</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Branding</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                    <div className="flex items-center gap-4">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded border border-gray-300 cursor-pointer" />
                      <code className="text-sm text-gray-500">{primaryColor}</code>
                    </div>
                  </div>
                  {settingsMsg && <p className="text-sm text-emerald-600">{settingsMsg}</p>}
                  <button onClick={handleSaveSettings} className="btn-primary">Save Branding</button>
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Admin Credentials</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                    <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)} className="input-field" placeholder={admin?.email || 'admin@company.com'} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="input-field" placeholder="Leave blank to keep current" />
                  </div>
                  {adminMsg && <p className="text-sm text-emerald-600">{adminMsg}</p>}
                  <button onClick={async () => {
                    try {
                      const payload = {};
                      if (adminEmail) payload.email = adminEmail;
                      if (adminPassword) payload.password = adminPassword;
                      if (Object.keys(payload).length === 0) return;
                      await superService.updateTenantAdmin(id, payload);
                      setAdminMsg('Admin credentials updated.');
                      setAdminPassword('');
                    } catch (err) {
                      setAdminMsg(err.response?.data?.error || 'Failed to update.');
                    }
                  }} className="btn-secondary">Update Admin Credentials</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantDetail;
