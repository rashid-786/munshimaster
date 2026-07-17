import { useState, useEffect } from 'react';
import api from '../../services/api';
import ResponsiveTable from '../../components/ResponsiveTable';
import Loading from '../../components/Loading';

export default function GstTaxConfig() {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', gst_percentage: '', cess_percentage: '', description: '', is_active: true, display_order: '' });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/super/gst-tax');
      setRates(res.data || []);
    } catch { setRates([]); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', gst_percentage: '', cess_percentage: '', description: '', is_active: true, display_order: String(rates.length + 1) });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ name: row.name, gst_percentage: String(row.gst_percentage), cess_percentage: String(row.cess_percentage || ''), description: row.description || '', is_active: row.is_active, display_order: String(row.display_order) });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    const payload = { ...form, gst_percentage: parseFloat(form.gst_percentage) || 0, cess_percentage: parseFloat(form.cess_percentage) || 0, display_order: parseInt(form.display_order) || 0 };
    try {
      if (editing) {
        await api.put(`/super/gst-tax/${editing.id}`, payload);
      } else {
        await api.post('/super/gst-tax', payload);
      }
      setShowForm(false);
      fetchData();
    } catch { alert('Failed to save.'); }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete "${row.name}"?`)) return;
    try {
      await api.delete(`/super/gst-tax/${row.id}`);
      fetchData();
    } catch { alert('Failed to delete.'); }
  };

  const columns = [
    { key: 'display_order', label: '#', render: (v) => v || '—' },
    { key: 'name', label: 'Tax Name', render: (v, row) => <span className={row.is_active ? '' : 'text-gray-400'}>{v}</span> },
    { key: 'gst_percentage', label: 'GST %', render: (v) => `${v}%` },
    { key: 'cess_percentage', label: 'Cess %', render: (v) => v && parseFloat(v) > 0 ? `${v}%` : '—' },
    { key: 'is_active', label: 'Status', render: (v) => <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${v ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{v ? 'Active' : 'Inactive'}</span> },
    {
      key: 'actions', label: '', render: (_, row) => (
        <div className="flex items-center gap-2">
          <button onClick={() => openEdit(row)} className="p-1.5 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={() => handleDelete(row)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="flex justify-center py-20"><Loading /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">GST Tax Configuration</h1>
        <button onClick={openNew} className="btn-primary text-sm">+ Add Tax Rate</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <ResponsiveTable
          columns={columns}
          data={rates}
          searchable={false}
          keyField="id"
          emptyMessage="No GST tax rates configured."
        />
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit' : 'Add'} Tax Rate</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g. GST @ 18%" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Percentage</label>
                  <input type="number" step="0.01" min="0" value={form.gst_percentage} onChange={e => setForm({ ...form, gst_percentage: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cess Percentage</label>
                  <input type="number" step="0.01" min="0" value={form.cess_percentage} onChange={e => setForm({ ...form, cess_percentage: e.target.value })} className="input-field" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                  <input type="number" min="0" value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.value === 'true' })} className="input-field">
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSave} className="btn-primary text-sm flex-1">{editing ? 'Update' : 'Create'}</button>
                <button onClick={() => setShowForm(false)} className="btn-secondary text-sm flex-1">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
