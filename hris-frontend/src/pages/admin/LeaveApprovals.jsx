import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';
import { ActionEdit, ActionDelete } from '../../components/ActionIcons';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import ConfirmModal from '../../components/ConfirmModal';
import SearchableSelect from '../../components/SearchableSelect';
import useIsMobile from '../../hooks/useIsMobile';

const LEAVE_TYPES = ['Annual', 'Sick', 'Casual', 'Unpaid'];



const LeaveApprovals = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isAdmin = user?.role === 'tenant_admin';
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showCreateLeave, setShowCreateLeave] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [leaveForm, setLeaveForm] = useState({ employeeId: '', leaveType: 'Annual', startDate: '', endDate: '', replacementEmployeeId: '' });
  const [modal, setModal] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const adhocEmployees = useMemo(() =>
    employees.filter(e => e.job_type === 'adhoc' && e.status !== 'deactivated')
      .map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` })),
    [employees]
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const leaves = await hrService.getLeaves();
        setLeaves(leaves);
        if (isAdmin) {
          const emps = await hrService.getEmployees();
          setEmployees(emps);
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleCreateLeave = async (e) => {
    e.preventDefault();
    try {
      const res = editingLeave
        ? await hrService.updateLeave(editingLeave.id, { leaveType: leaveForm.leaveType, startDate: leaveForm.startDate, endDate: leaveForm.endDate })
        : await hrService.adminCreateLeave(leaveForm);
      setMessage(res.message);
      setShowCreateLeave(false);
      setEditingLeave(null);
      setLeaveForm({ employeeId: '', leaveType: 'Annual', startDate: '', endDate: '', replacementEmployeeId: '' });
      const updated = await hrService.getLeaves();
      setLeaves(updated);
    } catch (err) {
      setMessage(err.response?.data?.error || 'Failed to save leave.');
    }
  };

  const handleEdit = (leave) => {
    setEditingLeave(leave);
    setLeaveForm({
      employeeId: leave.employee_id || '',
      leaveType: leave.leave_type,
      startDate: leave.start_date,
      endDate: leave.end_date,
      replacementEmployeeId: '',
    });
    setShowCreateLeave(true);
  };

  const handleDelete = (id) => {
    setModal({
      id,
      variant: 'danger',
      title: 'Delete Leave',
      message: 'Permanently delete this leave record? This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setModalLoading(true);
        try { await hrService.deleteLeave(id); setModal(null); setLeaves(await hrService.getLeaves()); }
        catch (err) { setMessage(err.response?.data?.error || 'Failed to delete.'); setModal(null); }
        finally { setModalLoading(false); }
      },
    });
  };

  const monthOptions = useMemo(() => {
    const set = new Set();
    for (const l of leaves) {
      const d = new Date(l.start_date);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return [...set].sort().reverse();
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter(l => {
      if (filterStatus && l.status !== filterStatus) return false;
      if (filterType && l.leave_type !== filterType) return false;
      if (filterMonth) {
        const d = new Date(l.start_date);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (ym !== filterMonth) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const name = `${l.first_name} ${l.last_name}`.toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [leaves, filterStatus, filterType, filterMonth, search]);

  const handleReview = async (id, status) => {
    try {
      const res = await hrService.reviewLeave(id, status);
      setMessage(res.message);
      setLeaves(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    } catch (err) {
      setMessage(err.response?.data?.error || 'Action failed.');
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      default: return 'badge-warning';
    }
  };

  const columns = [
    { key: 'employee_name', label: 'Employee', render: (_, r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
    { key: 'leave_type', label: 'Type', render: (v) => v },
    { key: 'start_date', label: 'Start Date', render: (v) => <span className="text-gray-500">{new Date(v).toLocaleDateString()}</span> },
    { key: 'end_date', label: 'End Date', render: (v) => <span className="text-gray-500">{new Date(v).toLocaleDateString()}</span> },
    { key: 'status', label: 'Status', render: (v) => <span className={statusBadge(v)}>{v}</span> },
    { key: 'actions', label: 'Actions', className: 'text-right', render: (_, r) => (
      <div className="flex gap-1.5 justify-end">
        {isAdmin && r.status === 'pending' ? (
          <>
            <button onClick={(e) => { e.stopPropagation(); handleReview(r.id, 'approved'); }} className="btn-success text-xs !px-3 !py-1">Approve</button>
            <button onClick={(e) => { e.stopPropagation(); handleReview(r.id, 'rejected'); }} className="btn-danger text-xs !px-3 !py-1">Reject</button>
          </>
        ) : (
          <span className="text-gray-400 text-sm self-center">{r.status === 'pending' ? 'Awaiting' : 'Done'}</span>
        )}
        {isAdmin && (
          <>
            <ActionEdit onClick={(e) => { e.stopPropagation(); handleEdit(r); }} />
            <ActionDelete onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} />
          </>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{isAdmin ? 'Leave Management' : 'My Leave Requests'}</h3>
        {isAdmin && (
          <button onClick={() => setShowCreateLeave(true)} className="btn-primary text-sm !px-4 !py-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Create Leave
          </button>
        )}
      </div>
      {message && <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
      <ResponsiveTable
        columns={columns}
        data={filteredLeaves}
        keyField="id"
       
        searchKeys={['first_name', 'last_name', 'leave_type', 'status']}
        loading={loading}
        mobilePrimary="employee_name"
        mobileSecondary="status"
        onRowClick={(r) => setSelectedRecord(r)}
        emptyMessage="No leave applications"
        header={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[140px] max-w-[200px]">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-8 text-sm"
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field max-w-[120px] text-sm">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field max-w-[120px] text-sm">
              <option value="">All Types</option>
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Casual">Casual</option>
              <option value="Unpaid">Unpaid</option>
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field max-w-[140px] text-sm">
              <option value="">All Months</option>
              {monthOptions.map(m => {
                const [y, mo] = m.split('-');
                const label = new Date(y, mo - 1).toLocaleString('default', { month: 'short', year: 'numeric' });
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
          </div>
        }
      />

      {isMobile && (
        <BottomSheet
          open={!!selectedRecord}
          onClose={() => setSelectedRecord(null)}
          title={`${selectedRecord?.first_name || ''} ${selectedRecord?.last_name || ''}`.trim() || 'Leave Details'}
          actions={
            isAdmin && selectedRecord?.status === 'pending' ? (
              <>
                <button
                  onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleReview(r.id, 'approved'); }}
                  className="flex-1 btn-success justify-center"
                >
                  Approve
                </button>
                <button
                  onClick={() => { const r = selectedRecord; setSelectedRecord(null); handleReview(r.id, 'rejected'); }}
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
              <DetailRow label="Leave Type" value={selectedRecord.leave_type} />
              <DetailRow label="Start Date" value={new Date(selectedRecord.start_date).toLocaleDateString()} />
              <DetailRow label="End Date" value={new Date(selectedRecord.end_date).toLocaleDateString()} />
              <DetailRow label="Status">
                <span className={statusBadge(selectedRecord.status)}>{selectedRecord.status}</span>
              </DetailRow>
            </div>
          )}
        </BottomSheet>
      )}

      {/* Admin: Create Leave Modal */}
      {showCreateLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowCreateLeave(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{editingLeave ? 'Edit Leave' : 'Create Leave'}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{editingLeave ? 'Update leave details.' : 'Approve leave for a staff member.'}</p>
              </div>
              <button onClick={() => { setShowCreateLeave(false); setEditingLeave(null); }} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
            </div>
            <form onSubmit={handleCreateLeave} className="p-6 space-y-4">
              {!editingLeave && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
                  <SearchableSelect
                    options={employees.map(e => ({ value: e.id, label: `${e.first_name} ${e.last_name}` }))}
                    value={leaveForm.employeeId}
                    onChange={(val) => setLeaveForm({ ...leaveForm, employeeId: val })}
                    placeholder="Select employee..."
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                <select value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} className="input-field">
                  {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required className="input-field" />
                </div>
              </div>
              {!editingLeave && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adhoc Replacement (optional)</label>
                  <SearchableSelect
                    options={adhocEmployees}
                    value={leaveForm.replacementEmployeeId}
                    onChange={(val) => setLeaveForm({ ...leaveForm, replacementEmployeeId: val })}
                    placeholder="Assign adhoc staff to cover..."
                  />
                  <p className="text-xs text-gray-400 mt-1">Automatically creates a replacement record for this leave period.</p>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowCreateLeave(false); setEditingLeave(null); }} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingLeave ? 'Update Leave' : 'Create & Approve'}</button>
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

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default LeaveApprovals;
