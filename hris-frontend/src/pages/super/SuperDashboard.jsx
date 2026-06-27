import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { Link } from 'react-router-dom';
import useIsMobile from '../../hooks/useIsMobile';

function formatINR(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const SuperDashboard = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    Promise.all([
      superService.getDashboard(),
      superService.getAnalytics(),
    ])
      .then(([s, a]) => {
        setStats(s);
        setAnalytics(a);
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => { setLoading(false); setAnalyticsLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>;
  }

  const cards = [
    {
      label: 'Total Tenants',
      value: stats.totalTenants,
      path: '/super/tenants',
      color: 'bg-indigo-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: 'Total Employees',
      value: stats.totalEmployees,
      path: '/super/employees',
      color: 'bg-emerald-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      label: 'Pending Leaves',
      value: stats.pendingLeaves,
      path: '/super/tenants',
      color: 'bg-amber-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Role Distribution',
      value: null,
      path: null,
      color: 'bg-purple-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  const analyticsCards = analytics ? [
    { label: 'Conversion Rate', value: `${analytics.conversionRate}%`, sub: `${analytics.trialConverted} of ${analytics.trialStarted} trials converted`, color: 'text-emerald-600' },
    { label: 'Active Trials', value: analytics.activeTrials, sub: 'currently trialing', color: 'text-amber-600' },
    { label: 'Churn Rate', value: `${analytics.churnRate}%`, sub: `${analytics.totalChurned} churned / ${analytics.totalActive + analytics.totalChurned} total`, color: 'text-red-600' },
    { label: 'Referrals', value: analytics.totalReferrals, sub: `${analytics.referralPending} pending credit`, color: 'text-indigo-600' },
  ] : [];

  // Plan distribution pie (simple bar chart)
  const planColors = { free: '#9CA3AF', business: '#6366F1', pro: '#7C3AED' };
  const planLabels = { free: 'Free', business: 'Business', pro: 'Pro' };

  // Revenue chart
  const revenueData = analytics?.revenueByMonth?.slice().reverse() || [];
  const maxRevenue = Math.max(...revenueData.map(r => Number(r.revenue) || 0), 1);

  return (
    <div className="space-y-6">
      {/* Top cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${card.color} text-white`}>{card.icon}</div>
            </div>
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            {card.label === 'Role Distribution' ? (
              <div className="mt-2 space-y-1.5">
                {stats.roleDistribution?.map(r => (
                  <div key={r.role} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 capitalize">{r.role.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-900">{r.count}</span>
                  </div>
                )) || <p className="text-sm text-gray-400 mt-1">-</p>}
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </p>
            )}
            {card.path && (
              <Link to={card.path} className="text-sm text-indigo-600 hover:text-indigo-500 mt-3 inline-block font-medium">
                View all →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Analytics section */}
      {!analyticsLoading && analytics && (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {analyticsCards.map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</p>
                {card.sub && <p className="text-xs text-gray-400 mt-1">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* Revenue chart + Plan distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue bar chart */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue (12 months)</h3>
              {revenueData.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No revenue data yet</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {revenueData.map((r, i) => {
                    const height = (Number(r.revenue) / maxRevenue) * 100;
                    const month = new Date(r.month).toLocaleDateString('en', { month: 'short', year: '2-digit' });
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="w-full bg-indigo-100 rounded-t relative" style={{ height: `${Math.max(height, 4)}%` }}>
                          <div
                            className="absolute bottom-0 w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-600"
                            style={{ height: `${height}%` }}
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                              {formatINR(r.revenue)}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-gray-400">{month}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Plan distribution */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Subscription Plans</h3>
              {(!analytics.subsByPlan || analytics.subsByPlan.length === 0) ? (
                <p className="text-sm text-gray-400 text-center py-8">No subscriptions yet</p>
              ) : (
                <div className="space-y-4">
                  {analytics.subsByPlan.map(row => {
                    const total = analytics.subsByPlan.reduce((s, r) => s + Number(r.c || 0), 0);
                    const pct = total > 0 ? Math.round((Number(row.c) / total) * 100) : 0;
                    return (
                      <div key={row.plan_id}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{planLabels[row.plan_id] || row.plan_id}</span>
                          <span className="text-gray-500">{row.c} ({pct}%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: planColors[row.plan_id] || '#6366F1' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Campaigns table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Campaigns & Promotions</h3>
            </div>
            {(!analytics.campaigns || analytics.campaigns.length === 0) ? (
              <div className="text-center text-gray-400 py-8 text-sm">No campaigns created yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="table-header">Name</th>
                      <th className="table-header">Code</th>
                      <th className="table-header">Redemptions</th>
                      <th className="table-header">Period</th>
                      <th className="table-header">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {analytics.campaigns.map((c, i) => {
                      const now = new Date();
                      const start = new Date(c.starts_at);
                      const end = new Date(c.ends_at);
                      const isActive = c.is_active && now >= start && now < end;
                      return (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="table-cell font-medium">{c.name}</td>
                          <td className="table-cell">
                            {c.code ? <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{c.code}</span> : '-'}
                          </td>
                          <td className="table-cell text-gray-500">
                            {c.redemptions}{c.max_redemptions > 0 ? ` / ${c.max_redemptions}` : ''}
                          </td>
                          <td className="table-cell text-gray-500 text-sm">
                            {start.toLocaleDateString()} – {end.toLocaleDateString()}
                          </td>
                          <td className="table-cell">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Recent tenants */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Recently Onboarded Tenants</h3>
        </div>
        {isMobile ? (
          <div className="divide-y divide-gray-100">
            {stats.recentTenants?.map((tenant) => (
              <Link key={tenant.id} to={`/super/tenants/${tenant.id}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{tenant.company_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tenant.subdomain} &middot; {new Date(tenant.created_at).toLocaleDateString()}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
            {(!stats.recentTenants || stats.recentTenants.length === 0) && (
              <div className="text-center text-gray-400 py-8 text-sm">No tenants yet</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">Company Name</th>
                  <th className="table-header">Subdomain</th>
                  <th className="table-header">Created</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentTenants?.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{tenant.company_name}</td>
                    <td className="table-cell text-gray-500">{tenant.subdomain}</td>
                    <td className="table-cell text-gray-500">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <Link
                        to={`/super/tenants/${tenant.id}`}
                        className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
                {(!stats.recentTenants || stats.recentTenants.length === 0) && (
                  <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">No tenants yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperDashboard;
