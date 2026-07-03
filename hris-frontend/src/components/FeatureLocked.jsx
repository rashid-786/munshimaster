import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import UpgradeModal from './UpgradeModal';
import { resolvePlan, getRank, PLAN_LABELS, PLAN_COLORS } from '../config/subscriptionPlans';

export default function FeatureLocked({ featureName, requiredPlan }) {
  const { tenant } = useAuth();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const rawPlan = tenant?.subscriptionPlan || 'free';
  const currentPlan = resolvePlan(rawPlan);
  const required = resolvePlan(requiredPlan);
  const canUpgrade = getRank(required) > getRank(currentPlan);

  return (
    <>
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-gray-900 mb-2">Feature Locked</h2>
          <p className="text-sm text-gray-500 mb-6">
            {featureName ? (
              <>Upgrade your plan to access <span className="font-semibold text-gray-700">{featureName}</span>.</>
            ) : (
              <>This feature is not available on your current plan.</>
            )}
          </p>

          <div className="bg-gray-50 rounded-xl p-5 mb-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Current plan</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[currentPlan] || 'bg-gray-100 text-gray-600'}`}>
                {PLAN_LABELS[currentPlan] || currentPlan}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Required plan</span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[required] || 'bg-indigo-100 text-indigo-700'}`}>
                {PLAN_LABELS[required] || required}
              </span>
            </div>
          </div>

          {canUpgrade && (
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Upgrade to {PLAN_LABELS[required] || required}
            </button>
          )}
        </div>
      </div>

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature={featureName}
        requiredPlan={requiredPlan}
      />
    </>
  );
}
