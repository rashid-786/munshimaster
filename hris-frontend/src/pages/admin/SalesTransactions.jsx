import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { DOC_LABELS, DOCUMENT_CONFIG, STATUS_STYLES } from '../../config/documentConfig';
import TransactionForm from '../../components/TransactionForm';
import ResponsiveTable from '../../components/ResponsiveTable';
import Drawer from '../../components/Drawer';
import TransactionDetailView from '../../components/TransactionDetailView';
import ConfirmModal from '../../components/ConfirmModal';

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
  const [generateMsg, setGenerateMsg] = useState('');
  const [templateConfig, setTemplateConfig] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    hrService.getInvoiceTemplateSettings().then(r => setTemplateConfig(r || {})).catch(() => {});
  }, []);

  useEffect(() => {
    if (searchParams.get('new') === '1') setShowForm(true);
  }, [searchParams]);

  useEffect(() => {
    if (printData) {
      const handler = () => setPrintData(null);
      window.addEventListener('afterprint', handler);
      setTimeout(() => { window.print(); }, 300);
      return () => window.removeEventListener('afterprint', handler);
    }
  }, [printData]);

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
  const openEdit = async (row) => {
    try {
      const full = await hrService.getTransaction(row.id);
      setEditing(full); setShowForm(true);
    } catch { setEditing(row); setShowForm(true); }
  };
  const handleDelete = async (row) => { setConfirmDelete(row); };
  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    try {
      await hrService.deleteTransaction(confirmDelete.id);
      setConfirmDelete(null);
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
        onRowClick={async (r) => {
          try {
            const full = await hrService.getTransaction(r.id);
            setDetail(full);
          } catch { setDetail(r); }
        }}
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

      <ConfirmModal
        open={!!confirmDelete}
        title="Delete Document"
        message={`Are you sure you want to delete draft ${confirmDelete?.document_number || ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />

      {printData && createPortal((() => {
        const rawHtml = buildInvoiceHTML(printData, templateConfig, 'sales');
        const styles = (rawHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/g) || []).map(s => s.replace(/<\/?style[^>]*>/g, '')).join('\n');
        const bodyContent = rawHtml.replace(/[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*/i, '');
        return (
          <div className="print-view">
            <style>{styles}</style>
            <style>{`@media print { @page { size: A4; margin: 0; } body > :not(.print-view) { display: none !important; } .print-view { display: block; } }`}</style>
            <div dangerouslySetInnerHTML={{ __html: bodyContent }} />
          </div>
        );
      })(), document.body)}

      {detail && (
        <Drawer
          open={!!detail}
          onClose={() => setDetail(null)}
          title={`${DOC_LABELS[tab] || 'Transaction'} — ${detail.document_number || ''}`}
          footer={
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => { const d = detail; setDetail(null); openEdit(d); }} className="btn-primary text-sm">Edit</button>
              {detail.status === 'draft' && (
                <button onClick={() => { const d = detail; setDetail(null); handleDelete(d); }} className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">Delete</button>
              )}
              <div className="flex-1" />
              {detail.status !== 'draft' && (
                <>
                  <button onClick={async () => {
                    try {
                      const full = await hrService.getTransaction(detail.id);
                      setPrintData(full);
                    } catch { alert('Failed to generate print view.'); }
                  }} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5" title="Print">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    Print
                  </button>
                  <button onClick={async () => {
                    try {
                      const blob = await hrService.downloadTransactionPDF(detail.id);
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a'); a.href = url; a.download = `${detail.document_number || 'invoice'}.pdf`; a.click();
                      URL.revokeObjectURL(url);
                    } catch { alert('Failed to download PDF.'); }
                  }} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5" title="Download PDF">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    PDF
                  </button>
                  <button onClick={async () => {
                    const url = `${window.location.origin}/invoice/${detail.id}`;
                    if (navigator.share) {
                      try { await navigator.share({ title: detail.document_number || 'Invoice', text: `Invoice ${detail.document_number}`, url }); } catch {}
                    } else {
                      try { await navigator.clipboard.writeText(url); alert('Link copied!'); } catch { prompt('Copy link:', url); }
                    }
                  }} className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1.5" title="Share">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                    Share
                  </button>
                </>
              )}
              {detail.status !== 'converted' && cfg?.conversions?.length > 0 && cfg.conversions.map(ct => (
                <button key={ct} onClick={async () => {
                  setGenerateMsg(`Generating ${DOC_LABELS[ct] || ct}...`);
                  try {
                    const res = await hrService.convertTransaction(detail.id, ct);
                    if (res?.id) {
                      try {
                        const full = await hrService.getTransaction(res.id);
                        setDetail(null);
                        setTimeout(() => { setTab(ct); setDetail(full); }, 100);
                      } catch { setDetail(null); setTimeout(() => setTab(ct), 100); }
                    }
                  } catch { alert('Conversion failed.'); }
                  setGenerateMsg('');
                }} className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                  {DOC_LABELS[ct] || ct}
                </button>
              ))}
              {generateMsg && <span className="text-sm text-indigo-600 animate-pulse ml-2">{generateMsg}</span>}
            </div>
          }
        >
          <TransactionDetailView
            transaction={detail}
            templateConfig={templateConfig || {}}
            direction="sales"
          />
        </Drawer>
      )}
    </div>
  );
}



function formatINR(cents) {
  const symbol = '₹';
  return symbol + Number(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildInvoiceHTML(t, cfg, direction) {
  const s = cfg || {};
  const isSales = direction === 'sales';
  const partyLabel = isSales ? 'Customer' : 'Supplier';
  const gstRates = [...new Set((t.items || []).map(i => i.gst_rate || 0).filter(r => r > 0))];
  const gstLabel = gstRates.length === 1 ? `GST @ ${gstRates[0]}%` : 'GST';
  const gstTotal = (Number(t.cgst_amount) || 0) + (Number(t.sgst_amount) || 0) + (Number(t.igst_amount) || 0);
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  const imgUrl = (url) => url ? (url.startsWith('http') ? url : apiBase + url.replace(/^\/api\/v1/, '')) : '';
  const fmt = (cents) => {
    const sym = '₹';
    return sym + Number(cents / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const statusBg = { draft:'#F3F4F6', sent:'#DBEAFE', paid:'#DCFCE7', partial:'#FEF3C7', overdue:'#FEE2E2', completed:'#DCFCE7', issued:'#E0E7FF', delivered:'#CCFBF1', cancelled:'#FEE2E2' };
  const statusFg = { draft:'#6B7280', sent:'#2563EB', paid:'#16A34A', partial:'#D97706', overdue:'#DC2626', completed:'#16A34A', issued:'#6366F1', delivered:'#0D9488', cancelled:'#DC2626' };

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t.document_number || 'Document'}</title>
<style>
  @page { size: A4; margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${s.fontFamily || 'Helvetica, Arial, sans-serif'}; font-size: ${s.fontSize === 'large' ? '14px' : s.fontSize === 'medium' ? '13px' : '12px'}; color: #111827; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid ${s.primaryColor || '#0F172A'}; }
  .header-left { display: flex; align-items: center; gap: 15px; }
  .header-right { text-align: right; }
  .header-right h1 { font-size: 18px; color: ${s.primaryColor || '#0F172A'}; margin-bottom: 4px; }
  .company-name { font-size: 16px; font-weight: bold; color: ${s.primaryColor || '#0F172A'}; }
  .section-title { font-weight: 600; color: #374151; margin-bottom: 4px; font-size: 12px; }
  .party-info { font-size: 12px; line-height: 1.6; }
  .party-info .name { font-weight: 600; color: #111827; }
  .party-info .detail { color: #6B7280; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
  th { background: ${s.primaryColor || '#374151'}; color: #fff; padding: 6px 8px; font-size: 11px; text-align: left; font-weight: 600; }
  th.right { text-align: right; }
  td { padding: 5px 8px; font-size: 11px; border-bottom: 1px solid #E5E7EB; color: #374151; }
  td.right { text-align: right; }
  tr:nth-child(even) td { background: #F9FAFB; }
  .summary { margin-left: auto; width: 280px; }
  .summary-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
  .summary-row.total { border-top: 2px solid ${s.primaryColor || '#0F172A'}; padding-top: 6px; margin-top: 4px; font-weight: bold; font-size: 14px; color: ${s.primaryColor || '#0F172A'}; }
  .summary-label { color: #6B7280; }
  .summary-value { color: #111827; }
  .notes { font-size: 11px; color: #6B7280; margin-top: 20px; padding-top: 10px; border-top: 1px solid #E5E7EB; }
  .signature { text-align: right; margin-top: 40px; display: flex; flex-direction: column; align-items: flex-end; }
  .signature img { max-width: 130px; max-height: 40px; margin-bottom: 4px; }
  .signature .name { font-weight: 600; font-size: 13px; color: #111827; }
  .signature .designation { font-size: 11px; color: #6B7280; }
  .signature .line { width: 140px; border-top: 1px solid #9CA3AF; margin-left: auto; margin-bottom: 4px; }
  .signature .label { font-size: 10px; color: #9CA3AF; }
  .status-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
</style></head><body>
  <div class="header">
    <div class="header-left">
      ${s.logoUrl ? `<img src="${imgUrl(s.logoUrl)}" style="max-height:60px;object-fit:contain;" />` : ''}
      <div>
        <div class="company-name">${s.companyName || ''}</div>
        ${s.gstNumber ? `<div style="font-size:11px;color:#6B7280;">GST: ${s.gstNumber}</div>` : ''}
      </div>
    </div>
    <div class="header-right">
      <h1>${DOC_LABELS[t.transaction_type] || 'Document'}</h1>
      <p style="color:#6B7280;font-size:11px;">${t.document_number || ''}</p>
      <p style="color:#6B7280;font-size:11px;">${t.document_date ? new Date(t.document_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}</p>
      ${t.due_date ? `<p style="color:#6B7280;font-size:11px;">Due: ${new Date(t.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>` : ''}
      <div style="margin-top:4px;">Status: <span class="status-badge" style="background:${statusBg[t.status] || '#F3F4F6'};color:${statusFg[t.status] || '#6B7280'};">${t.status || ''}</span></div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:15px;">
    <div class="party-info">
      <div class="section-title">${partyLabel}</div>
      <div class="name">${t.party_name || '—'}</div>
      ${t.party_gstin ? `<div class="detail">GSTIN: ${t.party_gstin}</div>` : ''}
      ${t.party_address ? `<div class="detail">${t.party_address}</div>` : ''}
      ${t.party_city ? `<div class="detail">${t.party_city}${t.party_state ? ', ' + t.party_state : ''}</div>` : ''}
    </div>
    ${t.place_of_supply ? `<div class="party-info"><div class="section-title">Place of Supply</div><div class="detail">${t.place_of_supply}</div></div>` : ''}
  </div>

  <table>
    <tr><th style="width:30px;">#</th><th>Item</th><th class="right" style="width:60px;">Qty</th><th class="right" style="width:80px;">Rate</th><th class="right" style="width:55px;">GST%</th><th class="right" style="width:90px;">Amount</th></tr>
    ${(t.items || []).map((item, i) => `<tr>
      <td>${i + 1}</td>
      <td>${item.description || item.item_name || '—'}</td>
      <td class="right">${item.quantity || 1}</td>
      <td class="right">${fmt(item.rate || 0)}</td>
      <td class="right">${item.gst_rate || 0}%</td>
      <td class="right">${fmt(item.total_amount || 0)}</td>
    </tr>`).join('')}
  </table>

  <div class="summary">
    <div class="summary-row"><span class="summary-label">Subtotal:</span><span class="summary-value">${fmt(t.subtotal || 0)}</span></div>
    ${Number(t.discount_amount) > 0 ? `<div class="summary-row"><span class="summary-label">Discount:</span><span class="summary-value" style="color:#DC2626;">-${fmt(t.discount_amount)}</span></div>` : ''}
    ${gstTotal > 0 ? `<div class="summary-row"><span class="summary-label">${gstLabel}:</span><span class="summary-value">${fmt(gstTotal)}</span></div>` : ''}
    ${Number(t.round_off) !== 0 ? `<div class="summary-row"><span class="summary-label">Round Off:</span><span class="summary-value">${fmt(t.round_off)}</span></div>` : ''}
    <div class="summary-row total"><span>Grand Total:</span><span>${fmt(t.grand_total || 0)}</span></div>
    
  </div>

  ${t.notes ? `<div class="notes"><strong>Notes:</strong><br>${t.notes.replace(/\\n/g, '<br>')}</div>` : ''}

  ${s.showSignature !== false ? `<div class="signature">
    ${s.signatureUrl ? `<img src="${imgUrl(s.signatureUrl)}" />` : ''}
    ${s.signatoryName ? `<div class="name">${s.signatoryName}</div>` : ''}
    ${s.signatoryDesignation ? `<div class="designation">${s.signatoryDesignation}</div>` : ''}
    <div class="line"></div>
    <div class="label">Authorized Signatory</div>
  </div>` : ''}
</body></html>`;
}
