import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import CampaignCreateEditModal from '../../components/CampaignCreateEditModal';
import ConfirmDialog from '../../components/super/ConfirmDialog';

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
const classNames = (...c) => c.filter(Boolean).join(' ');

const DISCOUNT_LABELS = { percentage: '% Off', fixed_amount: 'Fixed Amt', free_trial: 'Free Trial', custom: 'Custom' };

const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-gray-100 text-gray-500',
    expired: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.inactive}`}>{status}</span>;
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editCampaign, setEditCampaign] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [toggling, setToggling] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });

  const fetchCampaigns = async (p = page) => {
    setLoading(true);
    try {
      const params = { page: p, limit: 50 };
      if (statusFilter) params.status = statusFilter;
      const data = await superService.listCampaigns(params);
      setCampaigns(data.campaigns || []);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(1); setPage(1); }, [statusFilter]);
  useEffect(() => { fetchCampaigns(page); }, [page]);

  const handleToggle = async (c, newStatus) => {
    setToggling(c.id);
    try {
      await superService.toggleCampaignStatus(c.id, newStatus);
      fetchCampaigns();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to toggle status.');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = c => {
    setConfirm({
      open: true,
      variant: 'danger',
      title: 'Delete Campaign',
      message: `Delete campaign "${c.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirm(cnf => ({ ...cnf, loading: true }));
        try {
          await superService.deleteCampaign(c.id);
          fetchCampaigns();
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        } catch (e) {
          setError(e.response?.data?.error || 'Failed to delete.');
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        }
      },
    });
  };

  const handleEdit = c => {
    setEditCampaign(c);
    setShowModal(true);
  };

  const handleCreate = () => {
    setEditCampaign(null);
    setShowModal(true);
  };

  const isNowActive = c => c.status === 'active' && new Date(c.starts_at) <= new Date() && new Date(c.ends_at) > new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Campaigns & Promotions</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage promotional campaigns, discount codes, and offers</p>
        </div>
        <button onClick={handleCreate} className="btn-primary">+ New Campaign</button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['', 'active', 'inactive', 'expired'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={classNames('text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
              statusFilter === s ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
          >{s || 'All'}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No campaigns found. Create your first campaign!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">Name / Code</th>
                  <th className="table-header">Discount</th>
                  <th className="table-header">Plans</th>
                  <th className="table-header">Redemptions</th>
                  <th className="table-header">Period</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {campaigns.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      {c.code && <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{c.code}</span>}
                    </td>
                    <td className="table-cell text-gray-600">
                      {c.discount_type && (
                        <span>{DISCOUNT_LABELS[c.discount_type] || c.discount_type}{c.discount_value ? `: ${c.discount_value}` : ''}</span>
                      )}
                      {!c.discount_type && c.discount_pct && <span>% Off: {c.discount_pct}</span>}
                      {!c.discount_type && c.discount_months && <span>Free: {c.discount_months}mo</span>}
                    </td>
                    <td className="table-cell text-xs text-gray-500">
                      {c.applicable_plan_ids?.length ? (Array.isArray(c.applicable_plan_ids) ? c.applicable_plan_ids.join(', ') : c.applicable_plan_ids) : 'All'}
                    </td>
                    <td className="table-cell text-gray-600">{c.total_redemptions || c.redemptions || 0}</td>
                    <td className="table-cell text-gray-500 whitespace-nowrap text-xs">{fmtDate(c.starts_at)} — {fmtDate(c.ends_at)}</td>
                    <td className="table-cell"><StatusBadge status={isNowActive(c) ? 'active' : c.status || 'inactive'} /></td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => handleEdit(c)} className="btn-secondary !py-1 !px-2 text-xs">Edit</button>
                        {c.status !== 'expired' && (
                          <button onClick={() => handleToggle(c, c.status === 'active' ? 'inactive' : 'active')}
                            disabled={toggling === c.id}
                            className={`btn-secondary !py-1 !px-2 text-xs ${c.status === 'active' ? '!text-amber-600' : '!text-emerald-600'}`}
                          >{toggling === c.id ? '...' : c.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                        )}
                        <button onClick={() => handleDelete(c)} className="btn-danger !py-1 !px-2 text-xs">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40">Prev</button>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="btn-secondary !py-1 !px-3 text-xs disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      {showModal && (
        <CampaignCreateEditModal
          campaign={editCampaign}
          onClose={() => { setShowModal(false); setEditCampaign(null); }}
          onSuccess={() => { setShowModal(false); setEditCampaign(null); fetchCampaigns(); }}
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
}
