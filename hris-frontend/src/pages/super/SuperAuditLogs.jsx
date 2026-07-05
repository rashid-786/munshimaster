import { useState, useEffect, useCallback, Fragment } from 'react';
import { superService } from '../../services/super.service';

const fmtDate = d => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDateShort = d => d ? new Date(d).toISOString().split('T')[0] : '';

const ACTION_LABELS = {
  'tenant.created': 'Tenant Created',
  'tenant.updated': 'Tenant Updated',
  'tenant.deleted': 'Tenant Deleted',
  'tenant.suspended': 'Tenant Suspended',
  'tenant.reactivated': 'Tenant Reactivated',
  'tenant.admin_updated': 'Tenant Admin Updated',
  'tenant.notes_updated': 'Tenant Notes Updated',
  'tenant.plan_changed': 'Plan Changed',
  'tenant.trial_extended': 'Trial Extended',
  'plan.created': 'Plan Created',
  'plan.updated': 'Plan Updated',
  'plan.deactivated': 'Plan Deactivated',
  'plan.force_changed': 'Plan Force Changed',
  'plan.features_updated': 'Plan Features Updated',
  'plan_feature.updated': 'Plan Feature Updated',
  'override.created': 'Override Created',
  'override.updated': 'Override Updated',
  'override.deleted': 'Override Deleted',
  'override.bulk_created': 'Bulk Override Created',
  'quota.extra_granted': 'Extra Quota Granted',
  'campaign.created': 'Campaign Created',
  'campaign.updated': 'Campaign Updated',
  'campaign.deleted': 'Campaign Deleted',
  'campaign.activated': 'Campaign Activated',
  'campaign.deactivated': 'Campaign Deactivated',
  'campaign.status_changed': 'Campaign Status Changed',
  'referral.updated': 'Referral Updated',
  'section.visibility_updated': 'Section Visibility Updated',
  'section.visibility_reset': 'Section Visibility Reset',
  'section.hidden': 'Section Hidden',
  'section.shown': 'Section Shown',
  'section.read_only': 'Section Set Read-Only',
  'custom_plan.created': 'Custom Plan Created',
  'custom_plan.updated': 'Custom Plan Updated',
  'custom_plan.assigned': 'Custom Plan Assigned',
  'custom_plan.removed': 'Custom Plan Removed',
  'branding.updated': 'Branding Updated',
  'system.settings_updated': 'System Settings Updated',
  'admin.login': 'Admin Login',
  'admin.user_changed': 'Admin User Changed',
  'admin.bulk_action': 'Bulk Action',
  'employee.updated': 'Employee Updated',
  'tenant.status_changed': 'Tenant Status Changed',
};

const ENTITY_COLORS = {
  tenant: 'bg-blue-100 text-blue-700',
  plan: 'bg-purple-100 text-purple-700',
  campaign: 'bg-green-100 text-green-700',
  referral: 'bg-amber-100 text-amber-700',
  override: 'bg-orange-100 text-orange-700',
  section_visibility: 'bg-teal-100 text-teal-700',
  feature_override: 'bg-pink-100 text-pink-700',
  employee: 'bg-indigo-100 text-indigo-700',
  system: 'bg-gray-100 text-gray-700',
  bulk: 'bg-red-100 text-red-700',
  subscription: 'bg-cyan-100 text-cyan-700',
};

const getEntityColor = (type) => {
  const base = (type || '').split('_')[0];
  return ENTITY_COLORS[base] || ENTITY_COLORS.tenant;
};

export default function SuperAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    actorId: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    tenantId: '',
    limit: 50,
    offset: 0,
  });
  const [actionTypes, setActionTypes] = useState([]);
  const [actors, setActors] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const res = await superService.getActionLog(params);
      setLogs(res.logs || []);
      setTotal(res.total || 0);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    superService.getActionLogTypes().then(d => setActionTypes(d.types || [])).catch(() => {});
    superService.getActionLogActors().then(d => setActors(d.actors || [])).catch(() => {});
  }, []);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters({ action: '', entityType: '', actorId: '', dateFrom: '', dateTo: '', search: '', tenantId: '', limit: 50, offset: 0 });
  };

  const nextPage = () => setFilters(prev => ({ ...prev, offset: prev.offset + prev.limit }));
  const prevPage = () => setFilters(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }));

  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const totalPages = Math.ceil(total / filters.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{total} total entries</span>
          <button onClick={() => setShowFilters(!showFilters)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button onClick={fetchLogs} className="text-sm px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors" disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Action Type</label>
              <select value={filters.action} onChange={e => updateFilter('action', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400">
                <option value="">All Actions</option>
                {actionTypes.map(t => (
                  <option key={t.action} value={t.action}>{ACTION_LABELS[t.action] || t.action}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Entity Type</label>
              <select value={filters.entityType} onChange={e => updateFilter('entityType', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400">
                <option value="">All Entities</option>
                {['tenant', 'plan', 'campaign', 'referral', 'override', 'feature_override', 'section_visibility', 'employee', 'system', 'bulk', 'subscription'].map(e => (
                  <option key={e} value={e}>{e.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Actor</label>
              <select value={filters.actorId} onChange={e => updateFilter('actorId', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400">
                <option value="">All Actors</option>
                {actors.map(a => (
                  <option key={a.admin_id} value={a.admin_id}>{a.admin_name || a.admin_id}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tenant ID</label>
              <input value={filters.tenantId} onChange={e => updateFilter('tenantId', e.target.value)} placeholder="Filter by tenant..." className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">From Date</label>
              <input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">To Date</label>
              <input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Search</label>
              <input value={filters.search} onChange={e => updateFilter('search', e.target.value)} placeholder="Search text..." className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 mt-0.5 bg-white focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={clearFilters} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Clear Filters</button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-200">
                <th className="table-header text-left px-4 py-3">Date/Time</th>
                <th className="table-header text-left px-4 py-3">Action</th>
                <th className="table-header text-left px-4 py-3">Actor</th>
                <th className="table-header text-left px-4 py-3">Entity</th>
                <th className="table-header text-left px-4 py-3">Details</th>
                <th className="table-header text-left px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading audit logs...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">No audit log entries found.</td></tr>
              ) : logs.map(log => (
                <Fragment key={log.id}>
                  <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium text-gray-900">{ACTION_LABELS[log.action] || log.action}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-700">{log.admin_name || 'Unknown'}</span>
                      {log.actor_role && <span className="text-[10px] text-gray-400 ml-1">({log.actor_role})</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getEntityColor(log.entity_type)}`}>
                        {log.entity_type || '—'}
                      </span>
                      {log.entity_id && <span className="text-[10px] text-gray-400 ml-1 block truncate max-w-[120px]" title={log.entity_id}>{log.entity_id.slice(0, 12)}...</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-500 max-w-xs truncate">
                        {log.reason ? <span className="text-gray-700 font-medium">Reason: {log.reason}</span> : null}
                        {log.tenant_id && !log.reason && <span>Tenant: {log.tenant_id.slice(0, 12)}...</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{expandedRow === log.id ? '▲' : '▼'}</td>
                  </tr>
                  {expandedRow === log.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide">IP & User Agent</h4>
                            <p className="text-gray-500">IP: {log.ip_address || '—'}</p>
                            <p className="text-gray-500 break-all">UA: {log.user_agent || '—'}</p>
                            <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mt-3">IDs</h4>
                            <p className="text-gray-500">Log ID: {log.id}</p>
                            {log.admin_id && <p className="text-gray-500">Admin ID: {log.admin_id}</p>}
                            {log.tenant_id && <p className="text-gray-500">Tenant ID: {log.tenant_id}</p>}
                            {log.entity_id && <p className="text-gray-500">Entity ID: {log.entity_id}</p>}
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide">Old Value</h4>
                            {log.old_value ? (
                              <pre className="bg-white border border-gray-200 rounded-lg p-2 text-[10px] text-gray-600 overflow-x-auto max-h-32">{JSON.stringify(log.old_value, null, 2)}</pre>
                            ) : <p className="text-gray-400 italic">None</p>}
                            <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mt-3">New Value</h4>
                            {log.new_value ? (
                              <pre className="bg-white border border-gray-200 rounded-lg p-2 text-[10px] text-gray-600 overflow-x-auto max-h-32">{JSON.stringify(log.new_value, null, 2)}</pre>
                            ) : <p className="text-gray-400 italic">None</p>}
                            {log.details && (
                              <>
                                <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-wide mt-3">Raw Details</h4>
                                <pre className="bg-white border border-gray-200 rounded-lg p-2 text-[10px] text-gray-500 overflow-x-auto max-h-32">{JSON.stringify(log.details, null, 2)}</pre>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > filters.limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-500">
              Showing {filters.offset + 1}–{Math.min(filters.offset + filters.limit, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={prevPage} disabled={filters.offset === 0} className="text-xs px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white transition-colors">← Prev</button>
              <span className="text-xs text-gray-500">Page {currentPage} of {totalPages}</span>
              <button onClick={nextPage} disabled={filters.offset + filters.limit >= total} className="text-xs px-3 py-1 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-white transition-colors">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Per-page selector */}
      <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
        <span>Rows per page:</span>
        <select value={filters.limit} onChange={e => updateFilter('limit', Number(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white">
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
      </div>
    </div>
  );
}
