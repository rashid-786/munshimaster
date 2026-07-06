import { useState, useEffect } from 'react';
import { subscriptionService } from '../services/subscription.service';
import Loading from './Loading';

export default function DowngradeModal({ open, onClose, onDowngraded, targetPlan = 'free' }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError('');
      setConfirming(false);
      subscriptionService.getDowngradePreview(targetPlan !== 'free' ? targetPlan : undefined)
        .then(setPreview)
        .catch(err => setError(err.response?.data?.error || 'Failed to load preview'))
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleDowngrade = async () => {
    setConfirming(true);
    setError('');
    try {
      await subscriptionService.changePlan(targetPlan);
      onDowngraded?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to downgrade');
      setConfirming(false);
    }
  };

  const targetName = targetPlan === 'free' ? 'Free' : targetPlan === 'manage' ? 'Manage' : targetPlan === 'business' ? 'Business' : 'Business Pro';

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-900">Downgrade to {targetName}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="flex justify-center py-8"><Loading /></div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {preview && !loading && (
            <>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                <p className="font-medium">Current Plan: <strong>{preview.currentPlanName || preview.currentPlan}</strong></p>
                <p className="mt-1">Downgrading to <strong>{targetName}</strong> will limit access to these features:</p>
              </div>

              {preview.warnings?.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-1">
                  {preview.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              {preview.willLose?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">You will lose access to:</p>
                  <ul className="space-y-1">
                    {preview.willLose.map((label, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-red-600">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {preview.willKeep?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">You will keep:</p>
                  <ul className="space-y-1">
                    {preview.willKeep.map((label, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                Your data will not be deleted. If you upgrade again in the future, everything will be restored.
              </div>
            </>
          )}
        </div>

        {preview && !loading && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-white transition-all">
              Maybe Later
            </button>
            <button
              onClick={handleDowngrade}
              disabled={confirming}
              className="text-sm px-5 py-2 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium bg-red-600 hover:bg-red-700"
            >
              {confirming ? 'Downgrading...' : `Downgrade to ${targetName}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
