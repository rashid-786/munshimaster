import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { subscriptionService } from '../../services/subscription.service';
import { useAuth } from '../../context/AuthContext';
import Loading from '../../components/Loading';

const PLAN_RANK = { free: 0, business: 1, business_monthly: 1, pro: 2, pro_monthly: 2 };
const PLAN_LABELS = { free: 'Free', business: 'Business', business_monthly: 'Business Monthly', pro: 'Pro', pro_monthly: 'Pro Monthly' };
const PLAN_COLORS = { free: 'bg-gray-100 text-gray-700', business: 'bg-indigo-100 text-indigo-700', business_monthly: 'bg-indigo-100 text-indigo-700', pro: 'bg-purple-100 text-purple-700', pro_monthly: 'bg-purple-100 text-purple-700' };

const MODULE_SECTIONS = [
  {
    key: 'ledger', label: 'My Ledger Book', icon: 'M3 10h18M3 14h18M3 18h18M3 6h18',
    plan: 'free', to: '/admin/ledger',
    desc: 'Track income, expenses, receivables & payables',
  },
  {
    key: 'business', label: 'My Business', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    plan: 'business', to: '/admin/business',
    desc: 'Sales, purchases, inventory, GST, TDS & reports',
  },
  {
    key: 'hr', label: 'My HR', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    plan: 'pro', to: '/admin/hr',
    desc: 'Staff, attendance, payroll, leaves & advances',
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const [data, setData] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const currentPlan = tenant?.subscriptionPlan || 'free';
  const planRank = PLAN_RANK[currentPlan] ?? 0;

  useEffect(() => {
    Promise.all([
      hrService.getDashboard(),
      subscriptionService.getCurrent().catch(() => null),
    ])
      .then(([dash, sub]) => { setData(dash); setSubscription(sub); })
      .catch(() => setError('Failed to load dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loading /></div>;
  if (error) return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>;
  if (!data) return null;

  const {
    totalCustomers, totalSuppliers, totalInvoices,
    revenue, expense, income,
    pendingInvoicesCount, pendingInvoicesAmount,
    recentTransactions, pendingPOs,
  } = data;

  const netProfit = income - expense;
  const userName = user?.name || user?.firstName || 'User';
  const tenantName = tenant?.name || '';
  const primaryColor = tenant?.settings?.primaryColor || localStorage.getItem('primary_color') || '#4f46e5';

  const subStatus = subscription?.status || 'active';
  const validUntil = subscription?.validUntil || subscription?.trialEndsAt || null;
  const daysLeft = validUntil ? Math.max(0, Math.ceil((new Date(validUntil) - new Date()) / 86400000)) : null;

  const statusBadge = () => {
    if (subStatus === 'trialing') return { label: `Trial · ${daysLeft}d left`, color: 'bg-amber-100 text-amber-700' };
    if (subStatus === 'cancelled') return { label: `Cancelled · Ends ${new Date(validUntil).toLocaleDateString()}`, color: 'bg-red-100 text-red-700' };
    if (planRank === 0) return { label: 'Active', color: 'bg-green-100 text-green-700' };
    if (daysLeft !== null && daysLeft <= 7) return { label: `Renewing · ${daysLeft}d left`, color: 'bg-orange-100 text-orange-700' };
    return { label: validUntil ? `Active · Until ${new Date(validUntil).toLocaleDateString()}` : 'Active', color: 'bg-green-100 text-green-700' };
  };

  const badge = statusBadge();

  const kpiCards = [
    { label: 'Customers', value: totalCustomers, to: '/admin/customers', color: 'bg-indigo-500' },
    { label: 'Suppliers', value: totalSuppliers, to: '/admin/suppliers', color: 'bg-emerald-500' },
    { label: 'Invoices', value: totalInvoices, to: '/admin/invoices', color: 'bg-purple-500' },
    { label: 'Pending Invoices', value: pendingInvoicesCount, to: '/admin/invoices', color: 'bg-amber-500', sub: `₹${parseInt(pendingInvoicesAmount || 0).toLocaleString('en-IN')}` },
  ];

  const financialCards = [
    { label: 'Income', value: income, color: 'text-emerald-600' },
    { label: 'Expense', value: expense, color: 'text-red-600' },
    { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
  ];

  const accessibleModules = MODULE_SECTIONS.filter(m => planRank >= (PLAN_RANK[m.plan] ?? 0));

  return (
    <div className="space-y-6">

      {/* === Welcome + Branding + Plan === */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
            style={{ backgroundColor: primaryColor }}
          >
            {(tenantName || 'B').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Welcome back, {userName}</h1>
            <p className="text-sm text-gray-500">{tenantName || 'Your Business'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${PLAN_COLORS[currentPlan]}`}>
            {PLAN_LABELS[currentPlan]}
          </span>
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
          {planRank < 2 && subStatus !== 'trialing' && (
            <button onClick={() => navigate('/subscription')} className="btn-primary text-xs !py-1.5">
              Upgrade
            </button>
          )}
          {subStatus === 'trialing' && (
            <button onClick={() => navigate('/subscription')} className="btn-primary text-xs !py-1.5">
              Subscribe Now
            </button>
          )}
          {subStatus === 'cancelled' && (
            <button onClick={() => navigate('/subscription')} className="btn-primary text-xs !py-1.5">
              Renew
            </button>
          )}
        </div>
      </div>

      {/* === Owned Sections === */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {accessibleModules.map(mod => (
          <button
            key={mod.key}
            onClick={() => navigate(mod.to)}
            className="bg-white rounded-xl border border-gray-200 p-4 text-left hover:shadow-md hover:border-indigo-300 transition-all group"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-100 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={mod.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{mod.label}</p>
                <p className="text-xs text-gray-400">{mod.desc}</p>
              </div>
            </div>
            <span className="text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Open &rarr;</span>
          </button>
        ))}
      </div>

      {/* === Feature Usage (from subscription) === */}
      {subscription?.features && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(subscription.usage || {}).slice(0, 4).map(([key, used]) => {
            const limit = subscription.features[key];
            if (limit === undefined || limit === null) return null;
            const pct = limit === -1 ? 0 : Math.min(100, Math.round((used / limit) * 100));
            return (
              <div key={key} className="bg-white rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 capitalize">{key.replace(/_/g, ' ')}</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">
                  {used}{limit === -1 ? '' : ` / ${limit}`}
                </p>
                {limit !== -1 && (
                  <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* === KPI Cards === */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(card => (
          <Link key={card.label} to={card.to} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
            {card.sub && <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Financial Summary */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Financial Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            {financialCards.map(card => (
              <div key={card.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className={`text-lg font-bold mt-1 ${card.color}`}>
                  ₹{parseInt(card.value || 0).toLocaleString('en-IN')}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'New Invoice', to: '/admin/invoices' },
              { label: 'Add Customer', to: '/admin/customers' },
              { label: 'Add Supplier', to: '/admin/suppliers' },
              { label: 'Record Ledger', to: '/admin/ledger' },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-sm font-medium text-gray-700"
              >
                <span className="text-indigo-600 text-lg font-bold">+</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Ledger Entries</h3>
            <Link to="/admin/ledger" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View All</Link>
          </div>
          {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>No transactions yet.</p>
              <Link to="/admin/ledger" className="text-indigo-600 hover:underline mt-1 inline-block">Record your first entry</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentTransactions.map(txn => (
                <div key={txn.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{txn.party_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{txn.note || txn.type}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className={`text-sm font-semibold ${txn.type === 'credit' || txn.type === 'received' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {txn.type === 'credit' || txn.type === 'received' ? '+' : '-'}₹{parseInt(txn.amount || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400">{txn.entry_date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending POs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Pending Purchase Orders</h3>
            <Link to="/admin/purchase-orders" className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View All</Link>
          </div>
          {pendingPOs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>No pending POs.</p>
              <Link to="/admin/purchase-orders" className="text-indigo-600 hover:underline mt-1 inline-block">Create a purchase order</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {pendingPOs.map(po => (
                <Link key={po.id} to={`/admin/purchase-orders`} className="flex items-center justify-between py-2.5 hover:bg-gray-50 -mx-5 px-5 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{po.po_number}</p>
                    <p className="text-xs text-gray-400 capitalize">{po.status.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-gray-900">₹{parseInt(po.total_amount || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-gray-400">{new Date(po.created_at).toLocaleDateString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
