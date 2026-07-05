import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { superService } from '../../services/super.service';
import useIsMobile from '../../hooks/useIsMobile';
import ExtendTrialModal from '../../components/ExtendTrialModal';

const fmtINR = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n) => (n ?? 0).toLocaleString();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtMonth = (d) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '';
const classNames = (...c) => c.filter(Boolean).join(' ');

// ─── Reusable KPI Card ────────────────────────────────
function KPICard({ label, value, sub, icon, color, path, loading }) {
  if (loading) return <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse"><div className="h-8 bg-gray-200 rounded w-3/4 mb-2" /><div className="h-4 bg-gray-100 rounded w-1/2" /></div>;
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className={classNames('p-2.5 rounded-lg', color || 'bg-indigo-500')}>
          {icon}
        </div>
        {path && (
          <Link to={path} className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">View →</Link>
        )}
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Stat Card (simple text stat) ─────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={classNames('text-2xl font-bold mt-1', color || 'text-gray-900')}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Bar Chart (simple SVG) ───────────────────────────
function BarChart({ data, labelKey, valueKey, color = 'indigo', maxValue, format }) {
  if (!data || data.length === 0) return <p className="text-sm text-gray-400 text-center py-12">No data yet</p>;
  const max = maxValue || Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1.5 h-44">
      {data.map((d, i) => {
        const h = (Number(d[valueKey]) / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="w-full bg-gray-100 rounded-t relative" style={{ height: '100%' }}>
              <div
                className={`absolute bottom-0 w-full bg-${color}-500 rounded-t transition-all hover:bg-${color}-600`}
                style={{ height: `${Math.max(h, 3)}%` }}
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">
                  {format ? format(d[valueKey]) : d[valueKey]}
                </div>
              </div>
            </div>
            <span className="text-[10px] text-gray-400 truncate w-full text-center">{fmtMonth(d[labelKey])}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Horizontal Bar (for subscriptions) ───────────────
function HorizontalBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{fmtNum(value)} ({pct}%)</span>
      </div>
      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color || '#6366F1' }} />
      </div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────
function Badge({ children, variant = 'default' }) {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700',
    expiring: 'bg-amber-100 text-amber-700',
    expired: 'bg-red-100 text-red-700',
    default: 'bg-gray-100 text-gray-600',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[variant] || styles.default}`}>{children}</span>;
}

// ─── Empty State ──────────────────────────────────────
function Empty({ message }) {
  return <div className="text-center text-gray-400 py-10 text-sm">{message}</div>;
}

// ═══════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════
const SuperDashboard = () => {
  const isMobile = useIsMobile();

  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [conversion, setConversion] = useState(null);
  const [onboards, setOnboards] = useState(null);
  const [loading, setLoading] = useState({ summary: true, revenue: true, conversion: true, onboards: true });
  const [error, setError] = useState('');
  const [extendTrialTenant, setExtendTrialTenant] = useState(null);
  const [campaignAnalytics, setCampaignAnalytics] = useState(null);
  const [referralSummary, setReferralSummary] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [s, r, c, o, ca, rs] = await Promise.all([
          superService.getDashboardSummary(),
          superService.getDashboardRevenue(),
          superService.getDashboardConversion(),
          superService.getDashboardRecentOnboards(),
          superService.getCampaignAnalytics().catch(() => null),
          superService.getReferralSummary().catch(() => null),
        ]);
        setSummary(s);
        setRevenue(r);
        setConversion(c);
        setOnboards(o);
        if (ca) setCampaignAnalytics(ca);
        if (rs) setReferralSummary(rs);
      } catch {
        setError('Failed to load dashboard data');
      } finally {
        setLoading({ summary: false, revenue: false, conversion: false, onboards: false });
      }
    };
    fetchAll();
  }, []);

  const isLoading = Object.values(loading).some(Boolean);

  if (error && !isLoading) {
    return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg mx-4 mt-4">{error}</div>;
  }

  // ─── Plan Distribution ───────────────────────
  const planColors = { FREE: '#9CA3AF', MANAGE: '#F59E0B', BUSINESS: '#6366F1', BUSINESS_PRO: '#7C3AED', manage: '#F59E0B', business: '#6366F1', business_monthly: '#6366F1', free: '#9CA3AF', pro: '#7C3AED' };
  const planLabels = { FREE: 'Free', MANAGE: 'Manage', BUSINESS: 'Business', BUSINESS_PRO: 'Business Pro', free: 'Free', business: 'Business', business_monthly: 'Business (Mo)', manage: 'Manage', pro: 'Business Pro' };
  const planDist = summary?.planDistribution || [];
  const planTotal = planDist.reduce((s, r) => s + Number(r.count || 0), 0);

  // ─── Revenue chart data ──────────────────────
  const monthlyRev = revenue?.monthlyRevenue || [];
  const revenueByPlan = revenue?.byPlan || [];

  // ─── Tenant growth ───────────────────────────
  const growthData = conversion?.tenantGrowth || [];

  // ─── Trial vs Paid ───────────────────────────
  const tvp = conversion?.trialVsPaid || {};
  const trialing = Number(tvp.trialing || 0);
  const activePaid = Number(tvp.active_paid || 0);
  const churnedCount = Number(tvp.churned || 0);
  const subsTotal = trialing + activePaid + churnedCount || 1;

  // ─── Funnel ──────────────────────────────────
  const funnel = conversion?.conversionFunnel || [];
  const funnelData = {};
  funnel.forEach(f => { funnelData[f.event] = Number(f.count || 0); });

  // ─── Recent onboards ─────────────────────────
  const recent = onboards?.recentOnboards || [];
  const expiring = onboards?.expiringTrials || [];
  const expired = onboards?.expiredTrials || [];

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* ── Header ─────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Enterprise-wide oversight & analytics</p>
      </div>

      {/* ── KPI Cards Row 1 ────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="All Tenants"
          value={fmtNum(summary?.totalTenants)}
          sub={summary?.activeTenants != null ? `${fmtNum(summary.activeTenants)} active` : ''}
          color="bg-indigo-500"
          path="/super/tenants"
          loading={loading.summary}
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
        />
        <KPICard
          label="On Trial"
          value={fmtNum(summary?.onTrial)}
          sub={`${summary?.totalActiveSubs != null ? fmtNum(summary.totalActiveSubs) : '-'} active subs`}
          color="bg-amber-500"
          loading={loading.summary}
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KPICard
          label="Total Revenue"
          value={fmtINR(summary?.totalRevenue)}
          sub={revenue?.mrr != null ? `MRR ${fmtINR(revenue.mrr)}` : ''}
          color="bg-emerald-500"
          loading={loading.summary}
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <KPICard
          label="Conversion Rate"
          value={summary?.conversionRate != null ? `${summary.conversionRate}%` : '0%'}
          sub={`${summary?.trialConverted || 0} converted / ${summary?.trialStarted || 0} trials`}
          color="bg-purple-500"
          loading={loading.summary}
          icon={<svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
        />
      </div>

      {/* ── KPI Cards Row 2 ────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Campaigns" value={fmtNum(campaignAnalytics?.activeCampaigns)} color="text-amber-600" sub={`${campaignAnalytics?.totalRedemptions || 0} total redemptions`} />
        <StatCard label="Referral Conv." value={`${referralSummary?.conversionRate || 0}%`} color="text-indigo-600" sub={`${referralSummary?.converted || 0}/${referralSummary?.total || 0} converted`} />
        <StatCard label="Referral Revenue" value={fmtINR(referralSummary?.totalRevenue)} color="text-emerald-600" sub="from referrals" />
        <StatCard label="Active Subscribers" value={fmtNum(summary?.totalActiveSubs)} color="text-blue-600" />
      </div>

      {/* ── Charts Row ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Revenue Trend (12 months)</h3>
          <p className="text-xs text-gray-400 mb-4">Monthly revenue from paid subscriptions</p>
          <BarChart data={monthlyRev} labelKey="month" valueKey="revenue" color="emerald" format={(v) => fmtINR(v)} />
        </div>

        {/* Tenant Growth */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Tenant Growth (12 months)</h3>
          <p className="text-xs text-gray-400 mb-4">New tenant signups per month</p>
          <BarChart data={growthData} labelKey="month" valueKey="new_tenants" color="indigo" />
        </div>
      </div>

      {/* ── Plan Distribution + Trial vs Paid ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Subscription Plans</h3>
          {planDist.length === 0 ? <Empty message="No subscriptions yet" /> : (
            <div className="space-y-4">
              {planDist.map(r => (
                <HorizontalBar
                  key={r.subscription_plan}
                  label={planLabels[r.subscription_plan] || r.subscription_plan}
                  value={Number(r.count)}
                  total={planTotal}
                  color={planColors[r.subscription_plan] || '#6366F1'}
                />
              ))}
            </div>
          )}
        </div>

        {/* Trial vs Paid + Funnel */}
        <div className="space-y-6">
          {/* Trial vs Paid Donut (simplified as bars) */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Trial vs Paid</h3>
            <div className="space-y-4">
              <HorizontalBar label="On Trial" value={trialing} total={subsTotal} color="#F59E0B" />
              <HorizontalBar label="Active (Paid)" value={activePaid} total={subsTotal} color="#10B981" />
              <HorizontalBar label="Churned" value={churnedCount} total={subsTotal} color="#EF4444" />
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
            {funnel.length === 0 ? <Empty message="No conversion events yet" /> : (
              <div className="space-y-3">
                {funnel.map(f => (
                  <div key={f.event} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{f.event.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${Math.min(100, (Number(f.count) / Math.max(...funnel.map(x => Number(x.count)))) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-900 w-8 text-right">{f.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Revenue by Plan ────────────────────── */}
      {revenueByPlan.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue by Plan</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {revenueByPlan.map(r => (
              <div key={r.plan_id} className="border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 uppercase font-medium">{r.name || r.plan_id}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{fmtINR(r.revenue)}</p>
                <p className="text-xs text-gray-400">{r.payments} payments</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Onboards + Expiring Trials + Active Campaigns ── */}
      <div className={`grid grid-cols-1 ${!isMobile ? 'lg:grid-cols-3' : ''} gap-6`}>
        {/* Recent Onboards */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Onboards</h3>
            <Link to="/super/tenants" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">All tenants →</Link>
          </div>
          {recent.length === 0 ? <Empty message="No tenants onboarded yet" /> : (
            <div className="divide-y divide-gray-100">
              {recent.slice(0, 5).map(t => (
                <Link key={t.id} to={`/super/tenants/${t.id}`} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.company_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.subdomain} · {fmtDate(t.created_at)}</p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-2 shrink-0">{t.subscription_plan || 'FREE'}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Trials Expiring Soon */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Trials Expiring Soon</h3>
          </div>
          {expiring.length === 0 ? <Empty message="No trials expiring in next 7 days" /> : (
            <div className="divide-y divide-gray-100">
              {expiring.map(t => (
                <div key={t.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors">
                  <Link to={`/super/tenants/${t.tenant_id}`} className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.company_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Expires {fmtDate(t.trial_ends_at)}</p>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => setExtendTrialTenant({ id: t.tenant_id, company_name: t.company_name, subscription_plan: t.subscription_plan, trial_ends_at: t.trial_ends_at, sub_status: 'trialing' })}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-1 rounded"
                    >Extend</button>
                    <Badge variant="expiring">Expiring</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recently Expired Trials */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Recently Expired Trials</h3>
          </div>
          {expired.length === 0 ? <Empty message="No trials expired in last 7 days" /> : (
            <div className="divide-y divide-gray-100">
              {expired.map(t => (
                <Link key={t.id} to={`/super/tenants/${t.tenant_id}`} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.company_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ended {fmtDate(t.ended_at)}</p>
                  </div>
                  <Badge variant="expired">Expired</Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Campaign Performance ──────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Campaign Performance</h3>
          <Link to="/super/campaigns" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">Manage →</Link>
        </div>
        {!campaignAnalytics ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : campaignAnalytics.redemptionsByCampaign?.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">No campaign data</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Campaign</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Code</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Redemptions</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Revenue Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {campaignAnalytics.redemptionsByCampaign?.map((c, i) => (
                  <tr key={c.code || i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                    <td className="px-6 py-3 text-sm">{c.code ? <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{c.code}</span> : '-'}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{c.redemptions}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{c.revenue_impact ? fmtINR(c.revenue_impact) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Referral Summary ──────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Referral Summary</h3>
          <Link to="/super/referrals" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">Manage →</Link>
        </div>
        {!referralSummary ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div><p className="text-xs text-gray-500">Total</p><p className="text-lg font-bold text-gray-900">{fmtNum(referralSummary.total)}</p></div>
              <div><p className="text-xs text-gray-500">Pending</p><p className="text-lg font-bold text-amber-600">{fmtNum(referralSummary.pending)}</p></div>
              <div><p className="text-xs text-gray-500">Credited</p><p className="text-lg font-bold text-emerald-600">{fmtNum(referralSummary.credited)}</p></div>
              <div><p className="text-xs text-gray-500">Revenue</p><p className="text-lg font-bold text-gray-900">{fmtINR(referralSummary.totalRevenue)}</p></div>
            </div>
            {referralSummary.topReferrers?.slice(0, 5).map(t => (
              <div key={t.referrer_id} className="flex items-center justify-between py-2 border-t border-gray-50 text-sm">
                <span className="text-gray-700">{t.company_name}</span>
                <span className="text-gray-500">{t.total} referrals · ₹{(t.revenue || 0).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Loading overlay on initial load ────── */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/60 flex items-center justify-center z-50">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      )}

      {extendTrialTenant && (
        <ExtendTrialModal
          tenant={extendTrialTenant}
          onClose={() => setExtendTrialTenant(null)}
          onSuccess={() => { setExtendTrialTenant(null); fetchData(); }}
        />
      )}
    </div>
  );
};

export default SuperDashboard;
