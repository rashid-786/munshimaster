import { useState, useEffect } from 'react';
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

export default function FeatureOverrideModal({ tenantId, feature, existingOverride, onClose, onSuccess }) {
  const [overrideType, setOverrideType] = useState(existingOverride?.override_type || 'ENABLE_FEATURE');
  const [maxValue, setMaxValue] = useState(existingOverride?.max_value ?? (feature?.planDefault?.max_value ?? ''));
  const [isTemporary, setIsTemporary] = useState(existingOverride?.is_temporary || false);
  const [expiresAt, setExpiresAt] = useState(existingOverride?.expires_at ? existingOverride.expires_at.slice(0, 10) : '');
  const [reason, setReason] = useState(existingOverride?.reason || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!existingOverride;
  const featureKey = feature?.featureKey || feature?.feature_key;

  const needsLimit = overrideType === 'INCREASE_LIMIT' || overrideType === 'REDUCE_LIMIT';

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
