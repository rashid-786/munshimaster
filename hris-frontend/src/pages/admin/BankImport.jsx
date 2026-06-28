import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import Loading from '../../components/Loading';

const CATEGORIES = ['uncategorized', 'sales', 'purchases', 'salary', 'expenses', 'other_income', 'taxes', 'loan', 'transfers', 'withdrawal'];
const CATEGORY_COLORS = {
  sales: 'text-green-600 bg-green-50', purchases: 'text-red-600 bg-red-50',
  salary: 'text-blue-600 bg-blue-50', expenses: 'text-orange-600 bg-orange-50',
  other_income: 'text-teal-600 bg-teal-50', taxes: 'text-purple-600 bg-purple-50',
  loan: 'text-pink-600 bg-pink-50', transfers: 'text-gray-600 bg-gray-50',
  withdrawal: 'text-amber-600 bg-amber-50', uncategorized: 'text-gray-400 bg-gray-50',
};

const TABS = [
  { key: 'import', label: 'Import' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'history', label: 'Import History' },
];

const BankImport = () => {
  const [tab, setTab] = useState('import');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Transactions
  const [transactions, setTransactions] = useState([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnPage, setTxnPage] = useState(1);
  const [txnFilter, setTxnFilter] = useState({ category: '', matched: '' });
  const [txnLoading, setTxnLoading] = useState(false);

  // History
  const [imports, setImports] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.match(/\.(csv|xlsx?)$/i)) {
      setError('Please upload a CSV or XLSX file.');
      return;
    }
    setFile(f);
    setError('');
    setSuccess('');
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await hrService.bankImportPreview(file);
      setPreview(res);
      if (res.errors?.length) setError(res.errors.join(', '));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to parse file.');
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!preview?.rows?.length) return;
    setImporting(true);
    setError('');
    try {
      const res = await hrService.bankImportConfirm(preview.rows);
      setSuccess(`${res.message}`);
      setPreview(null);
      setFile(null);
      document.getElementById('bank-file-input').value = '';
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed.');
    }
    setImporting(false);
  };

  const fetchTransactions = useCallback(async () => {
    setTxnLoading(true);
    try {
      const params = { page: txnPage, limit: 50 };
      if (txnFilter.category) params.category = txnFilter.category;
      if (txnFilter.matched) params.matched = txnFilter.matched;
      const res = await hrService.bankGetTransactions(params);
      setTransactions(res.data);
      setTxnTotal(res.total);
    } catch {}
    setTxnLoading(false);
  }, [txnPage, txnFilter]);

  useEffect(() => {
    if (tab === 'transactions') fetchTransactions();
    if (tab === 'history') {
      setHistLoading(true);
      hrService.bankGetImports().then(setImports).catch(() => {}).finally(() => setHistLoading(false));
    }
  }, [tab, fetchTransactions]);

  const handleCategorize = async (id, category) => {
    try {
      await hrService.bankCategorize(id, category);
      fetchTransactions();
    } catch {}
  };

  const columns = [
    { key: 'entry_date', label: 'Date', render: (v) => <span className="text-gray-500">{v}</span> },
    { key: 'description', label: 'Description', render: (v) => <span className="max-w-[200px] truncate block">{v || '-'}</span> },
    { key: 'debit_amount', label: 'Debit', render: (v) => v > 0 ? <span className="font-semibold text-red-600">{formatINR(v)}</span> : '-' },
    { key: 'credit_amount', label: 'Credit', render: (v) => v > 0 ? <span className="font-semibold text-green-600">{formatINR(v)}</span> : '-' },
    {
      key: 'category', label: 'Category', render: (v, r) => (
        <select value={v} onChange={e => handleCategorize(r.id, e.target.value)}
          className={`text-xs font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLORS[v] || CATEGORY_COLORS.uncategorized}`}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      ),
    },
    { key: 'matched_invoice', label: 'Matched', render: (v) => v ? <span className="text-xs badge-success">{v}</span> : '-' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-900">Bank Import</h2>

      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setError(''); setSuccess(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 text-green-700 text-sm px-4 py-3 rounded-lg">{success}</div>}

      {tab === 'import' && (
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-300 transition-colors">
            <input id="bank-file-input" type="file" accept=".csv,.xlsx" onChange={handleFile} className="hidden" />
            <label htmlFor="bank-file-input" className="cursor-pointer block">
              <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 mb-1">{file ? file.name : 'Click to upload bank statement CSV/XLSX'}</p>
              <p className="text-xs text-gray-400">Supports HDFC, ICICI, SBI, and standard formats</p>
            </label>
          </div>

          {file && !preview && (
            <button onClick={handlePreview} disabled={loading} className="btn-primary">
              {loading ? 'Parsing...' : 'Preview'}
            </button>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="stat-card"><p className="text-sm text-gray-500">Transactions</p><p className="text-2xl font-bold">{preview.count}</p></div>
                <div className="stat-card"><p className="text-sm text-gray-500">Total Debit</p><p className="text-2xl font-bold text-red-600">{formatINR(preview.totalDebit)}</p></div>
                <div className="stat-card"><p className="text-sm text-gray-500">Total Credit</p><p className="text-2xl font-bold text-green-600">{formatINR(preview.totalCredit)}</p></div>
                <div className="stat-card"><p className="text-sm text-gray-500">Format</p><p className="text-2xl font-bold capitalize">{preview.format || 'Generic'}</p></div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b">
                    <th className="table-header">Date</th>
                    <th className="table-header">Description</th>
                    <th className="table-header text-right">Debit</th>
                    <th className="table-header text-right">Credit</th>
                    <th className="table-header">Category</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.rows.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td className="table-cell text-gray-500">{r.entry_date}</td>
                        <td className="table-cell max-w-[200px] truncate">{r.description || '-'}</td>
                        <td className="table-cell text-right text-red-600 font-medium">{r.debit_amount > 0 ? formatINR(r.debit_amount) : '-'}</td>
                        <td className="table-cell text-right text-green-600 font-medium">{r.credit_amount > 0 ? formatINR(r.credit_amount) : '-'}</td>
                        <td className="table-cell"><span className={`text-xs font-medium px-1.5 py-0.5 rounded ${CATEGORY_COLORS[r.category] || ''}`}>{r.category}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 100 && (
                  <p className="p-3 text-center text-sm text-gray-400">Showing first 100 of {preview.rows.length} transactions</p>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={handleConfirm} disabled={importing} className="btn-primary">
                  {importing ? 'Importing...' : `Confirm Import (${preview.count} transactions)`}
                </button>
                <button onClick={() => { setPreview(null); setFile(null); }} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select value={txnFilter.category} onChange={e => { setTxnFilter(f => ({ ...f, category: e.target.value })); setTxnPage(1); }}
              className="input-field text-sm w-40">
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={txnFilter.matched} onChange={e => { setTxnFilter(f => ({ ...f, matched: e.target.value })); setTxnPage(1); }}
              className="input-field text-sm w-40">
              <option value="">All</option>
              <option value="yes">Matched</option>
              <option value="no">Unmatched</option>
            </select>
          </div>

          <ResponsiveTable
            columns={columns}
            data={transactions}
            keyField="id"
            mobilePrimary="entry_date"
            mobileSecondary="description"
            emptyMessage="No transactions found"
            loading={txnLoading}
          />

          {txnTotal > 50 && (
            <div className="flex justify-center gap-2">
              <button disabled={txnPage <= 1} onClick={() => setTxnPage(p => p - 1)} className="btn-secondary !py-1 !px-3 text-xs">Prev</button>
              <span className="text-sm text-gray-500 py-1">Page {txnPage} of {Math.ceil(txnTotal / 50)}</span>
              <button disabled={txnPage >= Math.ceil(txnTotal / 50)} onClick={() => setTxnPage(p => p + 1)} className="btn-secondary !py-1 !px-3 text-xs">Next</button>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {histLoading ? <Loading /> : (
            <ResponsiveTable
              columns={[
                { key: 'import_batch_id', label: 'Batch ID', render: (v) => <span className="font-mono text-xs">{v?.slice(0, 8)}...</span> },
                { key: 'start_date', label: 'From', render: (v) => <span className="text-gray-500">{v}</span> },
                { key: 'end_date', label: 'To', render: (v) => <span className="text-gray-500">{v}</span> },
                { key: 'count', label: 'Transactions', render: (v) => <span className="font-semibold">{v}</span> },
                { key: 'imported_at', label: 'Imported At', render: (v) => <span className="text-gray-500">{v ? new Date(v).toLocaleString('en-IN') : '-'}</span> },
              ]}
              data={imports}
              keyField="import_batch_id"
              emptyMessage="No imports yet"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default BankImport;
