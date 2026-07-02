import React, { useState } from 'react';
import { hrService } from '../../services/hr.service';

const TABS = [
  { key: 'customer', label: 'Customers' },
  { key: 'supplier', label: 'Suppliers' },
  { key: 'product', label: 'Products' },
];

const TEMPLATE_LINKS = {
  customer: '/bulk-import-templates/customers.csv',
  supplier: '/bulk-import-templates/suppliers.csv',
  product: '/bulk-import-templates/products.csv',
};

const BulkImport = () => {
  const [tab, setTab] = useState('customer');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.name.match(/\.(csv|xlsx?)$/i)) {
      setError('Please upload a CSV or XLSX file.');
      return;
    }
    setFile(f);
    setError('');
    setPreview(null);
    setSuccess('');
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true); setError('');
    try {
      const data = await hrService.bulkImportPreview(tab, file);
      if (data.errors?.length > 0) {
        setError(`Found ${data.errors.length} issues. First: ${data.errors[0]}`);
      }
      setPreview(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to parse file.');
    } finally { setLoading(false); }
  };

  const handleConfirm = async () => {
    if (!preview?.rows?.length) return;
    if (!window.confirm(`Import ${preview.rows.length} ${tab}s?`)) return;
    setImporting(true); setError('');
    try {
      const data = await hrService.bulkImportConfirm(tab, preview.rows);
      setSuccess(data.message || `Imported ${data.imported} ${tab}s.`);
      setPreview(null);
      setFile(null);
    } catch (e) {
      setError(e.response?.data?.error || 'Import failed.');
    } finally { setImporting(false); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Bulk Import</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPreview(null); setFile(null); setError(''); setSuccess(''); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition
              ${tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{success}
        <button onClick={() => setSuccess('')} className="float-right">&times;</button>
      </div>}

      <div className="bg-white rounded-xl border p-6 space-y-4">
        <p className="text-sm text-gray-600">
          Upload a CSV or Excel file with {tab} data. The system auto-detects columns by header name.
          Duplicate names are skipped.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Select File (CSV or XLSX)</label>
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile}
            className="text-sm" />
        </div>

        {file && !preview && (
          <button onClick={handlePreview} disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
            {loading ? 'Parsing...' : 'Preview'}
          </button>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-700 font-medium">{preview.rows?.length || 0} rows detected</p>
              <div className="flex gap-2">
                <button onClick={() => { setPreview(null); setFile(null); }}
                  className="btn-secondary text-sm px-4 py-2">Cancel</button>
                <button onClick={handleConfirm} disabled={importing || !preview.rows?.length}
                  className="btn-primary text-sm px-4 py-2">
                  {importing ? 'Importing...' : `Import ${preview.rows.length} ${tab}s`}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-gray-600 sticky top-0">
                  <tr>
                    {preview.rows[0] && Object.keys(preview.rows[0]).filter(k => !k.startsWith('_')).map(k => (
                      <th key={k} className="text-left px-2 py-1.5 whitespace-nowrap">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {Object.entries(row).filter(([k]) => !k.startsWith('_')).map(([k, v]) => (
                        <td key={k} className="px-2 py-1 text-gray-700 max-w-[200px] truncate">
                          {String(v ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows?.length > 100 && (
              <p className="text-xs text-gray-400">Showing first 100 of {preview.rows.length} rows.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkImport;
