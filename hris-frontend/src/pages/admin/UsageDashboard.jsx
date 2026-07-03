import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscriptionService } from '../../services/subscription.service';
import UsageCard from '../../components/UsageCard';
import UpgradeModal from '../../components/UpgradeModal';
import { resolvePlan, getRank, PLAN_LABELS, PLAN_COLORS } from '../../config/subscriptionPlans';

const USAGE_LABELS = {
  transactions: 'Transactions',
  cashbook_entries: 'Cashbook Entries',
  staff_count: 'Staff',
  entities: 'Entities',
};

const USAGE_ICONS = {
  transactions: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
  ),
  cashbook_entries: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
  ),
  staff_count: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
  ),
  entities: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
  ),
};

const NEXT_PLAN_MAP = {
  FREE: 'MANAGE',
  MANAGE: 'BUSINESS',
  BUSINESS: 'BUSINESS_PRO',
};

export default function UsageDashboard() {
  const { tenant } = useAuth();
  const [usageData, setUsageData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const rawPlan = tenant?.subscriptionPlan || 'free';
  const currentPlan = resolvePlan(rawPlan);
  const planRank = getRank(currentPlan);
  const nextPlan = NEXT_PLAN_MAP[currentPlan];
  const isMaxPlan = !nextPlan || planRank >= 3;

  useEffect(() => {
    subscriptionService.getUsage()
      .then(data => setUsageData(data.usage || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getRequiredPlan = (key) => {
    if (key === 'entities') return 'FREE';
    if (key === 'staff_count') return 'MANAGE';
    return 'BUSINESS';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="w-6 h-6 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Subscription Usage</h2>
          <p className="text-sm text-gray-500 mt-0.5">Monthly usage across your account</p>
        </div>
        <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${PLAN_COLORS[currentPlan] || 'bg-gray-100 text-gray-600'}`}>
          {PLAN_LABELS[currentPlan] || currentPlan} Plan
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {usageData.filter(item => !(item.key === 'staff_count' && planRank === 0)).map((item) => (
          <UsageCard
            key={item.key}
            label={USAGE_LABELS[item.key] || item.key}
            icon={USAGE_ICONS[item.key]}
            current={item.current}
            limit={item.limit}
            requiredPlan={getRequiredPlan(item.key)}
          />
        ))}
      </div>

      {!isMaxPlan && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-5 text-center">
          <p className="text-sm font-medium text-gray-700 mb-1">
            Need more capacity?
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Upgrade to <span className="font-semibold text-gray-700">{PLAN_LABELS[nextPlan]}</span> for higher limits.
          </p>
          <button
            onClick={() => setShowUpgrade(true)}
            className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Upgrade Plan
          </button>
        </div>
      )}

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
    </div>
  );
}
