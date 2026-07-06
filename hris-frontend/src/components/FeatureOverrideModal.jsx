import { useState, useEffect, useMemo, useRef } from 'react';
import { superService } from '../services/super.service';

const OVERRIDE_TYPES = [
  { value: 'ENABLE_FEATURE', label: 'Enable Feature', description: 'Force-enable regardless of plan' },
  { value: 'DISABLE_FEATURE', label: 'Disable Feature', description: 'Force-disable regardless of plan' },
  { value: 'INCREASE_LIMIT', label: 'Increase Limit', description: 'Add extra quota to plan limit' },
  { value: 'REDUCE_LIMIT', label: 'Reduce Limit', description: 'Subtract from plan limit' },
  { value: 'READ_ONLY', label: 'Read Only', description: 'Allow viewing, block modifications' },
  { value: 'FULL_ACCESS', label: 'Full Access', description: 'Unrestricted access (no limits)' },
  { value: 'REVOKE_OVERRIDE', label: 'Revoke Override', description: 'Remove all overrides, revert to plan' },
];

const ALL_FEATURES = [
  { key: 'invoices', label: 'Invoices', type: 'boolean' },
  { key: 'attendance', label: 'Attendance', type: 'boolean' },
  { key: 'leaves', label: 'Leaves', type: 'boolean' },
  { key: 'payroll', label: 'Payroll', type: 'boolean' },
  { key: 'advances', label: 'Advances', type: 'boolean' },
  { key: 'replacements', label: 'Replacements', type: 'boolean' },
  { key: 'purchase_orders', label: 'Purchase Orders', type: 'boolean' },
  { key: 'credit_debit_notes', label: 'Credit/Debit Notes', type: 'boolean' },
  { key: 'inventory', label: 'Inventory', type: 'boolean' },
  { key: 'advanced_reports', label: 'Advanced Reports', type: 'boolean' },
  { key: 'multi_branch', label: 'Multi-Branch', type: 'boolean' },
  { key: 'whatsapp', label: 'WhatsApp', type: 'boolean' },
  { key: 'bank_import', label: 'Bank Import', type: 'boolean' },
  { key: 'gst_returns', label: 'GST Returns', type: 'boolean' },
  { key: 'e_invoicing', label: 'E-Invoicing', type: 'boolean' },
  { key: 'bulk_import', label: 'Bulk Import', type: 'boolean' },
  { key: 'recurring_invoices', label: 'Recurring Invoices', type: 'boolean' },
  { key: 'cash_flow', label: 'Cash Flow', type: 'boolean' },
  { key: 'balance_sheet', label: 'Balance Sheet', type: 'boolean' },
  { key: 'reports', label: 'Reports', type: 'boolean' },
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
  { key: 'kirana', label: 'Kirana Store', type: 'boolean' },
  { key: 'customers', label: 'Customers', type: 'boolean' },
  { key: 'suppliers', label: 'Suppliers', type: 'boolean' },
  { key: 'products', label: 'Products', type: 'boolean' },
  { key: 'buyers', label: 'Buyers', type: 'limit' },
  { key: 'sellers', label: 'Sellers', type: 'limit' },
  { key: 'cashbook_entries', label: 'Cashbook Entries', type: 'limit' },
  { key: 'max_customers', label: 'Max Customers', type: 'limit' },
  { key: 'max_suppliers', label: 'Max Suppliers', type: 'limit' },
  { key: 'max_staff', label: 'Staff Members', type: 'limit' },
  { key: 'max_branches', label: 'Branches', type: 'limit' },
  { key: 'max_monthly_txns', label: 'Monthly Transactions', type: 'limit' },
  { key: 'max_products', label: 'Max Products', type: 'limit' },
];

export default function FeatureOverrideModal({ tenantId, feature, featureKey: featureKeyProp, existingOverride, onClose, onSuccess }) {
  const [selectedKey, setSelectedKey] = useState(feature?.featureKey || feature?.feature_key || featureKeyProp || '');
  const [searchInput, setSearchInput] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [overrideType, setOverrideType] = useState(existingOverride?.override_type || 'ENABLE_FEATURE');
  const [maxValue, setMaxValue] = useState(existingOverride?.max_value ?? (feature?.planDefault?.max_value ?? ''));
  const [isTemporary, setIsTemporary] = useState(existingOverride?.is_temporary || false);
  const [expiresAt, setExpiresAt] = useState(existingOverride?.expires_at ? existingOverride.expires_at.slice(0, 10) : '');
  const [reason, setReason] = useState(existingOverride?.reason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  const filteredFeatures = useMemo(() => {
    if (!searchInput) return ALL_FEATURES;
    const q = searchInput.toLowerCase();
    return ALL_FEATURES.filter(f =>
      f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q)
    );
  }, [searchInput]);

  const isEditing = !!existingOverride;
  const featureKey = selectedKey;

  const needsLimit = overrideType === 'INCREASE_LIMIT' || overrideType === 'REDUCE_LIMIT';

  useEffect(() => {
    const handler = e => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!reason.trim()) { setError('Reason is required.'); return; }

    setSaving(true);
    try {
      if (isEditing) {
        await superService.updateFeatureOverride(tenantId, existingOverride.id, {
          overrideType, maxValue: needsLimit ? Number(maxValue) : null, isTemporary,
          expiresAt: isTemporary && expiresAt ? expiresAt : null, reason,
        });
      } else {
        await superService.createFeatureOverride(tenantId, {
          featureKey, overrideType, maxValue: needsLimit ? Number(maxValue) : null, isTemporary,
          expiresAt: isTemporary && expiresAt ? expiresAt : null, reason,
        });
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save override.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!existingOverride) return;
    setSaving(true);
    try {
      await superService.deleteFeatureOverride(tenantId, existingOverride.id);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to revoke override.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit' : 'Add'} Override
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {featureKey?.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}

          {/* Feature Selector (when not pre-selected) */}
          {!feature && !featureKeyProp && (
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Feature</label>
              <input
                type="text"
                value={selectedKey ? (ALL_FEATURES.find(f => f.key === selectedKey)?.label || selectedKey) : searchInput}
                onChange={e => { setSearchInput(e.target.value); setSelectedKey(''); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search features..."
                className="input-field w-full"
                required
                autoComplete="off"
              />
              {showDropdown && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredFeatures.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">No features found</div>
                  ) : filteredFeatures.map(f => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => { setSelectedKey(f.key); setSearchInput(f.label); setShowDropdown(false); }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors ${selectedKey === f.key ? 'bg-indigo-50 font-medium' : ''}`}
                    >
                      <span className="text-gray-900">{f.label}</span>
                      <span className="text-gray-400 ml-2 text-xs">({f.key})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Override Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Override Type</label>
            <select
              value={overrideType}
              onChange={e => setOverrideType(e.target.value)}
              className="input-field w-full"
              required
            >
              {OVERRIDE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label} — {t.description}</option>
              ))}
            </select>
          </div>

          {/* Max Value (for limit types) */}
          {needsLimit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {overrideType === 'INCREASE_LIMIT' ? 'Extra Quota Amount' : 'Reduce By Amount'}
              </label>
              <input
                type="number"
                value={maxValue}
                onChange={e => setMaxValue(e.target.value)}
                className="input-field w-full"
                min="1"
                required
              />
              {feature?.planDefault?.max_value != null && (
                <p className="text-xs text-gray-400 mt-1">
                  Plan base limit: {feature.planDefault.max_value === -1 ? 'Unlimited' : feature.planDefault.max_value}
                </p>
              )}
            </div>
          )}

          {/* Temporary toggle */}
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isTemporary}
                onChange={e => setIsTemporary(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
            </label>
            <span className="text-sm text-gray-700">Temporary override</span>
          </div>

          {/* Expiry (for temporary) */}
          {isTemporary && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
              <input
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
                className="input-field w-full"
                required={isTemporary}
              />
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="input-field w-full"
              rows={3}
              placeholder="Why is this override being applied?"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Required for audit trail</p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && (
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={saving}
                  className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >Revoke Override</button>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : isEditing ? 'Update Override' : 'Create Override'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
