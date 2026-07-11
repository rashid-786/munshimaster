import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGlobalConfig } from '../../context/GlobalConfigContext';
import { subscriptionService } from '../../services/subscription.service';
import UpgradeModal from '../../components/UpgradeModal';
import DowngradeModal from '../../components/DowngradeModal';
import {
  PLANS, resolvePlan, getRank, getPlan,
  PLAN_LABELS, PLAN_COLORS, FEATURE_LABELS, LIMIT_LABELS,
} from '../../config/subscriptionPlans';

const PLAN_ORDER = ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'];

const DB_LIMIT_MAP = {
  max_monthly_txns: 'max_monthly_txns',
  max_customers: 'max_customers',
  max_staff: 'max_staff',
  max_branches: 'max_branches',
  max_products: 'max_products',
  max_suppliers: 'max_suppliers',
  buyers: 'buyers',
  sellers: 'sellers',
  cashbook_entries: 'cashbook_entries',
};

const COMPARISON_FEATURES = [
  'kirana', 'reports_basic', 'entities', 'staff_directory', 'attendance', 'leaves',
  'purchase_orders', 'inventory', 'balance_sheet', 'advanced_reports',
  'payroll', 'advances', 'replacements', 'expenses',
  'recurring_invoices', 'credit_debit_notes', 'pl_statement', 'cash_flow',
  'bank_import', 'gst_returns', 'e_invoicing', 'bulk_import',
  'tally_export', 'tds_management', 'gstr2b_reco', 'audit_logs',
  'multi_branch', 'whatsapp', 'api_access', 'white_label',
  'priority_support',
];

const COMPARISON_LIMITS = [
  'max_customers', 'max_suppliers', 'max_staff', 'max_branches',
  'max_monthly_txns', 'max_products',
  'buyers', 'sellers', 'cashbook_entries',
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
  const { globalConfig } = useGlobalConfig();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePlans, setActivePlans] = useState(null);
  const [plansApi, setPlansApi] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState('free');
  const [upgradeTarget, setUpgradeTarget] = useState(null);

  const refreshSubscription = () => {
    subscriptionService.getCurrent()
      .then(sub => setSubscription(sub))
      .catch(() => {});
  };

  const rawPlan = tenant?.subscriptionPlan || 'free';
  const currentPlan = resolvePlan(rawPlan);
  const currentPlanDef = getPlan(currentPlan);
  const currentRank = getRank(currentPlan);

  const visiblePlans = PLAN_ORDER.filter(pid =>
    pid === currentPlan || (activePlans ? activePlans.has(pid) : true)
  );

  const getPlanLimit = (planId, limitKey) => {
    if (plansApi) {
      const dbKey = DB_LIMIT_MAP[limitKey];
      if (dbKey) {
        const apiPlan = getApiPlan(planId);
        if (apiPlan?.features?.[dbKey] !== undefined) {
          return Number(apiPlan.features[dbKey]);
        }
      }
    }
    return PLANS[planId].limits[limitKey];
  };

  const getApiPlan = (planId) => {
    if (!plansApi) return null;
    return plansApi.find(p => resolvePlan(p.id) === planId && p.period === 'year')
      || plansApi.find(p => resolvePlan(p.id) === planId);
  };

  const getPlanName = (planId) => {
    if (plansApi) {
      const api = getApiPlan(planId);
      if (api?.name) return api.name;
    }
    return PLANS[planId]?.name || planId;
  };

  const getPlanMonthlyPrice = (planId) => {
    if (plansApi) {
      const monthly = plansApi.find(p => resolvePlan(p.id) === planId && p.period === 'month');
      if (monthly?.price_inr !== undefined) return Number(monthly.price_inr);
      const yearly = plansApi.find(p => resolvePlan(p.id) === planId && p.period === 'year');
      if (yearly?.price_inr !== undefined) return Math.round(Number(yearly.price_inr) / 12);
    }
    return PLANS[planId]?.metadata?.priceMonthly || 0;
  };

  const getPlanYearlyPrice = (planId) => {
    if (plansApi) {
      const yearly = plansApi.find(p => resolvePlan(p.id) === planId && p.period === 'year');
      if (yearly?.price_inr !== undefined) return Number(yearly.price_inr);
      const monthly = plansApi.find(p => resolvePlan(p.id) === planId && p.period === 'month');
      if (monthly?.price_inr !== undefined) return Number(monthly.price_inr) * 12;
    }
    return PLANS[planId]?.metadata?.priceYearly || 0;
  };

  const getPlanFeature = (planId, feat) => {
    if (plansApi) {
      const apiPlan = getApiPlan(planId);
      if (apiPlan?.features?.[feat] !== undefined && typeof apiPlan.features[feat] === 'boolean') {
        return apiPlan.features[feat];
      }
    }
    return PLANS[planId].features[feat] === true;
  };

  useEffect(() => {
    subscriptionService.getCurrent()
      .then(sub => setSubscription(sub))
      .catch(() => {})
      .finally(() => setLoading(false));

    subscriptionService.getPlans()
      .then(plans => {
        setPlansApi(plans);
        const active = new Set();
        for (const p of plans) {
          active.add(resolvePlan(p.id));
        }
        setActivePlans(active);
      })
      .catch(() => setActivePlans(new Set()));
  }, []);

  const handleUpgrade = (planId) => {
    const rank = getRank(planId);
    if (rank > currentRank) {
      if (planId === 'MANAGE') {
        setUpgradeTarget({ plan: 'manage', label: PLAN_LABELS.MANAGE });
      } else if (planId === 'BUSINESS') {
        setUpgradeTarget({ plan: 'business', label: PLAN_LABELS.BUSINESS });
      } else {
        setUpgradeTarget({ plan: 'business_pro', label: PLAN_LABELS.BUSINESS_PRO });
      }
      setShowUpgrade(true);
    }
  };

  const handleDowngrade = (target) => {
    if (currentRank >= 1) {
      setDowngradeTarget(target.toLowerCase());
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
                {!globalConfig.hideSubscriptionLabels && (
                  <h2 className="text-lg font-bold text-gray-900">
                    {PLAN_LABELS[currentPlan] || currentPlan}
                  </h2>
                )}
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
            {currentRank >= 1 && (
              <button
                onClick={() => handleDowngrade('free')}
                className="py-2 px-4 text-sm font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
              >
                {isTrialing ? 'Cancel Trial' : 'Cancel Plan'}
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
          {visiblePlans.map((planId) => {
            const planName = getPlanName(planId);
            const monthlyPrice = getPlanMonthlyPrice(planId);
            const yearlyPrice = getPlanYearlyPrice(planId);
            const isCurrent = planId === currentPlan;
            const rank = getRank(planId);
            const canUpgrade = rank > currentRank;
            const canDowngrade = rank < currentRank;

            // Determine which features this plan has enabled (from API via getPlanFeature)
            const enabledFeatures = COMPARISON_FEATURES.filter(feat => getPlanFeature(planId, feat));

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
                  <h4 className="text-base font-bold text-gray-900">{planName}</h4>
                  <div className="mt-1">
                    <span className="text-2xl font-bold text-gray-900">₹{monthlyPrice}</span>
                    <span className="text-sm text-gray-500">/mo</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">₹{yearlyPrice}/year</p>
                </div>

                <ul className="space-y-1.5 mb-5 flex-1">
                  {enabledFeatures.slice(0, 6).map(feat => (
                    <li key={feat} className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {FEATURE_LABELS[feat] || feat}
                    </li>
                  ))}
                  {COMPARISON_LIMITS.filter(lk => getPlanLimit(planId, lk) !== 0).map(lk => (
                    <li key={lk} className="flex items-center gap-2 text-xs text-gray-600">
                      <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      {formatLimit(getPlanLimit(planId, lk))} {LIMIT_LABELS[lk] || lk}
                    </li>
                  ))}
                </ul>

                {canUpgrade && (
                  <button
                    onClick={() => handleUpgrade(planId)}
                    className="w-full py-2 text-sm font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    Upgrade to {planName}
                  </button>
                )}
                {canDowngrade && !isCurrent && (
                  <button
                    onClick={() => handleDowngrade(planId)}
                    className="w-full py-2 text-sm font-medium text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                  >
                    Downgrade to {planName}
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
        onUpgraded={() => { refreshTenant(); refreshSubscription(); }}
        feature={upgradeTarget?.label}
        requiredPlan={upgradeTarget?.plan || 'business'}
      />
      <DowngradeModal
        open={showDowngrade}
        targetPlan={downgradeTarget}
        onClose={() => { setShowDowngrade(false); setDowngradeTarget('free'); }}
        onDowngraded={() => { refreshTenant(); refreshSubscription(); setShowDowngrade(false); }}
      />
    </div>
  );
}
