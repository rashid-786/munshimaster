import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGlobalConfig } from '../../context/GlobalConfigContext';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import { resolvePlan } from '../../config/subscriptionPlans';
import Loading from '../../components/Loading';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function KpiCard({ title, value, subtitle, trend, trendLabel, color, icon, onClick }) {
  const trendUp = trend > 0;
  return (
    <div className="card p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
      <div className="flex items-center gap-2 mt-1">
        {trend !== undefined && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
        {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
        {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
      </div>
    </div>
  );
}

function AlertBadge({ type, message, actionUrl, navigate }) {
  const colors = {
    critical: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  };
  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-sm ${colors[type] || colors.info}`}>
      <span className="mt-0.5 shrink-0">
        {type === 'critical' ? '🔴' : type === 'warning' ? '🟡' : '🔵'}
      </span>
      <span className="flex-1">{message}</span>
      {actionUrl && (
        <button onClick={() => navigate(actionUrl)} className="underline font-medium whitespace-nowrap shrink-0">View</button>
      )}
    </div>
  );
}

function MiniTrend({ data, dataKey, color }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d[dataKey] || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  return (
    <div className="flex items-end gap-0.5 h-8 mt-2">
      {vals.map((v, i) => (
        <div key={i}
          className="w-2 rounded-t transition-all"
          style={{ height: `${((v - min) / range) * 100}%`, backgroundColor: color || '#6366f1', opacity: 0.5 + (i / vals.length) * 0.5 }}
        />
      ))}
    </div>
  );
}

const StatusPie = ({ data }) => {
  const rows = Object.entries(data || {}).filter(([, v]) => v > 0).map(([k, v]) => ({ name: k, value: v }));
  if (rows.length === 0) return <div className="text-gray-400 text-sm text-center py-8">No invoice data</div>;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={rows} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
          {rows.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

const BusinessDashboard = () => {
  const navigate = useNavigate();
  const { tenant } = useAuth();
  const { globalConfig } = useGlobalConfig();
  const rawPlan = tenant?.subscriptionPlan || 'FREE';
  const plan = resolvePlan(rawPlan);
  const isBusinessPro = plan === 'BUSINESS_PRO';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');
  const [error, setError] = useState('');
  const [entities, setEntities] = useState([]);
  const [consolidated, setConsolidated] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrService.getBusinessDashboard(period);
      setData(res);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load dashboard.');
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    hrService.getEntities().then(data => {
      setEntities(data);
      if (data.length > 1) {
        hrService.getConsolidatedPL().then(setConsolidated).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  if (loading) return <Loading />;

  const s = data?.summary || {};
  const trend = data?.monthlyTrend || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Business Command Center</h2>
          <p className="text-sm text-gray-500 mt-0.5">Real-time business performance overview</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetch} className="underline font-medium">Retry</button>
        </div>
      )}

      {/* Alerts */}
      {data?.alerts?.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((a, i) => (
            <AlertBadge key={i} {...a} navigate={navigate} />
          ))}
        </div>
      )}

      {/* Executive Summary KPI Cards */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Executive Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard title="Revenue" value={`₹${(s.totalRevenue || 0).toLocaleString()}`}
            trend={s.revenueGrowth} trendLabel="vs prev period" color="text-gray-900" icon="💰"
            onClick={() => navigate('/admin/sales-transactions')} />
          <KpiCard title="Net Profit" value={`₹${(s.netProfit || 0).toLocaleString()}`}
            subtitle={`${s.profitMargin || 0}% margin`}
            color={(s.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'} icon="📊"
            onClick={() => navigate('/admin/reports')} />
          <KpiCard title="Receivables" value={`₹${(s.outstandingReceivables || 0).toLocaleString()}`}
            subtitle={`${s.invoiceCounts?.pending || 0} pending`} color="text-amber-600" icon="📋"
            onClick={() => navigate('/admin/sales-transactions')} />
          <KpiCard title="Payables" value={`₹${(s.outstandingPayables || 0).toLocaleString()}`}
            subtitle={`${s.invoiceCounts?.overdue || 0} overdue`} color="text-red-600" icon="💳"
            onClick={() => navigate('/admin/purchase-transactions')} />
          {isBusinessPro && <KpiCard title="Cash Flow" value={`₹${(s.cashFlow?.net || 0).toLocaleString()}`}
            subtitle={`In ₹${(s.cashFlow?.in || 0).toLocaleString()} / Out ₹${(s.cashFlow?.out || 0).toLocaleString()}`}
            color={(s.cashFlow?.net || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'} icon="💵"
            onClick={() => navigate('/admin/reports')} />}
          <KpiCard title="Health Score" value={`${s.businessHealthScore || 0}/100`}
            subtitle={s.businessHealthScore >= 70 ? 'Good' : s.businessHealthScore >= 40 ? 'Fair' : 'Needs Attention'}
            color={s.businessHealthScore >= 70 ? 'text-emerald-600' : s.businessHealthScore >= 40 ? 'text-amber-600' : 'text-red-600'}
            icon="🏥" />
          <KpiCard title="Collection" value={`${s.collectionEfficiency || 0}%`}
            subtitle={`${s.invoiceCounts?.paid || 0} of ${s.invoiceCounts?.total || 0} paid`}
            color={s.collectionEfficiency >= 70 ? 'text-emerald-600' : s.collectionEfficiency >= 40 ? 'text-amber-600' : 'text-red-600'}
            icon="✅" />
          <KpiCard title="Customers" value={s.customers?.total || 0}
            subtitle={`+${s.customers?.new || 0} this period`} color="text-indigo-600" icon="👥"
            onClick={() => navigate('/admin/customers')} />
        </div>
      </div>

      {/* Consolidated P&L (multi-entity) */}
      {entities.length > 1 && consolidated && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Consolidated P&L</h3></div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between"><span className="text-sm text-gray-600">Total Income</span><span className="font-semibold text-gray-900">₹{consolidated.consolidated.totalIncome.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-600">Total Expenses</span><span className="font-semibold text-gray-900">₹{consolidated.consolidated.totalExpenses.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-600">Total Collections</span><span className="font-semibold text-gray-900">₹{consolidated.consolidated.totalCollections.toFixed(2)}</span></div>
              <div className="border-t border-gray-100 pt-2 flex justify-between">
                <span className="text-sm font-semibold text-gray-700">Net Profit</span>
                <span className={`text-sm font-bold ${consolidated.consolidated.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ₹{consolidated.consolidated.netProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Entity Breakdown</h3></div>
            <div className="p-4 space-y-2">
              {consolidated.entityBreakdown.map(e => (
                <div key={e.companyName} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{e.companyName}</span>
                    {e.branchName && <span className="text-xs text-gray-400 ml-1">({e.branchName})</span>}
                  </div>
                  <span className={`text-sm font-semibold ${e.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    ₹{e.netProfit.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue vs Expenses Trend */}
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Revenue vs Expenses (12 months)</h3></div>
          <div className="p-4">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>

        {/* Profit Trend */}
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Profitability Trend</h3></div>
          <div className="p-4">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={v => v.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="#10b981" fill="url(#profitGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <EmptyChart />}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Invoice Status */}
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Invoice Status</h3></div>
          <div className="p-4">
            <StatusPie data={data?.statusBreakdown} />
          </div>
        </div>

        {/* Top Customers */}
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Top Customers</h3></div>
          <div className="p-4">
            {data?.topCustomers?.length > 0 ? (
              <div className="space-y-3">
                {data.topCustomers.map((c, i) => (
                  <div key={c.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-1 px-2 py-1 rounded-lg transition-colors"
                    onClick={() => navigate(`/admin/customers?id=${c.id}`)}>
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.invoiceCount} invoices</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">{formatINR(c.revenue * 100)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm text-center py-8">No customer data</div>}
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Top Suppliers</h3></div>
          <div className="p-4">
            {data?.topSuppliers?.length > 0 ? (
              <div className="space-y-3">
                {data.topSuppliers.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 -mx-1 px-2 py-1 rounded-lg transition-colors"
                    onClick={() => navigate(`/admin/suppliers?id=${s.id}`)}>
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold flex items-center justify-center shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      <p className="text-xs text-gray-400">{s.poCount} POs</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">{formatINR(s.amount * 100)}</span>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm text-center py-8">No supplier data</div>}
          </div>
        </div>
      </div>

      {/* Operational Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Invoices */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Invoices</h3>
            <button onClick={() => navigate('/admin/sales-transactions')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View All</button>
          </div>
          <div className="p-4">
            {data?.recentInvoices?.length > 0 ? (
              <div className="space-y-2">
                {data.recentInvoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/sales-transactions')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{inv.documentNumber}</p>
                      <p className="text-xs text-gray-400 truncate">{inv.partyName || '—'}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-gray-900">{formatINR(inv.totalAmount * 100)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        inv.status === 'paid' ? 'bg-green-100 text-green-700' :
                        inv.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        inv.status === 'overdue' ? 'bg-red-100 text-red-700' :
                        inv.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm text-center py-8">No invoices yet</div>}
          </div>
        </div>

        {/* Pending Purchase Orders */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Pending Purchase Orders</h3>
            <button onClick={() => navigate('/admin/purchase-transactions')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View All</button>
          </div>
          <div className="p-4">
            {data?.pendingPOs?.length > 0 ? (
              <div className="space-y-2">
                {data.pendingPOs.map(po => (
                  <div key={po.id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate('/admin/purchase-transactions')}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{po.documentNumber}</p>
                      <p className="text-xs text-gray-400">{po.createdAt?.split('T')[0]}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-gray-900">{formatINR(po.totalAmount * 100)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        po.status === 'draft' ? 'bg-gray-100 text-gray-600' :
                        po.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                        po.status === 'approved' ? 'bg-indigo-100 text-indigo-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>{po.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-gray-400 text-sm text-center py-8">No pending POs</div>}
          </div>
        </div>
      </div>

      {/* Quick Actions / Subscription Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`${globalConfig.hideSubscriptionLabels ? 'lg:col-span-3' : 'lg:col-span-2'} flex flex-wrap gap-3`}>
          <button onClick={() => navigate('/admin/sales-transactions')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">💰</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Invoices</p>
          </button>
          <button onClick={() => navigate('/admin/purchase-transactions')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">📦</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Purchase Orders</p>
          </button>
          <button onClick={() => navigate('/admin/reports')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">📊</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Reports</p>
          </button>
          <button onClick={() => navigate('/admin/products')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">📦</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Inventory</p>
          </button>
          <button onClick={() => navigate('/admin/customers')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">👥</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Customers</p>
          </button>
          <button onClick={() => navigate('/admin/suppliers')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">🏢</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Suppliers</p>
          </button>
          {isBusinessPro && <button onClick={() => navigate('/admin/notes')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">📝</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Credit/Debit Notes</p>
          </button>}
          {isBusinessPro && <button onClick={() => navigate('/admin/cash-flow')} className="card flex-1 p-4 hover:shadow-md transition-shadow text-center min-w-[80px]">
            <p className="text-xl">💵</p>
            <p className="text-xs font-medium text-gray-900 mt-1">Cash Flow</p>
          </button>}
        </div>

        {/* Subscription */}
        {!globalConfig.hideSubscriptionLabels && <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-gray-900">Subscription</h3></div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Plan</span>
              <span className="text-sm font-semibold text-gray-900 capitalize">{data?.subscription?.plan || 'Free'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                data?.subscription?.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
              }`}>{data?.subscription?.status}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Customers</span>
              <span className="text-sm font-semibold text-gray-900">{s.customers?.total || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Suppliers</span>
              <span className="text-sm font-semibold text-gray-900">{s.suppliers?.total || 0}</span>
            </div>
            {s.invoiceCounts && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Invoices</span>
                <span className="text-sm font-semibold text-gray-900">{s.invoiceCounts.total || 0}</span>
              </div>
            )}
          </div>
        </div>}
      </div>
    </div>
  );
};

function EmptyChart() {
  return <div className="text-gray-400 text-sm text-center py-12">No data for this period</div>;
}

export default BusinessDashboard;