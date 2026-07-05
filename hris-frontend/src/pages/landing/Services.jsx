import { Link } from 'react-router-dom';

const SERVICE_BLOCKS = [
  {
    title: 'Finance and Ledger Operations',
    desc: 'Move from manual entries to structured financial execution with live khata, balance views, and periodic reporting.',
    items: ['Khata and cashbook tracking', 'Balance sheet and P&L visibility', 'Cash flow analysis', 'Entity-wise financial snapshots'],
  },
  {
    title: 'Billing, Collections, and Revenue Workflow',
    desc: 'Standardize billing across teams with invoice lifecycle tracking and recurring revenue support.',
    items: ['Invoice creation and status flow', 'Recurring invoice automation', 'Payment history and reconciliations', 'Credit/debit note workflow'],
  },
  {
    title: 'Procurement and Inventory Operations',
    desc: 'Keep purchasing and stock under one process for better planning, control, and auditability.',
    items: ['Supplier management and PO flow', 'Stock and product control', 'Bulk import options', 'Inventory-driven business operations'],
  },
  {
    title: 'People and Payroll Management',
    desc: 'Run people operations from onboarding to payroll with policy-driven workflows.',
    items: ['Employee directory and profile management', 'Attendance and leave approvals', 'Payroll, advances, and replacements', 'Calendar and shift-aware tracking'],
  },
  {
    title: 'Compliance and Tax Readiness',
    desc: 'Reduce filing stress with built-in compliance flows integrated into day-to-day operations.',
    items: ['GST return support', 'GSTR-2B reconciliation', 'TDS workflows', 'e-Invoice and e-Waybill readiness'],
  },
  {
    title: 'Growth and Subscription Enablement',
    desc: 'Scale with configurable plan-based access, usage controls, notifications, and branded experiences.',
    items: ['Subscription plans and upgrade flows', 'Feature-level access control', 'Tenant branding and customization', 'Notification and communication hooks'],
  },
];

const OUTCOMES = [
  'Single platform replacing fragmented tools',
  'Faster operations with fewer manual steps',
  'Clear ownership across finance, HR, and admin teams',
  'Subscription-aligned access as teams grow',
];

export default function Services() {
  return (
    <div>
      <section className="bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Services Built Around How Businesses Actually Operate</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Bahi360 combines finance, HR, compliance, and growth workflows into one service layer so your team can execute faster with better control.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/pricing" className="btn-primary !py-2.5 !px-6 text-sm">View Plans</Link>
            <Link to="/register" className="btn-secondary-navy !py-2.5 !px-6 text-sm">Start Free Trial</Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {SERVICE_BLOCKS.map((block) => (
              <article key={block.title} className="rounded-2xl border border-gray-200 p-6 bg-white hover:shadow-md transition-shadow">
                <h2 className="text-lg font-semibold text-gray-900">{block.title}</h2>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{block.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {block.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-gray-200 p-7 md:p-10">
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900">What you gain with Bahi360 services</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              {OUTCOMES.map((item) => (
                <div key={item} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                  {item}
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/pricing" className="btn-primary !py-2.5 !px-6 text-sm">Compare Subscription Plans</Link>
              <Link to="/faq" className="border border-gray-300 text-gray-700 rounded-lg py-2.5 px-6 text-sm font-medium hover:bg-gray-50">Read FAQs</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
