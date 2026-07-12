import { useState } from 'react';
import { superService } from '../services/super.service';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

const EXTENSION_OPTIONS = [
  { value: '7', label: '7 days', days: 7 },
  { value: '15', label: '15 days', days: 15 },
  { value: '30', label: '30 days', days: 30 },
  { value: '60', label: '60 days', days: 60 },
  { value: 'custom_days', label: 'Custom days', days: null },
  { value: 'custom_date', label: 'Custom end date', days: null },
];

const REASON_OPTIONS = [
  { value: 'sales_follow_up', label: 'Sales Follow-up' },
  { value: 'customer_request', label: 'Customer Request' },
  { value: 'promotional_offer', label: 'Promotional Offer' },
  { value: 'internal_testing', label: 'Internal Testing' },
  { value: 'payment_delay', label: 'Payment Delay' },
  { value: 'other', label: 'Other' },
];

const ExtendTrialModal = ({ tenant, onClose, onSuccess }) => {
  const [extensionType, setExtensionType] = useState('7');
  const [extensionDays, setExtensionDays] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isCustomDays = extensionType === 'custom_days';
  const isCustomDate = extensionType === 'custom_date';

  // Compute new trial end date for display
  const getPreviewEndDate = () => {
    if (isCustomDate && customDate) return new Date(customDate);
    const opt = EXTENSION_OPTIONS.find(o => o.value === extensionType);
    if (!opt || (!opt.days && !isCustomDays)) return null;
    const days = isCustomDays ? Number(extensionDays) : opt.days;
    if (!days || days <= 0) return null;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };
  const previewDate = getPreviewEndDate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalReason = reason === 'other' ? otherReason : reason;
    if (!finalReason) return setError('Please select or enter a reason.');
    if (isCustomDays && (!extensionDays || Number(extensionDays) <= 0)) return setError('Please enter a valid number of days.');
    if (isCustomDate && !customDate) return setError('Please select a custom end date.');
    if (isCustomDate && new Date(customDate) <= new Date()) return setError('Custom end date must be in the future.');

    setSaving(true);
    setError('');
    try {
      const payload = { reason: finalReason };
      if (isCustomDate) {
        payload.customTrialEndDate = customDate;
        payload.extensionType = 'custom_date';
      } else if (isCustomDays) {
        payload.extensionType = 'custom_days';
        payload.extensionDays = Number(extensionDays);
      } else {
        payload.extensionType = extensionType;
      }
      await superService.extendTrial(tenant.id, payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to extend trial.');
    } finally {
      setSaving(false);
    }
  };

  const currentTrialEnd = tenant.trial_ends_at;
  const isTrialing = tenant.sub_status === 'trialing' || tenant.subscription_status === 'trialing';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 pb-8 bg-black/30 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Extend Trial</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <p className="text-sm text-gray-500 mt-1">{tenant.company_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          {/* Current Status */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Current Plan</span>
              <span className="font-medium text-gray-900">{(tenant.subscription_plan || 'FREE').toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-medium ${isTrialing ? 'text-amber-600' : 'text-gray-900'}`}>{isTrialing ? 'Trialing' : tenant.subscription_status || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trial Start</span>
              <span className="text-gray-900">{tenant.trial_started_at ? fmtDate(tenant.trial_started_at) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Trial Ends</span>
              <span className={currentTrialEnd && new Date(currentTrialEnd) < new Date() ? 'text-red-600 font-medium' : 'text-gray-900'}>{currentTrialEnd ? fmtDate(currentTrialEnd) : '-'}</span>
            </div>
          </div>

          {/* Extension Options */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Extension Period</label>
            <div className="flex flex-wrap gap-2">
              {EXTENSION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setExtensionType(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    extensionType === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            {isCustomDays && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Number of days</label>
                <input
                  type="number"
                  min="1"
                  value={extensionDays}
                  onChange={e => setExtensionDays(e.target.value)}
                  className="input-field max-w-[160px]"
                  placeholder="e.g. 45"
                  autoFocus
                />
              </div>
            )}
            {isCustomDate && (
              <div className="mt-3">
                <label className="block text-xs font-medium text-gray-700 mb-1">Custom end date</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={e => setCustomDate(e.target.value)}
                  className="input-field max-w-[200px]"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            )}
          </div>

          {/* Preview */}
          {previewDate && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm">
              <span className="text-indigo-700 font-medium">New trial end date: </span>
              <span className="text-indigo-900 font-semibold">{previewDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Reason <span className="text-red-500">*</span></label>
            <div className="flex flex-wrap gap-2 mb-3">
              {REASON_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setReason(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    reason === opt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            {reason === 'other' && (
              <input
                type="text"
                value={otherReason}
                onChange={e => setOtherReason(e.target.value)}
                className="input-field"
                placeholder="Describe the reason..."
                autoFocus
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
            <button
              type="submit"
              disabled={saving || !reason}
              className="btn-primary text-sm disabled:opacity-50"
            >{saving ? 'Extending...' : 'Extend Trial'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtendTrialModal;
