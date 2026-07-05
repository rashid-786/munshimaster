import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { superService } from '../../services/super.service';
import { TenantStatusBadge, PlanBadge, TrialStatusBadge } from '../../components/super/Badges';
import { LoadingState, ErrorState, EmptyState } from '../../components/super/States';
import ConfirmDialog from '../../components/super/ConfirmDialog';
import ExtendTrialModal from '../../components/ExtendTrialModal';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtNum = n => (n ?? 0).toLocaleString('en-IN');

const FILTER_TABS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trialing', label: 'Trial' },
  { key: 'paid', label: 'Paid' },
  { key: 'expired', label: 'Expired' },
  { key: 'suspended', label: 'Suspended' },
];

export default function Tenants() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [extendTrialTenant, setExtendTrialTenant] = useState(null);
  const limit = 25;

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.subscriptionPlan = planFilter;
      const data = await superService.getTenants(params);
      setTenants(data.tenants || []);
      setTotal(data.total || 0);
    } catch {
      setError('Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleSuspendReactivate = async () => {
    if (!actionTarget) return;
    const isSuspend = actionType === 'suspend';
    try {
      await superService.updateTenantStatus(actionTarget.id, {
        status: isSuspend ? 'suspended' : 'active',
        reason: `${isSuspend ? 'Suspended' : 'Reactivated'} by super admin`,
      });
      setActionTarget(null);
      setActionType(null);
      fetchTenants();
    } catch {
      setError(`Failed to ${actionType} tenant.`);
    }
  };

  const handleDelete = async () => {
    if (!actionTarget) return;
    try {
      await superService.deleteTenant(actionTarget.id);
      setActionTarget(null);
      setActionType(null);
      fetchTenants();
    } catch {
      setError('Failed to delete tenant.');
    }
  };

  const totalPages = Math.ceil(total / limit);
  const isSuspended = status => status === 'suspended' || status === 'inactive';

  return (
    <div className="space-y-5">
      {/* Header + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tenants</h1>
          <p className="text-xs text-gray-400 mt-0.5">{fmtNum(total)} total tenants</p>
        </div>
        <div className="relative w-full sm:w-72">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search tenants..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {FILTER_TABS.map(tab => (
          <button key={tab.key} onClick={() => { setStatusFilter(tab.key); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
              statusFilter === tab.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {tab.label}
          </button>
        ))}
        <div className="ml-auto">
          <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-1 focus:ring-indigo-400">
            <option value="">All Plans</option>
            {['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'].map(p => (
              <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Error */}
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{error}</div>}

      {/* Table */}
      {loading && tenants.length === 0 ? (
        <LoadingState rows={8} />
      ) : tenants.length === 0 ? (
        <EmptyState title="No tenants found" message={search ? 'Try a different search term.' : 'No tenants match the selected filters.'} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Owner</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Created</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenants.map(tenant => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/super/tenants/${tenant.id}`)}>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                          {(tenant.company_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{tenant.company_name || 'Unnamed'}</p>
                          <p className="text-[11px] text-gray-400 truncate max-w-[180px]">{tenant.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-600 hidden sm:table-cell truncate max-w-[140px]">{(tenant.owner_first_name || tenant.owner_name || '') + (tenant.owner_last_name ? ' ' + tenant.owner_last_name : '') }</td>
                    <td className="px-4 py-3.5"><PlanBadge plan={tenant.subscription_plan} /></td>
                    <td className="px-4 py-3.5"><TenantStatusBadge status={tenant.subscription_status || tenant.status} /></td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 hidden md:table-cell">{fmtDate(tenant.created_at)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {tenant.subscription_status === 'trialing' && (
                          <button onClick={() => setExtendTrialTenant(tenant)} className="text-[10px] px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-medium transition-colors">Extend</button>
                        )}
                        {!isSuspended(tenant.subscription_status || tenant.status) ? (
                          <button onClick={() => { setActionTarget(tenant); setActionType('suspend'); }} className="text-[10px] px-2 py-1 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium transition-colors">Suspend</button>
                        ) : (
                          <button onClick={() => { setActionTarget(tenant); setActionType('reactivate'); }} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 font-medium transition-colors">Reactivate</button>
                        )}
                        <button onClick={() => { setActionTarget(tenant); setActionType('delete'); }} className="text-[10px] px-2 py-1 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 font-medium transition-colors">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">{(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {fmtNum(total)}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all">← Prev</button>
                <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white disabled:opacity-40 hover:bg-gray-50 transition-all">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirm Dialogs */}
      {actionTarget && actionType === 'suspend' && (
        <ConfirmDialog open onClose={() => setActionTarget(null)} onConfirm={handleSuspendReactivate}
          title="Suspend Tenant" variant="warning"
          message={`Are you sure you want to suspend "${actionTarget.company_name}"? Users will not be able to access the system.`}
          confirmLabel="Suspend" />
      )}
      {actionTarget && actionType === 'reactivate' && (
        <ConfirmDialog open onClose={() => setActionTarget(null)} onConfirm={handleSuspendReactivate}
          title="Reactivate Tenant" variant="warning"
          message={`Reactivate "${actionTarget.company_name}"? Access will be restored immediately.`}
          confirmLabel="Reactivate" />
      )}
      {actionTarget && actionType === 'delete' && (
        <ConfirmDialog open onClose={() => setActionTarget(null)} onConfirm={handleDelete}
          title="Delete Tenant" variant="danger"
          message={`Permanently delete "${actionTarget.company_name}" and ALL associated data? This cannot be undone!`}
          confirmLabel="Delete Forever" />
      )}

      {/* Extend Trial Modal */}
      {extendTrialTenant && (
        <ExtendTrialModal open onClose={() => setExtendTrialTenant(null)} tenant={extendTrialTenant}
          onExtend={() => { setExtendTrialTenant(null); fetchTenants(); }} />
      )}
    </div>
  );
}
