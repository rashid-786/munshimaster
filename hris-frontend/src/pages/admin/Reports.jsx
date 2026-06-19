import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatPhone, formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const TABS = [
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'balance', label: 'Balance Sheet' },
];

const PERIODS = [
  { value: '', label: 'Custom' },
  { value: 'this_year', label: 'This Year' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'yesterday', label: 'Yesterday' },
];

const fmtDate = (d) => d.toISOString().split('T')[0];

const calcPeriod = (period) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (period) {
    case 'this_year':
      return { start: `${y}-01-01`, end: `${y}-12-31` };
    case 'this_quarter': {
      const qStart = Math.floor(m / 3) * 3;
      const qEnd = qStart + 2;
      const endDate = new Date(y, qEnd + 1, 0);
      return { start: `${y}-${String(qStart + 1).padStart(2, '0')}-01`, end: fmtDate(endDate) };
    }
    case 'this_month': {
      const endDate = new Date(y, m + 1, 0);
      return { start: `${y}-${String(m + 1).padStart(2, '0')}-01`, end: fmtDate(endDate) };
    }
    case 'last_month': {
      const startDate = new Date(y, m - 1, 1);
      const endDate = new Date(y, m, 0);
      return { start: fmtDate(startDate), end: fmtDate(endDate) };
    }
    case 'yesterday': {
      const yd = new Date(now);
      yd.setDate(yd.getDate() - 1);
      const ys = fmtDate(yd);
      return { start: ys, end: ys };
    }
    default:
      return { start: '', end: '' };
  }
};

const Reports = () => {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('customers');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entryType, setEntryType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [downloading, setDownloading] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const handlePeriod = (value) => {
    setPeriod(value);
    if (value) {
      const { start, end } = calcPeriod(value);
      setStartDate(start);
      setEndDate(end);
    }
  };

  useEffect(() => {
    const { start, end } = calcPeriod('this_month');
    setStartDate(start);
    setEndDate(end);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { type: tab };
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (tab === 'balance') {
        if (entryType) params.entryType = entryType;
        if (paymentMethod) params.paymentMethod = paymentMethod;
      }
      const res = await hrService.getReportData(params);
      setData(res);
    } catch {}
    setLoading(false);
  }, [tab, search, startDate, endDate, entryType, paymentMethod]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownload = async (format) => {
    setDownloading(format);
    try {
      const params = {};
      if (search) params.search = search;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (tab === 'balance') {
        if (entryType) params.entryType = entryType;
        if (paymentMethod) params.paymentMethod = paymentMethod;
      }
      if (format === 'pdf') {
        await hrService.downloadReportPDF(tab, params);
      } else {
        await hrService.downloadReportExcel(tab, params);
      }
    } catch (err) {
      console.error('Download failed', err);
    }
    setDownloading('');
  };

  const getColumns = () => {
    if (tab === 'customers' || tab === 'suppliers') {
      return [
        { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v || '-'}</span> },
        { key: 'email', label: 'Email', render: (v) => v || '-' },
        { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '-' },
        { key: 'address', label: 'Address', className: 'whitespace-normal', render: (v) => <span className="text-gray-500">{v || '-'}</span> },
        { key: 'gstin', label: 'GSTIN', render: (v) => v || '-' },
        { key: 'created_at', label: 'Created At', render: (v) => <span className="text-gray-500">{v ? v.split('T')[0] : '-'}</span> },
      ];
    }
    return [
      { key: 'entry_date', label: 'Date', render: (v) => <span className="text-gray-500">{v ? v.split('T')[0] : '-'}</span> },
      { key: 'type', label: 'Type', render: (v) => <span className={v === 'IN' ? 'badge-success' : 'badge-danger'}>{v}</span> },
      { key: 'payment_method', label: 'Method', render: (v) => <span className="capitalize">{v}</span> },
      { key: 'amount', label: 'Amount', render: (v, r) => (
        <span className={`font-semibold ${r.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
          {r.type === 'IN' ? '+' : '-'}Rs.{(v / 100).toFixed(2)}
        </span>
      )},
      { key: 'description', label: 'Description', className: 'whitespace-normal', render: (v) => <span className="text-gray-500">{v || '-'}</span> },
      { key: 'added_by', label: 'Added By', render: (_, r) => <span className="text-gray-500">{r.first_name ? `${r.first_name} ${r.last_name}` : '-'}</span> },
    ];
  };

  const getMobilePrimary = () => {
    if (tab === 'customers' || tab === 'suppliers') return 'name';
    return 'entry_date';
  };

  const getMobileSecondary = () => {
    if (tab === 'customers' || tab === 'suppliers') return 'email';
    return 'type';
  };

  const columns = getColumns();

  const summary = tab === 'balance' && data.length > 0
    ? data.reduce((acc, r) => {
        const amt = Number(r.amount) || 0;
        if (r.type === 'IN') acc.income += amt;
        else if (r.type === 'OUT') acc.expense += amt;
        return acc;
      }, { income: 0, expense: 0 })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
        <div className="flex gap-2">
          <button onClick={() => handleDownload('pdf')} disabled={!!downloading} className="btn-primary text-sm">
            {downloading === 'pdf' ? 'Generating...' : 'Download PDF'}
          </button>
          <button onClick={() => handleDownload('excel')} disabled={!!downloading} className="btn-secondary text-sm">
            {downloading === 'excel' ? 'Generating...' : 'Download Excel'}
          </button>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); setEntryType(''); setPaymentMethod(''); setSelectedRecord(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Income</p>
              <p className="text-2xl font-bold text-emerald-600">{formatINR(summary.income)}</p>
            </div>
          </div>
          <div className="stat-card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Expense</p>
              <p className="text-2xl font-bold text-red-500">{formatINR(summary.expense)}</p>
            </div>
          </div>
          <div className="stat-card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${summary.income >= summary.expense ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Balance</p>
              <p className={`text-2xl font-bold ${summary.income >= summary.expense ? 'text-blue-600' : 'text-red-500'}`}>{formatINR(summary.income - summary.expense)}</p>
            </div>
          </div>
        </div>
      )}

      <ResponsiveTable
        columns={columns}
        data={data}
        keyField="id"
        mobilePrimary={getMobilePrimary()}
        mobileSecondary={getMobileSecondary()}
        onRowClick={(r) => setSelectedRecord(r)}
        emptyMessage="No data found"
        loading={loading}
        header={
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {tab !== 'balance' && (
              <div className="w-full sm:w-auto">
                <input type="text" placeholder="Search by name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} className="input-field w-full sm:max-w-[180px] text-sm" />
              </div>
            )}
            <div className="w-full sm:w-auto flex items-center gap-2">
              <span className="text-gray-500 shrink-0">Period:</span>
              <select value={period} onChange={e => handlePeriod(e.target.value)} className="input-field min-w-0 flex-1 sm:max-w-[150px]">
                {PERIODS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 shrink-0">From:</span>
              <input type="date" value={startDate} onChange={e => { setPeriod(''); setStartDate(e.target.value); }} className="input-field min-w-0 flex-1 sm:max-w-[150px]" />
              <span className="text-gray-500 shrink-0">To:</span>
              <input type="date" value={endDate} onChange={e => { setPeriod(''); setEndDate(e.target.value); }} className="input-field min-w-0 flex-1 sm:max-w-[150px]" />
              {(startDate || endDate) && (
                <button onClick={() => { setPeriod('this_month'); const { start, end } = calcPeriod('this_month'); setStartDate(start); setEndDate(end); }} className="text-xs text-gray-500 hover:text-gray-700 underline shrink-0 whitespace-nowrap">Clear</button>
              )}
            </div>
            {tab === 'balance' && (
              <div className="w-full sm:w-auto flex items-center gap-2">
                <span className="text-gray-500 shrink-0 hidden sm:inline">Type:</span>
                <select value={entryType} onChange={e => setEntryType(e.target.value)} className="input-field min-w-0 flex-1 sm:max-w-[130px]">
                  <option value="">All Types</option>
                  <option value="IN">IN (Income)</option>
                  <option value="OUT">OUT (Expense)</option>
                </select>
                <span className="text-gray-500 shrink-0 hidden sm:inline">Method:</span>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field min-w-0 flex-1 sm:max-w-[130px]">
                  <option value="">All Methods</option>
                  <option value="cash">Cash</option>
                  <option value="online">Online</option>
                </select>
              </div>
            )}
          </div>
        }
      />

      {isMobile && (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={
            selectedRecord
              ? (selectedRecord.name || (selectedRecord.entry_date ? selectedRecord.entry_date.split('T')[0] : 'Details'))
              : 'Details'
          }
          actions={null}
        >
          {selectedRecord && (
            <div className="space-y-3">
              {(tab === 'customers' || tab === 'suppliers') ? (
                <>
                  <DetailRow label="Name" value={selectedRecord.name} />
                  <DetailRow label="Email" value={selectedRecord.email} />
                  <DetailRow label="Phone" value={formatPhone(selectedRecord.phone)} />
                  <DetailRow label="Address" value={selectedRecord.address} />
                  <DetailRow label="GSTIN" value={selectedRecord.gstin} />
                  <DetailRow label="Created At" value={selectedRecord.created_at ? selectedRecord.created_at.split('T')[0] : '-'} />
                </>
              ) : (
                <>
                  <DetailRow label="Date" value={selectedRecord.entry_date ? selectedRecord.entry_date.split('T')[0] : '-'} />
                  <DetailRow label="Type">
                    <span className={selectedRecord.type === 'IN' ? 'badge-success' : 'badge-danger'}>{selectedRecord.type}</span>
                  </DetailRow>
                  <DetailRow label="Method" value={selectedRecord.payment_method} />
                  <DetailRow label="Amount">
                    <span className={`font-semibold ${selectedRecord.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedRecord.type === 'IN' ? '+' : '-'}Rs.{(selectedRecord.amount / 100).toFixed(2)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Description" value={selectedRecord.description || '-'} />
                  <DetailRow label="Added By" value={selectedRecord.first_name ? `${selectedRecord.first_name} ${selectedRecord.last_name}` : '-'} />
                </>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
};

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default Reports;
