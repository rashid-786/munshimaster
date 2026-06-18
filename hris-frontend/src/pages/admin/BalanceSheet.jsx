import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ConfirmModal from '../../components/ConfirmModal';

const emptyForm = { type: 'IN', paymentMethod: 'cash', amount: '', description: '', entryDate: new Date().toISOString().split('T')[0] };

const BalanceSheet = () => {
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ totalIn: 0, totalOut: 0, balance: 0 });
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [attachments, setAttachments] = useState({});
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await hrService.getBalanceEntries(params);
      setEntries(res.entries);
      setSummary(res.summary);
    } catch {}
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);

  const loadAttachments = async (entryId) => {
    try {
      const res = await hrService.getAttachments('balance_sheet', entryId);
      setAttachments(prev => ({ ...prev, [entryId]: res }));
    } catch {}
  };

  useEffect(() => {
    entries.forEach(e => {
      if (!attachments[e.id]) loadAttachments(e.id);
    });
  }, [entries]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setUploadFiles([]);
    setError('');
    setShowForm(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setForm({
      type: entry.type,
      paymentMethod: entry.payment_method,
      amount: (entry.amount / 100).toFixed(2),
      description: entry.description || '',
      entryDate: entry.entry_date ? entry.entry_date.split('T')[0] : '',
    });
    setUploadFiles([]);
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await hrService.updateBalanceEntry(editing.id, form);
      } else {
        const res = await hrService.createBalanceEntry(form);
        if (uploadFiles.length > 0) {
          setUploading(true);
          await hrService.uploadFiles('balance_sheet', res.id, uploadFiles, (pct) => {});
          setUploading(false);
        }
      }
      setShowForm(false);
      setEditing(null);
      setUploadFiles([]);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await hrService.deleteBalanceEntry(id);
      setModal(null);
      fetch();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  };

  const handleDeleteAttachment = async (entryId, attId) => {
    try {
      await hrService.deleteAttachment(attId);
      loadAttachments(entryId);
    } catch {}
  };

  const handleFileChange = async (entryId) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      setUploading(true);
      try {
        await hrService.uploadFiles('balance_sheet', entryId, files, () => {});
        loadAttachments(entryId);
      } catch {}
      setUploading(false);
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Balance Sheet</h2>
        <button onClick={openCreate} className="btn-primary">Add Entry</button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Total Income</p>
          <p className="text-2xl font-bold text-green-600">{formatINR(summary.totalIn)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-2xl font-bold text-red-600">{formatINR(summary.totalOut)}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Balance</p>
          <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatINR(Math.abs(summary.balance))}
            <span className="text-sm ml-1">{summary.balance >= 0 ? '(Surplus)' : '(Deficit)'}</span>
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Transactions</h3>
          <div className="flex gap-2 items-center">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field max-w-[150px]" placeholder="Start" />
            <span className="text-gray-400">to</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field max-w-[150px]" placeholder="End" />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-sm text-gray-500 hover:text-gray-700">Clear</button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="table-header">Date</th>
                <th className="table-header">Type</th>
                <th className="table-header">Method</th>
                <th className="table-header">Amount</th>
                <th className="table-header">Description</th>
                <th className="table-header">Attachments</th>
                <th className="table-header">Added By</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map(entry => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-cell text-gray-500 whitespace-nowrap">{entry.entry_date ? entry.entry_date.split('T')[0] : '-'}</td>
                  <td className="table-cell">
                    <span className={entry.type === 'IN' ? 'badge-success' : 'badge-danger'}>
                      {entry.type}
                    </span>
                  </td>
                  <td className="table-cell text-gray-600 capitalize">{entry.payment_method}</td>
                  <td className={`table-cell font-semibold ${entry.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                    {entry.type === 'IN' ? '+' : '-'}{formatINR(entry.amount)}
                  </td>
                  <td className="table-cell text-gray-500 max-w-[250px] truncate">{entry.description || '-'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1 flex-wrap">
                      {(attachments[entry.id] || []).map(att => (
                        <span key={att.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5">
                          <a href={`${import.meta.env.VITE_API_BASE_URL}/uploads/${att.stored_name}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate max-w-[80px]">
                            {att.original_name}
                          </a>
                          <button onClick={() => handleDeleteAttachment(entry.id, att.id)} className="text-red-400 hover:text-red-600">&times;</button>
                        </span>
                      ))}
                      <button onClick={() => handleFileChange(entry.id)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+File</button>
                    </div>
                  </td>
                  <td className="table-cell text-gray-500 text-sm">{entry.first_name} {entry.last_name}</td>
                  <td className="table-cell">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(entry)} className="text-sm text-indigo-600 hover:text-indigo-800">Edit</button>
                      <button onClick={() => setModal({ id: entry.id })} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={8} className="table-cell text-center text-gray-400 py-8">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{editing ? 'Edit Entry' : 'Add Entry'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input-field" required>
                    <option value="IN">IN (Income)</option>
                    <option value="OUT">OUT (Expense)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select value={form.paymentMethod} onChange={e => setForm({ ...form, paymentMethod: e.target.value })} className="input-field" required>
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
                  <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={form.entryDate} onChange={e => setForm({ ...form, entryDate: e.target.value })} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description / Notes</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} placeholder="Enter description or notes..." />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
                  <input type="file" multiple onChange={e => setUploadFiles(Array.from(e.target.files))} className="input-field" />
                  {uploadFiles.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{uploadFiles.length} file(s) selected</p>
                  )}
                </div>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saving || uploading} className="btn-primary">
                  {saving || uploading ? 'Saving...' : editing ? 'Update' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modal && (
        <ConfirmModal
          message="Are you sure you want to delete this entry?"
          onConfirm={() => handleDelete(modal.id)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
};

export default BalanceSheet;
