import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { superService } from '../../services/super.service';
import { TenantStatusBadge, PlanBadge, TrialStatusBadge } from '../../components/super/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../components/super/States';
import ConfirmDialog from '../../components/super/ConfirmDialog';
import ChangePlanModal from '../../components/super/ChangePlanModal';
import ExtendTrialModal from '../../components/ExtendTrialModal';
import FeatureOverrideModal from '../../components/FeatureOverrideModal';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const fmtNum = n => (n ?? 0).toLocaleString('en-IN');
const fmtINR = n => n ? '₹' + Number(n).toLocaleString('en-IN') : '₹0';

const TABS = ['Overview', 'Subscription', 'Usage', 'Features', 'Sections', 'Audit'];

export default function TenantDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [error, setError] = useState('');

  const [tenant, setTenant] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [admin, setAdmin] = useState(null);
  const [plans, setPlans] = useState([]);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState({ main: true, sub: false, usage: false });

  const [confirmAction, setConfirmAction] = useState(null);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [extendTrialOpen, setExtendTrialOpen] = useState(false);
  const [featureOverrideOpen, setFeatureOverrideOpen] = useState(false);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [activationMsg, setActivationMsg] = useState(null);

  // Fetch tenant
  const fetchTenant = useCallback(async () => {
    try {
      const [t, a] = await Promise.all([
        superService.getTenantDetail(id),
        superService.getTenantSubscription(id).catch(() => null),
      ]);
      const detail = t.tenant || t;
      setTenant(detail);
      setEmployees(detail.employees || t.employees || []);
      setAdmin(t.admin || null);
      setSubscriptionData(a);
    } catch { setError('Failed to load tenant.'); }
    setLoading(p => ({ ...p, main: false }));
  }, [id]);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  // Lazy tab data
  useEffect(() => {
    if (activeTab === 'Subscription' && !subscriptionData && !loading.sub) {
      setLoading(p => ({ ...p, sub: true }));
      superService.getTenantSubscription(id).then(d => setSubscriptionData(d)).catch(() => {}).finally(() => setLoading(p => ({ ...p, sub: false })));
    }
    if (activeTab === 'Usage' && !usageData && !loading.usage) {
      setLoading(p => ({ ...p, usage: true }));
      superService.getTenantUsage(id).then(d => setUsageData(d)).catch(() => {}).finally(() => setLoading(p => ({ ...p, usage: false })));
    }
  }, [activeTab, id, subscriptionData, usageData, loading]);

  useEffect(() => {
    if (changePlanOpen && plans.length === 0) {
      superService.listPlans().then(d => setPlans(d.plans || [])).catch(() => {});
    }
  }, [changePlanOpen, plans.length]);

  if (loading.main) return <LoadingState type="card" rows={4} />;
  if (error) return <ErrorState message={error} onRetry={fetchTenant} />;
  if (!tenant) return <EmptyState title="Tenant not found" />;

  const isActive = tenant.status !== 'inactive' && tenant.subscription_status !== 'suspended';
  const isTrialing = tenant.subscription_status === 'trialing';
  const sd = subscriptionData || {};
  const ud = usageData || {};

  const handleActivateTrial = async () => {
    setActivatingTrial(true);
    setActivationMsg(null);
    try {
      const res = await superService.activateTrial(tenant.id, { planId: 'manage' });
      setActivationMsg(res.message || '14-day trial activated!');
      fetchTenant();
    } catch (err) {
      setActivationMsg('Failed to activate trial.');
    }
    setActivatingTrial(false);
  };

  return (
    <div className="space-y-5">
      {/* Back + Header */}
      <div className="flex items-center gap-3 text-sm">
        <Link to="/super/tenants" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-600 font-medium">Tenants</span>
        <span className="text-gray-300">/</span>
        <span className="text-gray-900 font-semibold truncate">{tenant.company_name || 'Detail'}</span>
      </div>

      {/* Tenant Header Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {(tenant.company_name || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-gray-900">{tenant.company_name || 'Unnamed'}</h1>
                <TenantStatusBadge status={tenant.subscription_status || tenant.status} size="md" />
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                <span>{tenant.email}</span>
                {tenant.phone && <span>{tenant.phone}</span>}
                {tenant.owner_name && <span>Owner: {tenant.owner_name}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PlanBadge plan={tenant.subscription_plan} size="md" />
            {isTrialing && <TrialStatusBadge daysLeft={tenant.trial_days_left} size="md" />}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`text-sm px-4 py-3 font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'Overview' && renderOverview()}
        {activeTab === 'Subscription' && renderSubscription()}
        {activeTab === 'Usage' && renderUsage()}
        {activeTab === 'Features' && renderFeatures()}
        {activeTab === 'Sections' && renderSections()}
        {activeTab === 'Audit' && renderAudit()}
      </div>

      {/* Modals */}
      {changePlanOpen && <ChangePlanModal open onClose={() => setChangePlanOpen(false)} tenant={tenant} plans={plans} onConfirm={handleChangePlan} />}
      {extendTrialOpen && <ExtendTrialModal open onClose={() => setExtendTrialOpen(false)} tenant={tenant} onExtend={() => { setExtendTrialOpen(false); fetchTenant(); }} />}
      {featureOverrideOpen && <FeatureOverrideModal open onClose={() => setFeatureOverrideOpen(false)} tenantId={id} onSave={() => setFeatureOverrideOpen(false)} />}
      {confirmAction && (
        <ConfirmDialog open onClose={() => setConfirmAction(null)} onConfirm={handleConfirm}
          title={confirmAction.title} message={confirmAction.message} variant={confirmAction.variant} confirmLabel={confirmAction.label} />
      )}
    </div>
  );

  // ─── Overview Tab ────────────────────────────────────
  function renderOverview() {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Employees" value={fmtNum(ud.liveCounts?.employees ?? employees.length)} color="text-indigo-600" />
            <StatCard label="Plan" value={(tenant.subscription_plan || 'FREE').replace(/_/g, ' ')} sub={tenant.plan_price ? `₹${Number(tenant.plan_price).toLocaleString('en-IN')}/yr` : ''} />
            <StatCard label="Trial Ends" value={tenant.trial_end ? fmtDate(tenant.trial_end) : '—'} sub={tenant.trial_days_left > 0 ? `${tenant.trial_days_left} days left` : ''} />
            <StatCard label="Created" value={fmtDate(tenant.created_at)} />
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>

            {activationMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center justify-between">
                <span>{activationMsg}</span>
                <button onClick={() => setActivationMsg(null)} className="text-emerald-500 hover:text-emerald-700 ml-2">&times;</button>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {isActive ? (
                <button onClick={() => setConfirmAction({ title: 'Suspend Tenant', message: `Suspend "${tenant.company_name}"? Users will lose access.`, variant: 'warning', label: 'Suspend', action: 'suspend' })}
                  className="text-xs px-4 py-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium transition-colors">Suspend</button>
              ) : (
                <button onClick={() => setConfirmAction({ title: 'Reactivate Tenant', message: `Reactivate "${tenant.company_name}"? Access will be restored.`, variant: 'warning', label: 'Reactivate', action: 'reactivate' })}
                  className="text-xs px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium transition-colors">Reactivate</button>
              )}
              {!isTrialing && (
                <button onClick={handleActivateTrial} disabled={activatingTrial}
                  className="text-xs px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium transition-colors disabled:opacity-50">
                  {activatingTrial ? 'Activating...' : 'Start 14-Day Trial'}
                </button>
              )}
              {isTrialing && (
                <button onClick={() => setExtendTrialOpen(true)} className="text-xs px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium transition-colors">Extend Trial</button>
              )}
              <button onClick={() => setChangePlanOpen(true)} className="text-xs px-4 py-2 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 font-medium transition-colors">Change Plan</button>
              <button onClick={() => setFeatureOverrideOpen(true)} className="text-xs px-4 py-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 font-medium transition-colors">Feature Override</button>
            </div>
          </div>

          {/* Recent Employees */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Employees</h3>
              <span className="text-xs text-gray-400">{employees.length > 0 ? `Showing ${employees.length}` : ''}</span>
            </div>
            {employees.length === 0 ? (
              <div className="px-5 py-6"><EmptyState title="No employees" message="This tenant has no employees yet." /></div>
            ) : (
              <div className="divide-y divide-gray-100">
                {employees.map(emp => (
                  <div key={emp.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</p>
                      <p className="text-[11px] text-gray-400">{emp.email} · {emp.role || '—'}</p>
                    </div>
                    {emp.tenant_id && <span className="text-[10px] text-gray-400">ID: {emp.id.slice(0, 8)}...</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Admin Contact</h3>
            {admin ? (
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-500">Name:</span> <span className="text-gray-900 font-medium">{admin.name || '—'}</span></div>
                <div><span className="text-gray-500">Email:</span> <span className="text-gray-900">{admin.email || '—'}</span></div>
                <div><span className="text-gray-500">Phone:</span> <span className="text-gray-900">{admin.phone || '—'}</span></div>
                <div><span className="text-gray-500">Status:</span> <TenantStatusBadge status={admin.status || 'active'} /></div>
              </div>
            ) : <p className="text-sm text-gray-400">No admin data</p>}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Tenant Info</h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="text-gray-900 font-mono text-[10px]">{id}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Plan</span><PlanBadge plan={tenant.subscription_plan} /></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span><TenantStatusBadge status={tenant.subscription_status || tenant.status} /></div>
              <div className="flex justify-between"><span className="text-gray-500">Trial</span><span className="text-gray-900">{tenant.trial_end ? fmtDate(tenant.trial_end) : '—'}</span></div>
              {tenant.plan_price ? <div className="flex justify-between"><span className="text-gray-500">Plan Price</span><span className="text-gray-900 font-medium">{fmtINR(tenant.plan_price)}</span></div> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Subscription Tab ────────────────────────────────
  function renderSubscription() {
    if (loading.sub) return <LoadingState rows={4} />;
    const cur = sd.currentSubscription || {};
    const payments = sd.recentPayments || [];
    const history = sd.subscriptionHistory || [];
    const features = sd.planFeatures || [];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard label="Current Plan" value={cur.plan_name || tenant.subscription_plan || '—'} sub={cur.price_inr && cur.period ? `₹${Number(cur.price_inr).toLocaleString('en-IN')}/${cur.period}` : cur.period ? '' : ''} color="text-indigo-600" />
          <StatCard label="Status" value={(cur.status || tenant.subscription_status || '—').charAt(0).toUpperCase() + (cur.status || tenant.subscription_status || '').slice(1)} sub={cur.trial_end ? `Trial ends ${fmtDate(cur.trial_end)}` : ''} />
          <StatCard label="Total Revenue" value={fmtINR(sd.paymentSummary?.totalRevenue || 0)} sub={`${sd.paymentSummary?.totalPayments || 0} payments`} color="text-emerald-600" />
        </div>

        {features.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Plan Features</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {features.map(f => (
                <div key={f.feature_key} className="flex items-center gap-2 text-xs px-3 py-2 bg-gray-50 rounded-lg">
                  <span className={`w-1.5 h-1.5 rounded-full ${f.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className="text-gray-600">{f.feature_key.replace(/_/g, ' ')}</span>
                  {f.limit && <span className="text-gray-400 ml-auto">({f.limit})</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {payments.length > 0 && (
          <DataTable title="Recent Payments" headers={['Date', 'Amount', 'Status', 'Method']}
            rows={payments.map(p => [fmtDate(p.created_at), fmtINR(p.amount), p.status || '—', p.method || '—'])} />
        )}
        {history.length > 0 && (
          <DataTable title="Subscription History" headers={['Date', 'Event', 'Details']}
            rows={history.map(h => [fmtDateTime(h.created_at), h.event_type || h.action || '—', h.details || '—'])} />
        )}

        {/* Force Change Plan */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Change Plan</h3>
          <p className="text-xs text-gray-500 mb-3">Move this tenant to a different subscription plan.</p>
          <button onClick={() => setChangePlanOpen(true)} className="text-xs px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium">Change Plan</button>
        </div>
      </div>
    );
  }

  // ─── Usage Tab ─────────────────────────────────────
  function renderUsage() {
    if (loading.usage) return <LoadingState rows={4} />;
    const live = ud.liveCounts || {};
    const history = ud.usageHistory || [];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Employees" value={fmtNum(live.employees || 0)} color="text-indigo-600" />
          <StatCard label="Attendance" value={fmtNum(live.attendance || 0)} />
          <StatCard label="Leaves" value={fmtNum(live.leaves || 0)} />
          <StatCard label="Payroll" value={fmtNum(live.payroll || 0)} />
        </div>
        {history.length > 0 && (
          <DataTable title="Monthly Usage" headers={['Month', 'Employees', 'Attendance', 'Leaves', 'Payroll']}
            rows={history.map(h => [h.month || h.usage_month, fmtNum(h.employee_count || h.employees), fmtNum(h.attendance_count || h.attendance), fmtNum(h.leave_count || h.leaves), fmtNum(h.payroll_count || h.payroll)])} />
        )}
      </div>
    );
  }

  // ─── Features Tab ──────────────────────────────────
  function renderFeatures() {
    return <FeatureAccessTab tenantId={id} />;
  }

  // ─── Sections Tab ──────────────────────────────────
  function renderSections() {
    return <SectionVisibilityTab tenantId={id} />;
  }

  // ─── Audit Tab ─────────────────────────────────────
  function renderAudit() {
    return <AuditHistoryTab tenantId={id} />;
  }

  // ─── Handlers ──────────────────────────────────────
  async function handleConfirm() {
    if (confirmAction.action === 'suspend') {
      await superService.updateTenantStatus(id, { status: 'suspended', reason: 'Suspended by super admin' });
    } else if (confirmAction.action === 'reactivate') {
      await superService.updateTenantStatus(id, { status: 'active', reason: 'Reactivated by super admin' });
    }
    setConfirmAction(null);
    fetchTenant();
  }

  async function handleChangePlan({ planId, reason }) {
    try {
      await superService.changeTenantPlan(id, { planId, reason });
      setChangePlanOpen(false);
      fetchTenant();
    } catch {}
  }
}

// ─── Mini Components ────────────────────────────────
function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DataTable({ title, headers, rows }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {title && <div className="px-5 py-3.5 border-b border-gray-100"><h3 className="text-sm font-semibold text-gray-900">{title}</h3></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {headers.map(h => <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-xs text-gray-700">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Feature Access Tab ─────────────────────────────
function FeatureAccessTab({ tenantId }) {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overrideOpen, setOverrideOpen] = useState(false);

  useEffect(() => {
    superService.getTenantFeatures(tenantId).then(d => setFeatures(d.features || [])).catch(() => {}).finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) return <LoadingState rows={5} />;
  const boolFeatures = features.filter(f => f.featureType === 'boolean');
  const limitFeatures = features.filter(f => f.featureType !== 'boolean');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Feature Access</h3>
        <button onClick={() => setOverrideOpen(true)} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Add Override</button>
      </div>

      {boolFeatures.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {boolFeatures.map(f => (
            <div key={f.featureKey} className="px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`w-2 h-2 rounded-full ${f.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-700">{f.featureKey.replace(/_/g, ' ')}</span>
                {f.source !== 'plan' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{f.source}</span>}
              </div>
              <span className="text-xs text-gray-400">{f.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          ))}
        </div>
      )}

      {limitFeatures.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200"><span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Limit Features</span></div>
          {limitFeatures.map(f => (
            <div key={f.featureKey} className="px-5 py-3 flex items-center justify-between">
              <span className="text-sm text-gray-700">{f.featureKey.replace(/_/g, ' ')}</span>
              <span className="text-sm font-medium text-gray-900">{f.limit !== null && f.limit !== undefined ? f.limit : '∞'}</span>
            </div>
          ))}
        </div>
      )}

      {features.length === 0 && <EmptyState title="No feature data" />}
      {overrideOpen && <FeatureOverrideModal open onClose={() => setOverrideOpen(false)} tenantId={tenantId} onSave={() => { setOverrideOpen(false); window.location.reload(); }} />}
    </div>
  );
}

// ─── Section Visibility Tab ─────────────────────────
function SectionVisibilityTab({ tenantId }) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    superService.getSectionsV2(tenantId).then(d => setSections(d.sections || [])).catch(() => {}).finally(() => setLoading(false));
  }, [tenantId]);

  const toggleVisibility = async (sectionKey, visible) => {
    try {
      await superService.setSectionVisibility(tenantId, { sectionKey, visible, reason: 'Toggled by super admin' });
      setSections(s => s.map(sec => sec.sectionKey === sectionKey ? { ...sec, visible, source: 'override' } : sec));
    } catch {}
  };

  const toggleReadOnly = async (sectionKey, readOnly) => {
    try {
      await superService.setSectionVisibility(tenantId, { sectionKey, readOnly, reason: 'Toggled by super admin' });
      setSections(s => s.map(sec => sec.sectionKey === sectionKey ? { ...sec, readOnly, source: 'override' } : sec));
    } catch {}
  };

  if (loading) return <LoadingState rows={5} />;

  const parents = sections.filter(s => s.isParent);
  const children = sections.filter(s => !s.isParent);

  return (
    <div className="space-y-4">
      {parents.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200"><span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Main Sections</span></div>
          {parents.map(s => <SectionRow key={s.sectionKey} section={s} onToggleVisible={toggleVisibility} onToggleReadOnly={toggleReadOnly} />)}
        </div>
      )}
      {children.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200"><span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Child Sections</span></div>
          {children.map(s => {
            const parent = parents.find(p => p.sectionKey === s.parentSectionKey);
            const isParentHidden = parent && !parent.visible;
            return <SectionRow key={s.sectionKey} section={{ ...s, visible: isParentHidden ? false : s.visible, parentHidden: isParentHidden }} onToggleVisible={toggleVisibility} onToggleReadOnly={toggleReadOnly} />;
          })}
        </div>
      )}
      {sections.length === 0 && <EmptyState title="No sections" />}
    </div>
  );
}

function SectionRow({ section, onToggleVisible, onToggleReadOnly }) {
  return (
    <div className={`px-5 py-3 flex items-center justify-between ${section.parentHidden ? 'opacity-50' : ''}`}>
      <div>
        <p className="text-sm font-medium text-gray-900">{section.label || section.sectionKey}</p>
        <div className="flex items-center gap-2 text-[10px] text-gray-400">
          <span>{section.sectionKey}</span>
          {section.source !== 'plan' && <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Override</span>}
          {section.parentHidden && <span className="text-amber-600">Hidden by parent</span>}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={section.visible} disabled={section.parentHidden} onChange={e => onToggleVisible(section.sectionKey, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400" />
          Visible
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
          <input type="checkbox" checked={section.readOnly} disabled={!section.visible || section.parentHidden} onChange={e => onToggleReadOnly(section.sectionKey, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-gray-300 text-amber-500 focus:ring-amber-400" />
          Read-Only
        </label>
      </div>
    </div>
  );
}

// ─── Audit History Tab ──────────────────────────────
function AuditHistoryTab({ tenantId }) {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset };
      if (filter) params.action = filter;
      const data = await superService.getTenantAuditLog(tenantId, params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [tenantId, offset, filter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400">
          <option value="">All Actions</option>
          <option value="super_admin.tenant_suspended">Suspended</option>
          <option value="super_admin.tenant_reactivated">Reactivated</option>
          <option value="super_admin.plan_changed">Plan Changed</option>
          <option value="super_admin.trial_extended">Trial Extended</option>
        </select>
      </div>

      {loading ? <LoadingState rows={5} /> : logs.length === 0 ? <EmptyState title="No audit logs" message="No actions have been logged for this tenant yet." /> : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Actor</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Details</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <tr key={log.id}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(log.created_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-700">{log.actor_name || log.actor_id || '—'}</td>
                    <td className="px-4 py-2.5"><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{log.action}</span></td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">{log.changes ? JSON.stringify(log.changes) : log.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > limit && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
              <div className="flex gap-2">
                <button onClick={() => setOffset(o => Math.max(0, o - limit))} disabled={offset === 0} className="text-xs px-3 py-1 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                <button onClick={() => setOffset(o => o + limit)} disabled={offset + limit >= total} className="text-xs px-3 py-1 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
