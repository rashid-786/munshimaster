import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    hrService.getDashboard()
      .then(setData)
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

  const kpiCards = [
    { label: 'Customers', value: totalCustomers, to: '/admin/customers', color: 'bg-indigo-500' },
    { label: 'Suppliers', value: totalSuppliers, to: '/admin/suppliers', color: 'bg-emerald-500' },
    { label: 'Invoices', value: totalInvoices, to: '/admin/invoices', color: 'bg-purple-500' },
    { label: 'Pending Invoices', value: pendingInvoicesCount, to: '/admin/invoices', color: 'bg-amber-500', sub: `₹${(pendingInvoicesAmount / 100).toLocaleString('en-IN')}` },
  ];

  const financialCards = [
    { label: 'Income', value: income, color: 'text-emerald-600' },
    { label: 'Expense', value: expense, color: 'text-red-600' },
    { label: 'Net Profit', value: netProfit, color: netProfit >= 0 ? 'text-emerald-600' : 'text-red-600' },
  ];

  const quickActions = [
    { label: 'New Invoice', to: '/admin/invoices', icon: '＋' },
    { label: 'Add Customer', to: '/admin/customers', icon: '＋' },
    { label: 'Add Supplier', to: '/admin/suppliers', icon: '＋' },
    { label: 'Record Ledger', to: '/admin/ledger', icon: '＋' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
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
                  ₹{(card.value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.to)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-sm font-medium text-gray-700"
              >
                <span className="text-indigo-600 text-lg font-bold">{action.icon}</span>
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
                    <p className={`text-sm font-semibold ${txn.type === 'credit' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {txn.type === 'credit' ? '+' : '-'}₹{(txn.amount / 100).toLocaleString('en-IN')}
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
                    <p className="text-sm font-semibold text-gray-900">₹{(po.total_amount / 100).toLocaleString('en-IN')}</p>
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
