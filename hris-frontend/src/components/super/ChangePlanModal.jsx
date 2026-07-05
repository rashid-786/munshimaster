import { useState, useEffect } from 'react';

export default function ChangePlanModal({ open, onClose, tenant, plans, onConfirm, loading }) {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) { setSelectedPlan(''); setReason(''); }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">Change Plan — {tenant?.company_name || ''}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Plan</label>
            <p className="text-sm font-medium text-gray-900 mt-1 capitalize">{(tenant?.subscription_plan || 'N/A').replace(/_/g, ' ')}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">New Plan</label>
            <select value={selectedPlan} onChange={e => setSelectedPlan(e.target.value)}
              className="w-full mt-1.5 text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all">
              <option value="">Select a plan...</option>
              {(plans || []).map(p => (
                <option key={p.id} value={p.plan_id || p.id}>{p.name} — ₹{Number(p.price_inr || 0).toLocaleString('en-IN')}/{p.period || 'year'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why are you changing this tenant's plan?"
              className="w-full mt-1.5 text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all resize-none" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-white transition-all">Cancel</button>
          <button onClick={() => onConfirm({ planId: selectedPlan, reason })} disabled={!selectedPlan || loading}
            className="text-sm px-5 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium">
            {loading ? 'Changing...' : 'Change Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}
