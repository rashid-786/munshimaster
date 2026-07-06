import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';
import UpgradeModal from '../../components/UpgradeModal';

const FEATURE_LABELS = {
  my_bahi_book: 'Bahi Book ledger',
  buyers: 'Buyers / creditors tracking',
  sellers: 'Sellers / debtors tracking',
  customers: 'Customer management',
  ledger_customers: 'Customer management',
  suppliers: 'Supplier management',
  invoices: 'Invoicing',
  purchase_orders: 'Purchase orders',
  recurring_invoices: 'Recurring invoices',
  credit_debit_notes: 'Credit / Debit notes',
  expenses: 'Expense tracking',
  inventory: 'Inventory management',
  products: 'Product catalog',
  payroll: 'Payroll processing',
  attendance: 'Attendance management',
  leaves: 'Leave management',
  advances: 'Advance payments',
  replacements: 'Staff replacements',
  staff_directory: 'Staff directory',
  my_staff: 'Staff management',
  balance_sheet: 'Balance sheet',
  pl_statement: 'P&L statement',
  cash_flow: 'Cash flow reports',
  reports_basic: 'Basic reports',
  reports: 'All reports',
  advanced_reports: 'Advanced reports',
  audit_logs: 'Audit logs',
  api_access: 'API access',
  bank_import: 'Bank import / reconciliation',
  bulk_import: 'Bulk import',
  e_invoicing: 'E-invoicing',
  gst_returns: 'GST returns',
  gstr2b_reco: 'GSTR-2B reconciliation',
  tds_management: 'TDS management',
  tally_export: 'Tally export',
  whatsapp: 'WhatsApp integration',
  multi_branch: 'Multi-branch support',
  business_dashboard: 'Business dashboard',
  priority_support: 'Priority support',
  white_label: 'White label / custom branding',
  kirana: 'Kirana store module',
  cashbook_entries: 'Cash book entries',
  settings: 'Settings & preferences',
  monthly_txns: 'Monthly transactions',
  max_monthly_txns: 'Monthly transactions',
  max_staff: 'Staff members',
  staff_members: 'Staff members',
  max_branches: 'Branches / entities',
  branches: 'Branches / entities',
  max_customers: 'Customers',
  max_suppliers: 'Suppliers',
  max_products: 'Products',
};

const LIMIT_FEATURES = new Set([
  'max_staff', 'staff_members', 'max_branches', 'branches',
  'max_monthly_txns', 'monthly_txns', 'max_customers',
  'max_suppliers', 'max_products',
]);

function formatFeature(key, value) {
  const label = FEATURE_LABELS[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  if (LIMIT_FEATURES.has(key) && typeof value === 'number' && value > 0) {
    return `${label}: ${value.toLocaleString('en-IN')}`;
  }
  if (LIMIT_FEATURES.has(key) && value === -1) {
    return `Unlimited ${label.toLowerCase()}`;
  }
  return label;
}

function getPlanFeatures(plan) {
  const f = plan.features || {};
  const bullets = [];

  // Always show core features first
  if (f.my_bahi_book === true) bullets.push('Bahi Book ledger with khata tracking');
  if (f.invoices === true) bullets.push('Invoicing with credit / debit notes');
  if (f.purchase_orders === true) bullets.push('Purchase orders');
  if (f.recurring_invoices === true) bullets.push('Recurring billing');
  if (f.payroll === true) bullets.push('Payroll processing');
  if (f.attendance === true) bullets.push('Attendance tracking');
  if (f.leaves === true) bullets.push('Leave management');
  if (f.advances === true) bullets.push('Advance payments');
  if (f.replacements === true) bullets.push('Staff replacements');

  // Customers / Suppliers / Products
  if (f.max_customers === -1 || f.customers === true || f.ledger_customers === true) {
    const val = f.max_customers;
    bullets.push(val === -1 ? 'Unlimited customers' : val > 0 ? `Up to ${val.toLocaleString('en-IN')} customers` : 'Customer management');
  }
  if (f.max_suppliers === -1 || f.suppliers === true) {
    const val = f.max_suppliers;
    bullets.push(val === -1 ? 'Unlimited suppliers' : val > 0 ? `Up to ${val.toLocaleString('en-IN')} suppliers` : 'Supplier management');
  }
  if (f.max_products === -1 || f.products === true) {
    const val = f.max_products;
    bullets.push(val === -1 ? 'Unlimited products' : val > 0 ? `Up to ${val.toLocaleString('en-IN')} products` : 'Product catalog');
  }

  if (f.inventory === true) bullets.push('Inventory management');
  if (f.expenses === true) bullets.push('Expense tracking');
  if (f.kirana === true) bullets.push('Kirana store module');

  // Reports
  if (f.reports_basic === true) bullets.push('Basic reports');
  if (f.reports === true || f.advanced_reports === true) bullets.push('Advanced reports');
  if (f.balance_sheet === true) bullets.push('Balance sheet');
  if (f.pl_statement === true) bullets.push('Profit & Loss statement');
  if (f.cash_flow === true) bullets.push('Cash flow reports');

  // Staff / Branches
  if (f.max_staff === -1 || f.max_staff > 0 || f.my_staff === true) {
    const val = f.max_staff;
    bullets.push(val === -1 ? 'Unlimited staff members' : val > 0 ? `Up to ${val} staff members` : 'Staff management');
  }
  if (f.staff_directory === true) bullets.push('Staff directory');
  if (f.max_branches === -1 || f.multi_branch === true) {
    const val = f.max_branches;
    bullets.push(val === -1 ? 'Unlimited branches / entities' : val > 0 ? `Up to ${val} branches / entities` : 'Multi-branch support');
  }

  // Advanced
  if (f.whatsapp === true) bullets.push('WhatsApp integration');
  if (f.e_invoicing === true) bullets.push('E-invoicing');
  if (f.gst_returns === true) bullets.push('GST returns');
  if (f.gstr2b_reco === true) bullets.push('GSTR-2B reconciliation');
  if (f.tds_management === true) bullets.push('TDS management');
  if (f.bank_import === true) bullets.push('Bank import / reconciliation');
  if (f.bulk_import === true) bullets.push('Bulk import');
  if (f.tally_export === true) bullets.push('Tally export');
  if (f.audit_logs === true) bullets.push('Audit logs');
  if (f.api_access === true) bullets.push('API access');
  if (f.business_dashboard === true) bullets.push('Business dashboard');
  if (f.priority_support === true) bullets.push('Priority support');
  if (f.white_label === true) bullets.push('White label / custom branding');
  if (f.buyers === true || f.buyers === -1) bullets.push('Buyers / creditors tracking');
  if (f.sellers === true || f.sellers === -1) bullets.push('Sellers / debtors tracking');

  // Limits display
  const limitItems = [];
  if (typeof f.max_monthly_txns === 'number' && f.max_monthly_txns > 0) {
    limitItems.push(`${f.max_monthly_txns.toLocaleString('en-IN')} transactions / month`);
  } else if (f.max_monthly_txns === -1) {
    limitItems.push('Unlimited monthly transactions');
  }

  return { bullets, limits: limitItems };
}

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
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUpgrade, setShowUpgrade] = useState(null);
  const [billing, setBilling] = useState('year');

  useEffect(() => {
    hrService.getPlans()
      .then(data => {
        const all = (data.plans || []).filter(p => !p.id.endsWith('_monthly'));
        all.sort((a, b) => parseFloat(a.price_inr || 0) - parseFloat(b.price_inr || 0));
        setPlans(all);
      })
      .catch(() => {
        setError('Failed to load plans. Please try again later.');
      })
      .finally(() => setLoading(false));
  }, []);

  const popularIndex = plans.length > 1 ? 1 : -1;

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

          {loading ? (
            <div className="text-center text-gray-400 py-20">Loading plans...</div>
          ) : error ? (
            <div className="text-center text-red-500 py-20">{error}</div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto mt-12">
              {plans.map((plan, idx) => {
                const isPopular = idx === popularIndex;
                const amount = billing === 'month'
                  ? Math.round(parseFloat(plan.price_inr || 0) / 12)
                  : parseFloat(plan.price_inr || 0);
                const billingLabel = plan.id === 'free' ? 'forever' : billing === 'month' ? 'per month (effective)' : 'per year';
                const { bullets, limits } = getPlanFeatures(plan);

                return (
                  <article
                    key={plan.id}
                    className={`relative rounded-2xl border-2 p-6 bg-white ${isPopular ? 'border-primary-500 ring-2 ring-primary-500/20 shadow-md' : 'border-gray-200 shadow-sm'}`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-semibold bg-primary-600 text-white">
                        Recommended
                      </span>
                    )}

                    <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                    <p className="mt-1 text-sm text-gray-500 capitalize">{plan.id === 'free' ? 'For solo entrepreneurs' : plan.id === 'business' ? 'For growing teams' : plan.id === 'manage' ? 'For small teams' : 'For established businesses'}</p>

                    <div className="mt-4">
                      <span className="text-4xl font-bold text-gray-900">
                        {amount === 0 ? 'Free' : `Rs ${Math.round(amount).toLocaleString('en-IN')}`}
                      </span>
                      <p className="text-sm text-gray-500 mt-1">{billingLabel}</p>
                    </div>

                    <p className="mt-4 text-sm text-gray-600">
                      {plan.id === 'free' ? 'Start bookkeeping and daily operations quickly' :
                       plan.id === 'manage' ? 'Essential tools for small team operations' :
                       plan.id === 'business' ? 'Best fit for businesses moving from manual to structured operations' :
                       'Full capabilities for organizations scaling across teams and workflows'}
                    </p>

                    <ul className="mt-5 space-y-2.5">
                      {bullets.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
                          <svg className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {limits.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-400 font-medium mb-1">Limits</p>
                        <ul className="space-y-1">
                          {limits.map((l) => (
                            <li key={l} className="flex items-start gap-2 text-sm text-gray-700">
                              <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>{l}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <button
                      onClick={() => handleCta(plan.id)}
                      className={`w-full mt-7 py-2.5 rounded-xl text-sm font-medium transition-all ${plan.id === 'free' ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
                    >
                      {plan.id === 'free' ? 'Start Free' : plan.id === 'manage' ? 'Choose Manage' : plan.id === 'business' ? 'Choose Business' : 'Choose Pro'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

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
