import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { subscriptionService } from '../../services/subscription.service';
import UpgradeModal from '../../components/UpgradeModal';
import DowngradeModal from '../../components/DowngradeModal';
import {
  PLANS, resolvePlan, getRank, getPlan,
  PLAN_LABELS, PLAN_COLORS, FEATURE_LABELS, LIMIT_LABELS,
} from '../../config/subscriptionPlans';

const PLAN_ORDER = ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'];

const COMPARISON_FEATURES = [
  'entities', 'staff_directory', 'attendance', 'leaves',
  'purchase_orders', 'inventory', 'balance_sheet', 'advanced_reports',
  'payroll', 'advances', 'replacements',
  'recurring_invoices', 'credit_debit_notes', 'pl_statement', 'cash_flow',
  'bank_import', 'gst_returns', 'e_invoicing', 'bulk_import',
  'tally_export', 'tds_management', 'gstr2b_reco', 'audit_logs',
  'multi_branch', 'whatsapp', 'api_access', 'white_label',
  'priority_support',
];

const COMPARISON_LIMITS = [
  'customers', 'suppliers', 'staff_members', 'branches',
  'monthly_transactions', 'products',
];

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatLimit(val) {
  if (val === -1) return 'Unlimited';
  return val.toLocaleString();
}

export default function SubscriptionSettings() {
  const { tenant, refreshTenant } = useAuth();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState(null);

  const rawPlan = tenant?.subscriptionPlan || 'free';
  const currentPlan = resolvePlan(rawPlan);
  const currentPlanDef = getPlan(currentPlan);
  const currentRank = getRank(currentPlan);

  useEffect(() => {
    subscriptionService.getCurrent()
      .then(sub => setSubscription(sub))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = (planId) => {
    const rank = getRank(planId);
    if (rank > currentRank) {
      if (planId === 'MANAGE') {
        setUpgradeTarget({ plan: 'manage', label: PLAN_LABELS.MANAGE });
      } else if (planId === 'BUSINESS') {
        setUpgradeTarget({ plan: 'business', label: PLAN_LABELS.BUSINESS });
      } else {
        setUpgradeTarget({ plan: 'pro', label: PLAN_LABELS.BUSINESS_PRO });
      }
      setShowUpgrade(true);
    }
  };

  const handleDowngrade = () => {
    if (currentRank >= 2) {
      setShowDowngrade(true);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="w-6 h-6 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const isTrialing = subscription?.status === 'trialing';
  const expiryDate = isTrialing ? subscription?.trialEndsAt : subscription?.validUntil;

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">

      {/* ── Current Plan Banner ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900">
                  {PLAN_LABELS[currentPlan] || currentPlan}
                </h2>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isTrialing ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                  {isTrialing ? 'Trial' : 'Active'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {expiryDate ? (
                  isTrialing
                    ? <>Trial ends <span className="font-medium text-gray-700">{formatDate(expiryDate)}</span></>
                    : <>Valid until <span className="font-medium text-gray-700">{formatDate(expiryDate)}</span></>
                ) : 'No expiry'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentRank >= 2 && (
              <button
                onClick={handleDowngrade}
                className="py-2 px-4 text-sm font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
              >
                Cancel Plan
              </button>
            )}
            {currentRank < 3 && (
              <button
                onClick={() => handleUpgrade('BUSINESS_PRO')}
                className="py-2 px-4 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                Upgrade
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── All Plans ── */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Available Plans</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = planId === currentPlan;
            const rank = getRank(planId);
            const canUpgrade = rank > currentRank;
            const canDowngrade = rank < currentRank;

            return (
              <div
                key={planId}
                className={`relative bg-white rounded-xl border-2 p-5 flex flex-col ${
                  isCurrent ? 'border-indigo-400' : 'border-gray-200'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                    Current
                  </span>
                )}
                <div className="mb-4">
                  <h4 className="text-base font-bold text-gray-900">{plan.name}</h4>
                  <div className="mt-1">
                    <span className="text-2xl font-bold text-gray-900">₹{plan.metadata.priceMonthly}</span>
                    <span className="text-sm text-gray-500">/mo</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">₹{plan.metadata.priceYearly}/year</p>
                </div>

                <p className="text-xs text-gray-500 mb-4 flex-1">{plan.metadata.description}</p>

                <ul className="space-y-1.5 mb-5">
                  {planId === 'FREE' && (
                    <>
                      <li className="flex items-center gap-2 text-xs text-gray-600">
                        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Manage Buyers
                      </li>
                      <li className="flex items-center gap-2 text-xs text-gray-600">
                        <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        Manage Sellers
                      </li>
                    </>
                  )}
                  {planId !== 'FREE' && (
                    <li className="flex items-center gap-2 text-xs font-medium text-gray-700">
                      <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      Everything in {PLAN_LABELS[PLAN_ORDER[PLAN_ORDER.indexOf(planId) - 1]]} Plan
                    </li>
                  )}
                  {[
                    { label: 'Staff Members', limitKey: 'staff_members' },
                    { label: 'Monthly Transactions', limitKey: 'monthly_transactions' },
                    { label: 'Branches', limitKey: 'branches' },
                    { label: 'Products', limitKey: 'products' },
                  ].filter(({ limitKey }) => plan.limits[limitKey] !== 0).map(({ label, limitKey }) => (
                    <li key={limitKey} className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {formatLimit(plan.limits[limitKey])} {label}
                    </li>
                  ))}
                </ul>

                {canUpgrade && (
                  <button
                    onClick={() => handleUpgrade(planId)}
                    className="w-full py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    Upgrade to {plan.name}
                  </button>
                )}
                {canDowngrade && !isCurrent && (
                  <button
                    onClick={handleDowngrade}
                    className="w-full py-2 text-sm font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                  >
                    Downgrade
                  </button>
                )}
                {isCurrent && (
                  <div className="w-full py-2 text-sm font-medium text-gray-400 bg-gray-50 rounded-lg text-center">
                    Current Plan
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Feature Comparison Table ── */}
      <div>
        <h3 className="text-base font-semibold text-gray-900 mb-3">Feature Comparison</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700 min-w-[180px]">Feature</th>
                {PLAN_ORDER.map((planId) => (
                  <th key={planId} className={`px-4 py-3 font-semibold text-center min-w-[100px] ${
                    planId === currentPlan ? 'text-indigo-600 bg-indigo-50/50' : 'text-gray-600'
                  }`}>
                    {PLAN_LABELS[planId]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {COMPARISON_FEATURES.map((feat) => (
                <tr key={feat} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2.5 text-gray-700">{FEATURE_LABELS[feat] || feat}</td>
                  {PLAN_ORDER.map((planId) => {
                    const plan = PLANS[planId];
                    const enabled = plan.features[feat] === true;
                    return (
                      <td key={planId} className={`px-4 py-2.5 text-center ${
                        planId === currentPlan ? 'bg-indigo-50/30' : ''
                      }`}>
                        {enabled ? (
                          <svg className="w-4 h-4 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 mx-auto text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3 font-semibold text-gray-700">Limits</td>
                {PLAN_ORDER.map((planId) => (
                  <td key={planId} className={`px-4 py-3 text-center text-xs text-gray-500 ${
                    planId === currentPlan ? 'bg-indigo-50/50' : ''
                  }`} />
                ))}
              </tr>
              {COMPARISON_LIMITS.map((limitKey) => (
                <tr key={limitKey} className="hover:bg-gray-50/50">
                  <td className="px-4 py-2 text-gray-600">{LIMIT_LABELS[limitKey] || limitKey}</td>
                  {PLAN_ORDER.map((planId) => {
                    const plan = PLANS[planId];
                    const val = plan.limits[limitKey];
                    return (
                      <td key={planId} className={`px-4 py-2 text-center text-sm ${
                        planId === currentPlan ? 'bg-indigo-50/30' : ''
                      } ${val === -1 ? 'text-green-600 font-medium' : 'text-gray-700'}`}>
                        {formatLimit(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Payment History Link ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Payment History</p>
          <p className="text-xs text-gray-500 mt-0.5">View past invoices and download receipts</p>
        </div>
        <button
          onClick={() => navigate('/admin/payments')}
          className="py-2 px-4 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg transition-colors"
        >
          View Payments
        </button>
      </div>

      {/* ── Modals ── */}
      <UpgradeModal
        open={showUpgrade}
        onClose={() => { setShowUpgrade(false); setUpgradeTarget(null); }}
        feature={upgradeTarget?.label}
        requiredPlan={upgradeTarget?.plan || 'business'}
      />
      <DowngradeModal
        open={showDowngrade}
        onClose={() => setShowDowngrade(false)}
        onDowngraded={() => { refreshTenant(); setShowDowngrade(false); }}
      />
    </div>
  );
}
