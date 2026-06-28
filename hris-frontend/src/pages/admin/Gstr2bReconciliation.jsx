import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const TABS = [
  { key: 'upload', label: 'Upload' },
  { key: 'results', label: 'Reconciliation' },
  { key: 'history', label: 'Import History' },
];

const STATUS_COLORS = {
  matched: 'bg-emerald-50 text-emerald-700',
  unmatched: 'bg-red-50 text-red-700',
  ambiguous: 'bg-amber-50 text-amber-700',
};

const SECTION_LABELS = {
  b2b: 'B2B', b2ba: 'B2B Amd', cdnr: 'CN', cdnra: 'CN Amd',
  isda: 'ISD', isdaa: 'ISD Amd', impg: 'Imp Gds', imps: 'Imp Svc', nil: 'Nil',
};

const Gstr2bReconciliation = () => {
  const [tab, setTab] = useState('upload');
  const [jsonText, setJsonText] = useState('');
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [imports, setImports] = useState([]);
  const [selectedImport, setSelectedImport] = useState('');
  const [histLoading, setHistLoading] = useState(false);

  const [showManualMatch, setShowManualMatch] = useState(null);
  const [matchPoId, setMatchPoId] = useState('');

  const fetchStats = useCallback(async () => {
    try {
      const data = await hrService.getGstr2bStats();
      setStats(data);
    } catch (e) { /* ignore */ }
  }, []);

  const fetchItems = useCallback(async () => {
    setItemsLoading(true);
    try {
      const params = { page: itemsPage, limit: 50 };
      if (filterStatus) params.matchStatus = filterStatus;
      if (selectedImport) params.importId = selectedImport;
      const data = await hrService.getGstr2bItems(params);
      setItems(data.data || []);
      setItemsTotal(data.total || 0);
    } catch (e) {
      setError('Failed to load items.');
    } finally { setItemsLoading(false); }
  }, [itemsPage, filterStatus, selectedImport]);

  const fetchImports = useCallback(async () => {
    setHistLoading(true);
    try {
      const data = await hrService.getGstr2bImports();
      setImports(data || []);
    } catch (e) { /* ignore */ }
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => { if (tab === 'results') { fetchItems(); fetchStats(); } }, [tab, fetchItems, fetchStats]);
  useEffect(() => { if (tab === 'history') fetchImports(); }, [tab, fetchImports]);

  const handleUpload = async () => {
    if (!period.trim() || !jsonText.trim()) {
      setError('Period and JSON data are required.');
      return;
    }
    setLoading(true); setError(''); setSuccess('');
    try {
      let parsed;
      try { parsed = JSON.parse(jsonText); } catch (e) { setError('Invalid JSON format.'); setLoading(false); return; }
      const data = await hrService.uploadGstr2b(period, parsed);
      setSuccess(data.message || 'Upload successful.');
      setJsonText('');
      setPeriod('');
      if (data.stats) setStats(prev => prev || data.stats);
      if (data.importId) { setSelectedImport(data.importId); setTab('results'); }
    } catch (e) {
      setError(e.response?.data?.error || 'Upload failed.');
    } finally { setLoading(false); }
  };

  const handleMatch = async (itemId) => {
    if (!matchPoId) return;
    try {
      await hrService.matchGstr2bItem(itemId, matchPoId);
      setShowManualMatch(null);
      setMatchPoId('');
      fetchItems();
    } catch (e) {
      setError(e.response?.data?.error || 'Match failed.');
    }
  };

  const handleUnmatch = async (itemId) => {
    try {
      await hrService.unmatchGstr2bItem(itemId);
      fetchItems();
    } catch (e) {
      setError(e.response?.data?.error || 'Unmatch failed.');
    }
  };

  const handleDeleteImport = async (importId) => {
    if (!window.confirm('Delete this import and all its items?')) return;
    try {
      await hrService.deleteGstr2bImport(importId);
      fetchImports();
      if (selectedImport === importId) setSelectedImport('');
    } catch (e) {
      setError('Delete failed.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setError('Please upload a JSON file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setJsonText(ev.target.result);
      const periodMatch = file.name.match(/2B_(\d{4})(\d{2})/);
      if (periodMatch) {
        setPeriod(periodMatch[2] + periodMatch[1]);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">GSTR-2B Reconciliation</h2>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition
              ${tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{success}</div>}

      {tab === 'upload' && (
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <p className="text-sm text-gray-600">Upload the GSTR-2B JSON downloaded from the GST portal. The system will automatically reconcile it against your purchase orders.</p>

          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Period (MMYYYY)</label>
              <input type="text" value={period} onChange={e => setPeriod(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="border rounded-lg px-3 py-1.5 text-sm w-32" placeholder="062026" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Upload JSON file</label>
              <input type="file" accept=".json" onChange={handleFileUpload}
                className="text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Or paste JSON directly</label>
            <textarea value={jsonText} onChange={e => setJsonText(e.target.value)}
              className="input-field font-mono text-xs" rows={12} placeholder='Paste GSTR-2B JSON here...' />
          </div>

          <button onClick={handleUpload} disabled={loading || !period || !jsonText}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
            {loading ? 'Processing...' : 'Upload & Reconcile'}
          </button>
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-4">
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-gray-500">Total Items</p>
                <p className="text-xl font-bold text-gray-800">{stats.items?.total || 0}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-emerald-600 font-medium">Matched</p>
                <p className="text-xl font-bold text-emerald-700">{stats.items?.matched || 0}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-red-600 font-medium">Unmatched</p>
                <p className="text-xl font-bold text-red-700">{stats.items?.unmatched || 0}</p>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs text-amber-600 font-medium">Ambiguous</p>
                <p className="text-xl font-bold text-amber-700">{stats.items?.ambiguous || 0}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center">
            <select value={selectedImport} onChange={e => setSelectedImport(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">All Imports</option>
              {imports.map(imp => (
                <option key={imp.id} value={imp.id}>{imp.period} - {imp.filename} ({new Date(imp.uploaded_at).toLocaleDateString()})</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">All Status</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Unmatched</option>
              <option value="ambiguous">Ambiguous</option>
            </select>
            <span className="text-sm text-gray-500">{itemsTotal} items</span>
          </div>

          {itemsLoading ? <Loading /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2">Supplier</th>
                    <th className="text-left px-3 py-2">Invoice</th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-right px-3 py-2">Value</th>
                    <th className="text-center px-3 py-2">Status</th>
                    <th className="text-center px-3 py-2">Match</th>
                    <th className="text-center px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400">No items found.</td></tr>
                  ) : items.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.supplier_name || '-'}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{item.supplier_gstin || ''}</p>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{item.invoice_number || '-'}</td>
                      <td className="px-3 py-2">{item.invoice_date ? item.invoice_date.slice(0, 10) : '-'}</td>
                      <td className="px-3 py-2 text-right font-medium">₹{(item.total_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.match_status] || ''}`}>
                          {item.match_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs">
                        {item.matched_po_number ? (
                          <span className="text-gray-600">{item.matched_po_number}</span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.match_status === 'unmatched' && (
                          <button onClick={() => setShowManualMatch(item.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">Match</button>
                        )}
                        {item.match_status === 'matched' && (
                          <button onClick={() => handleUnmatch(item.id)}
                            className="text-red-500 hover:text-red-700 text-xs">Unmatch</button>
                        )}
                        {item.match_status === 'ambiguous' && (
                          <button onClick={() => setShowManualMatch(item.id)}
                            className="text-amber-600 hover:text-amber-800 text-xs font-medium">Resolve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {itemsTotal > 50 && (
            <div className="flex justify-center gap-2">
              <button disabled={itemsPage <= 1} onClick={() => setItemsPage(p => p - 1)}
                className="btn-secondary text-xs px-3 py-1">Previous</button>
              <span className="text-sm text-gray-500 self-center">Page {itemsPage}</span>
              <button disabled={itemsPage * 50 >= itemsTotal} onClick={() => setItemsPage(p => p + 1)}
                className="btn-secondary text-xs px-3 py-1">Next</button>
            </div>
          )}

          {showManualMatch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
                <h3 className="font-semibold text-gray-900">Manually Match Item</h3>
                <p className="text-sm text-gray-600">Enter the Purchase Order ID to match this item.</p>
                <input type="text" value={matchPoId} onChange={e => setMatchPoId(e.target.value)}
                  className="input-field" placeholder="Purchase Order ID" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setShowManualMatch(null); setMatchPoId(''); }}
                    className="btn-secondary text-sm px-4 py-2">Cancel</button>
                  <button onClick={() => handleMatch(showManualMatch)} disabled={!matchPoId}
                    className="btn-primary text-sm px-4 py-2">Match</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          {histLoading ? <Loading /> : (
            imports.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">No imports yet. Upload a GSTR-2B JSON to get started.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Period</th>
                      <th className="text-left px-3 py-2">File</th>
                      <th className="text-left px-3 py-2">Uploaded</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-right px-3 py-2">Matched</th>
                      <th className="text-right px-3 py-2">Unmatched</th>
                      <th className="text-center px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {imports.map(imp => {
                      const s = typeof imp.stats === 'string' ? JSON.parse(imp.stats) : (imp.stats || {});
                      return (
                        <tr key={imp.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{imp.period}</td>
                          <td className="px-3 py-2">{imp.filename}</td>
                          <td className="px-3 py-2">{new Date(imp.uploaded_at).toLocaleString()}</td>
                          <td className="px-3 py-2 text-right">{s.total || 0}</td>
                          <td className="px-3 py-2 text-right text-emerald-600">{s.matched || 0}</td>
                          <td className="px-3 py-2 text-right text-red-600">{s.unmatched || 0}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => handleDeleteImport(imp.id)}
                              className="text-red-500 hover:text-red-700 text-xs">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Gstr2bReconciliation;
