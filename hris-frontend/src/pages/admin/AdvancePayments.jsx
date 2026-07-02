import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const AdvancePayments = () => {
  const isMobile = useIsMobile();
  const [advances, setAdvances] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showGrant, setShowGrant] = useState(false);
  const [form, setForm] = useState({ employeeId: '', amount: '', reason: '' });
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

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
    { key: 'actions', label: 'Actions', render: (_, r) => (
      <div>
        {r.status === 'pending' && (
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleApprove(r.id); }} className="text-sm text-green-600 hover:text-green-800 font-medium">Approve</button>
            <button onClick={(e) => { e.stopPropagation(); handleReject(r.id); }} className="text-sm text-red-600 hover:text-red-800 font-medium">Reject</button>
          </div>
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

      <div className="relative max-w-xs">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          placeholder="Search by staff name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input-field pl-9 text-sm mb-4"
        />
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
