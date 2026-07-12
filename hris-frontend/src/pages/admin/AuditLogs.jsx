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
    { key: 'created_at', label: 'Date', render: (v) => v ? new Date(v).toLocaleString() : '—' },
  ], []);

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
          emptyMessage="No audit logs found."
          mobilePrimary="action"
          mobileSecondary="actor_name"
          onRowClick={(row) => setSelectedLog(row)}
          total={total}
          page={page}
          totalPages={totalPages}
          onPrevPage={() => setPage(p => p - 1)}
          onNextPage={() => setPage(p => p + 1)}
        />
      </div>

      {selectedLog && (isMobile ? (
        <BottomSheet open={!!selectedLog} onClose={() => setSelectedLog(null)} title={ACTION_LABELS[selectedLog.action] || selectedLog.action}>
          <DetailContent log={selectedLog} />
        </BottomSheet>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{ACTION_LABELS[selectedLog.action] || selectedLog.action}</h3>
                <p className="text-sm text-gray-500 mt-0.5">Audit Log Details</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">&times;</button>
            </div>
            <div className="p-6">
              <DetailContent log={selectedLog} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function DetailContent({ log }) {
  return (
    <div className="space-y-3">
      <DetailRow label="Actor" value={log.actor_name || '—'} />
      <DetailRow label="Action" value={ACTION_LABELS[log.action] || log.action} />
      <DetailRow label="Entity" value={log.entity_type ? log.entity_type.charAt(0).toUpperCase() + log.entity_type.slice(1) : '—'} />
      <DetailRow label="Entity ID" value={log.entity_id ? <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{log.entity_id}</code> : '—'} />
      <DetailRow label="Date" value={log.created_at ? new Date(log.created_at).toLocaleString() : '—'} />
      <DetailRow label="IP Address" value={log.ip_address || '—'} />
      {log.changes && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2">Changes</p>
          <pre className="text-xs bg-gray-50 p-3 rounded-lg overflow-auto max-h-48">{JSON.stringify(typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 flex-1 break-words">{children || value || '—'}</span>
    </div>
  );
}

export default AuditLogs;
