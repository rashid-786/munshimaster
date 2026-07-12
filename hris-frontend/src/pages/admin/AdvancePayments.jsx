import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import Modal from '../../components/Modal';
import SearchableSelect from '../../components/SearchableSelect';
import useIsMobile from '../../hooks/useIsMobile';

const AdvancePayments = () => {
  const isMobile = useIsMobile();
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [form, setForm] = useState({ employeeId: '', amount: '', reason: '' });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const search = useMemo(() => {
    if (!selectedEmployeeId) return '';
    const emp = employees.find(e => e.id === selectedEmployeeId);
    return emp ? `${emp.first_name} ${emp.last_name}` : '';
  }, [selectedEmployeeId, employees]);
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ status: 'pending', amount: '', reason: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);

  const filteredAdvances = useMemo(() => {
    if (!search) return advances;
    const q = search.toLowerCase();
    return advances.filter(a => `${a.first_name} ${a.last_name}`.toLowerCase().includes(q));
  }, [advances, search]);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const data = await hrService.getAdvances();
      setAdvances(data);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [advances, employees] = await Promise.all([
        hrService.getAdvances(),
        hrService.getEmployees(),
      ]);
      setAdvances(advances);
      setEmployees(employees);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleGrant = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await hrService.createAdvance({ employeeId: form.employeeId, amount: form.amount, reason: form.reason });
      setMessage(res.message);
      setShowGrant(false);
      setForm({ employeeId: '', amount: '', reason: '' });
      fetch();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to grant advance.');
    }
  };

  const handleApprove = async (id) => {
    try {
      await hrService.approveAdvance(id);
      fetch();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to approve.');
    }
  };

  const handleReject = async (id) => {
    try {
      await hrService.rejectAdvance(id);
      fetch();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to reject.');
    }
  };

  const handleEdit = (r) => {
    setEditForm({ status: r.status, amount: (r.amount / 100).toFixed(2), reason: r.reason || '' });
    setEditingRecord(r);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      await hrService.updateAdvance(editingRecord.id, editForm);
      setMessage('Advance updated successfully.');
      setEditingRecord(null);
      fetch();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to update advance.');
    }
  };

  const handleDelete = async (id) => {
    try {
      await hrService.deleteAdvance(id);
      setMessage('Advance deleted successfully.');
      setConfirmDelete(null);
      fetch();
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to delete advance.');
      setConfirmDelete(null);
    }
  };

  const statusBadgeClass = (status) => {
    if (status === 'approved') return 'badge-success';
    if (status === 'pending') return 'badge-warning';
    if (status === 'rejected') return 'badge-danger';
    return 'badge-info';
  };

  const columns = [
    { key: 'employee_name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'amount', label: 'Amount', render: (v) => formatINR(v) },
    { key: 'remaining_balance', label: 'Remaining', render: (v) => formatINR(v) },
    { key: 'reason', label: 'Reason', render: (v) => <span className="text-gray-500 max-w-[200px] truncate block">{v || '-'}</span> },
    { key: 'status', label: 'Status', render: (v) => (
      <span className={statusBadgeClass(v)}>{v.replace('_', ' ')}</span>
    )},
    { key: 'created_at', label: 'Date', render: (v) => <span className="text-gray-500">{(v || '').split('T')[0]}</span> },
    { key: 'actions', label: 'Actions', className: 'text-right', render: (_, r) => (
      <div className="flex justify-end gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); handleEdit(r); }} className="btn-secondary !py-1.5 !px-2.5 text-xs" title="Edit">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
        </button>
        {r.status === 'pending' && (
          <>
            <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(r); }} className="btn-danger !py-1.5 !px-2.5 text-xs" title="Delete">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleApprove(r.id); }} className="btn-success !py-1.5 !px-2.5 text-xs">Approve</button>
            <button onClick={(e) => { e.stopPropagation(); handleReject(r.id); }} className="btn-danger !py-1.5 !px-2.5 text-xs">Reject</button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-blue-500 hover:text-blue-700">&times;</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Advance Payments</h3>
        <button onClick={() => setShowGrant(!showGrant)} className="btn-primary text-sm">
          {showGrant ? 'Cancel' : 'Grant Advance'}
        </button>
      </div>

      {showGrant && (
        <form onSubmit={handleGrant} className="card p-6 space-y-4 bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="input-field" required>
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
              <input type="number" min="1" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} className="input-field" placeholder="Optional" />
            </div>
          </div>
          <button type="submit" className="btn-primary">Grant Advance</button>
        </form>
      )}

      <div className="max-w-xs mb-4 flex items-center gap-2">
        <div className="flex-1">
          <SearchableSelect
            options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
            value={selectedEmployeeId}
            onChange={(val) => setSelectedEmployeeId(val)}
            placeholder="Search employee..."
          />
        </div>
        {selectedEmployeeId && (
          <button onClick={() => setSelectedEmployeeId('')} className="text-xs text-indigo-600 hover:text-indigo-800 shrink-0">Clear</button>
        )}
      </div>
      <ResponsiveTable
        columns={columns}
        data={filteredAdvances}
        keyField="id"
        searchKeys={['first_name', 'last_name', 'amount', 'reason']}
        loading={loading}
        mobilePrimary="employee_name"
        mobileSecondary="amount"
        onRowClick={(r) => setSelectedRecord(r)}
        emptyMessage="No advance payment records"
      />

      {isMobile && (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`${selectedRecord?.first_name || ''} ${selectedRecord?.last_name || ''}`.trim() || 'Advance Details'}
          actions={
            selectedRecord?.status === 'pending' ? (
              <>
                <button
                  onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleApprove(r.id); }}
                  className="flex-1 btn-success justify-center"
                >
                  Approve
                </button>
                <button
                  onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleReject(r.id); }}
                  className="flex-1 btn-danger justify-center"
                >
                  Reject
                </button>
              </>
            ) : null
          }
        >
          {selectedRecord && (
            <div className="space-y-3">
              <DetailRow label="Employee" value={`${selectedRecord.first_name} ${selectedRecord.last_name}`} />
              <DetailRow label="Amount" value={formatINR(selectedRecord.amount)} />
              <DetailRow label="Remaining" value={formatINR(selectedRecord.remaining_balance)} />
              <DetailRow label="Reason" value={selectedRecord.reason || '-'} />
              <DetailRow label="Status">
                <span className={statusBadgeClass(selectedRecord.status)}>{selectedRecord.status.replace('_', ' ')}</span>
              </DetailRow>
              <DetailRow label="Date" value={(selectedRecord.created_at || '').split('T')[0]} />
            </div>
          )}
        </BottomSheet>
      )}

      <Modal open={!!editingRecord} onClose={() => setEditingRecord(null)} title="Edit Advance">
        {editingRecord && (
          <form onSubmit={handleUpdate} className="space-y-4 p-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={editForm.status}
                onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="input-field">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (Rs.)</label>
              <input type="number" min="1" step="0.01" value={editForm.amount}
                onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input type="text" value={editForm.reason}
                onChange={e => setEditForm({ ...editForm, reason: e.target.value })}
                className="input-field" placeholder="Optional" />
            </div>
            <p className="text-xs text-gray-400">Changes to amount will adjust the remaining balance accordingly.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingRecord(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="submit" className="btn-primary text-sm">Save Changes</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Advance">
        {confirmDelete && (
          <div className="space-y-4 p-2">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete this advance for <strong>{confirmDelete.first_name} {confirmDelete.last_name}</strong>?
            </p>
            <p className="text-sm text-gray-500">Amount: {formatINR(confirmDelete.amount)}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" onClick={() => handleDelete(confirmDelete.id)} className="btn-danger text-sm">Delete</button>
            </div>
          </div>
        )}
      </Modal>
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

export default AdvancePayments;
