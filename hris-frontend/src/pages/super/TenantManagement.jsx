import { useState, useEffect, useCallback } from 'react';
import { superService } from '../../services/super.service';
import { Link } from 'react-router-dom';
import useIsMobile from '../../hooks/useIsMobile';
import ExtendTrialModal from '../../components/ExtendTrialModal';
import ConfirmDialog from '../../components/super/ConfirmDialog';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const fmtDateTime = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
const fmtNum = (n) => (n ?? 0).toLocaleString();
const classNames = (...c) => c.filter(Boolean).join(' ');

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'trial', label: 'Trial' },
  { key: 'paid', label: 'Paid' },
  { key: 'expired', label: 'Expired' },
  { key: 'suspended', label: 'Suspended' },
];

const PLAN_OPTIONS = ['', 'FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'];

const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700',
    trialing: 'bg-amber-100 text-amber-700',
    paid: 'bg-blue-100 text-blue-700',
    expired: 'bg-red-100 text-red-700',
    suspended: 'bg-gray-200 text-gray-600',
    inactive: 'bg-gray-200 text-gray-600',
    default: 'bg-gray-100 text-gray-500',
  };
  const display = status === 'trialing' ? 'Trial' : status === 'active' ? 'Active' : status === 'suspended' || status === 'inactive' ? 'Suspended' : status === 'expired' ? 'Expired' : status === 'paid' ? 'Paid' : status || '—';
  const style = styles[status] || styles.default;
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style}`}>{display}</span>;
};

const PlanBadge = ({ plan }) => {
  const colors = { FREE: 'bg-gray-100 text-gray-600', MANAGE: 'bg-amber-100 text-amber-700', BUSINESS: 'bg-indigo-100 text-indigo-700', BUSINESS_PRO: 'bg-purple-100 text-purple-700' };
  const s = plan?.toUpperCase?.() || 'FREE';
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[s] || colors.FREE}`}>{s === 'BUSINESS_PRO' ? 'PRO' : s}</span>;
};

const TenantManagement = () => {
  const isMobile = useIsMobile();
  const [tenants, setTenants] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [suspending, setSuspending] = useState(null);
  const [extendTrialTenant, setExtendTrialTenant] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
  const limit = 25;

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, search };
      if (statusFilter) params.status = statusFilter;
      if (planFilter) params.subscriptionPlan = planFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const data = await superService.getTenants(params);
      setTenants(data.tenants);
      setTotal(data.total);
    } catch {
      setError('Failed to load tenants.');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter, dateFrom, dateTo]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  const handleSuspendReactivate = async (tenant, action) => {
    setSuspending(tenant.id);
    try {
      const status = action === 'suspend' ? 'suspended' : 'active';
      await superService.updateTenantStatus(tenant.id, { status, reason: `${action === 'suspend' ? 'Suspended' : 'Reactivated'} by super admin` });
      fetchTenants();
    } catch {
      setError(`Failed to ${action} tenant.`);
    } finally {
      setSuspending(null);
    }
  };

  const handleDelete = (id, name) => {
    setConfirm({
      open: true,
      variant: 'danger',
      title: 'Delete Tenant',
      message: `Permanently delete "${name}" and ALL associated data? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirm(c => ({ ...c, loading: true }));
        try {
          await superService.deleteTenant(id);
          fetchTenants();
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        } catch {
          setError('Failed to delete tenant.');
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        }
      },
    });
  };

  const totalPages = Math.ceil(total / limit);
  const isSuspended = (t) => t.status === 'inactive' || t.subscription_status === 'suspended' || t.status === 'suspended';
  const isTrialing = (t) => !isSuspended(t) && t.latest_subscription_status === 'trialing';
  const subStatus = (t) => {
    if (isSuspended(t)) return 'suspended';
    if (isTrialing(t)) return 'trialing';
    if (t.latest_subscription_status === 'active' || t.active_subscription_count > 0) return 'active';
    if (t.latest_subscription_status === 'expired' || t.subscription_status === 'expired') return 'expired';
    return 'active';
  };

  const renderFilters = () => (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => { setStatusFilter(f.key); setPage(1); }}
            className={classNames(
              'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
              statusFilter === f.key
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            )}
          >{f.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }} className="input-field !py-1.5 !text-xs max-w-[140px]">
          <option value="">All plans</option>
          {PLAN_OPTIONS.filter(Boolean).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-field !py-1.5 !text-xs max-w-[140px]" placeholder="From" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-field !py-1.5 !text-xs max-w-[140px]" placeholder="To" />
        {(dateFrom || dateTo || planFilter) && (
          <button onClick={() => { setPlanFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }} className="text-xs text-red-600 hover:text-red-500 font-medium">Clear</button>
        )}
      </div>
    </div>
  );

  const renderTable = () => {
    if (loading) {
      return (
        <div className="divide-y divide-gray-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 px-6 py-4">
              <div className="flex-1"><div className="h-4 bg-gray-200 rounded w-1/2 mb-1" /><div className="h-3 bg-gray-100 rounded w-1/3" /></div>
              <div className="w-20"><div className="h-4 bg-gray-200 rounded" /></div>
              <div className="w-16"><div className="h-4 bg-gray-200 rounded" /></div>
              <div className="w-24"><div className="h-4 bg-gray-200 rounded" /></div>
              <div className="w-20"><div className="h-4 bg-gray-200 rounded" /></div>
              <div className="w-32"><div className="h-4 bg-gray-200 rounded" /></div>
            </div>
          ))}
        </div>
      );
    }

    if (tenants.length === 0) {
      return <div className="text-center text-gray-400 py-12 text-sm">No tenants found. Try adjusting filters.</div>;
    }

    if (isMobile) {
      return (
        <div className="divide-y divide-gray-100">
          {tenants.map(t => (
            <div key={t.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.company_name}</p>
                    <PlanBadge plan={t.subscription_plan} />
                  </div>
                  <p className="text-xs text-gray-500 truncate">{t.subdomain}</p>
                </div>
                <StatusBadge status={subStatus(t)} />
              </div>
              <div className="text-xs text-gray-500 space-y-0.5">
                <p>{t.owner_first_name ? `${t.owner_first_name} ${t.owner_last_name || ''}` : '—'}{t.owner_email ? ` · ${t.owner_email}` : ''}</p>
                <p>Created {fmtDate(t.created_at)} {t.last_activity_at ? `· Last active ${fmtDateTime(t.last_activity_at)}` : ''}</p>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                <Link to={`/super/tenants/${t.id}`} className="btn-secondary !py-1 !px-2.5 text-xs">Manage</Link>
                <button
                  onClick={() => handleSuspendReactivate(t, isSuspended(t) ? 'reactivate' : 'suspend')}
                  disabled={suspending === t.id}
                  className={`btn-secondary !py-1 !px-2.5 text-xs ${isSuspended(t) ? 'text-emerald-600' : 'text-red-600'}`}
                >{suspending === t.id ? '...' : isSuspended(t) ? 'Reactivate' : 'Suspend'}</button>
                {subStatus(t) === 'trialing' && (
                  <button onClick={() => setExtendTrialTenant(t)} className="btn-secondary !py-1 !px-2.5 text-xs !text-amber-600">Extend Trial</button>
                )}
                <button onClick={() => handleDelete(t.id, t.company_name)} className="btn-danger !py-1 !px-2.5 text-xs">Delete</button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Tenant</th>
              <th className="table-header">Owner</th>
              <th className="table-header">Plan</th>
              <th className="table-header">Status</th>
              <th className="table-header">Created</th>
              <th className="table-header">Last Active</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tenants.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                <td className="table-cell">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{t.company_name}</p>
                    <p className="text-xs text-gray-400 truncate max-w-[200px]">{t.subdomain}</p>
                  </div>
                </td>
                <td className="table-cell text-sm">
                  <div className="min-w-0 max-w-[220px]">
                    <p className="text-gray-700 truncate">{t.owner_first_name ? `${t.owner_first_name} ${t.owner_last_name || ''}` : '—'}</p>
                    <p className="text-xs text-gray-400 truncate">{t.owner_email || t.owner_phone || '—'}</p>
                  </div>
                </td>
                <td className="table-cell"><PlanBadge plan={t.subscription_plan} /></td>
                <td className="table-cell"><StatusBadge status={subStatus(t)} /></td>
                <td className="table-cell text-sm text-gray-500 whitespace-nowrap">{fmtDate(t.created_at)}</td>
                <td className="table-cell text-sm text-gray-500 whitespace-nowrap">{t.last_activity_at ? fmtDateTime(t.last_activity_at) : '—'}</td>
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Link to={`/super/tenants/${t.id}`} className="btn-secondary !py-1 !px-2.5 text-xs">Manage</Link>
                    <button
                      onClick={() => handleSuspendReactivate(t, isSuspended(t) ? 'reactivate' : 'suspend')}
                      disabled={suspending === t.id}
                      className={`btn-secondary !py-1 !px-2.5 text-xs ${isSuspended(t) ? '!text-emerald-600' : '!text-red-600'}`}
                    >{suspending === t.id ? '...' : isSuspended(t) ? 'Reactivate' : 'Suspend'}</button>
                    {subStatus(t) === 'trialing' && (
                      <button onClick={() => setExtendTrialTenant(t)} className="btn-secondary !py-1 !px-2.5 text-xs !text-amber-600">Extend Trial</button>
                    )}
                    <button onClick={() => handleDelete(t.id, t.company_name)} className="btn-danger !py-1 !px-2.5 text-xs">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Tenants</h2>
          <p className="text-sm text-gray-500 mt-0.5">{fmtNum(total)} total</p>
        </div>
        <Link to="/super/tenants?action=create" className="btn-primary text-sm">+ New Tenant</Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 space-y-3">
          <input
            type="text"
            placeholder="Search by company name, owner, email, or phone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="input-field w-full"
          />
          {renderFilters()}
        </div>

        {renderTable()}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
            <span className="text-sm text-gray-500">Page {page} of {totalPages} ({fmtNum(total)} total)</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary !py-1.5 text-sm disabled:opacity-40"
              >Previous</button>
              <span className="text-sm text-gray-400 mx-1">—</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary !py-1.5 text-sm disabled:opacity-40"
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {extendTrialTenant && (
        <ExtendTrialModal
          tenant={extendTrialTenant}
          onClose={() => setExtendTrialTenant(null)}
          onSuccess={fetchTenants}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel || 'Confirm'}
        variant={confirm.variant}
        loading={confirm.loading}
        onClose={() => setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null })}
        onConfirm={confirm.onConfirm}
      />
    </div>
  );
};

export default TenantManagement;
