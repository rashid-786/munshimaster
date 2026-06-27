import { useState, useEffect } from 'react';
import { subscriptionService } from '../../services/subscription.service';
import Loading from '../../components/Loading';

const STATUS_STYLES = {
  captured: 'bg-emerald-100 text-emerald-700',
  created: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
};

export default function PaymentHistory() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    subscriptionService.getPaymentHistory()
      .then(res => setPayments(res.payments || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-12"><Loading /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Payment History</h2>
        <p className="text-sm text-gray-500 mt-1">View your past subscription payments and download receipts.</p>
      </div>

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          <p className="text-gray-500 font-medium">No payments yet</p>
          <p className="text-sm text-gray-400 mt-1">Payments will appear here once you upgrade to a paid plan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">Date</th>
                  <th className="table-header">Plan</th>
                  <th className="table-header">Amount</th>
                  <th className="table-header">Period</th>
                  <th className="table-header">Status</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell text-sm text-gray-500 whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="table-cell font-medium">{p.plan_name || p.plan_id}</td>
                    <td className="table-cell font-semibold text-gray-900 whitespace-nowrap">
                      ₹{Number(p.amount).toLocaleString('en-IN')}
                    </td>
                    <td className="table-cell text-sm text-gray-500 whitespace-nowrap">
                      {p.period_start
                        ? `${new Date(p.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} – ${new Date(p.period_end).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`
                        : '-'}
                    </td>
                    <td className="table-cell">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button
                        onClick={() => subscriptionService.downloadReceipt(p.id)}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
