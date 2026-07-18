import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../services/hr.service';
import { formatINR } from '../utils/currency';
import Loading from './Loading';

const TYPE_OPTIONS = {
  customer: [
    { value: 'all', label: 'All Types' },
    { value: 'sales_invoice', label: 'Sales Invoice' },
    { value: 'payment_in', label: 'Payment Received' },
    { value: 'credit_note', label: 'Credit Note' },
  ],
  supplier: [
    { value: 'all', label: 'All Types' },
    { value: 'purchase_order', label: 'Purchase Order' },
    { value: 'debit_note', label: 'Debit Note' },
  ],
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'paid', label: 'Paid' },
  { value: 'sent', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'draft', label: 'Draft' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES = {
  paid: 'bg-green-50 text-green-700 border-green-200',
  completed: 'bg-green-50 text-green-700 border-green-200',
  sent: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  overdue: 'bg-red-50 text-red-700 border-red-200',
  draft: 'bg-gray-50 text-gray-600 border-gray-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  issued: 'bg-blue-50 text-blue-700 border-blue-200',
};

const TYPE_ICONS = {
  sales_invoice: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  ),
  payment_in: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
  credit_note: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" /></svg>
  ),
  purchase_order: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
  ),
  debit_note: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  ),
};

const TRANSACTION_ROUTES = {
  sales_invoice: '/admin/sales-transactions',
  purchase_order: '/admin/purchase-transactions',
};

function today() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

function monthStart() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function TransactionsTab({ partyType, partyId, partyName }) {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [transactionType, setTransactionType] = useState('all');
  const [status, setStatus] = useState('all');
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrService.getPartyTransactions(partyType, partyId, {
        transactionType: transactionType === 'all' ? '' : transactionType,
        status: status === 'all' ? '' : status,
        startDate: startDate || '',
        endDate: endDate || '',
        page,
        limit: 35,
      });
      setTransactions(data.transactions || []);
      setSummary(data.summary || {});
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    }
    setLoading(false);
  }, [partyType, partyId, transactionType, status, startDate, endDate, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleNewTransaction = (type) => {
    const base = TRANSACTION_ROUTES[type];
    if (base) navigate(base);
  };

  const statusBadge = (s) => {
    const cls = STATUS_STYLES[s] || 'bg-gray-50 text-gray-600 border-gray-200';
    return <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>{s}</span>;
  };

  const typeIcon = (t) => TYPE_ICONS[t] || null;

  const loadMore = () => setPage(prev => prev + 1);

  return (
    <div className="space-y-5">
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label={partyType === 'customer' ? 'Total Sales' : 'Total Purchases'}
            value={formatINR(partyType === 'customer' ? summary.totalSales : summary.totalPurchases)}
            color="blue"
          />
          <SummaryCard
            label={partyType === 'customer' ? 'Payments Received' : 'Payments Made'}
            value={formatINR(partyType === 'customer' ? summary.totalPaymentsReceived : summary.totalPaymentsMade)}
            color="green"
          />
          <SummaryCard
            label="Outstanding"
            value={formatINR(summary.outstanding)}
            color="red"
          />
          <SummaryCard
            label="Last Transaction"
            value={summary.lastTransactionDate ? new Date(summary.lastTransactionDate).toLocaleDateString('en-IN') : '—'}
            color="gray"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={transactionType} onChange={e => { setTransactionType(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-w-0 w-auto">
          {TYPE_OPTIONS[partyType].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none min-w-0 w-auto">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input type="date" value={startDate} onChange={e => { setStartDate(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-[140px]" />
        <span className="text-gray-400 text-xs">to</span>
        <input type="date" value={endDate} onChange={e => { setEndDate(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-[140px]" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500 font-medium mr-1">Quick Actions:</span>
        {Object.entries(TRANSACTION_ROUTES).map(([key, route]) => (
          <button key={key} type="button" onClick={() => handleNewTransaction(key)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors whitespace-nowrap">
            + {TYPE_OPTIONS[partyType].find(o => o.value === key)?.label || key}
          </button>
        ))}
      </div>

      {loading && transactions.length === 0 ? (
        <Loading />
      ) : transactions.length === 0 ? (
        <div className="text-center py-10">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <p className="text-sm text-gray-400">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((txn, i) => (
            <div key={`${txn.transaction_type}-${txn.id}-${i}`}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 shrink-0">
                {typeIcon(txn.transaction_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">{txn.type_label}</span>
                  <span className="text-sm font-semibold text-gray-900">{txn.reference}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>{txn.date ? new Date(txn.date).toLocaleDateString('en-IN') : '—'}</span>
                  {txn.description && <><span>·</span><span className="truncate">{txn.description}</span></>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-gray-900">{formatINR(txn.amount)}</div>
                <div>{statusBadge(txn.status)}</div>
              </div>
            </div>
          ))}
          {transactions.length < total && (
            <button type="button" onClick={loadMore} disabled={loading}
              className="w-full text-sm text-indigo-600 hover:text-indigo-700 font-medium py-2 text-center">
              {loading ? 'Loading...' : `Load More (${transactions.length} of ${total})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[color] || colors.gray}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
