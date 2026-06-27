import React, { useState, useEffect, useCallback } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ConfirmModal from '../../components/ConfirmModal';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';
import UpgradeBanner from '../../components/UpgradeBanner';

const emptyForm = { type: 'IN', paymentMethod: 'cash', amount: '', description: '', entryDate: new Date().toISOString().split('T')[0] };

const BalanceSheet = () => {
  const isMobile = useIsMobile();
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
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await hrService.getBalanceEntries(params);
      setEntries(res.entries);
      setSummary(res.summary);
    } catch {} finally {
      setLoading(false);
    }
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
    setSelectedRecord(null);
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

  const entryAttachments = selectedRecord ? attachments[selectedRecord.id] || [] : [];

  const columns = [
    { key: 'entry_date', label: 'Date', render: (v) => <span className="text-gray-500 whitespace-nowrap">{v ? v.split('T')[0] : '-'}</span> },
    { key: 'type', label: 'Type', render: (v) => (
      <span className={v === 'IN' ? 'badge-success' : 'badge-danger'}>{v}</span>
    )},
    { key: 'payment_method', label: 'Method', render: (v) => <span className="text-gray-600 capitalize">{v}</span> },
    { key: 'amount', label: 'Amount', render: (v, r) => (
      <span className={`font-semibold ${r.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
        {r.type === 'IN' ? '+' : '-'}{formatINR(v)}
      </span>
    )},
    { key: 'description', label: 'Description', render: (v) => <span className="text-gray-500 max-w-[250px] truncate block">{v || '-'}</span> },
    { key: 'attachments_cell', label: 'Attachments', render: (_, r) => {
      const entryAtts = attachments[r.id] || [];
      return (
        <div className="flex items-center gap-1 flex-wrap">
          {entryAtts.map(att => (
            <span key={att.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5">
              <a href={`${import.meta.env.VITE_API_BASE_URL}/uploads/${att.stored_name}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate max-w-[80px]">
                {att.original_name}
              </a>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(r.id, att.id); }} className="text-red-400 hover:text-red-600">&times;</button>
            </span>
          ))}
          <button onClick={(e) => { e.stopPropagation(); handleFileChange(r.id); }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">+File</button>
        </div>
      );
    }},
    { key: 'added_by', label: 'Added By', render: (_, r) => <span className="text-gray-500 text-sm">{r.first_name} {r.last_name}</span> },
    { key: 'actions', label: 'Actions', render: (_, r) => (
      <div className="flex gap-2">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="text-sm text-indigo-600 hover:text-indigo-800">Edit</button>
        <button onClick={(e) => { e.stopPropagation(); setModal({ id: r.id }); }} className="text-sm text-red-600 hover:text-red-800">Delete</button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Balance Sheet</h2>
        <button onClick={openCreate} className="btn-primary">Add Entry</button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}
      <UpgradeBanner type="feature" feature="Balance Sheet" plan="business" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Income</p>
            <p className="text-2xl font-bold text-emerald-600">{formatINR(summary.totalIn)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center text-red-500 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500">{formatINR(summary.totalOut)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${summary.balance >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Balance</p>
            <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {formatINR(Math.abs(summary.balance))}
              <span className="text-sm ml-1">{summary.balance >= 0 ? '(Surplus)' : '(Deficit)'}</span>
            </p>
          </div>
        </div>
      </div>

      <ResponsiveTable
        columns={columns}
        data={entries}
        keyField="id"
        searchable={true}
        searchKeys={['description', 'type', 'payment_method']}
        loading={loading}
        mobilePrimary="entry_date"
        mobileSecondary="type"
        onRowClick={(r) => setSelectedRecord(r)}
        emptyMessage="No transactions found"
        header={
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
        }
      />

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
          open
          message="Are you sure you want to delete this entry?"
          onConfirm={() => handleDelete(modal.id)}
          onCancel={() => setModal(null)}
        />
      )}

      {isMobile && (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={selectedRecord ? `${selectedRecord.type === 'IN' ? '+' : '-'}${formatINR(selectedRecord.amount)}` : 'Transaction Details'}
          actions={
            <>
              <button
                onClick={() => { const r = selectedRecord; setSelectedRecord(null); openEdit(r); }}
                className="flex-1 btn-primary justify-center"
              >
                Edit
              </button>
              <button
                onClick={() => { const r = selectedRecord; setSelectedRecord(null); setModal({ id: r.id }); }}
                className="flex-1 btn-danger justify-center"
              >
                Delete
              </button>
            </>
          }
        >
          {selectedRecord && (
            <div className="space-y-3">
              <DetailRow label="Date" value={selectedRecord.entry_date ? selectedRecord.entry_date.split('T')[0] : '-'} />
              <DetailRow label="Type">
                <span className={selectedRecord.type === 'IN' ? 'badge-success' : 'badge-danger'}>{selectedRecord.type}</span>
              </DetailRow>
              <DetailRow label="Method" value={selectedRecord.payment_method} />
              <DetailRow label="Amount">
                <span className={`font-semibold ${selectedRecord.type === 'IN' ? 'text-green-600' : 'text-red-600'}`}>
                  {selectedRecord.type === 'IN' ? '+' : '-'}{formatINR(selectedRecord.amount)}
                </span>
              </DetailRow>
              <DetailRow label="Description" value={selectedRecord.description || '-'} />
              <DetailRow label="Added By" value={`${selectedRecord.first_name} ${selectedRecord.last_name}`} />
              <DetailRow label="Attachments">
                <div className="flex flex-col gap-1">
                  {entryAttachments.length === 0 && <span className="text-gray-400">—</span>}
                  {entryAttachments.map(att => (
                    <span key={att.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded px-1.5 py-0.5">
                      <a href={`${import.meta.env.VITE_API_BASE_URL}/uploads/${att.stored_name}`} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate max-w-[180px]">
                        {att.original_name}
                      </a>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteAttachment(selectedRecord.id, att.id); }} className="text-red-400 hover:text-red-600">&times;</button>
                    </span>
                  ))}
                  <button onClick={(e) => { e.stopPropagation(); handleFileChange(selectedRecord.id); }} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium self-start mt-1">+ Add File</button>
                </div>
              </DetailRow>
            </div>
          )}
        </BottomSheet>
      )}
    </div>
  );
};

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default BalanceSheet;
