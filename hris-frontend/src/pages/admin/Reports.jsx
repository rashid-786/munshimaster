import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';
import { formatPhone, formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';
import UpgradeBanner from '../../components/UpgradeBanner';

const PLAN_RANK = { free: 0, business: 1, business_monthly: 1, pro: 2, pro_monthly: 2 };

const BASIC_TABS = [
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'balance', label: 'Balance Sheet' },
];
const ADVANCED_TABS = [
  { key: 'sales_by_customer', label: 'Sales by Customer' },
  { key: 'purchases_by_supplier', label: 'Purchases by Supplier' },
  { key: 'ar_aging', label: 'AR Aging' },
  { key: 'ap_aging', label: 'AP Aging' },
  { key: 'invoice_status_summary', label: 'Invoice Status' },
  { key: 'gst_summary', label: 'GST Summary' },
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

const BUCKET_ORDER = ['0-30', '31-60', '61-90', '90+'];
const BUCKET_COLORS = { '0-30': 'text-green-600 bg-green-50', '31-60': 'text-amber-600 bg-amber-50', '61-90': 'text-orange-600 bg-orange-50', '90+': 'text-red-600 bg-red-50' };

const Reports = () => {
  const { tenant } = useAuth();
  const currentPlan = tenant?.subscriptionPlan || 'free';
  const planRank = PLAN_RANK[currentPlan] || 0;
  const TABS = planRank >= 2 ? [...BASIC_TABS, ...ADVANCED_TABS] : BASIC_TABS;
  const isMobile = useIsMobile();
  const [tab, setTab] = useState('customers');
  const [data, setData] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('this_year');
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
    const { start, end } = calcPeriod(period);
    setStartDate(start);
    setEndDate(end);
  }, []);

  useEffect(() => {
    const tabKeys = TABS.map(t => t.key);
    if (!tabKeys.includes(tab) && tabKeys.length > 0) {
      setTab(tabKeys[0]);
    }
  }, [TABS]);

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
      setError('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load report');
    }
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
    switch (tab) {
      case 'customers':
      case 'suppliers':
        return [
          { key: 'name', label: 'Name', render: (v) => <span className="font-medium">{v || '-'}</span> },
          { key: 'email', label: 'Email', render: (v) => v || '-' },
          { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '-' },
          { key: 'address', label: 'Address', className: 'whitespace-normal', render: (v) => <span className="text-gray-500">{v || '-'}</span> },
          { key: 'gstin', label: 'GSTIN', render: (v) => v || '-' },
          { key: 'created_at', label: 'Created At', render: (v) => <span className="text-gray-500">{v ? v.split('T')[0] : '-'}</span> },
        ];
      case 'balance':
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
      case 'sales_by_customer':
        return [
          { key: 'name', label: 'Customer', render: (v) => <span className="font-medium">{v || '-'}</span> },
          { key: 'email', label: 'Email', render: (v) => v || '-' },
          { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '-' },
          { key: 'invoice_count', label: 'Invoices', render: (v) => v },
          { key: 'total_sales', label: 'Total Sales', render: (v) => <span className="font-semibold text-green-600">{formatINR(v)}</span> },
          { key: 'total_collected', label: 'Collected', render: (v) => <span className="font-semibold">{formatINR(v)}</span> },
          { key: 'balance_due', label: 'Balance Due', render: (v) => <span className={`font-semibold ${Number(v) > 0 ? 'text-red-600' : ''}`}>{formatINR(v)}</span> },
        ];
      case 'purchases_by_supplier':
        return [
          { key: 'name', label: 'Supplier', render: (v) => <span className="font-medium">{v || '-'}</span> },
          { key: 'email', label: 'Email', render: (v) => v || '-' },
          { key: 'phone', label: 'Phone', render: (v) => formatPhone(v) || '-' },
          { key: 'order_count', label: 'Orders', render: (v) => v },
          { key: 'total_purchases', label: 'Total Purchases', render: (v) => <span className="font-semibold text-red-600">{formatINR(v)}</span> },
        ];
      default:
        return [];
    }
  };

  const getMobilePrimary = () => {
    if (['customers', 'suppliers', 'sales_by_customer', 'purchases_by_supplier'].includes(tab)) return 'name';
    if (tab === 'balance') return 'entry_date';
    return '';
  };

  const getMobileSecondary = () => {
    if (['customers', 'suppliers', 'sales_by_customer', 'purchases_by_supplier'].includes(tab)) return 'email';
    if (tab === 'balance') return 'type';
    return '';
  };

  const columns = getColumns();
  const isAgingTab = tab === 'ar_aging' || tab === 'ap_aging';
  const isStatusTab = tab === 'invoice_status_summary';
  const isGstTab = tab === 'gst_summary';
  const isAggTab = tab === 'sales_by_customer' || tab === 'purchases_by_supplier';

  const summary = (() => {
    if (tab === 'balance' && Array.isArray(data) && data.length > 0) {
      return data.reduce((acc, r) => {
        const amt = Number(r.amount) || 0;
        if (r.type === 'IN') acc.income += amt;
        else if (r.type === 'OUT') acc.expense += amt;
        return acc;
      }, { income: 0, expense: 0 });
    }
    return null;
  })();

  const needsDateRange = ['customers', 'suppliers', 'balance', 'sales_by_customer', 'purchases_by_supplier', 'invoice_status_summary', 'gst_summary'].includes(tab);

  return (
    <div className="space-y-6">
      <UpgradeBanner type="feature" feature="Reports" plan="business" />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-xl font-semibold text-gray-900">Reports</h2>
        {!isAgingTab && (
          <div className="flex gap-2">
            <button onClick={() => handleDownload('pdf')} disabled={!!downloading} className="btn-primary text-sm">
              {downloading === 'pdf' ? 'Generating...' : 'Download PDF'}
            </button>
            <button onClick={() => handleDownload('excel')} disabled={!!downloading} className="btn-secondary text-sm">
              {downloading === 'excel' ? 'Generating...' : 'Download Excel'}
            </button>
          </div>
        )}
      </div>

      <div className="border-b border-gray-200 overflow-x-auto">
        <div className="flex gap-0 -mb-px min-w-max">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); setEntryType(''); setPaymentMethod(''); setSelectedRecord(null); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters — visible for all tabs */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {!['sales_by_customer', 'purchases_by_supplier'].includes(tab) && (
          <div className="w-full sm:w-auto">
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="input-field w-full sm:max-w-[180px] text-sm" />
          </div>
        )}
        {needsDateRange && (
          <>
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
          </>
        )}
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

      {/* AR / AP Aging buckets */}
      {isAgingTab && data?.buckets && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BUCKET_ORDER.map(b => {
              const items = data.buckets[b] || [];
              const total = items.reduce((s, r) => s + Number(r.outstanding || r.total_amount || 0), 0);
              return (
                <div key={b} className={`stat-card ${BUCKET_COLORS[b]}`}>
                  <p className="text-xs font-medium opacity-80">{b} days</p>
                  <p className="text-2xl font-bold">{items.length}</p>
                  <p className="text-xs opacity-80 mt-1">{formatINR(total)}</p>
                </div>
              );
            })}
          </div>
          <p className="text-sm text-gray-500">Total Outstanding: <span className="font-semibold text-gray-900">{formatINR(data.totalOutstanding || 0)}</span></p>
          <ResponsiveTable
            columns={[
              { key: 'invoice_number', label: tab === 'ar_aging' ? 'Invoice #' : 'Order #', render: (v) => <span className="font-medium">{v || '-'}</span> },
              { key: 'customer_name', label: tab === 'ar_aging' ? 'Customer' : 'Supplier', render: (v) => v || '-' },
              ...(tab === 'ar_aging' ? [
                { key: 'invoice_date', label: 'Invoice Date', render: (v) => v ? v.split('T')[0] : '-' },
                { key: 'due_date', label: 'Due Date', render: (v) => v ? v.split('T')[0] : '-' },
                { key: 'total_amount', label: 'Total', render: (v) => formatINR(v) },
                { key: 'amount_paid', label: 'Paid', render: (v) => formatINR(v) },
                { key: 'outstanding', label: 'Outstanding', render: (v) => <span className="font-semibold text-red-600">{formatINR(v)}</span> },
              ] : [
                { key: 'order_date', label: 'Order Date', render: (v) => v ? v.split('T')[0] : '-' },
                { key: 'expected_date', label: 'Expected Date', render: (v) => v ? v.split('T')[0] : '-' },
                { key: 'total_amount', label: 'Total', render: (v) => formatINR(v) },
              ]),
              { key: 'days_overdue', label: 'Days Overdue', render: (v) => <span className="font-semibold">{v}</span> },
              { key: 'bucket', label: 'Bucket', render: (_, r) => {
                const d = Number(r.days_overdue);
                const bucket = d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
                return <span className="text-xs font-medium">{bucket}</span>;
              }},
            ]}
            data={Object.entries(data.buckets || {}).flatMap(([bucket, items]) => items.map(r => ({ ...r, bucket })))}
            keyField="id"
            searchKeys={['invoice_number', 'customer_name', 'order_number']}
            loading={loading}
            emptyMessage="No outstanding items"
          />
        </div>
      )}

      {/* Invoice Status Summary */}
      {isStatusTab && data?.rows && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="stat-card">
              <p className="text-sm text-gray-500">Total Invoices</p>
              <p className="text-2xl font-bold">{data.totalCount || 0}</p>
            </div>
            <div className="stat-card">
              <p className="text-sm text-gray-500">Total Amount</p>
              <p className="text-2xl font-bold">{formatINR(data.totalAmount || 0)}</p>
            </div>
          </div>
          <ResponsiveTable
            columns={[
              { key: 'status', label: 'Status', render: (v) => <span className={`badge-${v}`}>{v}</span> },
              { key: 'count', label: 'Count', render: (v) => <span className="font-semibold">{v}</span> },
              { key: 'total_amount', label: 'Total Amount', render: (v) => <span className="font-semibold">{formatINR(v)}</span> },
            ]}
            data={data.rows}
            keyField="status"
            loading={loading}
            emptyMessage="No invoices"
          />
        </div>
      )}

      {/* GST Summary */}
      {tab === 'gst_summary' && (
        <>
          {error ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-1">Unable to load GST Summary</p>
              <p className="text-sm">{error}</p>
            </div>
          ) : data?.output && (data.output.totalOutput > 0 || data.input?.totalInput > 0) ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="stat-card bg-green-50 border border-green-100">
                  <p className="text-sm text-green-700 font-medium">Total Output Tax</p>
                  <p className="text-2xl font-bold text-green-700">{formatINR(data.output?.totalOutput || 0)}</p>
                  <p className="text-xs text-green-500 mt-1">{data.output?.invoiceCount || 0} invoices</p>
                </div>
                <div className="stat-card bg-red-50 border border-red-100">
                  <p className="text-sm text-red-700 font-medium">Total Input Tax</p>
                  <p className="text-2xl font-bold text-red-700">{formatINR(data.input?.totalInput || 0)}</p>
                  <p className="text-xs text-red-500 mt-1">{data.input?.poCount || 0} purchases</p>
                </div>
                <div className="stat-card bg-blue-50 border border-blue-100">
                  <p className="text-sm text-blue-700 font-medium">Net Tax Liability</p>
                  <p className={`text-2xl font-bold ${data.netTax >= 0 ? 'text-red-700' : 'text-green-700'}`}>{formatINR(Math.abs(data.netTax || 0))}</p>
                  <p className="text-xs text-blue-500 mt-1">{data.netTax >= 0 ? 'Payable' : 'Refundable'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Output Tax (Sales)</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">GST</span><span className="font-medium">{formatINR((data.output?.cgst || 0) + (data.output?.sgst || 0) + (data.output?.igst || 0))}</span></div>
                    <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{formatINR(data.output?.totalOutput || 0)}</span></div>
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">Input Tax (Purchases)</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">GST</span><span className="font-medium">{formatINR((data.input?.cgst || 0) + (data.input?.sgst || 0) + (data.input?.igst || 0))}</span></div>
                    <div className="flex justify-between border-t pt-2 font-semibold"><span>Total</span><span>{formatINR(data.input?.totalInput || 0)}</span></div>
                  </div>
                </div>
              </div>
            </div>
          ) : !error && data?.output ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-1">No GST data</p>
              <p className="text-sm">No tax transactions found for the selected period. Try a different date range.</p>
            </div>
          ) : loading ? null : !error && !loading ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium mb-1">GST Summary</p>
              <p className="text-sm">Select a period and date range to view tax liability.</p>
            </div>
          ) : null}
        </>
      )}

      {/* Standard table for array-based reports */}
      {!isAgingTab && !isStatusTab && !isGstTab && (
        <>
          <ResponsiveTable
            columns={columns}
            data={Array.isArray(data) ? data : []}
            keyField="id"
            mobilePrimary={getMobilePrimary()}
            mobileSecondary={getMobileSecondary()}
            onRowClick={(r) => setSelectedRecord(r)}
            emptyMessage="No data found"
            loading={loading}
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
                  ) : tab === 'balance' ? (
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
                  ) : tab === 'sales_by_customer' ? (
                    <>
                      <DetailRow label="Customer" value={selectedRecord.name} />
                      <DetailRow label="Email" value={selectedRecord.email} />
                      <DetailRow label="Phone" value={formatPhone(selectedRecord.phone)} />
                      <DetailRow label="Invoices" value={String(selectedRecord.invoice_count || 0)} />
                      <DetailRow label="Total Sales">{formatINR(selectedRecord.total_sales)}</DetailRow>
                      <DetailRow label="Collected">{formatINR(selectedRecord.total_collected)}</DetailRow>
                      <DetailRow label="Balance Due"><span className="text-red-600">{formatINR(selectedRecord.balance_due)}</span></DetailRow>
                    </>
                  ) : tab === 'purchases_by_supplier' ? (
                    <>
                      <DetailRow label="Supplier" value={selectedRecord.name} />
                      <DetailRow label="Email" value={selectedRecord.email} />
                      <DetailRow label="Phone" value={formatPhone(selectedRecord.phone)} />
                      <DetailRow label="Orders" value={String(selectedRecord.order_count || 0)} />
                      <DetailRow label="Total Purchases"><span className="text-red-600">{formatINR(selectedRecord.total_purchases)}</span></DetailRow>
                    </>
                  ) : null}
                </div>
              )}
            </BottomSheet>
          )}
        </>
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
