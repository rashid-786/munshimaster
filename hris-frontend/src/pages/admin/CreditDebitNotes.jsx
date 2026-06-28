import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import ResponsiveTable from '../../components/ResponsiveTable';
import { formatINR } from '../../utils/currency';

const statusBadge = {
  draft: 'text-yellow-600 bg-yellow-50',
  issued: 'text-green-600 bg-green-50',
  cancelled: 'text-red-600 bg-red-50',
};

const TABS = [
  { key: 'credit', label: 'Credit Notes' },
  { key: 'debit', label: 'Debit Notes' },
];

const CreditDebitNotes = () => {
  const [tab, setTab] = useState('credit');
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailItems, setDetailItems] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    invoice_id: '', date: new Date().toISOString().split('T')[0], reason: '',
    notes: '', gst_type: 'intra', place_of_supply: '',
    items: [{ description: '', quantity: 1, unit_price: '', hsn_code: '', cgst_rate: '', sgst_rate: '', igst_rate: '' }],
  });
  const [formSaving, setFormSaving] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrService.getNotes(tab, { page, limit: 20, status: '' });
      setData(res.data);
      setTotal(res.total);
    } catch {}
    setLoading(false);
  }, [tab, page]);

  useEffect(() => { fetch(); }, [fetch]);

  const openDetail = async (id) => {
    setDetailLoading(true);
    try {
      const res = await hrService.getNote(tab, id);
      setDetail(res);
      setDetailItems(res.items || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch detail.');
    }
    setDetailLoading(false);
  };

  const handleStatus = async (id, status) => {
    try {
      await hrService.updateNoteStatus(tab, id, status);
      setDetail(prev => prev ? { ...prev, status } : null);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft note?')) return;
    try {
      await hrService.deleteNote(tab, id);
      setDetail(null);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormSaving(true);
    setError('');
    try {
      await hrService.createNote(tab, {
        invoice_id: form.invoice_id || undefined,
        date: form.date,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
        gst_type: form.gst_type || undefined,
        place_of_supply: form.place_of_supply || undefined,
        items: form.items.map(i => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: parseFloat(i.unit_price) || 0,
          hsn_code: i.hsn_code || undefined,
          cgst_rate: parseFloat(i.cgst_rate) || 0,
          sgst_rate: parseFloat(i.sgst_rate) || 0,
          igst_rate: parseFloat(i.igst_rate) || 0,
        })),
      });
      setShowForm(false);
      setForm({ ...form, invoice_id: '', reason: '', notes: '', items: [{ description: '', quantity: 1, unit_price: '', hsn_code: '', cgst_rate: '', sgst_rate: '', igst_rate: '' }] });
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create.');
    }
    setFormSaving(false);
  };

  const addItem = () => {
    setForm(f => ({ ...f, items: [...f.items, { description: '', quantity: 1, unit_price: '', hsn_code: '', cgst_rate: '', sgst_rate: '', igst_rate: '' }] }));
  };

  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const columns = [
    { key: tab === 'credit' ? 'credit_note_number' : 'debit_note_number', label: 'Number', render: (v) => <span className="font-mono text-sm">{v}</span> },
    { key: 'ref_invoice', label: 'Ref Invoice', render: (v) => v || '-' },
    { key: tab === 'credit' ? 'cn_date' : 'dn_date', label: 'Date', render: (v) => v ? v.split('T')[0] : '-' },
    { key: 'total_amount', label: 'Amount', render: (v) => <span className="font-semibold">{formatINR((v || 0) / 100)}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[v]}`}>{v}</span> },
    {
      key: 'actions', label: '', render: (v, r) => (
        <button onClick={() => openDetail(r.id)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View</button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Credit / Debit Notes</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ New {tab === 'credit' ? 'Credit' : 'Debit'} Note</button>
      </div>

      <div className="flex items-center gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setPage(1); setDetail(null); setError(''); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'text-indigo-600 border-indigo-600' : 'text-gray-500 border-transparent hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-10 bg-black/30 overflow-auto" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">New {tab === 'credit' ? 'Credit' : 'Debit'} Note</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Invoice ID</label>
                  <input type="text" value={form.invoice_id} onChange={e => setForm({ ...form, invoice_id: e.target.value })} className="input-field" placeholder="Optional" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Type</label>
                  <select value={form.gst_type} onChange={e => setForm({ ...form, gst_type: e.target.value })} className="input-field">
                    <option value="intra">Intra-state (CGST+SGST)</option>
                    <option value="inter">Inter-state (IGST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Place of Supply</label>
                  <input type="text" value={form.place_of_supply} onChange={e => setForm({ ...form, place_of_supply: e.target.value })} className="input-field" placeholder="e.g. Karnataka" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-field" placeholder={tab === 'credit' ? 'e.g. Sales return, Discount' : 'e.g. Rate revision, Additional charges'} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Items</label>
                  <button type="button" onClick={addItem} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+ Add Item</button>
                </div>
                <div className="space-y-3">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-medium">Item {idx + 1}</span>
                        {form.items.length > 1 && <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-500 hover:text-red-700">Remove</button>}
                      </div>
                      <input type="text" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="input-field text-sm" placeholder="Description" required />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-field text-sm" placeholder="Qty" />
                        <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} className="input-field text-sm" placeholder="Unit Price (INR)" />
                        <input type="text" value={item.hsn_code} onChange={e => updateItem(idx, 'hsn_code', e.target.value)} className="input-field text-sm" placeholder="HSN" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" step="0.01" value={item.cgst_rate} onChange={e => updateItem(idx, 'cgst_rate', e.target.value)} className="input-field text-sm" placeholder="CGST %" />
                        <input type="number" step="0.01" value={item.sgst_rate} onChange={e => updateItem(idx, 'sgst_rate', e.target.value)} className="input-field text-sm" placeholder="SGST %" />
                        <input type="number" step="0.01" value={item.igst_rate} onChange={e => updateItem(idx, 'igst_rate', e.target.value)} className="input-field text-sm" placeholder="IGST %" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} placeholder="Optional notes" />
              </div>
              <button type="submit" disabled={formSaving} className="btn-primary w-full">
                {formSaving ? 'Creating...' : `Create ${tab === 'credit' ? 'Credit' : 'Debit'} Note`}
              </button>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{detail[tab === 'credit' ? 'credit_note_number' : 'debit_note_number']}</h3>
              <span className={statusBadge[detail.status]}>{detail.status}</span>
            </div>
            <div className="flex gap-2">
              {detail.status === 'draft' && (
                <>
                  <button onClick={() => handleStatus(detail.id, 'issued')} className="btn-primary text-xs px-3 py-1.5">Issue</button>
                  <button onClick={() => handleDelete(detail.id)} className="btn-danger text-xs px-3 py-1.5">Delete</button>
                </>
              )}
              {detail.status === 'issued' && (
                <button onClick={() => handleStatus(detail.id, 'cancelled')} className="btn-danger text-xs px-3 py-1.5">Cancel</button>
              )}
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">Customer</p>
                <p className="text-sm text-gray-900 mt-0.5">{detail.customer_name || '—'}</p>
                {detail.customer_gstin && <p className="text-xs text-gray-400 mt-0.5">GST: {detail.customer_gstin}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Date</p>
                <p className="text-sm text-gray-900 mt-0.5">{(detail[tab === 'credit' ? 'cn_date' : 'dn_date'] || '').split('T')[0]}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Reference Invoice</p>
                <p className="text-sm text-gray-900 mt-0.5">{detail.ref_invoice || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Reason</p>
                <p className="text-sm text-gray-900 mt-0.5">{detail.reason || '—'}</p>
              </div>
            </div>

            {detailItems.length > 0 && (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 border-y border-gray-200">
                  <th className="table-header">#</th>
                  <th className="table-header">Description</th>
                  <th className="table-header text-right">Qty</th>
                  <th className="table-header text-right">Rate</th>
                  <th className="table-header text-right">Amount</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {detailItems.map((item, i) => (
                    <tr key={item.id || i}>
                      <td className="table-cell text-gray-400">{i + 1}</td>
                      <td className="table-cell">{item.description}</td>
                      <td className="table-cell text-right">{item.quantity}</td>
                      <td className="table-cell text-right">{formatINR((item.unit_price || 0) / 100)}</td>
                      <td className="table-cell text-right font-medium">{formatINR((item.total_price || 0) / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{formatINR((detail.subtotal || 0) / 100)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Tax</span><span>{formatINR((detail.tax_amount || 0) / 100)}</span></div>
              <div className="flex justify-between text-lg font-bold text-gray-900"><span>Total</span><span>{formatINR((detail.total_amount || 0) / 100)}</span></div>
            </div>
            {detail.notes && <p className="text-xs text-gray-400">Notes: {detail.notes}</p>}
          </div>
        </div>
      )}

      <ResponsiveTable columns={columns} data={data} keyField="id" loading={loading}
        emptyMessage={`No ${tab} notes found`}
        mobilePrimary={tab === 'credit' ? 'credit_note_number' : 'debit_note_number'}
        mobileSecondary="status" />

      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary !py-1 !px-3 text-xs">Prev</button>
          <span className="text-sm text-gray-500 py-1">Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="btn-secondary !py-1 !px-3 text-xs">Next</button>
        </div>
      )}
    </div>
  );
};

export default CreditDebitNotes;
