import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import Loading from '../../components/Loading';

const TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'deductions', label: 'Deductions' },
  { key: 'challans', label: 'Challans' },
];

const STATUS_COLORS = {
  deducted: 'bg-amber-50 text-amber-700',
  deposited: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700',
};

const TDSManagement = () => {
  const [tab, setTab] = useState('summary');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Summary
  const [summary, setSummary] = useState(null);
  const [summaryPeriod, setSummaryPeriod] = useState('');

  // Deductions
  const [deductions, setDeductions] = useState([]);
  const [dedTotal, setDedTotal] = useState(0);
  const [dedPage, setDedPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');

  // Challans
  const [challans, setChallans] = useState([]);
  const [chTotal, setChTotal] = useState(0);
  const [chPage, setChPage] = useState(1);

  // Form state
  const [dedForm, setDedForm] = useState({ entityName: '', entityGstin: '', entityPan: '', section: '194C', invoiceNumber: '', invoiceAmount: '', tdsRate: '', deductionDate: '', notes: '' });
  const [challanForm, setChallanForm] = useState({ challanNumber: '', bsrCode: '', depositDate: '', amount: '', tdsPeriod: '', notes: '' });
  const [showDedForm, setShowDedForm] = useState(false);
  const [showChallanForm, setShowChallanForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDedId, setEditingDedId] = useState(null);

  const [sections, setSections] = useState([]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrService.getTdsSummary(summaryPeriod || undefined);
      setSummary(data);
    } catch (e) { setError('Failed to load summary.'); }
    finally { setLoading(false); }
  }, [summaryPeriod]);

  const fetchDeductions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: dedPage, limit: 50 };
      if (filterStatus) params.status = filterStatus;
      const data = await hrService.getTdsDeductions(params);
      setDeductions(data.data || []);
      setDedTotal(data.total || 0);
    } catch (e) { setError('Failed to load deductions.'); }
    finally { setLoading(false); }
  }, [dedPage, filterStatus]);

  const fetchChallans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrService.getTdsChallans({ page: chPage, limit: 50 });
      setChallans(data.data || []);
      setChTotal(data.total || 0);
    } catch (e) { setError('Failed to load challans.'); }
    finally { setLoading(false); }
  }, [chPage]);

  const fetchSections = useCallback(async () => {
    try {
      const data = await hrService.getTdsSections();
      setSections(data || []);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { fetchSections(); }, [fetchSections]);
  useEffect(() => { if (tab === 'summary') fetchSummary(); }, [tab, fetchSummary]);
  useEffect(() => { if (tab === 'deductions') fetchDeductions(); }, [tab, fetchDeductions]);
  useEffect(() => { if (tab === 'challans') fetchChallans(); }, [tab, fetchChallans]);

  const handleSaveDeduction = async () => {
    setSaving(true); setError('');
    try {
      if (editingDedId) {
        await hrService.updateTdsDeduction(editingDedId, dedForm);
        setSuccess('Deduction updated.');
      } else {
        await hrService.createTdsDeduction(dedForm);
        setSuccess('Deduction recorded.');
      }
      setShowDedForm(false);
      setDedForm({ entityName: '', entityGstin: '', entityPan: '', section: '194C', invoiceNumber: '', invoiceAmount: '', tdsRate: '', deductionDate: '', notes: '' });
      setEditingDedId(null);
      fetchDeductions();
      if (tab === 'summary') fetchSummary();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save deduction.');
    } finally { setSaving(false); }
  };

  const handleDeleteDeduction = async (id) => {
    if (!window.confirm('Delete this deduction?')) return;
    try {
      await hrService.deleteTdsDeduction(id);
      fetchDeductions();
      if (tab === 'summary') fetchSummary();
    } catch (e) { setError('Delete failed.'); }
  };

  const handleSaveChallan = async () => {
    setSaving(true); setError('');
    try {
      await hrService.createTdsChallan(challanForm);
      setSuccess('Challan recorded.');
      setShowChallanForm(false);
      setChallanForm({ challanNumber: '', bsrCode: '', depositDate: '', amount: '', tdsPeriod: '', notes: '' });
      fetchChallans();
      if (tab === 'summary') fetchSummary();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save challan.');
    } finally { setSaving(false); }
  };

  const openEditDed = (ded) => {
    setDedForm({
      entityName: ded.entity_name || '',
      entityGstin: ded.entity_gstin || '',
      entityPan: ded.entity_pan || '',
      section: ded.section,
      invoiceNumber: ded.invoice_number || '',
      invoiceAmount: ded.invoice_amount?.toString() || '',
      tdsRate: ded.tds_rate?.toString() || '',
      deductionDate: ded.deduction_date?.slice(0, 10) || '',
      notes: ded.notes || '',
    });
    setEditingDedId(ded.id);
    setShowDedForm(true);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-800">TDS Management</h2>

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
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{success}
        <button onClick={() => setSuccess('')} className="float-right">&times;</button>
      </div>}

      {tab === 'summary' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input type="text" value={summaryPeriod} onChange={e => setSummaryPeriod(e.target.value.replace(/[^Q0-9]/g, '').slice(0, 5))}
              className="border rounded-lg px-3 py-1.5 text-sm w-32" placeholder="Q2FY26" />
            <button onClick={fetchSummary} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Refresh</button>
          </div>

          {loading ? <Loading /> : summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-gray-500">Total Deductions</p>
                  <p className="text-xl font-bold text-gray-800">{summary.summary?.totalDeductions || 0}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-gray-500">Total TDS (₹)</p>
                  <p className="text-xl font-bold text-gray-800">₹{(summary.summary?.totalTds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-emerald-600 font-medium">Deposited (₹)</p>
                  <p className="text-xl font-bold text-emerald-700">₹{(summary.summary?.totalDeposited || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <p className="text-xs text-amber-600 font-medium">Pending Deposit (₹)</p>
                  <p className="text-xl font-bold text-amber-700">₹{(summary.summary?.pendingDeposit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>

              {summary.bySection?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">By Section</h3>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600">
                        <tr>
                          <th className="text-left px-3 py-2">Section</th>
                          <th className="text-right px-3 py-2">Count</th>
                          <th className="text-right px-3 py-2">Invoice Amount</th>
                          <th className="text-right px-3 py-2">TDS Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {summary.bySection.map((s, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-xs font-medium">{s.section}</td>
                            <td className="px-3 py-2 text-right">{s.count}</td>
                            <td className="px-3 py-2 text-right">₹{parseFloat(s.total_invoice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right font-medium">₹{parseFloat(s.total_tds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'deductions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="">All Status</option>
              <option value="deducted">Deducted</option>
              <option value="deposited">Deposited</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button onClick={() => { setShowDedForm(true); setEditingDedId(null); setDedForm({ entityName: '', entityGstin: '', entityPan: '', section: '194C', invoiceNumber: '', invoiceAmount: '', tdsRate: '', deductionDate: '', notes: '' }); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 ml-auto">+ New Deduction</button>
          </div>

          {loading ? <Loading /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2">Entity</th>
                    <th className="text-left px-3 py-2">Section</th>
                    <th className="text-left px-3 py-2">Invoice</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-right px-3 py-2">TDS</th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-center px-3 py-2">Status</th>
                    <th className="text-center px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deductions.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400">No deductions recorded.</td></tr>
                  ) : deductions.map(d => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <p className="font-medium">{d.entity_name || '-'}</p>
                        {d.entity_pan && <p className="text-[10px] text-gray-400">{d.entity_pan}</p>}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{d.section}</td>
                      <td className="px-3 py-2 text-xs">{d.invoice_number || '-'}</td>
                      <td className="px-3 py-2 text-right">₹{(d.invoice_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-right font-medium">₹{(d.tds_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs">{d.deduction_date?.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status] || ''}`}>{d.status}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs">
                        <button onClick={() => openEditDed(d)} className="text-indigo-600 hover:text-indigo-800 mr-2">Edit</button>
                        {d.status === 'deducted' && (
                          <button onClick={() => handleDeleteDeduction(d.id)} className="text-red-500 hover:text-red-700">Del</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {dedTotal > 50 && (
            <div className="flex justify-center gap-2">
              <button disabled={dedPage <= 1} onClick={() => setDedPage(p => p - 1)} className="btn-secondary text-xs px-3 py-1">Previous</button>
              <span className="text-sm text-gray-500 self-center">Page {dedPage}</span>
              <button disabled={dedPage * 50 >= dedTotal} onClick={() => setDedPage(p => p + 1)} className="btn-secondary text-xs px-3 py-1">Next</button>
            </div>
          )}

          {showDedForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
                  <h3 className="text-base font-semibold text-gray-900">{editingDedId ? 'Edit' : 'New'} TDS Deduction</h3>
                  <button onClick={() => setShowDedForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Entity Name</label>
                    <input type="text" value={dedForm.entityName} onChange={e => setDedForm({ ...dedForm, entityName: e.target.value })}
                      className="input-field" placeholder="Vendor / Contractor name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                      <input type="text" value={dedForm.entityGstin} onChange={e => setDedForm({ ...dedForm, entityGstin: e.target.value })}
                        className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">PAN *</label>
                      <input type="text" value={dedForm.entityPan} onChange={e => setDedForm({ ...dedForm, entityPan: e.target.value.toUpperCase() })}
                        className="input-field" placeholder="AAACD1234E" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TDS Section *</label>
                      <select value={dedForm.section} onChange={e => {
                        const sec = sections.find(s => s.section === e.target.value);
                        setDedForm({ ...dedForm, section: e.target.value, tdsRate: sec?.rate?.toString() || '' });
                      }} className="input-field">
                        {sections.map(s => <option key={s.id} value={s.section}>{s.section} - {s.nature_of_payment} ({s.rate}%)</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TDS Rate (%) *</label>
                      <input type="number" step="0.01" value={dedForm.tdsRate} onChange={e => setDedForm({ ...dedForm, tdsRate: e.target.value })}
                        className="input-field" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                      <input type="text" value={dedForm.invoiceNumber} onChange={e => setDedForm({ ...dedForm, invoiceNumber: e.target.value })}
                        className="input-field" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Amount (₹) *</label>
                      <input type="number" step="0.01" min="0" value={dedForm.invoiceAmount} onChange={e => setDedForm({ ...dedForm, invoiceAmount: e.target.value })}
                        className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deduction Date *</label>
                    <input type="date" value={dedForm.deductionDate} onChange={e => setDedForm({ ...dedForm, deductionDate: e.target.value })}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea value={dedForm.notes} onChange={e => setDedForm({ ...dedForm, notes: e.target.value })}
                      className="input-field" rows={2} />
                  </div>
                </div>
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 sticky bottom-0 bg-white">
                  <button onClick={() => setShowDedForm(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
                  <button onClick={handleSaveDeduction} disabled={saving || !dedForm.invoiceAmount || !dedForm.deductionDate}
                    className="btn-primary text-sm px-4 py-2">{saving ? 'Saving...' : editingDedId ? 'Update' : 'Record'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'challans' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowChallanForm(true); setChallanForm({ challanNumber: '', bsrCode: '', depositDate: '', amount: '', tdsPeriod: '', notes: '' }); }}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">+ New Challan</button>
          </div>

          {loading ? <Loading /> : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-3 py-2">Challan No.</th>
                    <th className="text-left px-3 py-2">BSR Code</th>
                    <th className="text-left px-3 py-2">Deposit Date</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Period</th>
                    <th className="text-right px-3 py-2">Linked Deds</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {challans.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No challans recorded.</td></tr>
                  ) : challans.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-xs">{c.challan_number}</td>
                      <td className="px-3 py-2 text-xs">{c.bsr_code || '-'}</td>
                      <td className="px-3 py-2 text-xs">{c.deposit_date?.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-right font-medium">₹{(c.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-xs">{c.tds_period || '-'}</td>
                      <td className="px-3 py-2 text-right text-xs">{c.linked_deductions || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {chTotal > 50 && (
            <div className="flex justify-center gap-2">
              <button disabled={chPage <= 1} onClick={() => setChPage(p => p - 1)} className="btn-secondary text-xs px-3 py-1">Previous</button>
              <span className="text-sm text-gray-500 self-center">Page {chPage}</span>
              <button disabled={chPage * 50 >= chTotal} onClick={() => setChPage(p => p + 1)} className="btn-secondary text-xs px-3 py-1">Next</button>
            </div>
          )}

          {showChallanForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">Record Challan</h3>
                  <button onClick={() => setShowChallanForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Challan Number *</label>
                  <input type="text" value={challanForm.challanNumber} onChange={e => setChallanForm({ ...challanForm, challanNumber: e.target.value })}
                    className="input-field" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BSR Code</label>
                    <input type="text" value={challanForm.bsrCode} onChange={e => setChallanForm({ ...challanForm, bsrCode: e.target.value })}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹) *</label>
                    <input type="number" step="0.01" min="0" value={challanForm.amount} onChange={e => setChallanForm({ ...challanForm, amount: e.target.value })}
                      className="input-field" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deposit Date *</label>
                    <input type="date" value={challanForm.depositDate} onChange={e => setChallanForm({ ...challanForm, depositDate: e.target.value })}
                      className="input-field" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">TDS Period</label>
                    <input type="text" value={challanForm.tdsPeriod} onChange={e => setChallanForm({ ...challanForm, tdsPeriod: e.target.value })} className="input-field" placeholder="Q2FY26" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={challanForm.notes} onChange={e => setChallanForm({ ...challanForm, notes: e.target.value })} className="input-field" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowChallanForm(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
                  <button onClick={handleSaveChallan} disabled={saving || !challanForm.challanNumber || !challanForm.amount || !challanForm.depositDate}
                    className="btn-primary text-sm px-4 py-2">{saving ? 'Saving...' : 'Record'}</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TDSManagement;
