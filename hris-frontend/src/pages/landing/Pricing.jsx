import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import UpgradeModal from '../../components/UpgradeModal';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: { year: 0, month: 0 },
    period: 'forever',
    subtitle: 'For early-stage operators',
    highlight: 'Start bookkeeping and daily operations quickly',
    features: [
      'Khata ledger and basic business tracking',
      'Up to 50 customers',
      'Up to 2 staff members',
      '500 monthly transactions',
      'Basic reporting',
    ],
    limitations: ['No advanced finance reports', 'No full payroll and invoicing workflows'],
    cta: 'Start Free',
  },
  {
    id: 'business',
    name: 'Business',
    price: { year: 999, month: 99 },
    period: 'per year',
    subtitle: 'For growing teams',
    highlight: 'Best fit for businesses moving from manual tools to structured operations',
    features: [
      'Unlimited customers and staff',
      'Invoices, purchase orders, and recurring billing',
      'Payroll, attendance, leaves, advances',
      'Balance sheet, P&L, and cash flow reports',
      'Export to PDF and Excel',
      'Email support',
    ],
    limitations: ['Advanced Pro controls like deeper automation and premium support are excluded'],
    cta: 'Choose Business',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { year: 2499, month: 208 },
    period: 'per year',
    subtitle: 'For advanced and multi-entity operations',
    highlight: 'Full capabilities for organizations scaling across teams and workflows',
    features: [
      'Everything in Business',
      'Inventory and stock-heavy workflows',
      'Multi-branch readiness and premium controls',
      'Bulk notifications and advanced automation hooks',
      'Priority support',
      'Stronger customization and expansion path',
    ],
    limitations: [],
    cta: 'Choose Pro',
  },
];

const FAQS = [
  {
    q: 'Can I upgrade later without losing data?',
    a: 'Yes. Your data and history remain intact. Upgrading only unlocks additional capabilities for your tenant.',
  },
  {
    q: 'Do I need a card to start?',
    a: 'No card is required to start free and evaluate workflows.',
  },
  {
    q: 'Which plan should I choose first?',
    a: 'If you need invoicing, payroll, and full reporting, start with Business. If you need premium controls and scaling headroom, choose Pro.',
  },
  {
    q: 'What if I downgrade?',
    a: 'Data remains available. Access to premium features is restricted based on your active plan.',
  },
];

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
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-emerald-50">
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Subscription Plans Built for Real Business Stages</h1>
            <p className="mt-4 text-lg text-gray-600">
              Choose the plan that matches your current operations. Start lean, then unlock deeper workflows as you grow.
            </p>

            <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-1 mt-7 shadow-sm">
              <button
                onClick={() => setBilling('month')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'month' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Monthly View
              </button>
              <button
                onClick={() => setBilling('year')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${billing === 'year' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Annual View
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12">
            {PLANS.map((plan) => {
              const amount = billing === 'month' ? plan.price.month : plan.price.year;
              const billingLabel = plan.id === 'free' ? plan.period : billing === 'month' ? 'per month (effective)' : plan.period;
              return (
                <article
                  key={plan.id}
                  className={`relative rounded-2xl border-2 p-6 bg-white ${plan.popular ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md' : 'border-gray-200 shadow-sm'}`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-primary-600 text-white">
                      Recommended
                    </span>
                  )}

                  <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{plan.subtitle}</p>

                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">Rs {amount.toLocaleString('en-IN')}</span>
                    <p className="text-sm text-gray-500 mt-1">{billingLabel}</p>
                  </div>

                  <p className="mt-4 text-sm text-gray-600">{plan.highlight}</p>

                  <ul className="mt-5 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                        <svg className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                    {plan.limitations.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                        <svg className="w-4 h-4 text-gray-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCta(plan.id)}
                    className={`w-full mt-7 py-2.5 rounded-xl text-sm font-medium transition-all ${plan.id === 'free' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                  >
                    {plan.cta}
                  </button>
                </article>
              );
            })}
          </div>

          <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h3 className="text-xl font-semibold text-gray-900">How to pick a plan quickly</h3>
              <ul className="mt-4 space-y-3 text-sm text-gray-600">
                <li>If you are validating workflow and need basic tracking, start with Free.</li>
                <li>If you are already issuing invoices or running payroll, Business is your default choice.</li>
                <li>If you run advanced operations and need stronger scale controls, choose Pro.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Subscription FAQs</h3>
              <div className="space-y-3">
                {FAQS.map((faq) => (
                  <div key={faq.q} className="bg-white rounded-xl border border-gray-200 p-4">
                    <p className="text-sm font-medium text-gray-900">{faq.q}</p>
                    <p className="text-sm text-gray-600 mt-1.5">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

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
