import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import UpgradeModal from '../../components/UpgradeModal';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '₹0',
    period: 'forever',
    desc: 'For solo shopkeepers',
    popular: false,
    features: [
      { text: 'Khata ledger — 50 customers', included: true },
      { text: '500 transactions/month', included: true },
      { text: 'Basic daily reports', included: true },
      { text: '2 staff members', included: true },
      { text: 'Attendance tracking', included: true },
      { text: 'Leave management', included: true },
      { text: 'Advanced reports (P&L)', included: false },
      { text: 'Invoices & estimates', included: false },
      { text: 'Payroll calculation', included: false },
      { text: 'Inventory management', included: false },
    ],
  },
];

const PAID_PLANS = {
  business: {
    name: 'Business',
    monthly: 99,
    yearly: 1069,
    desc: 'For growing teams',
    popular: true,
    features: [
      { text: 'Unlimited customers & transactions', included: true },
      { text: 'Advanced P&L reports', included: true },
      { text: 'Unlimited staff', included: true },
      { text: 'Attendance tracking', included: true },
      { text: 'Leave management', included: true },
      { text: 'Payroll calculation', included: true },
      { text: 'Invoices & estimates', included: true },
      { text: 'Purchase orders', included: true },
      { text: 'Export to Excel/PDF', included: true },
      { text: 'Email support', included: true },
      { text: 'Inventory management', included: false },
      { text: 'Bulk WhatsApp notifications', included: false },
    ],
  },
  pro: {
    name: 'Pro',
    monthly: 149,
    yearly: 1609,
    desc: 'For established businesses',
    popular: false,
    features: [
      { text: 'Everything in Business, plus...', included: true },
      { text: 'Inventory management', included: true },
      { text: 'Up to 5 branches', included: true },
      { text: 'Bulk WhatsApp notifications', included: true },
      { text: 'Custom branding (your logo)', included: true },
      { text: 'API access', included: true },
      { text: 'Phone + email support', included: true },
    ],
  },
};

export default function Pricing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showUpgrade, setShowUpgrade] = useState(null);
  const [billing, setBilling] = useState('year');

  const handleCta = (planId) => {
    if (!user) {
      navigate('/register');
      return;
    }
    if (planId === 'free') {
      navigate('/login');
      return;
    }
    setShowUpgrade(planId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            The Complete OS for Your Small Business
          </h1>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">
            From khata to payroll — one app, no limits. Start free. Upgrade when you grow.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1 mt-6 shadow-sm">
            <button
              onClick={() => setBilling('month')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'month' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('year')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'year' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Annual <span className="text-emerald-300 font-semibold">Save 10%</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free plan */}
          {PLANS.map(plan => (
            <div
              key={plan.id}
              className="relative bg-white rounded-2xl border-2 border-gray-200 p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-400 text-sm ml-1">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{plan.desc}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className={`flex items-start gap-2.5 text-sm ${f.included ? 'text-gray-700' : 'text-gray-400'}`}>
                    {f.included ? (
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCta(plan.id)}
                className="w-full py-2.5 rounded-xl font-medium text-sm border-2 border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
              >
                Get Started Free
              </button>
            </div>
          ))}

          {/* Paid plans */}
          {Object.entries(PAID_PLANS).map(([id, plan]) => {
            const price = billing === 'month' ? plan.monthly : plan.yearly;
            const periodLabel = billing === 'month' ? '/mo' : '/yr';
            const perMonth = billing === 'year' ? `₹${Math.round(plan.yearly / 12)}/mo` : null;
            const perYear = billing === 'month' ? `₹${plan.yearly}/yr` : null;
            return (
              <div
                key={id}
                className={`relative bg-white rounded-2xl border-2 p-6 shadow-sm transition-all hover:shadow-md ${
                  plan.popular ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-200'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-4 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-3xl font-bold text-gray-900">₹{price.toLocaleString('en-IN')}</span>
                    <span className="text-gray-400 text-sm ml-1">{periodLabel}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {perMonth || perYear}{plan.desc && ` — ${plan.desc}`}
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2.5 text-sm ${f.included ? 'text-gray-700' : 'text-gray-400'}`}>
                      {f.included ? (
                        <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCta(id)}
                  className="w-full py-2.5 rounded-xl font-medium text-sm bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-all"
                >
                  Upgrade Now
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-12 max-w-3xl mx-auto">
          <h3 className="text-lg font-semibold text-gray-900 text-center mb-6">Frequently Asked Questions</h3>
          <div className="space-y-4">
            <Faq q="What happens when I upgrade?" a="All your existing data carries over instantly. Nothing changes except you unlock more features." />
            <Faq q="What if I downgrade?" a="Your data stays safe. You'll lose access to paid features but nothing is deleted. Upgrade anytime to get them back." />
            <Faq q="Do I need a credit card for the trial?" a="No. Try Business free for 14 days — no payment required." />
            <Faq q="Is my data backed up?" a="Yes. Daily encrypted backups. You can request a full export anytime." />
            <Faq q="Can I use it on multiple phones?" a="Yes. Your account works on any device. All data syncs instantly." />
          </div>
        </div>
      </div>

      {showUpgrade && (
        <UpgradeModal
          open={!!showUpgrade}
          onClose={() => setShowUpgrade(null)}
          requiredPlan={showUpgrade}
        />
      )}
    </div>
  );
}

function Faq({ q, a }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="font-medium text-gray-900 text-sm">{q}</p>
      <p className="text-sm text-gray-500 mt-1">{a}</p>
    </div>
  );
}
