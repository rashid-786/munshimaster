import React, { useState, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const TABS = [
  { key: 'gstr3b', label: 'GSTR-3B Summary' },
  { key: 'gstr1', label: 'GSTR-1 Details' },
];

const getToday = () => new Date().toISOString().slice(0, 10);
const getMonthStart = () => {
  const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10);
};

const StatCard = ({ label, value, sub }) => (
  <div className="bg-white rounded-xl border p-4">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-lg font-bold text-gray-800">{value ?? '-'}</p>
    {sub != null && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const GstReturns = () => {
  const [tab, setTab] = useState('gstr3b');
  const [from, setFrom] = useState(getMonthStart());
  const [to, setTo] = useState(getToday());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gstr3b, setGstr3b] = useState(null);
  const [gstr1, setGstr1] = useState(null);

  const fetchGstr3b = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await hrService.getGstr3b(from, to);
      setGstr3b(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load GSTR-3B');
    } finally { setLoading(false); }
  }, [from, to]);

  const fetchGstr1 = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await hrService.getGstr1(from, to);
      setGstr1(data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load GSTR-1');
    } finally { setLoading(false); }
  }, [from, to]);

  const handleGenerate = () => {
    if (tab === 'gstr3b') fetchGstr3b();
    else fetchGstr1();
  };

  const handleDownload = async () => {
    if (!gstr1?.gstr1) return;
    try {
      await hrService.downloadGstr1Json(from, to);
    } catch (e) {
      setError('Download failed.');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">GST Returns</h2>

      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="border rounded-lg px-3 py-1.5 text-sm" />
        </div>
        <button onClick={handleGenerate} disabled={loading}
          className="mt-5 px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
          {loading ? 'Loading...' : 'Generate'}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setGstr1(null); setGstr3b(null); setError(''); }}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition
              ${tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <Loading />}

      {!loading && tab === 'gstr3b' && gstr3b && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Taxable Value" value={`₹${(gstr3b.taxableValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} sub={`${gstr3b.invoiceCount || 0} invoices`} />
            <StatCard label="GST" value={`₹${((gstr3b.cgst || 0) + (gstr3b.sgst || 0) + (gstr3b.igst || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard label="Total Tax Liability" value={`₹${(gstr3b.totalTaxLiability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
            <StatCard label="Credit Notes (Taxable)" value={`₹${(gstr3b.creditNotesAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
            <StatCard label="Total Purchases" value={`₹${(gstr3b.totalPurchases || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
          </div>

          {gstr3b.outwardSupplies?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Outward Supplies Breakdown</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Place of Supply</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-right px-3 py-2">Taxable Value</th>
                      <th className="text-right px-3 py-2">Tax</th>
                      <th className="text-right px-3 py-2">Invoices</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gstr3b.outwardSupplies.map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{r.place_of_supply || '-'}</td>
                        <td className="px-3 py-2 capitalize">{r.gst_type}</td>
                        <td className="px-3 py-2 text-right">₹{(r.total_taxable / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">₹{(r.total_tax / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && tab === 'gstr1' && gstr1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
              <StatCard label="B2B Invoices" value={gstr1.summary?.b2bCount ?? 0} />
              <StatCard label="B2C Invoices" value={gstr1.summary?.b2cCount ?? 0} />
              <StatCard label="Credit Notes" value={gstr1.summary?.creditNoteCount ?? 0} />
              <StatCard label="Total" value={gstr1.summary?.totalInvoices ?? 0} />
            </div>
            <button onClick={handleDownload}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap self-end">
              Download JSON
            </button>
          </div>

          {gstr1.gstr1?.b2b?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">B2B Invoices ({gstr1.gstr1.b2b.length})</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Invoice</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">GSTIN</th>
                      <th className="text-right px-3 py-2">Value</th>
                      <th className="text-center px-3 py-2">E-Inv</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gstr1.gstr1.b2b.map((b, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{b.inv[0]?.inum || '-'}</td>
                        <td className="px-3 py-2">{b.inv[0]?.idt || '-'}</td>
                        <td className="px-3 py-2">{b.trdNm || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{b.ctin || '-'}</td>
                        <td className="px-3 py-2 text-right">₹{(b.inv[0]?.val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-center">{b.inv[0]?.einv === 'Y' ? '✓' : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {gstr1.gstr1?.b2cs?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">B2C (Others) Summary by State</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">Place of Supply</th>
                      <th className="text-right px-3 py-2">Taxable Value</th>
                      <th className="text-right px-3 py-2">GST</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gstr1.gstr1.b2cs.map((b, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2">{b.pos || '-'}</td>
                        <td className="px-3 py-2 text-right">₹{(b.txval || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">₹{((b.camt || 0) + (b.samt || 0) + (b.iamt || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {gstr1.gstr1?.cdnr?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Credit Notes ({gstr1.gstr1.cdnr.length})</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">CN No.</th>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Customer</th>
                      <th className="text-left px-3 py-2">GSTIN</th>
                      <th className="text-left px-3 py-2">Ref Invoice</th>
                      <th className="text-right px-3 py-2">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gstr1.gstr1.cdnr.map((c, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{c.nt[0]?.nt_num || '-'}</td>
                        <td className="px-3 py-2">{c.nt[0]?.nt_dt || '-'}</td>
                        <td className="px-3 py-2">{c.trdNm || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.ctin || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs">{c.nt[0]?.inum || '-'}</td>
                        <td className="px-3 py-2 text-right">₹{(c.nt[0]?.val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {gstr1.gstr1?.hsndata?.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">HSN-wise Summary</h3>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-3 py-2">HSN</th>
                      <th className="text-right px-3 py-2">UQC</th>
                      <th className="text-right px-3 py-2">Qty</th>
                      <th className="text-right px-3 py-2">Value</th>
                      <th className="text-right px-3 py-2">Taxable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {gstr1.gstr1.hsndata.map((h, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono text-xs">{h.hsn_sc || '-'}</td>
                        <td className="px-3 py-2 text-right">{h.uqc || '-'}</td>
                        <td className="px-3 py-2 text-right">{h.qty ?? '-'}</td>
                        <td className="px-3 py-2 text-right">₹{(h.val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right">₹{(h.txval || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!gstr1.gstr1?.b2b?.length && !gstr1.gstr1?.b2cs?.length && !gstr1.gstr1?.cdnr?.length && !gstr1.gstr1?.hsndata?.length) && (
            <p className="text-gray-500 text-sm py-4">No invoice data found for the selected period.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default GstReturns;
