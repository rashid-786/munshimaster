import { useState } from 'react';
import UpgradeModal from './UpgradeModal';

export default function UpgradeBanner({ type = 'limit', feature, usage, limit, plan = 'BUSINESS' }) {
  const [showModal, setShowModal] = useState(false);

  if (type === 'limit' && limit > 0) {
    const pct = Math.round((usage / limit) * 100);
    if (pct < 80) return null;
    const remaining = limit - usage;
    return (
      <>
        <div className={`flex items-center justify-between p-3 rounded-xl text-sm ${
          pct >= 100 ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-amber-50 border border-amber-200 text-amber-700'
        }`}>
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <span>
              {remaining > 0
                ? `${remaining} ${feature} ${remaining === 1 ? 'slot' : 'slots'} remaining (${usage}/${limit} used).`
                : `You've reached the ${feature} limit (${usage}/${limit}).`}
            </span>
          </div>
          <button onClick={() => setShowModal(true)} className="shrink-0 ml-3 font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap">
            Upgrade for unlimited
          </button>
        </div>
        {showModal && (
          <UpgradeModal open={showModal} onClose={() => setShowModal(false)} feature={feature} requiredPlan={plan} />
        )}
      </>
    );
  }

  if (type === 'feature') {
    return (
      <>
        <div className="flex items-center justify-between p-3 rounded-xl text-sm bg-indigo-50 border border-indigo-200 text-indigo-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span><strong>{feature}</strong> is available on a higher plan.</span>
          </div>
          <button onClick={() => setShowModal(true)} className="shrink-0 ml-3 font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap">
            Upgrade now
          </button>
        </div>
        {showModal && (
          <UpgradeModal open={showModal} onClose={() => setShowModal(false)} feature={feature} requiredPlan={plan} />
        )}
      </>
    );
  }

  return null;
}
