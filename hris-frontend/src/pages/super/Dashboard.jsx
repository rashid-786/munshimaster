import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { superService } from '../../services/super.service';
import DashboardCard from '../../components/super/DashboardCard';
import { TenantStatusBadge, PlanBadge, TrialStatusBadge } from '../../components/super/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../components/super/States';
import ExtendTrialModal from '../../components/ExtendTrialModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const fmtINR = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = n => (n ?? 0).toLocaleString('en-IN');
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtMonth = d => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '';

const PLAN_COLORS = { FREE: '#94a3b8', MANAGE: '#f59e0b', BUSINESS: '#6366f1', BUSINESS_PRO: '#8b5cf6', PRO: '#8b5cf6' };
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function SuperDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [extendTrialTenant, setExtendTrialTenant] = useState(null);

  useEffect(() => {
    Promise.all([
      superService.getDashboardSummary().catch(() => null),
      superService.getDashboardRevenue().catch(() => null),
      superService.getDashboardConversion().catch(() => null),
      superService.getDashboardRecentOnboards().catch(() => null),
      superService.getDashboardExpiringTrials(14).catch(() => null),
    ]).then(([summary, revenue, conversion, onboards, trials]) => {
      setData({ summary, revenue, conversion, onboards, trials });
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState type="card" rows={6} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  if (!data) return <EmptyState title="No data available" message="Could not load dashboard data." />;

  const s = data.summary || {};
  const r = data.revenue || {};
  const c = data.conversion || {};
  const o = data.onboards?.recentOnboards || data.onboards || [];
  const t = data.trials?.trials || data.trials?.expiringTrials || data.trials || [];

  const planDist = s.planDistribution || [];
  const totalTenants = s.totalTenants || 0;
  const revenueChart = (r.monthlyRevenue || []).map(m => ({ month: fmtMonth(m.month), revenue: Number(m.revenue) || 0 }));
  const trialStarted = s.trialStarted || 0;
  const trialConverted = s.trialConverted || 0;
  const funnel = c.conversionFunnel || [];

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          title="Total Tenants"
          value={fmtNum(totalTenants)}
          subtitle={`${s.activeTenants || 0} active`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
          color="indigo"
          onClick={() => navigate('/super/tenants')}
        />
        <DashboardCard
          title="On Trial"
          value={fmtNum(s.onTrial || 0)}
          subtitle={s.onTrial > 0 ? `${t.length > 0 ? t.length + ' expiring soon' : 'Active trials'}` : 'No active trials'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="amber"
        />
        <DashboardCard
          title="Total Revenue"
          value={fmtINR(s.totalRevenue)}
          subtitle={r.thisMonth ? `${fmtINR(r.thisMonth)} this month` : ''}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="emerald"
        />
        <DashboardCard
          title="Conversion Rate"
          value={`${s.conversionRate || 0}%`}
          subtitle={`${trialConverted} of ${trialStarted} trials converted`}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          color="violet"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Revenue Trend</h3>
            <Link to="/super/analytics/revenue" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">Full Analytics →</Link>
          </div>
          {revenueChart.length === 0 ? (
            <EmptyState title="No revenue data" message="Revenue will appear once subscriptions start processing." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => '₹' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={v => fmtINR(v)} />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Plan Distribution</h3>
          </div>
          {planDist.length === 0 ? (
            <EmptyState title="No plan data" />
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={planDist} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="count" nameKey="name">
                    {planDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => [v, 'Tenants']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2">
                {planDist.map((p, i) => (
                  <div key={p.name || i} className="flex items-center justify-between text-xs px-2 py-1.5 bg-gray-50 rounded-lg">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600">{p.name}</span>
                    </span>
                    <span className="font-medium text-gray-900">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Onboards */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Onboards</h3>
            <Link to="/super/tenants" className="text-xs text-indigo-600 font-medium">All →</Link>
          </div>
          {o.length === 0 ? (
            <div className="px-5 py-8"><EmptyState title="No recent onboards" /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {o.slice(0, 5).map(tenant => (
                <div key={tenant.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/super/tenants/${tenant.id}`)}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tenant.company_name}</p>
                    <p className="text-[11px] text-gray-400">{tenant.owner_name || tenant.email} · {fmtDate(tenant.created_at)}</p>
                  </div>
                  <PlanBadge plan={tenant.subscription_plan} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Trials */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Trials Expiring Soon</h3>
            {t.length > 0 && <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{t.length} at risk</span>}
          </div>
          {t.length === 0 ? (
            <div className="px-5 py-8"><EmptyState title="No expiring trials" message="All trials are up to date." /></div>
          ) : (
            <div className="divide-y divide-gray-100">
              {t.slice(0, 5).map(tenant => (
                <div key={tenant.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/super/tenants/${tenant.id}`)}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tenant.company_name}</p>
                    <p className="text-[11px] text-gray-400">Ends {fmtDate(tenant.trial_end)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrialStatusBadge daysLeft={tenant.daysLeft !== undefined ? tenant.daysLeft : tenant.trial_days_left} />
                    <button onClick={e => { e.stopPropagation(); setExtendTrialTenant(tenant); }} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium transition-colors">Extend</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          {funnel.length === 0 ? (
            <EmptyState title="No funnel data" />
          ) : (
            <div className="space-y-3">
              {funnel.map((s, i) => {
                const maxCount = Math.max(...funnel.map(f => f.count || 0), 1);
                const pct = ((s.count || 0) / maxCount) * 100;
                return (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{s.stage}</span>
                      <span className="font-medium text-gray-900">{fmtNum(s.count)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${i === 0 ? 'bg-indigo-500' : i === funnel.length - 1 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Extend Trial Modal */}
      {extendTrialTenant && (
        <ExtendTrialModal
          open={!!extendTrialTenant}
          onClose={() => setExtendTrialTenant(null)}
          tenant={extendTrialTenant}
          onExtend={() => { setExtendTrialTenant(null); window.location.reload(); }}
        />
      )}
    </div>
  );
}
