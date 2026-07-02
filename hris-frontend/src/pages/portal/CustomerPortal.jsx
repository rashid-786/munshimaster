import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const CustomerPortal = () => {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    hrService.verifyPortalToken(token)
      .then(setData)
      .catch(e => setError(e.response?.data?.error || 'Invalid or expired link.'))
      .finally(() => setLoading(false));
  }, [token]);

  const fmt = (v) => '₹' + (v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loading /></div>;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
        <div className="text-4xl mb-4">🔗</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Invalid Portal Link</h2>
        <p className="text-sm text-gray-500">{error}</p>
        <p className="text-xs text-gray-400 mt-2">Please contact the business for a new link.</p>
      </div>
    </div>
  );

  if (!data) return null;

  const totalOutstanding = data.invoices.reduce((s, i) => s + (i.outstanding || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-bold text-indigo-700">
              {data.customer?.name?.charAt(0) || '?'}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{data.customer?.name || 'Customer'}</h1>
              <p className="text-sm text-gray-500">{data.customer?.phone}{data.customer?.gstin ? ` | ${data.customer.gstin}` : ''}</p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
            <p className="text-xs text-gray-500">Total Invoices</p>
            <p className="text-xl font-bold text-gray-800">{data.invoices.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
            <p className="text-xs text-gray-500">Paid</p>
            <p className="text-xl font-bold text-emerald-700">
              {fmt(data.invoices.reduce((s, i) => s + (i.collected || i.amount_paid || 0), 0))}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
            <p className="text-xs text-gray-500">Outstanding</p>
            <p className="text-xl font-bold text-red-700">{fmt(totalOutstanding)}</p>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800">Your Invoices</h2>
          </div>
          {data.invoices.length === 0 ? (
            <p className="p-6 text-center text-gray-400 text-sm">No invoices found.</p>
          ) : (
            <div className="divide-y">
              {data.invoices.map(inv => (
                <div key={inv.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">{inv.invoice_number}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                        ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                          inv.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                          inv.outstanding > 0 && new Date(inv.due_date) < new Date() ? 'bg-red-50 text-red-700' :
                          'bg-gray-50 text-gray-600'}`}>
                        {inv.status === 'paid' ? 'Paid' : inv.status === 'partial' ? 'Partial' : 
                         inv.outstanding > 0 && new Date(inv.due_date) < new Date() ? 'Overdue' : inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {inv.invoice_date?.slice(0, 10)} | Due: {inv.due_date?.slice(0, 10)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{fmt(inv.total_amount)}</p>
                    {inv.outstanding > 0 && <p className="text-xs text-red-500">Due: {fmt(inv.outstanding)}</p>}
                  </div>
                  <div className="ml-3 flex gap-1">
                    <Link to={`/portal/${token}/invoices/${inv.id}`}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                      View
                    </Link>
                    {inv.payment_link_url && inv.outstanding > 0 && (
                      <a href={inv.payment_link_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">
                        Pay
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400">Powered by bahi360</p>
      </div>
    </div>
  );
};

export default CustomerPortal;
