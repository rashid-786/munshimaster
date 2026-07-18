import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ConfirmModal from '../../components/ConfirmModal';
import ResponsiveTable from '../../components/ResponsiveTable';
import useIsMobile from '../../hooks/useIsMobile';
import Loading from '../../components/Loading';
import { ActionDelete } from '../../components/ActionIcons';

const emptyItem = { description: '', quantity: 1, unit_price: '', hsn_code: '' };
const emptyForm = { customer_id: '', template_name: '', frequency: 'monthly', interval_count: 1, day_of_week: '', day_of_month: '', next_generation_date: '', due_date_offset: 15, notes: '', gst_type: 'intra', place_of_supply: '', items: [{ ...emptyItem }] };

const FREQ_LABELS = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' };

const RecurringInvoices = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      const data = await hrService.getRecurringTemplates(params);
      setTemplates(data);
    } catch { setError('Failed to load templates.'); }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    hrService.getCustomers({ limit: 100 }).then(res => setCustomers(res.data)).catch(() => {});
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = async (t) => {
    setEditing(t.id);
    try {
      const full = await hrService.getRecurringTemplate(t.id);
      setForm({
        customer_id: full.customer_id,
        template_name: full.template_name || '',
        frequency: full.frequency,
        interval_count: full.interval_count || 1,
        day_of_week: full.day_of_week ?? '',
        day_of_month: full.day_of_month ?? '',
        next_generation_date: full.next_generation_date?.split('T')[0] || full.next_generation_date,
        due_date_offset: full.due_date_offset || 15,
        notes: full.notes || '',
        gst_type: full.gst_type || 'intra',
        place_of_supply: full.place_of_supply || '',
        items: full.items.map(i => ({
          description: i.description,
          quantity: i.quantity,
          unit_price: (i.unit_price / 100).toFixed(2),
          hsn_code: i.hsn_code || '',
        })),
      });
      setShowForm(true);
    } catch { setError('Failed to load template details.'); }
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        customer_id: form.customer_id,
        template_name: form.template_name || null,
        frequency: form.frequency,
        interval_count: parseInt(form.interval_count) || 1,
        day_of_week: form.day_of_week ? parseInt(form.day_of_week) : null,
        day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
        next_generation_date: form.next_generation_date,
        due_date_offset: parseInt(form.due_date_offset) || 15,
        notes: form.notes || null,
        gst_type: form.gst_type,
        place_of_supply: form.place_of_supply || null,
        items: form.items.map(i => ({
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unit_price: (parseFloat(i.unit_price) || 0).toFixed(2),
          hsn_code: i.hsn_code || null,
        })),
      };

      if (editing) {
        await hrService.updateRecurringTemplate(editing, payload);
      } else {
        await hrService.createRecurringTemplate(payload);
      }
      setShowForm(false);
      setEditing(null);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template.');
    } finally { setSaving(false); }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await hrService.toggleRecurringTemplate(id, isActive);
      fetch();
    } catch { setError('Failed to toggle template.'); }
  };

  const handleDelete = (id) => {
    setModal({
      title: 'Delete Template',
      message: 'Are you sure you want to delete this recurring template?',
      action: async () => {
        await hrService.deleteRecurringTemplate(id);
        setModal(null);
        fetch();
      },
    });
  };

  const handleGenerate = async (id) => {
    try {
      const res = await hrService.generateRecurringInvoice(id);
      navigate(`/admin/sales-transactions`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate invoice.');
    }
  };

  const calcSubtotal = () => form.items.reduce((s, item) => s + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) * 100 || 0), 0);
  const subtotal = calcSubtotal();
  const taxRate = 18;
  const tax = Math.round(subtotal * taxRate / 100);
  const totalAmt = subtotal + tax;

  const columns = [
    { key: 'template_name', label: 'Name', render: (v) => <span className="font-medium">{v || '—'}</span> },
    { key: 'customer_name', label: 'Customer', render: (v) => v || '—' },
    { key: 'frequency', label: 'Frequency', render: (v) => FREQ_LABELS[v] || v },
    { key: 'next_generation_date', label: 'Next Date', render: (v) => v ? v.split('T')[0] : '—' },
    {
      key: 'is_active', label: 'Status', render: (v, r) => (
        <span className={v ? 'badge-success' : 'badge-danger'}>{v ? 'Active' : 'Inactive'}</span>
      ),
    },
    { key: 'actions', label: 'Actions', className: 'text-right', render: (_, r) => (
      <div className="flex gap-1.5 justify-end">
        <button onClick={(e) => { e.stopPropagation(); handleGenerate(r.id); }} className="btn-ghost !py-1.5 !px-2.5 text-xs" title="Generate">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleToggle(r.id, !r.is_active); }}
          className={`btn-ghost !py-1.5 !px-2.5 text-xs ${r.is_active ? '!text-amber-500 hover:!bg-amber-50' : '!text-green-500 hover:!bg-green-50'}`} title={r.is_active ? 'Deactivate' : 'Activate'}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={r.is_active ? 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} /></svg>
        </button>
        <ActionDelete onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} />
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Recurring Invoices</h2>
        <button onClick={openCreate} className="btn-primary">+ New Template</button>
      </div>

      <div className="flex items-center gap-2">
        {['', 'active', 'inactive'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <ResponsiveTable
        columns={columns}
        data={templates}
        keyField="id"
        mobilePrimary="template_name"
        mobileSecondary="customer_name"
        onRowClick={openEdit}
        emptyMessage="No recurring templates yet"
        loading={loading}
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSave}>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Template' : 'New Recurring Template'}</h3>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="text-gray-400 hover:text-gray-600">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                    <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} className="input-field" required>
                      <option value="">Select customer</option>
                      {customers.filter(c => c.status === 'active').map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                    <input type="text" value={form.template_name} onChange={e => setForm({ ...form, template_name: e.target.value })} className="input-field" placeholder="e.g. Monthly subscription" />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Frequency *</label>
                    <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="input-field">
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Every</label>
                    <input type="number" min="1" value={form.interval_count} onChange={e => setForm({ ...form, interval_count: e.target.value })} className="input-field" />
                  </div>
                  {form.frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                      <select value={form.day_of_week} onChange={e => setForm({ ...form, day_of_week: e.target.value })} className="input-field">
                        <option value="">Select</option>
                        {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                          <option key={i} value={i}>{d}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {form.frequency === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
                      <input type="number" min="1" max="31" value={form.day_of_month} onChange={e => setForm({ ...form, day_of_month: e.target.value })} className="input-field" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Next Date *</label>
                    <input type="date" value={form.next_generation_date} onChange={e => setForm({ ...form, next_generation_date: e.target.value })} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Due (days)</label>
                    <input type="number" min="1" value={form.due_date_offset} onChange={e => setForm({ ...form, due_date_offset: e.target.value })} className="input-field" />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">GST Type:</span>
                    <select value={form.gst_type} onChange={e => setForm({ ...form, gst_type: e.target.value })} className="input-field text-sm w-32">
                      <option value="intra">Intra-state</option>
                      <option value="inter">Inter-state</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Place of Supply:</span>
                    <input type="text" value={form.place_of_supply} onChange={e => setForm({ ...form, place_of_supply: e.target.value })} className="input-field text-sm w-48" placeholder="e.g. Maharashtra" />
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b">
                        <th className="table-header">Description</th>
                        <th className="table-header text-center w-20">HSN/SAC</th>
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
                            <input value={item.hsn_code} onChange={e => updateItem(i, 'hsn_code', e.target.value)}
                              className="input-field text-sm text-center" placeholder="HSN" maxLength={8} />
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
                    {form.gst_type === 'intra' ? (
                      <div className="flex justify-between text-sm text-green-600"><span>GST @ {taxRate}%</span><span>{formatINR(tax)}</span></div>
                    ) : form.gst_type === 'inter' ? (
                      <div className="flex justify-between text-sm text-blue-600"><span>IGST @ {taxRate}%</span><span>{formatINR(tax)}</span></div>
                    ) : (
                      <div className="flex justify-between text-sm"><span>Tax ({taxRate}%)</span><span>{formatINR(tax)}</span></div>
                    )}
                    <div className="flex justify-between text-base font-bold border-t pt-1"><span>Total</span><span>{formatINR(totalAmt)}</span></div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="input-field" rows={2} />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && <ConfirmModal {...modal} onCancel={() => setModal(null)} />}
    </div>
  );
};

export default RecurringInvoices;
