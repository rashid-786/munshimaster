import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const AGING_COLORS = {
  current: 'bg-emerald-50 text-emerald-700',
  aging_1_30: 'bg-blue-50 text-blue-700',
  aging_31_60: 'bg-amber-50 text-amber-700',
  aging_61_90: 'bg-orange-50 text-orange-700',
  aging_90_plus: 'bg-red-50 text-red-700',
};

const Khata = () => {
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    try {
      const data = await hrService.getKhataSummary();
      setSummary(data);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrService.getKhataCustomers(search || undefined);
      setCustomers(data || []);
    } catch (e) { setError('Failed to load khata.'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchSummary(); fetchCustomers(); }, [fetchSummary, fetchCustomers]);

  const openDetail = async (id) => {
    setDetailLoading(true); setError('');
    try {
      const data = await hrService.getKhataCustomerDetail(id);
      setDetail(data);
    } catch (e) { setError('Failed to load customer detail.'); }
    finally { setDetailLoading(false); }
  };

  const handleGenerateLink = async (customerId) => {
    try {
      const data = await hrService.generatePortalLink(customerId);
      await navigator.clipboard.writeText(data.portalUrl);
      setSuccess('Portal link copied to clipboard!');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to generate link.');
    }
  };

  const handleSendReminder = async (customerId, type) => {
    try {
      await hrService.sendKhataReminder(customerId, type);
      setSuccess('Reminder sent.');
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to send reminder.');
    }
  };

  const fmt = (v) => '₹' + (v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Khata — Credit Ledger</h2>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{success}
        <button onClick={() => setSuccess('')} className="float-right">&times;</button>
      </div>}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Total Outstanding</p>
            <p className="text-lg font-bold text-red-700">{fmt(summary.total_outstanding || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Customers Due</p>
            <p className="text-lg font-bold text-gray-800">{summary.customers_with_outstanding || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Total Billed</p>
            <p className="text-lg font-bold text-gray-800">{fmt(summary.total_invoiced || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Total Collected</p>
            <p className="text-lg font-bold text-emerald-700">{fmt(summary.total_collected || 0)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500">Over 90 Days</p>
            <p className="text-lg font-bold text-red-700">{fmt(summary.aging_90_plus || 0)}</p>
          </div>
        </div>
      )}

      {/* Aging Breakdown */}
      {summary && (
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500 font-medium mb-2">Aging Breakdown</p>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'aging_current', label: 'Current', color: 'bg-emerald-500' },
              { key: 'aging_1_30', label: '1-30 Days', color: 'bg-blue-500' },
              { key: 'aging_31_60', label: '31-60 Days', color: 'bg-amber-500' },
              { key: 'aging_61_90', label: '61-90 Days', color: 'bg-orange-500' },
              { key: 'aging_90_plus', label: '90+ Days', color: 'bg-red-500' },
            ].map(b => {
              const val = parseInt(summary[b.key] || 0);
              const total = parseInt(summary.total_outstanding || 0);
              const pct = total > 0 ? (val / total * 100) : 0;
              return (
                <div key={b.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${b.color}`} />
                  <span className="text-xs text-gray-600">{b.label}</span>
                  <span className="text-xs font-medium">{fmt(val)}</span>
                  <span className="text-[10px] text-gray-400">({pct.toFixed(0)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          className="input-field flex-1" placeholder="Search customers by name, phone, or GSTIN..." />
        <button onClick={fetchCustomers} className="btn-secondary text-sm px-4 py-2">Search</button>
      </div>

      {/* Customer List */}
      {loading ? <Loading /> : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-right px-3 py-2">Billed</th>
                <th className="text-right px-3 py-2">Paid</th>
                <th className="text-right px-3 py-2">Outstanding</th>
                <th className="text-left px-3 py-2">Last Invoice</th>
                <th className="text-center px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No customers with outstanding balances.</td></tr>
              ) : customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(c.id)}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.name}</p>
                    {c.phone && <p className="text-[10px] text-gray-400">{c.phone}</p>}
                  </td>
                  <td className="px-3 py-2 text-right">{fmt(c.total_billed || 0)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{fmt(c.total_paid || 0)}</td>
                  <td className="px-3 py-2 text-right font-medium text-red-700">{fmt(c.outstanding || 0)}</td>
                  <td className="px-3 py-2 text-xs">{c.last_invoice_date?.slice(0, 10) || '-'}</td>
                  <td className="px-3 py-2 text-center" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center">
                      <button onClick={() => handleGenerateLink(c.id)}
                        className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100" title="Share portal link">Link</button>
                      <button onClick={() => handleSendReminder(c.id, 'email')}
                        className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Email</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Customer Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{detail.customer?.name}</h3>
                <p className="text-xs text-gray-500">{detail.customer?.phone} {detail.customer?.gstin && `| ${detail.customer.gstin}`}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-5 space-y-4">
              {detailLoading ? <Loading /> : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Outstanding</p>
                      <p className="text-lg font-bold text-red-700">
                        {detail.invoices.reduce((s, i) => s + i.outstanding, 0) > 0
                          ? fmt(detail.invoices.reduce((s, i) => s + i.outstanding, 0)) : '₹0'}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Invoices</p>
                      <p className="text-lg font-bold text-gray-800">{detail.invoices.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Payments</p>
                      <p className="text-lg font-bold text-gray-800">{detail.recentPayments?.length || 0}</p>
                    </div>
                  </div>

                  <h4 className="font-semibold text-gray-700 text-sm">Invoices</h4>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-2 py-1.5">Invoice</th>
                          <th className="text-left px-2 py-1.5">Date</th>
                          <th className="text-left px-2 py-1.5">Due</th>
                          <th className="text-right px-2 py-1.5">Amount</th>
                          <th className="text-right px-2 py-1.5">Paid</th>
                          <th className="text-right px-2 py-1.5">Due</th>
                          <th className="text-center px-2 py-1.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detail.invoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-2 py-1.5 font-mono">{inv.invoice_number}</td>
                            <td className="px-2 py-1.5">{inv.invoice_date?.slice(0, 10)}</td>
                            <td className="px-2 py-1.5">{inv.due_date?.slice(0, 10)}</td>
                            <td className="px-2 py-1.5 text-right">{fmt(inv.total_amount)}</td>
                            <td className="px-2 py-1.5 text-right text-emerald-600">{fmt(inv.collected || 0)}</td>
                            <td className="px-2 py-1.5 text-right font-medium text-red-600">{fmt(inv.outstanding)}</td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium
                                ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' :
                                  inv.status === 'partial' ? 'bg-amber-50 text-amber-700' :
                                  inv.status === 'overdue' ? 'bg-red-50 text-red-700' :
                                  'bg-gray-50 text-gray-600'}`}>{inv.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {detail.recentPayments?.length > 0 && (
                    <>
                      <h4 className="font-semibold text-gray-700 text-sm">Recent Payments</h4>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-600">
                            <tr>
                              <th className="text-left px-2 py-1.5">Date</th>
                              <th className="text-left px-2 py-1.5">Invoice</th>
                              <th className="text-right px-2 py-1.5">Amount</th>
                              <th className="text-left px-2 py-1.5">Method</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {detail.recentPayments.map(p => (
                              <tr key={p.id} className="hover:bg-gray-50">
                                <td className="px-2 py-1.5">{p.payment_date?.slice(0, 10)}</td>
                                <td className="px-2 py-1.5 font-mono">{p.invoice_number}</td>
                                <td className="px-2 py-1.5 text-right font-medium">{fmt(p.amount)}</td>
                                <td className="px-2 py-1.5 capitalize">{p.payment_method}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Khata;
