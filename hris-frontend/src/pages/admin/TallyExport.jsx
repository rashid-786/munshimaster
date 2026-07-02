import React, { useState } from 'react';
import { hrService } from '../../services/hr.service';

const EXPORTS = [
  { key: 'masters', label: 'All Masters (Customers + Suppliers + Products)', desc: 'One file with all master data' },
  { key: 'customers', label: 'Customers Only', desc: 'Export customers as Sundry Debtors ledgers' },
  { key: 'suppliers', label: 'Suppliers Only', desc: 'Export suppliers as Sundry Creditors ledgers' },
  { key: 'products', label: 'Products Only', desc: 'Export products as stock items with HSN' },
  { key: 'invoices', label: 'Sales Invoices', desc: 'Export sales vouchers for a period' },
  { key: 'purchase-orders', label: 'Purchase Orders', desc: 'Export purchase vouchers for a period' },
];

const TallyExport = () => {
  const [downloading, setDownloading] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleExport = async (key) => {
    setDownloading(key); setError(''); setSuccess('');
    try {
      const params = {};
      if ((key === 'invoices' || key === 'purchase-orders') && from && to) {
        params.from = from; params.to = to;
      }
      const response = await hrService.tallyExport(key, params);
      const url = window.URL.createObjectURL(new Blob([response], { type: 'application/xml' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Tally_${key.charAt(0).toUpperCase() + key.slice(1)}.xml`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`Tally_${key}.xml downloaded. Import into Tally via Gateway of Tally > Import Data.`);
    } catch (e) {
      setError(e.response?.data?.error || 'Export failed.');
    } finally { setDownloading(null); }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Export to Tally</h2>
      <p className="text-sm text-gray-600">
        Export your data as Tally XML files. Import them in Tally via <strong>Gateway of Tally &gt; Import Data</strong>.
        The XML includes GSTIN, HSN codes, and tax splits for seamless migration.
      </p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{success}
        <button onClick={() => setSuccess('')} className="float-right">&times;</button>
      </div>}

      {(downloading === 'invoices' || downloading === 'purchase-orders') && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-700">Downloading with date range:</span>
          {from && <span className="text-xs bg-white px-2 py-1 rounded">From: {from}</span>}
          {to && <span className="text-xs bg-white px-2 py-1 rounded">To: {to}</span>}
        </div>
      )}

      <div className="grid gap-3">
        {EXPORTS.map(exp => (
          <div key={exp.key} className="bg-white rounded-xl border p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{exp.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{exp.desc}</p>
              {(exp.key === 'invoices' || exp.key === 'purchase-orders') && (
                <div className="flex gap-2 mt-2">
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                    className="border rounded px-2 py-1 text-xs" placeholder="From" />
                  <input type="date" value={to} onChange={e => setTo(e.target.value)}
                    className="border rounded px-2 py-1 text-xs" placeholder="To" />
                </div>
              )}
            </div>
            <button onClick={() => handleExport(exp.key)} disabled={downloading === exp.key}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm whitespace-nowrap disabled:opacity-50">
              {downloading === exp.key ? 'Downloading...' : 'Download XML'}
            </button>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="font-medium text-amber-800 text-sm mb-1">How to import into Tally</h4>
        <ol className="text-xs text-amber-700 space-y-1 ml-4 list-decimal">
          <li>Download the XML file(s) above</li>
          <li>Open Tally and go to <strong>Gateway of Tally &gt; Import Data</strong></li>
          <li>Select the XML file and import</li>
          <li>For vouchers, Tally will automatically create the ledger entries with GST splits</li>
          <li>Verify the imported data in Tally before use</li>
        </ol>
      </div>
    </div>
  );
};

export default TallyExport;
