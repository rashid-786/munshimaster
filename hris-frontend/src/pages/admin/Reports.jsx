import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatPhone } from '../../utils/currency';

const TABS = [
  { key: 'customers', label: 'Customers' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'balance', label: 'Balance Sheet' },
];

const SORT_OPTIONS = {
  customers: [{ value: 'name', label: 'Name' }, { value: 'email', label: 'Email' }, { value: 'created_at', label: 'Date Created' }],
  suppliers: [{ value: 'name', label: 'Name' }, { value: 'email', label: 'Email' }, { value: 'created_at', label: 'Date Created' }],
  balance: [{ value: 'entry_date', label: 'Date' }, { value: 'amount', label: 'Amount' }, { value: 'type', label: 'Type' }, { value: 'payment_method', label: 'Payment Method' }],
};

const Columns = {
  customers: ['Name', 'Email', 'Phone', 'Address', 'GSTIN', 'Created At'],
  suppliers: ['Name', 'Email', 'Phone', 'Address', 'GSTIN', 'Created At'],
  balance: ['Date', 'Type', 'Method', 'Amount', 'Description', 'Added By'],
};

const Reports = () => {
  const [tab, setTab] = useState('customers');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [entryType, setEntryType] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [downloading, setDownloading] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { type: tab, sortBy: sortBy || undefined, sortOrder };
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
  }, [tab, search, startDate, endDate, sortBy, sortOrder, entryType, paymentMethod]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDownload = async (format) => {
    setDownloading(format);
    try {
      const params = { sortBy: sortBy || undefined, sortOrder };
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
              onClick={() => { setTab(t.key); setSearch(''); setEntryType(''); setPaymentMethod(''); }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            {tab !== 'balance' && (
              <input type="text" placeholder="Search by name, email, phone..." value={search} onChange={e => setSearch(e.target.value)} className="input-field max-w-xs text-sm" />
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">From:</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field max-w-[140px]" />
              <span className="text-gray-500">To:</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field max-w-[140px]" />
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Sort:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="input-field max-w-[140px]">
                <option value="">Default</option>
                {(SORT_OPTIONS[tab] || []).map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="input-field max-w-[100px]">
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>

          {tab === 'balance' && (
            <div className="flex gap-3 items-center text-sm">
              <span className="text-gray-500">Filter:</span>
              <select value={entryType} onChange={e => setEntryType(e.target.value)} className="input-field max-w-[130px]">
                <option value="">All Types</option>
                <option value="IN">IN (Income)</option>
                <option value="OUT">OUT (Expense)</option>
              </select>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field max-w-[130px]">
                <option value="">All Methods</option>
                <option value="cash">Cash</option>
                <option value="online">Online</option>
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {(Columns[tab] || []).map(col => (
                  <th key={col} className="table-header">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={Columns[tab]?.length || 6} className="table-cell text-center text-gray-400 py-8">Loading...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={Columns[tab]?.length || 6} className="table-cell text-center text-gray-400 py-8">No data found</td></tr>
              ) : (
                data.map((row, i) => (
                  <tr key={row.id || i} className="hover:bg-gray-50 transition-colors">
                    {tab === 'customers' || tab === 'suppliers' ? (
                      <>
                        <td className="table-cell font-medium">{row.name || '-'}</td>
                        <td className="table-cell">{row.email || '-'}</td>
                        <td className="table-cell">{formatPhone(row.phone) || '-'}</td>
                        <td className="table-cell text-gray-500 max-w-[200px] truncate">{row.address || '-'}</td>
                        <td className="table-cell">{row.gstin || '-'}</td>
                        <td className="table-cell text-gray-500">{row.created_at ? row.created_at.split('T')[0] : '-'}</td>
                      </>
                    ) : (
                      <>
                        <td className="table-cell text-gray-500">{row.entry_date ? row.entry_date.split('T')[0] : '-'}</td>
                        <td className="table-cell"><span className={row.type === 'IN' ? 'badge-success' : 'badge-danger'}>{row.type}</span></td>
                        <td className="table-cell capitalize">{row.payment_method}</td>
                        <td className={`table-cell font-semibold ${row.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                          {row.type === 'IN' ? '+' : '-'}Rs.{(row.amount / 100).toFixed(2)}
                        </td>
                        <td className="table-cell text-gray-500 max-w-[200px] truncate">{row.description || '-'}</td>
                        <td className="table-cell text-gray-500">{row.first_name ? `${row.first_name} ${row.last_name}` : '-'}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;
