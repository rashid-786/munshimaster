import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useGlobalConfig } from '../context/GlobalConfigContext';
import { subscriptionService } from '../services/subscription.service';
import { PLANS, getRank, resolvePlan, PLAN_LABELS } from '../config/subscriptionPlans';

const PLAN_ID_MAP = {
  MANAGE: 'manage',
  BUSINESS: 'business',
  BUSINESS_PRO: 'business_pro',
};

export default function UpgradeModal({ open, onClose, onUpgraded, feature, requiredPlan = 'BUSINESS' }) {
  const { tenant, refreshTenant, updateTenantPlan } = useAuth();
  const { globalConfig } = useGlobalConfig();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [billing, setBilling] = useState('month');
  const [selectedPlan, setSelectedPlan] = useState(null);

  const currentPlan = resolvePlan(tenant?.subscriptionPlan || 'FREE');
  const [plansData, setPlansData] = useState(null);

  useEffect(() => {
    if (open) {
      subscriptionService.getPlans().then(setPlansData).catch(() => {});
    }
  }, [open]);

  if (globalConfig.hideSubscriptionLabels) return null;

  const getTrialDays = (key) => {
    if (!plansData) return null;
    const base = PLAN_ID_MAP[key];
    if (!base) return null;
    const planId = billing === 'month' ? `${base}_monthly` : base;
    const plan = plansData.find(p => p.id === planId);
    return plan?.trial_days ?? null;
  };

  const getPlanId = (key) => {
    const base = PLAN_ID_MAP[key];
    if (!base) return null;
    return billing === 'month' ? `${base}_monthly` : base;
  };

  const handleStartTrial = async () => {
    if (!selectedPlan) return;
    const planId = getPlanId(selectedPlan);
    if (!planId) return;
    setLoading(`trial_${planId}`);
    setError('');

    try {
      const res = await subscriptionService.startTrial(planId);
      updateTenantPlan(res.plan);
      try { await refreshTenant(); } catch {}
      onUpgraded?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start trial.');
    } finally {
      setLoading('');
    }
  };

  const handlePayNow = async () => {
    if (!selectedPlan) return;
    const planId = getPlanId(selectedPlan);
    if (!planId) return;
    setLoading(`pay_${planId}`);
    setError('');

    try {
      const order = await subscriptionService.createOrder(planId);

      const plan = PLANS[selectedPlan];
      const periodLabel = billing === 'month' ? '1 Month' : '1 Year';
      const currentOrderId = order.orderId;

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: 'INR',
        name: 'Bahi360',
        description: `${plan.name} Plan — ${periodLabel}`,
        order_id: currentOrderId,
        prefill: {
          name: order.tenantName,
          email: order.email,
          contact: order.contact,
        },
        theme: { color: '#0B3C5D' },
        modal: {
          ondismiss: () => {
            subscriptionService.cancelOrder(currentOrderId).catch(() => {});
            setLoading('');
          },
        },
        handler: async (response) => {
          const payRes = await subscriptionService.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId,
          });
          updateTenantPlan(payRes.plan);
          try { await refreshTenant(); } catch {}
          onUpgraded?.();
          onClose();
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading('');
    }
  };

  if (!open) return null;

  const featureName = feature
    ?.replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  const required = resolvePlan(requiredPlan);

  const isPlanActive = (key) => {
    if (!plansData) return true;
    const base = PLAN_ID_MAP[key];
    if (!base) return false;
    return plansData.some(p => p.id === base || p.id === `${base}_monthly`);
  };

  const getApiPlan = (key) => {
    if (!plansData) return null;
    const base = PLAN_ID_MAP[key];
    if (!base) return null;
    const yearly = plansData.find(p => p.id === base);
    const monthly = plansData.find(p => p.id === `${base}_monthly`);
    return { yearly, monthly };
  };

  const getApiPrice = (key, period) => {
    const api = getApiPlan(key);
    if (!api) return null;
    const p = period === 'month' ? api.monthly : api.yearly;
    return p ? parseInt(p.price_inr || 0) : null;
  };

  const getDescription = (key) => {
    const api = getApiPlan(key);
    const planData = api?.yearly || api?.monthly;
    if (!planData?.features) return '';
    const f = planData.features;
    const parts = [];
    if (typeof f.max_monthly_txns === 'number' && f.max_monthly_txns > 0) parts.push(`${f.max_monthly_txns.toLocaleString('en-IN')} txns`);
    else if (f.max_monthly_txns === -1) parts.push('Unlimited txns');
    if (typeof f.max_staff === 'number' && f.max_staff > 0) parts.push(`${f.max_staff} staff`);
    else if (f.max_staff === -1) parts.push('Unlimited staff');
    if (f.multi_branch || f.max_branches === -1 || (typeof f.max_branches === 'number' && f.max_branches > 1)) {
      parts.push(f.max_branches === -1 ? 'Unlimited branches' : `${f.max_branches} branches`);
    }
    if (f.inventory === true) parts.push('Inventory');
    if (f.whatsapp === true) parts.push('WhatsApp');
    if (f.api_access === true) parts.push('API');
    if (f.priority_support === true) parts.push('Priority');
    return parts.slice(0, 5).join(' · ') + (parts.length > 5 ? ' ..' : '');
  };

  const UPGRADE_PLANS = {};
  for (const [key, plan] of Object.entries(PLANS)) {
    if (getRank(key) > getRank(currentPlan) && isPlanActive(key)) {
      UPGRADE_PLANS[key] = plan;
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">
              {featureName ? `Unlock ${featureName}` : 'Upgrade Your Plan'}
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">&times;</button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {featureName
              ? `The ${featureName} feature requires the ${PLAN_LABELS[required] || required} plan.`
              : 'Choose the plan that fits your business.'}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            Current: <span className="font-semibold text-gray-700">{PLAN_LABELS[currentPlan]}</span>
          </div>

          <div className="flex items-center justify-center gap-3 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => { setBilling('month'); setSelectedPlan(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => { setBilling('year'); setSelectedPlan(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'year' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Annual <span className="text-emerald-600 font-semibold">-10%</span>
            </button>
          </div>

          <div className="grid gap-3">
            {Object.entries(UPGRADE_PLANS).map(([key, plan]) => {
              const priceMonthly = getApiPrice(key, 'month') ?? plan.metadata.priceMonthly;
              const priceYearly = getApiPrice(key, 'year') ?? plan.metadata.priceYearly;
              const price = billing === 'month' ? priceMonthly : priceYearly;
              const isSelected = selectedPlan === key;
              const perMonth = billing === 'year' && priceYearly ? `₹${Math.round(priceYearly / 12)}/mo` : null;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedPlan(key)}
                  disabled={!!loading}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : key === required
                      ? 'border-indigo-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900">{plan.name}</span>
                    {price > 0 ? (
                      <span className="text-indigo-600 font-bold shrink-0 ml-3">₹{price}{billing === 'month' ? '/mo' : '/yr'}</span>
                    ) : (
                      <span className="text-emerald-600 font-semibold text-sm shrink-0 ml-3">Free</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {getDescription(key) || plan.metadata.description}
                    {perMonth && <span className="ml-2">{perMonth}</span>}
                  </div>
                  {isSelected && (
                    <div className="mt-2 text-xs text-indigo-600 font-medium flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {Object.keys(UPGRADE_PLANS).length === 0 && (
            <div className="p-4 bg-gray-50 rounded-xl text-center text-sm text-gray-500">
              You're already on the highest plan.
            </div>
          )}

          {selectedPlan && (
            <>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
                Try <strong>{PLANS[selectedPlan].name}</strong> free for {getTrialDays(selectedPlan)} days. No payment required.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleStartTrial}
                  disabled={!!loading}
                  className="py-2.5 rounded-xl font-medium text-sm border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 transition-all"
                >
                  {loading?.startsWith('trial_') ? 'Starting...' : 'Start Free Trial'}
                </button>
                <button
                  onClick={handlePayNow}
                  disabled={!!loading}
                  className="py-2.5 rounded-xl font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all"
                >
                  {loading?.startsWith('pay_') ? 'Processing...' : 'Pay Now'}
                </button>
              </div>
            </>
          )}

          <button onClick={onClose} className="btn-secondary w-full text-sm">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
