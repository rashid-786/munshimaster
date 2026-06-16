import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ConfirmModal from '../../components/ConfirmModal';

const emptyItem = { description: '', quantity: 1, unit_price: '' };
const emptyForm = { supplier_id: '', order_date: '', expected_date: '', items: [{ ...emptyItem }], notes: '' };

const statusBadge = {
  draft: 'badge-info', sent: 'badge-warning', approved: 'badge-success',
  received: 'badge-success', cancelled: 'badge-danger',
};

const PurchaseOrders = () => {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [taxRate, setTaxRate] = useState(18);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const limit = 15;

  const fetch = useCallback(async () => {
    const res = await hrService.getPurchaseOrders({ search, status: statusFilter || undefined, page, limit });
    setOrders(res.data);
    setTotal(res.total);
  }, [search, statusFilter, page]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    hrService.getSuppliers({ limit: 100 }).then(res => setSuppliers(res.data)).catch(() => {});
    hrService.getTenantSettings().then(res => { if (res.settings?.taxRate) setTaxRate(res.settings.taxRate); }).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDetail(null);
    setAttachmentFiles([]);
    setShowForm(true);
  };

  const openEdit = async (po) => {
    setEditing(po.id);
    setDetail(null);
    setAttachmentFiles([]);
    try {
      const full = await hrService.getPurchaseOrder(po.id);
      setForm({
        supplier_id: full.supplier_id,
        order_date: full.order_date?.split('T')[0] || full.order_date,
        expected_date: full.expected_date?.split('T')[0] || full.expected_date || '',
        items: full.items.map(i => ({ description: i.description, quantity: i.quantity, unit_price: (i.unit_price / 100).toFixed(2) })),
        notes: full.notes || '',
      });
      setShowForm(true);
    } catch { setError('Failed to load PO details.'); }
  };

  const viewDetail = async (po) => {
    try {
      const full = await hrService.getPurchaseOrder(po.id);
      setDetail(full);
      const atts = await hrService.getAttachments('purchase_order', po.id);
      setAttachments(atts);
    } catch { setError('Failed to load PO details.'); }
  };

  const addItem = () => setForm({ ...form, items: [...form.items, { ...emptyItem }] });

  const removeItem = (i) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  };

  const updateItem = (i, field, value) => {
    const items = [...form.items];
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  };

  const calcSubtotal = () => form.items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) * 100 || 0), 0);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        supplier_id: form.supplier_id,
        order_date: form.order_date,
        expected_date: form.expected_date || null,
        notes: form.notes,
        items: form.items.map(i => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: (parseFloat(i.unit_price) || 0).toFixed(2),
        })),
      };
      let poId;
      if (editing) {
        await hrService.updatePurchaseOrder(editing, payload);
        poId = editing;
      } else {
        const result = await hrService.createPurchaseOrder(payload);
        poId = result.id;
      }
      if (attachmentFiles.length > 0) {
        setUploading(true);
        setUploadProgress(0);
        await hrService.uploadFiles('purchase_order', poId, attachmentFiles, (e) => {
          setUploadProgress(Math.round((e.loaded * 100) / e.total));
        });
        setAttachmentFiles([]);
        setUploadProgress(100);
        const atts = await hrService.getAttachments('purchase_order', poId);
        setAttachments(atts);
        setUploading(false);
      }
      setShowForm(false);
      setEditing(null);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save purchase order.');
    } finally { setSaving(false); setUploading(false); }
  };

  const handleStatus = async (id, status) => {
    try {
      await hrService.updatePurchaseOrderStatus(id, status);
      if (detail?.id === id) setDetail(prev => prev ? { ...prev, status } : null);
      fetch();
    } catch (err) { setError(err.response?.data?.error || 'Status update failed.'); }
  };

  const handleDelete = (id) => {
    setModal({
      id,
      variant: 'danger',
      title: 'Delete Purchase Order',
      message: 'Permanently delete this purchase order? This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try {
          await hrService.deletePurchaseOrder(id);
          if (detail?.id === id) setDetail(null);
          setModal(null);
          fetch();
        } catch (err) {
          setError(err.response?.data?.error || 'Delete failed.');
          setModal(null);
        } finally { setModalLoading(false); }
      },
    });
  };

  const subtotal = calcSubtotal();
  const tax = Math.round(subtotal * taxRate / 100);
  const totalAmt = subtotal + tax;
  const totalPages = Math.ceil(total / limit);

  const statusFlow = ['draft', 'sent', 'approved', 'received'];

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
        <span>{error}</span>
        <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button>
      </div>}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Purchase Orders</h2>
        <button onClick={openCreate} className="btn-primary">+ New Purchase Order</button>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
          <input type="text" placeholder="Search by PO number or supplier..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); setDetail(null); }}
            className="input-field max-w-md" />
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); setDetail(null); }}
            className="input-field max-w-[160px]">
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">PO #</th>
                <th className="table-header">Supplier</th>
                <th className="table-header">Date</th>
                <th className="table-header">Expected</th>
                <th className="table-header text-right">Amount</th>
                <th className="table-header">Status</th>
                <th className="table-header text-center">Attachments</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map(po => (
                <tr key={po.id} className={`hover:bg-gray-50 transition-colors cursor-pointer ${detail?.id === po.id ? 'bg-indigo-50/50' : ''}`}
                    onClick={() => viewDetail(po)}>
                  <td className="table-cell font-medium text-indigo-600">{po.po_number}</td>
                  <td className="table-cell">{po.supplier_name}</td>
                  <td className="table-cell text-gray-500">{po.order_date?.split('T')[0]}</td>
                  <td className="table-cell text-gray-500">{po.expected_date?.split('T')[0] || '—'}</td>
                  <td className="table-cell text-right font-medium">{formatINR(po.total_amount)}</td>
                  <td className="table-cell"><span className={statusBadge[po.status]}>{po.status}</span></td>
                  <td className="table-cell text-center">
                    {(po.attachment_count || 0) > 0 && (
                      <span className="text-indigo-600 hover:text-indigo-800 cursor-pointer" title={`${po.attachment_count} attachment${po.attachment_count > 1 ? 's' : ''}`}>
                        📎 {po.attachment_count}
                      </span>
                    )}
                  </td>
                  <td className="table-cell text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => openEdit(po)} className="btn-secondary !py-1 !px-3 text-xs">Edit</button>
                      <button onClick={() => handleDelete(po.id)} className="btn-danger !py-1 !px-3 text-xs">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8">No purchase orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">{total} total</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs px-3 py-1">Prev</button>
              <span className="text-sm text-gray-600 self-center">Page {page} of {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs px-3 py-1">Next</button>
            </div>
          </div>
        )}
      </div>

      {detail && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-gray-900">{detail.po_number}</h3>
              <span className={statusBadge[detail.status]}>{detail.status}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => hrService.downloadPurchaseOrderPDF(detail.id)}
                className="btn-secondary text-xs px-3 py-1.5">Download PDF</button>
              {statusFlow.indexOf(detail.status) < statusFlow.length - 1 && ['cancelled'].indexOf(detail.status) === -1 && (
                <button onClick={() => handleStatus(detail.id, statusFlow[statusFlow.indexOf(detail.status) + 1])}
                  className="btn-primary text-xs px-3 py-1.5">
                  Mark as {statusFlow[statusFlow.indexOf(detail.status) + 1]}
                </button>
              )}
              {detail.status !== 'cancelled' && (
                <button onClick={() => handleStatus(detail.id, 'cancelled')}
                  className="btn-danger text-xs px-3 py-1.5">Cancel</button>
              )}
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium">Supplier</p>
                <p className="text-sm text-gray-900 mt-0.5">{detail.supplier_name}</p>
                {detail.supplier_gstin && <p className="text-xs text-gray-400 mt-0.5">GST: {detail.supplier_gstin}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Order Date</p>
                <p className="text-sm text-gray-900 mt-0.5">{detail.order_date?.split('T')[0]}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Expected Date</p>
                <p className="text-sm text-gray-900 mt-0.5">{detail.expected_date?.split('T')[0] || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Supplier Contact</p>
                {detail.supplier_email && <p className="text-sm text-gray-900 mt-0.5">{detail.supplier_email}</p>}
                {detail.supplier_phone && <p className="text-xs text-gray-500">{detail.supplier_phone}</p>}
              </div>
            </div>

            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-y border-gray-200">
                  <th className="table-header">#</th>
                  <th className="table-header">Description</th>
                  <th className="table-header text-right">Qty</th>
                  <th className="table-header text-right">Rate</th>
                  <th className="table-header text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {detail.items?.map((item, i) => (
                  <tr key={item.id || i}>
                    <td className="table-cell text-gray-400 w-10">{i + 1}</td>
                    <td className="table-cell">{item.description}</td>
                    <td className="table-cell text-right">{item.quantity}</td>
                    <td className="table-cell text-right">{formatINR(item.unit_price)}</td>
                    <td className="table-cell text-right font-medium">{formatINR(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex justify-end">
              <div className="w-64 space-y-1">
                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatINR(detail.subtotal)}</span></div>
                <div className="flex justify-between text-sm text-gray-600"><span>Tax ({taxRate}%)</span><span>{formatINR(detail.tax_amount)}</span></div>
                <div className="flex justify-between text-base font-bold text-gray-900 border-t pt-1"><span>Total</span><span>{formatINR(detail.total_amount)}</span></div>
              </div>
            </div>

            {detail.notes && (
              <div>
                <p className="text-xs text-gray-500 font-medium">Notes</p>
                <p className="text-sm text-gray-700 mt-0.5">{detail.notes}</p>
              </div>
            )}

            {attachments.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-1">Attachments</p>
                <div className="space-y-1">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 text-sm">
                      <a href={`${import.meta.env.VITE_API_BASE_URL || ''}/uploads/${att.stored_name}`} target="_blank" rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-800 underline">{att.original_name}</a>
                      <span className="text-xs text-gray-400">({(att.file_size / 1024).toFixed(1)} KB)</span>
                      <button onClick={() => hrService.deleteAttachment(att.id).then(() => setAttachments(prev => prev.filter(a => a.id !== att.id)))}
                        className="text-red-400 hover:text-red-600 text-xs ml-1">&times;</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => { setShowForm(false); setEditing(null); }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Purchase Order' : 'New Purchase Order'}</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
                    <select value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })} className="input-field" required>
                      <option value="">Select supplier</option>
                      {suppliers.filter(s => s.status === 'active').map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Order Date *</label>
                    <input type="date" value={form.order_date} onChange={e => setForm({ ...form, order_date: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Date</label>
                    <input type="date" value={form.expected_date} onChange={e => setForm({ ...form, expected_date: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="table-header">Description</th>
                        <th className="table-header text-right w-24">Qty</th>
                        <th className="table-header text-right w-32">Rate (₹)</th>
                        <th className="table-header text-right w-32">Amount</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.items.map((item, i) => (
                        <tr key={i}>
                          <td className="p-2">
                            <input value={item.description} onChange={e => updateItem(i, 'description', e.target.value)}
                              className="input-field text-sm" placeholder="Item description" required />
                          </td>
                          <td className="p-2">
                            <input type="number" min="0.01" step="any" value={item.quantity}
                              onChange={e => updateItem(i, 'quantity', e.target.value)}
                              className="input-field text-sm text-right" required />
                          </td>
                          <td className="p-2">
                            <input type="number" min="0" step="0.01" value={item.unit_price}
                              onChange={e => updateItem(i, 'unit_price', e.target.value)}
                              className="input-field text-sm text-right" required />
                          </td>
                          <td className="p-2 text-right text-sm font-medium text-gray-700">
                            {formatINR(Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) * 100 || 0)))}
                          </td>
                          <td className="p-2 text-center">
                            <button type="button" onClick={() => removeItem(i)}
                              className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button type="button" onClick={addItem}
                    className="w-full py-2 text-sm text-indigo-600 hover:bg-indigo-50 font-medium transition-colors">
                    + Add Item
                  </button>
                </div>

                <div className="flex justify-end">
                  <div className="w-64 space-y-1">
                    <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatINR(subtotal)}</span></div>
                    <div className="flex justify-between text-sm"><span>Tax ({taxRate}%)</span><span>{formatINR(tax)}</span></div>
                    <div className="flex justify-between text-base font-bold border-t pt-1"><span>Total</span><span>{formatINR(totalAmt)}</span></div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                  <input type="file" multiple onChange={e => setAttachmentFiles(Array.from(e.target.files))}
                    className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  {attachmentFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {Array.from(attachmentFiles).map((f, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <span>{f.name}</span>
                          <span className="text-gray-400">({(f.size / 1024).toFixed(1)} KB)</span>
                          <button type="button" onClick={() => setAttachmentFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600">&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {uploading && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving || uploading} className="btn-primary">{uploading ? `Uploading ${uploadProgress}%...` : saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!modal}
        title={modal?.title}
        message={modal?.message}
        confirmLabel={modal?.confirmLabel}
        variant={modal?.variant}
        loading={modalLoading}
        onConfirm={modal?.onConfirm || (() => {})}
        onCancel={() => setModal(null)}
      />
    </div>
  );
};

export default PurchaseOrders;
