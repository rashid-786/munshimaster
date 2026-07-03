import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { superService } from '../../services/super.service';
import { formatINR } from '../../utils/currency';
import useIsMobile from '../../hooks/useIsMobile';

const TABS = ['Employees', 'Calendar', 'Leaves', 'Payroll', 'Overrides', 'Audit Log', 'Settings'];

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
  const [hiddenGroups, setHiddenGroups] = useState({});
  const [subscriptionPlan, setSubscriptionPlan] = useState('free');
  const [settingsMsg, setSettingsMsg] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const isMobile = useIsMobile();

  // Override state
  const [overrides, setOverrides] = useState([]);
  const [overrideHistory, setOverrideHistory] = useState([]);
  const [newOverrideKey, setNewOverrideKey] = useState('');
  const [newOverrideValue, setNewOverrideValue] = useState('');
  const [newOverrideExpiry, setNewOverrideExpiry] = useState('');
  const [overrideMsg, setOverrideMsg] = useState('');
  const [extraQuotaKey, setExtraQuotaKey] = useState('');
  const [extraQuotaAmount, setExtraQuotaAmount] = useState('');
  const [extraQuotaDays, setExtraQuotaDays] = useState('');
  const [extraQuotaMsg, setExtraQuotaMsg] = useState('');
  const [forcePlan, setForcePlan] = useState('');
  const [forcePlanReason, setForcePlanReason] = useState('');
  const [forcePlanMsg, setForcePlanMsg] = useState('');

  // Audit log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditLogLimit, setAuditLogLimit] = useState(50);
  const [auditLogOffset, setAuditLogOffset] = useState(0);
  const [auditLogFilter, setAuditLogFilter] = useState('');
  const [auditLogLoading, setAuditLogLoading] = useState(false);

  useEffect(() => {
    superService.getTenantDetail(id)
      .then(data => {
        setTenant(data.tenant);
        setEmployees(data.employees);
        setAdmin(data.admin);
        setCompanyName(data.tenant.company_name);
        setPrimaryColor(data.tenant.settings?.primaryColor || '#4f46e5');
        setHiddenGroups(data.tenant.settings?.hiddenGroups || {});
        setSubscriptionPlan(data.tenant.subscription_plan || 'free');
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
    if (activeTab === 'Overrides') {
      superService.listOverrides(id).then(d => setOverrides(d.overrides)).catch(() => {});
      superService.getOverrideHistory(id).then(d => setOverrideHistory(d.history)).catch(() => {});
    }
    if (activeTab === 'Audit Log') {
      fetchAuditLogs();
    }
  }, [activeTab, id, calendarMonth, calendarYear]);

  const fetchAuditLogs = async (offset = 0) => {
    setAuditLogLoading(true);
    try {
      const params = { limit: auditLogLimit, offset };
      if (auditLogFilter) params.action = auditLogFilter;
      const data = await superService.getTenantAuditLog(id, params);
      setAuditLogs(data.logs);
      setAuditLogTotal(data.total);
      setAuditLogOffset(offset);
    } catch {}
    setAuditLogLoading(false);
  };

  const PLANS = [
    { value: 'free', label: 'Free (Ledger)' },
    { value: 'pro', label: 'Pro (+ Business)' },
    { value: 'enterprise', label: 'Enterprise (+ HR)' },
  ];

  const handleSaveSettings = async () => {
    try {
      await superService.updateTenant(id, {
        companyName,
        subscriptionPlan,
        settings: { primaryColor, hiddenGroups }
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
            isMobile ? (
              <div className="divide-y divide-gray-100 -mx-6">
                {employees.map(emp => (
                  <div key={emp.id} className="px-6 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.first_name} {emp.last_name}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{emp.email}</p>
                      </div>
                      <span className={`badge shrink-0 ${emp.role === 'tenant_admin' ? 'badge-info' : 'badge-success'}`}>
                        {emp.role === 'tenant_admin' ? 'Admin' : 'Employee'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                      <span className="font-medium text-gray-700">{formatINR(emp.base_salary)}</span>
                      <span>&middot;</span>
                      <span>Joined {new Date(emp.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {employees.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No employees</div>}
              </div>
            ) : (
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
            )
          )}

          {activeTab === 'Calendar' && renderCalendar()}

          {activeTab === 'Leaves' && (
            isMobile ? (
              <div className="divide-y divide-gray-100 -mx-6">
                {leaves.map(l => (
                  <div key={l.id} className="px-6 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{l.first_name} {l.last_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{l.leave_type}</p>
                      </div>
                      <span className={`badge shrink-0 ${
                        l.status === 'approved' ? 'badge-success' :
                        l.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                      }`}>{l.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                      <span>{new Date(l.start_date).toLocaleDateString()} - {new Date(l.end_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
                {leaves.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No leaves</div>}
              </div>
            ) : (
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
            )
          )}

          {activeTab === 'Payroll' && (
            isMobile ? (
              <div className="divide-y divide-gray-100 -mx-6">
                {payroll.map(p => (
                  <div key={p.id} className="px-6 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(p.pay_period_start).toLocaleDateString()} - {new Date(p.pay_period_end).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="badge badge-info shrink-0">{p.status}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 text-xs">
                      <div className="flex items-center gap-3 text-gray-500">
                        <span>Gross: <span className="font-medium text-gray-700">{formatINR(p.gross_salary)}</span></span>
                        <span className="text-red-600">-{formatINR(p.deductions)}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{formatINR(p.net_salary)}</span>
                    </div>
                  </div>
                ))}
                {payroll.length === 0 && <div className="text-center text-gray-400 py-8 text-sm">No payroll records</div>}
              </div>
            ) : (
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
            )
          )}

          {activeTab === 'Overrides' && (
            <div className="max-w-3xl space-y-8">
              {/* ── Current Overrides ── */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Feature Limit Overrides</h4>
                {overrides.length === 0 ? (
                  <p className="text-sm text-gray-400">No overrides configured.</p>
                ) : (
                  <div className="space-y-2">
                    {overrides.map(ov => (
                      <div key={ov.featureKey} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                        <div>
                          <span className="font-medium text-gray-700">{ov.featureKey}</span>
                          <span className="text-gray-500 ml-3">Max: <strong>{ov.maxValue ?? 'Unlimited'}</strong></span>
                          {ov.expiresAt && <span className="text-gray-400 ml-3">Expires: {new Date(ov.expiresAt).toLocaleDateString()}</span>}
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm('Remove this override?')) return;
                            try {
                              await superService.removeOverride(id, ov.featureKey);
                              setOverrides(overrides.filter(o => o.featureKey !== ov.featureKey));
                              setOverrideMsg('Override removed.');
                            } catch (e) { setOverrideMsg(e.response?.data?.error || 'Failed.'); }
                          }}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >Remove</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <hr className="border-gray-200" />

              {/* ── Add / Edit Override ── */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Add / Update Override</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <select value={newOverrideKey} onChange={e => setNewOverrideKey(e.target.value)} className="input-field">
                    <option value="">Select feature...</option>
                    {['customers','suppliers','staff_members','branches','monthly_transactions','products','entities'].map(k => (
                      <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="Max value (-1 = unlimited)" value={newOverrideValue} onChange={e => setNewOverrideValue(e.target.value)} className="input-field" />
                  <input type="date" value={newOverrideExpiry} onChange={e => setNewOverrideExpiry(e.target.value)} className="input-field" />
                  <button
                    onClick={async () => {
                      if (!newOverrideKey) return;
                      try {
                        const data = { featureKey: newOverrideKey, maxValue: newOverrideValue === '' ? null : Number(newOverrideValue) };
                        if (newOverrideExpiry) data.expiresAt = new Date(newOverrideExpiry).toISOString();
                        await superService.setOverride(id, data);
                        const res = await superService.listOverrides(id);
                        setOverrides(res.overrides);
                        setOverrideMsg(`Override for "${newOverrideKey}" saved.`);
                        setNewOverrideKey(''); setNewOverrideValue(''); setNewOverrideExpiry('');
                      } catch (e) { setOverrideMsg(e.response?.data?.error || 'Failed.'); }
                    }}
                    className="btn-primary text-sm"
                  >Save</button>
                </div>
              </div>

              {overrideMsg && <p className="text-sm text-emerald-600">{overrideMsg}</p>}

              <hr className="border-gray-200" />

              {/* ── Grant Extra Quota ── */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Grant Extra Quota</h4>
                <p className="text-sm text-gray-500 mb-3">Temporarily increase a limit beyond the plan allowance.</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <select value={extraQuotaKey} onChange={e => setExtraQuotaKey(e.target.value)} className="input-field">
                    <option value="">Select feature...</option>
                    {['customers','suppliers','staff_members','branches','monthly_transactions','products','entities'].map(k => (
                      <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="Extra amount" value={extraQuotaAmount} onChange={e => setExtraQuotaAmount(e.target.value)} className="input-field" />
                  <input type="number" placeholder="Duration (days)" value={extraQuotaDays} onChange={e => setExtraQuotaDays(e.target.value)} className="input-field" />
                  <button
                    onClick={async () => {
                      if (!extraQuotaKey || !extraQuotaAmount) return;
                      try {
                        await superService.grantExtraQuota(id, {
                          featureKey: extraQuotaKey,
                          extraAmount: Number(extraQuotaAmount),
                          durationDays: extraQuotaDays ? Number(extraQuotaDays) : null,
                        });
                        setExtraQuotaMsg(`+${extraQuotaAmount} ${extraQuotaKey} granted.`);
                        const res = await superService.listOverrides(id);
                        setOverrides(res.overrides);
                        setExtraQuotaKey(''); setExtraQuotaAmount(''); setExtraQuotaDays('');
                      } catch (e) { setExtraQuotaMsg(e.response?.data?.error || 'Failed.'); }
                    }}
                    className="btn-primary text-sm"
                  >Grant</button>
                </div>
                {extraQuotaMsg && <p className="text-sm text-emerald-600 mt-2">{extraQuotaMsg}</p>}
              </div>

              <hr className="border-gray-200" />

              {/* ── Force Plan Change ── */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Force Plan Change</h4>
                <p className="text-sm text-gray-500 mb-3">Immediately change this tenant's subscription plan.</p>
                <div className="flex items-end gap-3 flex-wrap">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">New Plan</label>
                    <select value={forcePlan} onChange={e => setForcePlan(e.target.value)} className="input-field">
                      <option value="">Select plan...</option>
                      <option value="FREE">Free</option>
                      <option value="MANAGE">Manage</option>
                      <option value="BUSINESS">Business</option>
                      <option value="BUSINESS_PRO">Business Pro</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-gray-500 mb-1">Reason</label>
                    <input type="text" placeholder="Optional reason" value={forcePlanReason} onChange={e => setForcePlanReason(e.target.value)} className="input-field" />
                  </div>
                  <button
                    onClick={async () => {
                      if (!forcePlan) return;
                      try {
                        await superService.forcePlanChange(id, { plan: forcePlan, reason: forcePlanReason || undefined });
                        setForcePlanMsg(`Plan changed to ${forcePlan}.`);
                        setForcePlan(''); setForcePlanReason('');
                      } catch (e) { setForcePlanMsg(e.response?.data?.error || 'Failed.'); }
                    }}
                    className="btn-primary text-sm"
                  >Apply</button>
                </div>
                {forcePlanMsg && <p className="text-sm text-emerald-600 mt-2">{forcePlanMsg}</p>}
              </div>

              <hr className="border-gray-200" />

              {/* ── Override History ── */}
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-3">Override Change History</h4>
                {overrideHistory.length === 0 ? (
                  <p className="text-sm text-gray-400">No changes recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="table-header">Action</th>
                          <th className="table-header">Feature</th>
                          <th className="table-header">Old Value</th>
                          <th className="table-header">New Value</th>
                          <th className="table-header">Admin</th>
                          <th className="table-header">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {overrideHistory.map(h => (
                          <tr key={h.id}>
                            <td className="table-cell"><span className={`badge ${h.action === 'deleted' ? 'badge-danger' : h.action === 'created' ? 'badge-success' : 'badge-warning'}`}>{h.action}</span></td>
                            <td className="table-cell font-medium">{h.feature_key}</td>
                            <td className="table-cell text-gray-500">{h.old_value ?? '—'}</td>
                            <td className="table-cell text-gray-500">{h.new_value ?? '—'}</td>
                            <td className="table-cell text-gray-500">{h.admin_name || '—'}</td>
                            <td className="table-cell text-gray-500">{new Date(h.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'Audit Log' && (
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 mb-4">
                <h4 className="text-base font-semibold text-gray-900">Subscription Audit Log</h4>
                <select value={auditLogFilter} onChange={e => { setAuditLogFilter(e.target.value); fetchAuditLogs(0); }} className="input-field max-w-xs text-sm">
                  <option value="">All actions</option>
                  <option value="plan.upgrade">Upgrades</option>
                  <option value="plan.downgrade">Downgrades</option>
                  <option value="plan.cancel">Cancellations</option>
                  <option value="plan.suspend">Suspensions</option>
                  <option value="plan.reactivate">Reactivations</option>
                  <option value="plan.force_upgrade">Force Upgrades</option>
                  <option value="limit.violation">Limit Violations</option>
                  <option value="quota.extra_granted">Extra Quota Grants</option>
                  <option value="limit.override.created">Override Created</option>
                  <option value="limit.override.deleted">Override Deleted</option>
                  <option value="admin.action">Admin Actions</option>
                </select>
              </div>

              {auditLogLoading ? (
                <div className="flex justify-center py-8"><div className="animate-spin h-6 w-6 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-gray-400">No audit logs found.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="table-header">Action</th>
                          <th className="table-header">Entity</th>
                          <th className="table-header">Changes</th>
                          <th className="table-header">Actor</th>
                          <th className="table-header">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {auditLogs.map(log => (
                          <tr key={log.id}>
                            <td className="table-cell">
                              <span className="text-xs font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">{log.action}</span>
                            </td>
                            <td className="table-cell text-gray-500">{log.entity_type}{log.entity_id ? `:${log.entity_id}` : ''}</td>
                            <td className="table-cell text-gray-500 text-xs max-w-[200px] truncate">{log.changes ? JSON.stringify(log.changes).slice(0, 80) : '—'}</td>
                            <td className="table-cell text-gray-500">{log.actor_name || 'System'}</td>
                            <td className="table-cell text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                    <span>Showing {auditLogs.length} of {auditLogTotal} entries</span>
                    <div className="flex gap-2">
                      <button disabled={auditLogOffset === 0} onClick={() => fetchAuditLogs(Math.max(0, auditLogOffset - auditLogLimit))}
                        className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-50">Prev</button>
                      <button disabled={auditLogOffset + auditLogLimit >= auditLogTotal} onClick={() => fetchAuditLogs(auditLogOffset + auditLogLimit)}
                        className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-50">Next</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'Settings' && (
            <div className="max-w-2xl space-y-8">
              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Subscription Plan</h4>
                <select
                  value={subscriptionPlan}
                  onChange={e => setSubscriptionPlan(e.target.value)}
                  className="input-field max-w-xs"
                >
                  {PLANS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <hr className="border-gray-200" />

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
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <h4 className="text-base font-semibold text-gray-900 mb-4">Sidebar Visibility</h4>
                <p className="text-sm text-gray-500 mb-3">Hide modules from this tenant's sidebar navigation.</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!hiddenGroups['My Bahi Book']} onChange={e => setHiddenGroups({ ...hiddenGroups, 'My Bahi Book': e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Hide My Bahi Book</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!hiddenGroups['My Business']} onChange={e => setHiddenGroups({ ...hiddenGroups, 'My Business': e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Hide My Business</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!hiddenGroups['My Staff']} onChange={e => setHiddenGroups({ ...hiddenGroups, 'My Staff': e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Hide My Staff</span>
                  </label>
                </div>
              </div>

              {settingsMsg && <p className="text-sm text-emerald-600">{settingsMsg}</p>}
              <button onClick={handleSaveSettings} className="btn-primary">Save Settings</button>

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
