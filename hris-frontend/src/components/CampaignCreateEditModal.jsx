import { useState } from 'react';
import { superService } from '../services/super.service';

export default function CampaignCreateEditModal({ campaign, onClose, onSuccess }) {
  const isEdit = !!campaign;
  const [name, setName] = useState(campaign?.name || '');
  const [code, setCode] = useState(campaign?.code || '');
  const [description, setDescription] = useState(campaign?.description || '');
  const [discountType, setDiscountType] = useState(campaign?.discount_type || 'percentage');
  const [discountValue, setDiscountValue] = useState(campaign?.discount_value ?? campaign?.discount_pct ?? '');
  const [applicablePlanIds, setApplicablePlanIds] = useState(
    Array.isArray(campaign?.applicable_plan_ids) ? campaign.applicable_plan_ids.join(', ') : ''
  );
  const [startDate, setStartDate] = useState(campaign?.starts_at ? campaign.starts_at.slice(0, 10) : '');
  const [endDate, setEndDate] = useState(campaign?.ends_at ? campaign.ends_at.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');

    if (!name.trim()) { setError('Campaign name is required.'); return; }
    if (!startDate || !endDate) { setError('Start and end dates are required.'); return; }
    if (new Date(endDate) <= new Date(startDate)) { setError('End date must be after start date.'); return; }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        discountType,
        discountValue: discountValue ? Number(discountValue) : null,
        applicablePlanIds: applicablePlanIds ? applicablePlanIds.split(',').map(s => s.trim()).filter(Boolean) : [],
        startDate,
        endDate,
      };

      if (isEdit) {
        await superService.updateCampaign(campaign.id, payload);
      } else {
        await superService.createCampaign(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Campaign' : 'Create Campaign'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className="input-field w-full" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="input-field w-full" placeholder="e.g. SUMMER20" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
              <select value={discountType} onChange={e => setDiscountType(e.target.value)} className="input-field w-full">
                <option value="percentage">Percentage Off</option>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="free_trial">Free Trial Extension</option>
                <option value="custom">Custom Offer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value</label>
              <input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} className="input-field w-full" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Plans</label>
              <input value={applicablePlanIds} onChange={e => setApplicablePlanIds(e.target.value)} className="input-field w-full" placeholder="free, business (comma-sep)" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="input-field w-full" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field w-full" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field w-full" required />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : isEdit ? 'Update Campaign' : 'Create Campaign'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
