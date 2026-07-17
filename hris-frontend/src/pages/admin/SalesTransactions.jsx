import { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { DOC_LABELS, DOCUMENT_CONFIG, STATUS_STYLES } from '../../config/documentConfig';
import TransactionForm from '../../components/TransactionForm';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const TYPES = ['sales_invoice', 'payment_in', 'sales_return', 'credit_note', 'delivery_challan', 'quotation', 'proforma_invoice'];

const PERIODS = [
  { value: '', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom' },
];

function getPeriodDates(period) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const fmt = (dt) => {
    const s = new Date(dt);
    return s.getFullYear() + '-' + String(s.getMonth()+1).padStart(2,'0') + '-' + String(s.getDate()).padStart(2,'0');
  };
  const startOf = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  switch (period) {
    case 'today': {
      const s = startOf(now);
      return { startDate: fmt(s), endDate: fmt(s) };
    }
    case 'yesterday': {
      const s = new Date(y, m, d - 1);
      return { startDate: fmt(s), endDate: fmt(s) };
    }
    case 'this_week': {
      const day = now.getDay();
      const mon = new Date(y, m, d - (day === 0 ? 6 : day - 1));
      return { startDate: fmt(mon), endDate: fmt(now) };
    }
    case 'last_week': {
      const day = now.getDay();
      const mon = new Date(y, m, d - (day === 0 ? 6 : day - 1));
      const lastMon = new Date(mon);
      lastMon.setDate(lastMon.getDate() - 7);
      const lastSun = new Date(mon);
      lastSun.setDate(lastSun.getDate() - 1);
      return { startDate: fmt(lastMon), endDate: fmt(lastSun) };
    }
    case 'this_month': {
      return { startDate: fmt(new Date(y, m, 1)), endDate: fmt(now) };
    }
    case 'last_month': {
      return { startDate: fmt(new Date(y, m - 1, 1)), endDate: fmt(new Date(y, m, 0)) };
    }
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3;
      return { startDate: fmt(new Date(y, q, 1)), endDate: fmt(now) };
    }
    case 'last_quarter': {
      const q = Math.floor(m / 3) * 3;
      const lqStart = new Date(y, q - 3, 1);
      const lqEnd = new Date(y, q, 0);
      return { startDate: fmt(lqStart), endDate: fmt(lqEnd) };
    }
    case 'this_year':
      return { startDate: fmt(new Date(y, 0, 1)), endDate: fmt(now) };
    default:
      return {};
  }
}

export default function SalesTransactions() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('sales_invoice');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [period, setPeriod] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);

  const dateParams = period === 'custom'
    ? { startDate: fromDate || undefined, endDate: toDate || undefined }
    : getPeriodDates(period);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrService.listTransactions({ transactionType: tab, direction: 'sales', search, status: statusFilter, page, limit: 35, ...dateParams });
      setData(res.data || []);
      setTotal(res.total || 0);
    } catch { setData([]); }
    setLoading(false);
  }, [tab, search, statusFilter, page, dateParams.startDate, dateParams.endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [tab, search, statusFilter, period, fromDate, toDate]);

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setPeriod(''); setFromDate(''); setToDate(''); };

  const cfg = DOCUMENT_CONFIG[tab];

  const columns = [
    { key: 'document_number', label: 'Document No', sortable: true },
    { key: 'document_date', label: 'Date', render: (v) => v ? new Date(v).toLocaleDateString('en-IN') : '—', sortable: true },
    { key: 'party_name', label: cfg?.partyType === 'customer' ? 'Customer' : 'Supplier', render: (v) => v || '—' },
    { key: 'grand_total', label: 'Amount', render: (v) => formatINR(v || 0), sortable: true },
    { key: 'status', label: 'Status', render: (v) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[v] || 'bg-gray-100 text-gray-600'}`}>{v}</span> },
  ];

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (row) => { setEditing(row); setShowForm(true); };
  const handleDelete = async (row) => {
    if (!window.confirm(`Delete draft ${row.document_number}?`)) return;
    try {
      await hrService.deleteTransaction(row.id);
      fetchData();
    } catch { alert('Failed to delete.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Sales</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ New {DOC_LABELS[tab]}</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-0 overflow-x-auto">
        {TYPES.map(t => (
          <button key={t} onClick={() => { setTab(t); setDetail(null); }}
            className={`text-sm font-medium px-1 py-3 -mb-px border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {DOC_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Search</label>
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[160px]" placeholder={`Search ${cfg?.label || 'transactions'}...`} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px]">
              <option value="">All Status</option>
              {['draft', 'sent', 'paid', 'partial', 'overdue', 'completed', 'issued', 'delivered'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Period</label>
            <select value={period} onChange={e => { setPeriod(e.target.value); if (e.target.value !== 'custom') { setFromDate(''); setToDate(''); } }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-w-[130px]">
              {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
            </>
          )}
          {(search || statusFilter || period || fromDate || toDate) && (
            <div className="flex items-end pb-[2px]">
              <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-gray-700 underline whitespace-nowrap">Clear</button>
            </div>
          )}
        </div>
      </div>

      <ResponsiveTable
        columns={columns}
        data={data}
        loading={loading}
        total={total}
        page={page}
        totalPages={Math.ceil(total / 35)}
        onPageChange={setPage}
        searchable={false}
        onRowClick={(r) => setDetail(r)}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); openEdit(row); }}
              className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Edit</button>
            {row.status === 'draft' && (
              <button onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
                className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>
            )}
          </div>
        )}
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm animate-fade-in pt-10 pb-10 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 flex flex-col max-h-[85vh] animate-scale-in" onClick={e => e.stopPropagation()}>
            <TransactionForm transactionType={tab} initial={editing || {}} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={() => { setEditing(null); fetchData(); }} />
          </div>
        </div>
      )}

      {detail && (isMobile ? (
        <BottomSheet open={!!detail} onClose={() => setDetail(null)} title={detail.document_number || 'Transaction Details'}>
          <DetailContent data={detail} />
        </BottomSheet>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{detail.document_number}</h3>
              <button onClick={() => setDetail(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <DetailContent data={detail} />
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => { const d = detail; setDetail(null); openEdit(d); }} className="btn-primary text-sm">Edit</button>
              {detail.status === 'draft' && (
                <button onClick={() => { const d = detail; setDetail(null); handleDelete(d); }} className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">Delete</button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailContent({ data }) {
  return (
    <div className="space-y-3 text-sm">
      <DetailRow label="Document No" value={data.document_number} />
      <DetailRow label="Date" value={data.document_date ? new Date(data.document_date).toLocaleDateString('en-IN') : '—'} />
      <DetailRow label={data.direction === 'sales' ? 'Customer' : 'Supplier'} value={data.party_name || '—'} />
      <DetailRow label="GSTIN" value={data.party_gstin || '—'} />
      {data.due_date && <DetailRow label="Due Date" value={new Date(data.due_date).toLocaleDateString('en-IN')} />}
      <DetailRow label="Amount" value={formatINR(data.grand_total || 0)} />
      <DetailRow label="Paid" value={formatINR(data.amount_paid || 0)} />
      <DetailRow label="Balance" value={formatINR(data.balance_due || 0)} />
      <DetailRow label="Status">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[data.status] || 'bg-gray-100 text-gray-600'}`}>{data.status}</span>
      </DetailRow>
      {data.notes && <DetailRow label="Notes" value={data.notes} />}
    </div>
  );
}

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

function formatINR(cents) {
  const symbol = localStorage.getItem('currency_symbol') || '₹';
  return symbol + Number(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
