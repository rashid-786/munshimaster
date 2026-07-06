import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { superService } from '../../services/super.service';
import { TenantStatusBadge, PlanBadge, TrialStatusBadge } from '../../components/super/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../components/super/States';
import ConfirmDialog from '../../components/super/ConfirmDialog';
import ChangePlanModal from '../../components/super/ChangePlanModal';
import ExtendTrialModal from '../../components/ExtendTrialModal';
import FeatureOverrideModal from '../../components/FeatureOverrideModal';
import ConfirmModal from '../../components/ConfirmModal';

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
  const [histPage, setHistPage] = useState(0);
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

  const trialEnd = sd.currentSubscription?.trial_ends_at || tenant.trial_end;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.round((new Date(trialEnd) - Date.now()) / 86400000)) : null;
  const createdDate = tenant.created_at || tenant.start_date || sd.currentSubscription?.created_at;

  const handleActivateTrial = async () => {
    setActivatingTrial(true);
    setActivationMsg(null);
    try {
      const res = await superService.activateTrial(tenant.id, { planId: 'manage' });
      const trialDays = res.trialEndsAt
        ? Math.round((new Date(res.trialEndsAt) - Date.now()) / 86400000)
        : '';
      setActivationMsg(res.message || `${trialDays || ''} day trial activated!`);
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
            {isTrialing && <TrialStatusBadge daysLeft={trialDaysLeft} size="md" />}
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
      {featureOverrideOpen && <FeatureOverrideModal onClose={() => setFeatureOverrideOpen(false)} tenantId={id} onSuccess={() => { setFeatureOverrideOpen(false); fetchTenant(); }} />}
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
            <StatCard label="Trial Ends" value={trialEnd ? fmtDate(trialEnd) : '—'} sub={trialDaysLeft > 0 ? `${trialDaysLeft} days left` : ''} />
            <StatCard label="Created" value={fmtDate(createdDate)} />
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
              <div className="flex justify-between"><span className="text-gray-500">Trial</span><span className="text-gray-900">{trialEnd ? fmtDate(trialEnd) : '—'}</span></div>
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
    const historyTotal = sd.subscriptionHistoryTotal || 0;
    const features = sd.planFeatures || [];
    const histLimit = 10;

    const fetchHistoryPage = (page) => {
      setHistPage(page);
      setLoading(p => ({ ...p, sub: true }));
      superService.getTenantSubscription(id, { historyLimit, historyOffset: page * histLimit })
        .then(d => setSubscriptionData(prev => ({ ...prev, subscriptionHistory: d.subscriptionHistory, subscriptionHistoryTotal: d.subscriptionHistoryTotal })))
        .catch(() => {})
        .finally(() => setLoading(p => ({ ...p, sub: false })));
    };

    const formatEvent = (h) => {
      const labels = {
        upgrade: 'Upgrade', downgrade: 'Downgrade', renewal: 'Renewal',
        trial_start: 'Trial Started', trial_expired: 'Trial Expired',
        cancellation: 'Cancellation', payment_failure: 'Payment Failed',
        admin_change: 'Admin Change', suspended: 'Suspended',
        reactivated: 'Reactivated', expired: 'Expired',
        grace_period_start: 'Grace Period', grace_period_expired: 'Grace Period Expired',
      };
      return labels[h.event_type] || h.event_type || '—';
    };

    const formatDetails = (h) => {
      const parts = [];
      if (h.old_plan && h.new_plan && h.old_plan !== h.new_plan) parts.push(`${h.old_plan} → ${h.new_plan}`);
      else if (h.new_plan) parts.push(`Plan: ${h.new_plan}`);
      return parts.join(', ') || '—';
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <StatCard label="Current Plan" value={cur.plan_name || tenant.subscription_plan || '—'} sub={cur.price_inr && cur.period ? `₹${Number(cur.price_inr).toLocaleString('en-IN')}/${cur.period}` : cur.period ? '' : ''} color="text-indigo-600" />
          <StatCard label="Status" value={(cur.status || tenant.subscription_status || '—').charAt(0).toUpperCase() + (cur.status || tenant.subscription_status || '').slice(1)} sub={trialEnd ? `Trial ends ${fmtDate(trialEnd)}` : cur.status === 'active' ? 'Active' : ''} />
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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Subscription History</h3>
            </div>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="text-left px-4 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Details</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {history.map(h => (
                  <tr key={h.id}>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(h.created_at)}</td>
                    <td className="px-4 py-2.5"><span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">{formatEvent(h)}</span></td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">{formatDetails(h)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historyTotal > histLimit && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-500">{histPage * histLimit + 1}–{Math.min((histPage + 1) * histLimit, historyTotal)} of {historyTotal}</span>
                <div className="flex gap-2">
                  <button onClick={() => fetchHistoryPage(histPage - 1)} disabled={histPage === 0} className="text-xs px-3 py-1 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50">← Prev</button>
                  <button onClick={() => fetchHistoryPage(histPage + 1)} disabled={(histPage + 1) * histLimit >= historyTotal} className="text-xs px-3 py-1 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50">Next →</button>
                </div>
              </div>
            )}
          </div>
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
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">HR</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Employees" value={fmtNum(live.employees || 0)} color="text-indigo-600" />
            <StatCard label="Attendance" value={fmtNum(live.attendance || 0)} />
            <StatCard label="Leaves" value={fmtNum(live.leaves || 0)} />
            <StatCard label="Payroll" value={fmtNum(live.payroll || 0)} />
          </div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Business</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Buyers" value={fmtNum(live.buyers || 0)} color="text-emerald-600" />
            <StatCard label="Sellers" value={fmtNum(live.sellers || 0)} color="text-emerald-600" />
            <StatCard label="Transactions" value={fmtNum(live.total_txns || 0)} color="text-emerald-600" />
            <StatCard label="Cashbook Entries" value={fmtNum(live.cashbook_entries || 0)} color="text-emerald-600" />
          </div>
        </div>
        {history.length > 0 && (
          <DataTable title="Monthly Usage" headers={['Month', 'Employees', 'Attendance', 'Leaves', 'Payroll', 'Buyers', 'Sellers', 'Txns', 'Cashbook']}
            rows={history.map(h => [h.month || h.usage_month, fmtNum(h.employee_count || h.employees), fmtNum(h.attendance_count || h.attendance), fmtNum(h.leave_count || h.leaves), fmtNum(h.payroll_count || h.payroll), fmtNum(h.buyer_count || 0), fmtNum(h.seller_count || 0), fmtNum(h.txn_count || 0), fmtNum(h.cashbook_count || 0)])} />
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
      <p className={`text-sm font-semibold mt-1 ${color || 'text-gray-900'}`}>{value}</p>
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
const ALL_FEATURE_DEFS = [
  { key: 'invoices', label: 'Invoices', type: 'boolean' },
  { key: 'purchase_orders', label: 'Purchase Orders', type: 'boolean' },
  { key: 'credit_debit_notes', label: 'Credit/Debit Notes', type: 'boolean' },
  { key: 'attendance', label: 'Attendance', type: 'boolean' },
  { key: 'leaves', label: 'Leaves', type: 'boolean' },
  { key: 'payroll', label: 'Payroll', type: 'boolean' },
  { key: 'advances', label: 'Advances', type: 'boolean' },
  { key: 'replacements', label: 'Replacements', type: 'boolean' },
  { key: 'inventory', label: 'Inventory', type: 'boolean' },
  { key: 'advanced_reports', label: 'Advanced Reports', type: 'boolean' },
  { key: 'multi_branch', label: 'Multi-Branch', type: 'boolean' },
  { key: 'whatsapp', label: 'WhatsApp Integration', type: 'boolean' },
  { key: 'bank_import', label: 'Bank Import', type: 'boolean' },
  { key: 'gst_returns', label: 'GST Returns', type: 'boolean' },
  { key: 'e_invoicing', label: 'E-Invoicing', type: 'boolean' },
  { key: 'bulk_import', label: 'Bulk Import', type: 'boolean' },
  { key: 'recurring_invoices', label: 'Recurring Invoices', type: 'boolean' },
  { key: 'cash_flow', label: 'Cash Flow', type: 'boolean' },
  { key: 'balance_sheet', label: 'Balance Sheet', type: 'boolean' },
  { key: 'pl_statement', label: 'P&L Statement', type: 'boolean' },
  { key: 'tally_export', label: 'Tally Export', type: 'boolean' },
  { key: 'tds_management', label: 'TDS Management', type: 'boolean' },
  { key: 'gstr2b_reco', label: 'GSTR-2B Reco', type: 'boolean' },
  { key: 'audit_logs', label: 'Audit Logs', type: 'boolean' },
  { key: 'api_access', label: 'API Access', type: 'boolean' },
  { key: 'white_label', label: 'White Label', type: 'boolean' },
  { key: 'priority_support', label: 'Priority Support', type: 'boolean' },
  { key: 'business_dashboard', label: 'Business Dashboard', type: 'boolean' },
  { key: 'expenses', label: 'Expenses', type: 'boolean' },
  { key: 'reports', label: 'Reports', type: 'boolean' },
  { key: 'kirana', label: 'Kirana Store', type: 'boolean' },
  { key: 'customers', label: 'Customers', type: 'boolean' },
  { key: 'suppliers', label: 'Suppliers', type: 'boolean' },
  { key: 'products', label: 'Products', type: 'boolean' },
  { key: 'buyers', label: 'Buyers', type: 'limit', defaultMax: 20 },
  { key: 'sellers', label: 'Sellers', type: 'limit', defaultMax: 20 },
  { key: 'cashbook_entries', label: 'Cashbook Entries', type: 'limit', defaultMax: 500 },
  { key: 'max_customers', label: 'Customers', type: 'limit', defaultMax: 50 },
  { key: 'max_suppliers', label: 'Suppliers', type: 'limit', defaultMax: 20 },
  { key: 'max_staff', label: 'Staff Members', type: 'limit', defaultMax: 2 },
  { key: 'max_branches', label: 'Branches', type: 'limit', defaultMax: 1 },
  { key: 'max_monthly_txns', label: 'Monthly Transactions', type: 'limit', defaultMax: 500 },
  { key: 'max_products', label: 'Products', type: 'limit', defaultMax: 20 },
];

function FeatureAccessTab({ tenantId }) {
  const [rawFeatures, setRawFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const refreshFeatures = useCallback(() => {
    superService.getTenantFeatures(tenantId).then(d => setRawFeatures(d.features || [])).catch(() => {});
  }, [tenantId]);

  useEffect(() => {
    superService.getTenantFeatures(tenantId).then(d => setRawFeatures(d.features || [])).catch(() => {}).finally(() => setLoading(false));
  }, [tenantId]);

  const handleRevokeAll = async () => {
    setRevoking(true);
    try {
      await superService.revokeAllFeatureOverrides(tenantId);
      setShowRevokeConfirm(false);
      refreshFeatures();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to revoke overrides.');
    } finally {
      setRevoking(false);
    }
  };

  if (loading) return <LoadingState rows={5} />;

  // Build a lookup from the API response
  const featureMap = {};
  rawFeatures.forEach(f => { featureMap[f.featureKey] = f; });

  // Merge ALL_FEATURE_DEFS with resolved data from API
  const merged = ALL_FEATURE_DEFS.map(def => {
    const resolved = featureMap[def.key];
    return {
      ...def,
      enabled: resolved ? resolved.enabled : false,
      limit: resolved ? resolved.limit : null,
      source: resolved ? resolved.source : 'default',
      override: resolved ? resolved.override : null,
    };
  });

  const boolFeatures = merged.filter(f => f.type === 'boolean');
  const limitFeatures = merged.filter(f => f.type === 'limit');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Feature Access</h3>
          <p className="text-xs text-gray-400 mt-0.5">{boolFeatures.filter(f => f.enabled).length + limitFeatures.filter(f => f.limit !== 0 && f.limit !== null).length} of {merged.length} features enabled</p>
        </div>
        <button onClick={() => setOverrideOpen(true)} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">Add Override</button>
      </div>

      {boolFeatures.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Toggle Features</span>
          </div>
          {boolFeatures.map(f => (
            <div key={f.key} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={`w-9 h-5 rounded-full transition-colors shrink-0 relative ${f.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${f.enabled ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
                <div className="min-w-0">
                  <p className={`text-sm truncate ${f.enabled ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{f.label}</p>
                  {f.source !== 'plan' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{f.source}</span>
                  )}
                </div>
              </div>
              <span className="text-xs shrink-0 ml-3">{f.enabled ? 'Enabled' : 'Disabled'}</span>
            </div>
          ))}
        </div>
      )}

      {limitFeatures.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Numeric Limits</span>
          </div>
          {limitFeatures.map(f => (
            <div key={f.key} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.limit !== 0 && f.limit !== null ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <div className="min-w-0">
                  <p className={`text-sm truncate ${f.limit !== 0 && f.limit !== null ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{f.label}</p>
                  {f.source !== 'plan' && f.source !== 'default' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{f.source}</span>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-gray-900 shrink-0 ml-3">
                {f.limit === null || f.limit === -1 ? '∞' : f.limit}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-900">Override Details</h3>
          {rawFeatures.some(f => f.override) && (
            <button onClick={() => setShowRevokeConfirm(true)} className="text-xs text-red-600 hover:text-red-700 font-medium">
              Revoke All
            </button>
          )}
        </div>
        {rawFeatures.filter(f => f.override).length === 0 ? (
          <p className="text-xs text-gray-400">No active overrides for this tenant.</p>
        ) : (
          <div className="space-y-2 mt-3">
            {Object.values(
              rawFeatures.filter(f => f.override).reduce((acc, f) => {
                if (!acc[f.featureKey]) acc[f.featureKey] = { ...f, overrideTypes: [] };
                acc[f.featureKey].overrideTypes.push(f.override.overrideType);
                return acc;
              }, {})
            ).map(f => (
              <div key={f.featureKey} className="text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between">
                <span className="font-medium text-amber-800">{f.featureKey.replace(/_/g, ' ')}</span>
                <span className="text-amber-600">{f.overrideTypes.join(', ')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {merged.length === 0 && <EmptyState title="No feature data" />}
      {overrideOpen && <FeatureOverrideModal onClose={() => setOverrideOpen(false)} tenantId={tenantId} onSuccess={() => { setOverrideOpen(false); refreshFeatures(); }} />}
      <ConfirmModal
        open={showRevokeConfirm}
        title="Revoke All Overrides?"
        message="All feature overrides for this tenant will be removed and features will revert to their plan defaults."
        confirmLabel="Revoke All"
        variant="danger"
        loading={revoking}
        onConfirm={handleRevokeAll}
        onCancel={() => setShowRevokeConfirm(false)}
      />
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
      const sec = sections.find(s => s.sectionKey === sectionKey);
      await superService.setSectionVisibility(tenantId, { sectionKey, visible: sec?.visible ?? true, readOnly, reason: 'Toggled by super admin' });
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit, offset };
      if (filter) params.action = filter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const data = await superService.getTenantAuditLog(tenantId, params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {} finally { setLoading(false); }
  }, [tenantId, offset, filter, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const [activePreset, setActivePreset] = useState(null);

  const clearFilters = () => {
    setFilter('');
    setDateFrom('');
    setDateTo('');
    setActivePreset(null);
    setOffset(0);
  };

  const applyPreset = (preset) => {
    const now = new Date();
    let from = '';
    if (preset === '15m') {
      from = new Date(now.getTime() - 15 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    } else if (preset === '30m') {
      from = new Date(now.getTime() - 30 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    } else if (preset === '1h') {
      from = new Date(now.getTime() - 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    } else if (preset === '2h') {
      from = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    } else if (preset === 'today') {
      from = now.toISOString().slice(0, 10);
    } else if (preset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      from = y.toISOString().slice(0, 10);
    }
    setDateFrom(from);
    setDateTo('');
    setActivePreset(preset);
    setOffset(0);
  };

  const presets = [
    { key: '15m', label: '15 min' },
    { key: '30m', label: '30 min' },
    { key: '1h', label: '1 hr' },
    { key: '2h', label: '2 hr' },
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {presets.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              activePreset === p.key
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-medium'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}>
            {p.label}
          </button>
        ))}
        <select value={filter} onChange={e => { setFilter(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400">
          <option value="">All Actions</option>
          <option value="super_admin.tenant_suspended">Suspended</option>
          <option value="super_admin.tenant_reactivated">Reactivated</option>
          <option value="super_admin.plan_changed">Plan Changed</option>
          <option value="super_admin.trial_extended">Trial Extended</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400" />
        <span className="text-xs text-gray-400">to</span>
        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setOffset(0); }}
          className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400" />
        {(filter || dateFrom || dateTo) && (
          <button onClick={clearFilters} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50">Clear</button>
        )}
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
