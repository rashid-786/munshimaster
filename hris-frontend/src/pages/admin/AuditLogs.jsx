import React, { useState, useEffect, useMemo } from 'react';
import { hrService } from '../../services/hr.service';
import ResponsiveTable from '../../components/ResponsiveTable';
import BottomSheet from '../../components/BottomSheet';
import useIsMobile from '../../hooks/useIsMobile';

const ACTION_LABELS = {
  'employee.created': 'Staff Created', 'employee.updated': 'Staff Updated', 'employee.deleted': 'Staff Deleted',
  'employee.activated': 'Staff Activated', 'employee.deactivated': 'Staff Deactivated',
  'leave.created': 'Leave Created', 'leave.updated': 'Leave Updated', 'leave.deleted': 'Leave Deleted',
  'replacement.created': 'Replacement Created', 'replacement.ended': 'Replacement Ended', 'replacement.deleted': 'Replacement Deleted',
  'import.executed': 'Bulk Import', 'settings.updated': 'Settings Updated',
};

const ACTION_COLORS = {
  created: 'badge-success', updated: 'badge-info', deleted: 'badge-danger',
  activated: 'badge-success', deactivated: 'badge-warning', ended: 'badge-warning',
  executed: 'badge-info',
};

function actionBadge(action) {
  const key = Object.keys(ACTION_COLORS).find(k => action?.includes(k));
  return `badge ${ACTION_COLORS[key] || 'badge-info'}`;
}

const Icons = {
  search: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  clock: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
};

const AuditLogs = () => {
  const isMobile = useIsMobile();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState([]);
  const [filterAction, setFilterAction] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    hrService.getAuditActions().then(setActions).catch(() => {});
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, filterAction]);

  const fetchLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 50 };
      if (filterAction) params.action = filterAction;
      if (search) params.search = search;
      const res = await hrService.getAuditLogs(params);
      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(() => [
    { key: 'action', label: 'Action', render: (v) => <span className={actionBadge(v)}>{ACTION_LABELS[v] || v}</span> },
    { key: 'actor_name', label: 'Actor' },
    { key: 'entity_type', label: 'Entity', render: (v) => v && <span className="capitalize">{v}</span> },
    ...(isMobile ? [] : [{ key: 'entity_id', label: 'Entity ID', render: (v) => v ? <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{v.slice(0, 8)}...</code> : '—' }]),
    { key: 'created_at', label: 'Date', render: (v) => v ? new Date(v).toLocaleString() : '—' },
  ], [isMobile]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">{Icons.clock}</div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-500">{total} total entries</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-500 hover:text-red-700">&times;</button></div>}

      <div className="card animate-slide-up">
        <div className="card-header">
          <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearch} className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{Icons.search}</span>
              <input type="text" placeholder="Search actor or entity ID..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-9" />
            </form>
            <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} className="input-field text-sm py-1.5 max-w-[200px]">
              <option value="">All Actions</option>
              {actions.map(a => <option key={a} value={a}>{ACTION_LABELS[a] || a}</option>)}
            </select>
          </div>
        </div>

        <ResponsiveTable
          columns={columns}
          data={logs}
          loading={loading}
          empty="No audit logs found."
          onRowClick={(row) => setSelectedLog(row)}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost text-sm">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost text-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {isMobile && selectedLog && (
        <BottomSheet open={!!selectedLog} onClose={() => setSelectedLog(null)} title={ACTION_LABELS[selectedLog.action] || selectedLog.action}>
          <div className="space-y-3">
            <div className="flex items-start gap-3"><span className="text-sm text-gray-500 w-24 shrink-0">Actor</span><span className="text-sm text-gray-900">{selectedLog.actor_name || '—'}</span></div>
            <div className="flex items-start gap-3"><span className="text-sm text-gray-500 w-24 shrink-0">Entity</span><span className="text-sm text-gray-900 capitalize">{selectedLog.entity_type || '—'}</span></div>
            <div className="flex items-start gap-3"><span className="text-sm text-gray-500 w-24 shrink-0">Entity ID</span><span className="text-sm text-gray-900 font-mono">{selectedLog.entity_id || '—'}</span></div>
            <div className="flex items-start gap-3"><span className="text-sm text-gray-500 w-24 shrink-0">Date</span><span className="text-sm text-gray-900">{selectedLog.created_at ? new Date(selectedLog.created_at).toLocaleString() : '—'}</span></div>
            <div className="flex items-start gap-3"><span className="text-sm text-gray-500 w-24 shrink-0">IP</span><span className="text-sm text-gray-900">{selectedLog.ip_address || '—'}</span></div>
            {selectedLog.changes && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-700 mb-1">Changes</p>
                <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-40">{JSON.stringify(typeof selectedLog.changes === 'string' ? JSON.parse(selectedLog.changes) : selectedLog.changes, null, 2)}</pre>
              </div>
            )}
          </div>
        </BottomSheet>
      )}
    </div>
  );
};

export default AuditLogs;
