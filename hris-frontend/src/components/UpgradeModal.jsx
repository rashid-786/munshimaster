import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscriptionService } from '../services/subscription.service';
import PromoBanner from './PromoBanner';

const PLANS = {
  trial: { name: 'Try Business Free', monthly: 0, yearly: 0, popular: false, isTrial: true },
  business: { name: 'Business', monthly: 99, yearly: 1069, popular: true },
  pro: { name: 'Pro', monthly: 149, yearly: 1609, popular: false },
};

export default function UpgradeModal({ open, onClose, feature, requiredPlan = 'business' }) {
  const { refreshTenant } = useAuth();
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [billing, setBilling] = useState('year');
  const [selectedPlan, setSelectedPlan] = useState(null);

  const getPlanId = (key) => {
    if (key === 'trial') return billing === 'month' ? 'business_monthly' : 'business';
    return billing === 'month' ? `${key}_monthly` : key;
  };

  const handleContinue = async () => {
    if (!selectedPlan) return;
    const planId = getPlanId(selectedPlan);
    setLoading(planId);
    setError('');

    try {
      if (selectedPlan === 'trial') {
        await subscriptionService.startTrial(planId);
        await refreshTenant();
        onClose();
        return;
      }

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
          await subscriptionService.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            planId,
          });
          await refreshTenant();
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

  const selectedIsTrial = selectedPlan === 'trial';

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
              ? `The ${featureName} feature requires the ${PLANS[requiredPlan]?.name || requiredPlan} plan.`
              : 'Choose the plan that fits your business.'}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          {/* Billing toggle */}
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

          <PromoBanner onApply={(code) => setPromoCode(code)} />

          <div className="grid gap-3">
            {Object.entries(PLANS).map(([key, plan]) => {
              const planId = getPlanId(key);
              const isSelected = selectedPlan === key;

              if (plan.isTrial) {
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedPlan(key)}
                    disabled={!!loading}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                        : 'border-indigo-200 bg-indigo-50/50 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">{plan.name}</span>
                        <span className="text-sm text-gray-500 ml-2">14 days free, then ₹{billing === 'month' ? `${PLANS.business.monthly}/mo` : `${PLANS.business.yearly}/yr`}</span>
                      </div>
                      <span className="text-indigo-600 text-sm font-medium">Free</span>
                    </div>
                    {isSelected && (
                      <div className="mt-2 text-xs text-indigo-600 font-medium flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        Selected
                      </div>
                    )}
                  </button>
                );
              }

              const price = billing === 'month' ? plan.monthly : plan.yearly;
              const periodLabel = billing === 'month' ? '/mo' : '/yr';
              const perMonth = billing === 'year' ? `₹${Math.round(plan.yearly / 12)}/mo` : null;
              return (
                <button
                  key={planId}
                  onClick={() => setSelectedPlan(key)}
                  disabled={!!loading}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : key === requiredPlan
                      ? 'border-indigo-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{plan.name}</span>
                      {perMonth && <span className="text-xs text-gray-400 ml-2">{perMonth}</span>}
                    </div>
                    <span className="text-indigo-600 font-bold">₹{price}{periodLabel}</span>
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

          {/* Info message when trial is selected */}
          {selectedIsTrial && (
            <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
              Start your 14-day free trial with full Business features. No payment required.
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleContinue}
            disabled={!selectedPlan || !!loading}
            className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all ${
              selectedPlan
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? 'Processing...' : selectedIsTrial ? 'Start Free Trial' : 'Continue'}
          </button>

          <button onClick={onClose} className="btn-secondary w-full text-sm">
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
