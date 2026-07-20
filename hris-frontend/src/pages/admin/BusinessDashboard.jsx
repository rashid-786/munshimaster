import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import Loading from '../../components/Loading';
import CreateDocumentModal from '../../components/CreateDocumentModal';
import AdjustStockModal from '../../components/AdjustStockModal';
import EmptyState from '../../components/EmptyState';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'year', label: 'Year' },
];

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

function HeroKpi({ title, value, hint, icon, color, onClick }) {
  return (
    <button onClick={onClick} className="card p-4 text-left hover:shadow-md transition-shadow w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </button>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="card flex flex-col items-center justify-center gap-1.5 p-4 hover:shadow-md transition-shadow min-w-[96px] flex-1">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-700 text-center leading-tight">{label}</span>
    </button>
  );
}

function statusStyle(status) {
  return ({
    paid: 'bg-green-100 text-green-700',
    sent: 'bg-blue-100 text-blue-700',
    overdue: 'bg-red-100 text-red-700',
    partial: 'bg-amber-100 text-amber-700',
    draft: 'bg-gray-100 text-gray-600',
    approved: 'bg-indigo-100 text-indigo-700',
    received: 'bg-emerald-100 text-emerald-700',
    cancelled: 'bg-gray-100 text-gray-500',
  })[status] || 'bg-gray-100 text-gray-600';
}

const BusinessDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');
  const [error, setError] = useState('');
  const [lowStock, setLowStock] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDir, setCreateDir] = useState('sales');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState(null);
  const [lowStockOpen, setLowStockOpen] = useState(false);

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
    hrService.getLowStockAlerts().then(setLowStock).catch(() => setLowStock([]));
  }, []);

  if (loading) return <Loading />;

  const s = data?.summary || {};

  const recent = [
    ...(data?.recentInvoices || []).map(i => ({ ...i, kind: 'Sale', url: '/admin/sales-transactions', party: i.partyName })),
    ...(data?.pendingPOs || []).map(p => ({ ...p, kind: 'Purchase', url: '/admin/purchase-transactions', party: p.partyName || p.customer_name })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Billing</h2>
          <p className="text-sm text-gray-500 mt-0.5">Money in, money out, and what needs your attention</p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${period === p.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
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

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <HeroKpi title="Total Collection" value={formatINR((s.cashFlow?.in || 0) * 100)}
          hint="Received this period" icon="💰" color="text-emerald-600"
          onClick={() => navigate('/admin/sales-transactions')} />
        <HeroKpi title="Total Payments" value={formatINR((s.cashFlow?.out || 0) * 100)}
          hint="Paid out this period" icon="💳" color="text-red-600"
          onClick={() => navigate('/admin/purchase-transactions')} />
        <HeroKpi title="Receivables" value={formatINR((s.outstandingReceivables || 0) * 100)}
          hint={`${s.invoiceCounts?.pending || 0} pending invoices`} icon="📋" color="text-amber-600"
          onClick={() => navigate('/admin/sales-transactions')} />
        <HeroKpi title="Stock to Reorder" value={`${lowStock.length} item${lowStock.length === 1 ? '' : 's'}`}
          hint="Below threshold" icon="📦" color={lowStock.length ? 'text-red-600' : 'text-gray-900'}
          onClick={() => lowStock.length && setLowStockOpen(true)} />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <QuickAction icon="➕" label="Sales Invoice" onClick={() => { setCreateDir('sales'); setCreateOpen(true); }} />
        <QuickAction icon="🧾" label="Purchase Bill" onClick={() => { setCreateDir('purchase'); setCreateOpen(true); }} />
        <QuickAction icon="📦" label="Adjust Stock" onClick={() => { setAdjustProductId(null); setAdjustOpen(true); }} />
        <QuickAction icon="📊" label="Reports" onClick={() => navigate('/admin/reports')} />
      </div>

      <CreateDocumentModal open={createOpen} direction={createDir} onClose={() => setCreateOpen(false)} />

      <AdjustStockModal
        open={adjustOpen}
        productId={adjustProductId}
        onClose={() => setAdjustOpen(false)}
        onAdjusted={() => hrService.getLowStockAlerts().then(setLowStock).catch(() => {})}
      />

      {lowStockOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setLowStockOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Stock to Reorder</h3>
              <button onClick={() => setLowStockOpen(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2">&times;</button>
            </div>
            <div className="p-5">
              {lowStock.length === 0 ? (
                <EmptyState icon="📦" title="All stocked up" message="No items are below their reorder level." />
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-auto">
                  {lowStock.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-gray-50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400">
                          {p.current_stock ?? 0} {p.unit || 'pcs'} left
                          {p.reorder_level > 0 ? ` · reorder at ${p.reorder_level}` : p.low_stock_threshold > 0 ? ` · threshold ${p.low_stock_threshold}` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => { setLowStockOpen(false); setAdjustProductId(p.id); setAdjustOpen(true); }}
                        className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      >
                        Adjust
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <button onClick={() => navigate('/admin/sales-transactions')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">View All</button>
          </div>
          <div className="p-4">
            {recent.length > 0 ? (
              <div className="space-y-1">
                {recent.map(r => (
                  <button key={r.id} onClick={() => navigate(r.url)}
                    className="w-full flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 transition-colors text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.kind === 'Sale' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{r.kind}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.documentNumber}</p>
                        <p className="text-xs text-gray-400 truncate">{r.party || '—'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-gray-900">{formatINR((r.totalAmount || 0) * 100)}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${statusStyle(r.status)}`}>{r.status}</span>
                    </div>
                  </button>
                ))}
                </div>
            ) : <EmptyState icon="🧾" title="No recent activity" message="Your recent sales and purchases will appear here." />}
          </div>
        </div>

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
      </div>
    </div>
  );
};

export default BusinessDashboard;
