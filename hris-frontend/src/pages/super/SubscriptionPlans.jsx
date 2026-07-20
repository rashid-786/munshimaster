import { useState, useEffect, useCallback } from 'react';
import { superService } from '../../services/super.service';
import useIsMobile from '../../hooks/useIsMobile';
import ConfirmDialog from '../../components/super/ConfirmDialog';

const fmtINR = (n) => (n ?? 0) === 0 ? '₹0' : '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtNum = (n) => (n ?? 0).toLocaleString();
const classNames = (...c) => c.filter(Boolean).join(' ');

const PERIOD_LABELS = { month: 'Monthly', quarter: 'Quarterly', year: 'Yearly', custom: 'Custom', lifetime: 'Lifetime', trial: 'Trial' };
const FEATURE_TYPES = ['boolean', 'limit', 'config', 'section'];

const ALL_FEATURE_DEFS = [
  { key: 'max_customers', label: 'Customers', type: 'limit', defaultMax: 50 },
  { key: 'max_suppliers', label: 'Suppliers', type: 'limit', defaultMax: 20 },
  { key: 'max_staff', label: 'Staff Members', type: 'limit', defaultMax: 2 },
  { key: 'max_branches', label: 'Branches', type: 'limit', defaultMax: 1 },
  { key: 'max_monthly_txns', label: 'Monthly Transactions', type: 'limit', defaultMax: 500 },
  { key: 'max_products', label: 'Products', type: 'limit', defaultMax: 20 },
  { key: 'invoices', label: 'Invoices', type: 'boolean' },
  { key: 'purchase_orders', label: 'Purchase Orders', type: 'boolean' },
  { key: 'attendance', label: 'Attendance', type: 'boolean' },
  { key: 'leaves', label: 'Leaves', type: 'boolean' },
  { key: 'payroll', label: 'Payroll', type: 'boolean' },
  { key: 'advances', label: 'Advances', type: 'boolean' },
  { key: 'replacements', label: 'Replacements', type: 'boolean' },
  { key: 'inventory', label: 'Inventory', type: 'boolean' },
  { key: 'advanced_reports', label: 'Advanced Reports', type: 'boolean' },
  { key: 'multi_branch', label: 'Multi-Branch', type: 'boolean' },
  { key: 'whatsapp', label: 'WhatsApp Integration', type: 'boolean' },
  { key: 'bank_import', label: 'Bank Import', type: 'boolean' },
  { key: 'gst_returns', label: 'GST Returns', type: 'boolean' },
  { key: 'e_invoicing', label: 'E-Invoicing', type: 'boolean' },
  { key: 'bulk_import', label: 'Bulk Import', type: 'boolean' },
  { key: 'recurring_invoices', label: 'Recurring Invoices', type: 'boolean' },
  { key: 'cash_flow', label: 'Cash Flow', type: 'boolean' },
  { key: 'balance_sheet', label: 'Balance Sheet', type: 'boolean' },
  { key: 'pl_statement', label: 'P&L Statement', type: 'boolean' },
  { key: 'tally_export', label: 'Tally Export', type: 'boolean' },
  { key: 'tds_management', label: 'TDS Management', type: 'boolean' },
  { key: 'gstr2b_reco', label: 'GSTR-2B Reco', type: 'boolean' },
  { key: 'audit_logs', label: 'Audit Logs', type: 'boolean' },
  { key: 'api_access', label: 'API Access', type: 'boolean' },
  { key: 'white_label', label: 'White Label', type: 'boolean' },
  { key: 'priority_support', label: 'Priority Support', type: 'boolean' },
  { key: 'business_dashboard', label: 'Business Dashboard', type: 'boolean' },
  { key: 'expenses', label: 'Expenses', type: 'boolean' },
  { key: 'reports', label: 'Reports', type: 'boolean' },
  { key: 'cashbook_entries', label: 'Cashbook Entries', type: 'limit', defaultMax: 500 },
  { key: 'buyers', label: 'Buyers', type: 'limit', defaultMax: 20 },
  { key: 'sellers', label: 'Sellers', type: 'limit', defaultMax: 20 },
];

const StatusBadge = ({ status }) => {
  const styles = {
    active: 'bg-emerald-100 text-emerald-700',
    inactive: 'bg-gray-200 text-gray-500',
    deprecated: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.inactive}`}>{status || 'inactive'}</span>;
};

// ─── Plan Card ────────────────────────────────────────
const PlanCard = ({ plan, onEdit, onFeatures, onDeactivate, onDelete }) => {
  const status = plan.is_active === false ? 'inactive' : 'active';
  const periodLabel = PERIOD_LABELS[plan.period] || plan.period || '';
  return (
    <div className={classNames(
      'bg-white rounded-xl border shadow-sm p-5 hover:shadow-md transition-shadow',
      status === 'active' ? 'border-gray-200' : 'border-gray-200 opacity-85'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{plan.name || plan.id}</h3>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{plan.id}</p>
          {plan.description && <p className="text-xs text-gray-500 mt-1 max-w-[200px]">{plan.description}</p>}
        </div>
        <StatusBadge status={status} />
      </div>

      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-2xl font-bold text-gray-900">{fmtINR(plan.price_inr)}</span>
        {periodLabel && <span className="text-sm text-gray-400">/{periodLabel.toLowerCase()}</span>}
      </div>

      {plan.trial_days > 0 && <p className="text-xs text-amber-600 mb-3">{plan.trial_days}-day trial</p>}

      <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
        <span>{plan.feature_count || 0} features</span>
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        <span>{plan.active_subscribers || 0} subscribers</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => onEdit(plan)} className="btn-secondary !py-1.5 !px-3 text-xs">Edit</button>
        <button onClick={() => onFeatures(plan)} className="btn-secondary !py-1.5 !px-3 text-xs">Features</button>
        {status === 'active' && (
          <button onClick={() => onDeactivate(plan)} className="btn-secondary !py-1.5 !px-3 text-xs !text-red-600">Deactivate</button>
        )}
        {status === 'inactive' && (
          <button onClick={() => onDelete(plan)} className="btn-secondary !py-1.5 !px-3 text-xs !text-red-600">Delete</button>
        )}
      </div>
    </div>
  );
};

// ─── Plan Edit Modal ──────────────────────────────────
const PlanFormModal = ({ plan, onClose, onSave }) => {
  const isEdit = !!plan;
  const [form, setForm] = useState({
    name: plan?.name || '',
    code: plan?.id || '',
    description: plan?.description || '',
    price: plan?.price_inr || 0,
    currency: plan?.currency || 'INR',
    period: plan?.period || 'year',
    trialDays: plan?.trial_days || 0,
    isActive: plan?.is_active !== undefined ? plan.is_active : true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setErr('Name is required.');
    if (!isEdit && !form.code.trim()) return setErr('Code is required.');
    setSaving(true);
    setErr('');
    try {
      const payload = { ...form };
      if (isEdit) delete payload.code;
      await onSave(payload, isEdit);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 bg-black/30 animate-fade-in" >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Plan' : 'Create New Plan'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{err}</div>}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Plan Name</label>
              <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required className="input-field" placeholder="Business Pro" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Code {isEdit && <span className="text-gray-400">(read-only)</span>}</label>
              <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                disabled={isEdit} required={!isEdit}
                className="input-field disabled:bg-gray-100 disabled:text-gray-400" placeholder="business_pro" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} className="input-field" placeholder="Optional plan description" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Price (₹)</label>
              <input type="number" min="0" step="1" value={form.price} onChange={e => setForm(p => ({ ...p, price: Number(e.target.value) }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
              <select value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))} className="input-field">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Billing Cycle</label>
              <select value={form.period} onChange={e => setForm(p => ({ ...p, period: e.target.value }))} className="input-field">
                {Object.entries(PERIOD_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Trial Days</label>
              <input type="number" min="0" value={form.trialDays} onChange={e => setForm(p => ({ ...p, trialDays: Number(e.target.value) }))} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select value={form.isActive ? 'active' : 'inactive'} onChange={e => setForm(p => ({ ...p, isActive: e.target.value === 'active' }))} className="input-field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : isEdit ? 'Update Plan' : 'Create Plan'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Feature Management Modal ─────────────────────────
const FeaturesModal = ({ plan, onClose, onSave }) => {
  const isEdit = !!plan;
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await superService.getPlanFeatures(plan.id);
        const existing = data.features || [];
        // Merge with ALL_FEATURE_DEFS to show all possible features
        const merged = ALL_FEATURE_DEFS.map(def => {
          const found = existing.find(f => f.feature_key === def.key);
          return {
            feature_key: def.key,
            feature_type: def.type,
            label: def.label,
            enabled: found ? found.enabled : def.type === 'boolean' ? false : true,
            max_value: found ? found.max_value : (def.type === 'limit' ? def.defaultMax : null),
            config: found?.config || null,
          };
        });
        // Also add any extra features from DB not in ALL_FEATURE_DEFS
        existing.forEach(f => {
          if (!merged.find(m => m.feature_key === f.feature_key)) {
            merged.push({
              feature_key: f.feature_key,
              feature_type: f.feature_type || 'boolean',
              label: f.feature_key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              enabled: f.enabled,
              max_value: f.max_value,
              config: f.config,
            });
          }
        });
        setFeatures(merged);
      } catch {
        setErr('Failed to load features.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [plan.id]);

  const toggleFeature = (key) => {
    setFeatures(f => f.map(f => f.feature_key === key ? { ...f, enabled: !f.enabled } : f));
  };

  const setLimit = (key, val) => {
    setFeatures(f => f.map(f => f.feature_key === key ? { ...f, max_value: val === '' ? null : Number(val) } : f));
  };

  const handleSave = async () => {
    setSaving(true);
    setErr('');
    try {
      const payload = features.map(f => ({
        featureKey: f.feature_key,
        featureType: f.feature_type,
        enabled: f.enabled,
        maxValue: f.max_value,
      }));
      await onSave(plan.id, payload);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || 'Failed to save features.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 bg-black/30" >
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-12" onClick={e => e.stopPropagation()}>
          <div className="flex justify-center"><div className="animate-spin h-6 w-6 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>
        </div>
      </div>
    );
  }

  const grouped = {};
  features.forEach(f => {
    const type = f.feature_type || 'boolean';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(f);
  });

  const typeLabels = { boolean: 'Toggle Features', limit: 'Numeric Limits', config: 'Configuration', section: 'Section Access' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 pb-8 bg-black/30 animate-fade-in overflow-y-auto" >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 my-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{plan.name || plan.id} — Features</h3>
            <p className="text-xs text-gray-400">{features.filter(f => f.enabled).length} of {features.length} enabled</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-6 max-h-[65vh] overflow-y-auto">
          {err && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{err}</div>}

          {Object.entries(grouped).map(([type, feats]) => (
            <div key={type}>
              <h4 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">{typeLabels[type] || type}</h4>
              <div className="space-y-2">
                {feats.map(f => (
                  <div key={f.feature_key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => toggleFeature(f.feature_key)}
                        className={classNames(
                          'relative w-9 h-5 rounded-full transition-colors shrink-0',
                          f.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                        )}
                      >
                        <span className={classNames(
                          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                          f.enabled ? 'translate-x-4' : 'translate-x-0'
                        )} />
                      </button>
                      <div className="min-w-0">
                        <p className={classNames('text-sm truncate', f.enabled ? 'text-gray-900 font-medium' : 'text-gray-400')}>{f.label}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{f.feature_key}</p>
                      </div>
                    </div>
                    {f.feature_type === 'limit' && (
                      <div className="shrink-0 ml-3">
                        <input
                          type="number"
                          value={f.max_value ?? ''}
                          onChange={e => setLimit(f.feature_key, e.target.value)}
                          disabled={!f.enabled}
                          className="w-20 text-xs py-1 px-2 border border-gray-200 rounded text-right disabled:bg-gray-100 disabled:text-gray-400"
                          placeholder="Unlimited"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400">Changes take effect immediately for new assignments</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save Features'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════
const SubscriptionPlans = () => {
  const isMobile = useIsMobile();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [editPlan, setEditPlan] = useState(null);
  const [featurePlan, setFeaturePlan] = useState(null);
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superService.listPlans();
      setPlans(data.plans || []);
    } catch {
      setError('Failed to load plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const handleCreate = async (data) => {
    await superService.createPlan(data);
    fetchPlans();
  };

  const handleUpdate = async (data) => {
    await superService.updatePlan(editPlan.id, data);
    fetchPlans();
    setEditPlan(null);
  };

  const handleDeactivate = (plan) => {
    setConfirm({
      open: true,
      variant: 'warning',
      title: 'Deactivate Plan',
      message: `Deactivate "${plan.name || plan.id}"? Existing subscribers will retain access but no new assignments can use this plan.`,
      onConfirm: async () => {
        setConfirm(c => ({ ...c, loading: true }));
        try {
          await superService.deactivatePlan(plan.id);
          fetchPlans();
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        } catch (e) {
          setError(e.response?.data?.error || 'Failed to deactivate plan.');
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        }
      },
    });
  };

  const handleSaveFeatures = async (planId, features) => {
    await superService.bulkUpdatePlanFeatures(planId, features);
    fetchPlans();
  };

  const handleDelete = (plan) => {
    setConfirm({
      open: true,
      variant: 'danger',
      title: 'Delete Plan',
      message: `Delete "${plan.name || plan.id}" permanently? This cannot be undone. Only plans with no active subscribers or tenant assignments can be deleted.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirm(c => ({ ...c, loading: true }));
        try {
          await superService.deletePlan(plan.id);
          fetchPlans();
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        } catch (e) {
          setError(e.response?.data?.error || 'Failed to delete plan.');
          setConfirm({ open: false, title: '', message: '', variant: 'danger', onConfirm: null });
        }
      },
    });
  };

  // Filters
  const filteredPlans = [...plans].filter(p => {
    if (statusFilter === 'active' && p.is_active === false) return false;
    if (statusFilter === 'inactive' && p.is_active !== false) return false;
    if (periodFilter !== 'all' && p.period !== periodFilter) return false;
    return true;
  });

  // Sort: active first, then by price
  const sortedPlans = filteredPlans.sort((a, b) => {
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    return (a.price_inr || 0) - (b.price_inr || 0);
  });

  const PERIOD_OPTIONS = [...new Set(plans.map(p => p.period).filter(Boolean))];

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-bold">&times;</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Subscription Plans</h2>
          <p className="text-sm text-gray-500 mt-0.5">{plans.length} plans · {plans.filter(p => p.is_active !== false).length} active</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">+ Create Plan</button>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field !w-auto !py-1.5 text-sm">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="input-field !w-auto !py-1.5 text-sm">
          <option value="all">All Types</option>
          {PERIOD_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{PERIOD_LABELS[opt] || opt}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-8 bg-gray-100 rounded w-1/2 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-full" />
            </div>
          ))}
        </div>
      ) : sortedPlans.length === 0 ? (
        <div className="text-center text-gray-400 py-16 text-sm">
          No plans yet. Create your first subscription plan.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedPlans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onEdit={p => setEditPlan(p)}
              onFeatures={p => setFeaturePlan(p)}
              onDeactivate={handleDeactivate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <PlanFormModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
        />
      )}

      {/* Edit Modal */}
      {editPlan && (
        <PlanFormModal
          plan={editPlan}
          onClose={() => setEditPlan(null)}
          onSave={handleUpdate}
        />
      )}

      {/* Features Modal */}
      {featurePlan && (
        <FeaturesModal
          plan={featurePlan}
          onClose={() => setFeaturePlan(null)}
          onSave={handleSaveFeatures}
        />
      )}

      {/* Confirm Dialog */}
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

export default SubscriptionPlans;
