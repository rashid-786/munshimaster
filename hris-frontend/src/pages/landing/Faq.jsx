import { useState } from 'react';
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: 'What is Bahi360 best suited for?',
    a: 'Bahi360 is designed for SMBs and growing teams that want one system for ledger, billing, HR, payroll, inventory, and compliance workflows.',
  },
  {
    q: 'How do subscription plans differ?',
    a: 'Free supports basic operations for smaller setups. Business unlocks core operational workflows such as invoicing, payroll, and reports. Pro extends capabilities for more advanced and scaling operations.',
  },
  {
    q: 'Can I switch plans as my team grows?',
    a: 'Yes. You can move between plans based on your needs. Existing data is retained, and access is controlled by your active plan.',
  },
  {
    q: 'Does Bahi360 include payroll and attendance together?',
    a: 'Yes. Payroll, attendance, leaves, and advances are integrated, reducing manual reconciliation between separate tools.',
  },
  {
    q: 'Which compliance workflows are supported?',
    a: 'Bahi360 supports GST returns, GSTR-2B reconciliation, TDS workflows, and related operational compliance modules.',
  },
  {
    q: 'Can I manage invoicing and purchase operations here?',
    a: 'Yes. You can run invoices, recurring invoices, purchase orders, suppliers, customers, and payment tracking from one platform.',
  },
  {
    q: 'Can we customize branding and tenant settings?',
    a: 'Yes. Tenant-level branding and settings are available so teams can personalize the experience while keeping system controls intact.',
  },
  {
    q: 'How is data protected?',
    a: 'The application uses authenticated access, tenant-level data separation, and role-based controls to protect operational data.',
  },
  {
    q: 'Is there support during onboarding?',
    a: 'Yes. You can start with trial access and connect with the Bahi360 team for onboarding guidance and plan recommendations.',
  },
];

function FaqItem({ faq }) {
  const [open, setOpen] = useState(false);

  return (
    <article className={`border border-gray-200 rounded-xl overflow-hidden transition-all ${open ? 'shadow-sm' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900 pr-4">{faq.q}</span>
        <svg
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
        </div>
      )}
    </article>
  );
}

export default function Faq() {
  return (
    <div>
      <section className="bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Frequently Asked Questions</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Answers about services, subscriptions, onboarding, and day-to-day usage across Bahi360 workflows.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          {FAQS.map((faq) => (
            <FaqItem key={faq.q} faq={faq} />
          ))}
        </div>
      </section>

      <section className="pb-16 md:pb-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 md:p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900">Need plan-specific guidance?</h2>
            <p className="mt-3 text-gray-600">Review full subscription details or start a trial and explore the product directly.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/pricing" className="btn-primary !py-2.5 !px-6 text-sm">Open Pricing</Link>
              <Link to="/register" className="btn-secondary-navy !py-2.5 !px-6 text-sm">Start Trial</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
