import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const LeaveApprovals = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const isAdmin = user?.role === 'tenant_admin';
  const [leaves, setLeaves] = useState([]);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    hrService.getLeaves().then(setLeaves).catch(() => {});
  }, []);

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
      return true;
    });
  }, [leaves, filterStatus, filterType, filterMonth]);

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
    { key: 'actions', label: 'Actions', render: (_, r) => (
      <div>
        {isAdmin && r.status === 'pending' ? (
          <div className="flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleReview(r.id, 'approved'); }} className="btn-success text-xs !px-3 !py-1">Approve</button>
            <button onClick={(e) => { e.stopPropagation(); handleReview(r.id, 'rejected'); }} className="btn-danger text-xs !px-3 !py-1">Reject</button>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">{r.status === 'pending' ? 'Awaiting approval' : 'Done'}</span>
        )}
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">{isAdmin ? 'Leave Applications' : 'My Leave Requests'}</h3>
      {message && <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
      <ResponsiveTable
        columns={columns}
        data={filteredLeaves}
        keyField="id"
        mobilePrimary="employee_name"
        mobileSecondary="status"
        onRowClick={(r) => setSelectedRecord(r)}
        emptyMessage="No leave applications"
        header={
          <div className="flex flex-wrap gap-2">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field max-w-[130px] text-sm">
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field max-w-[130px] text-sm">
              <option value="">All Types</option>
              <option value="Annual">Annual</option>
              <option value="Sick">Sick</option>
              <option value="Casual">Casual</option>
              <option value="Unpaid">Unpaid</option>
            </select>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field max-w-[150px] text-sm">
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
