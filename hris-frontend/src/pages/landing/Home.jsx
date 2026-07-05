import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const CORE_MODULES = [
  {
    title: 'Khata & Smart Ledger',
    desc: 'Track cash in, cash out, and party balances in a single live ledger built for daily business decisions.',
  },
  {
    title: 'Billing & Collections',
    desc: 'Create invoices, payment links, recurring invoices, and follow up faster with status visibility.',
  },
  {
    title: 'Payroll & HR Console',
    desc: 'Manage attendance, leaves, salary runs, advances, and replacements from one workflow.',
  },
  {
    title: 'Inventory & Purchase Flow',
    desc: 'Control stock, suppliers, purchase orders, and movement history without manual spreadsheets.',
  },
  {
    title: 'Compliance & Reports',
    desc: 'Use GST returns, GSTR-2B reconciliation, TDS, e-invoice, and P&L reports with export-ready outputs.',
  },
  {
    title: 'Subscription & Controls',
    desc: 'Feature gating, usage tracking, tenant-level settings, and upgrade paths designed for growth.',
  },
];

const PLAN_SUMMARY = [
  {
    id: 'free',
    name: 'Free',
    price: 'Rs 0',
    cycle: 'forever',
    pitch: 'For solo founders and early-stage shops',
    bullets: ['Khata + daily bookkeeping', 'Up to 50 customers', 'Basic reports'],
    cta: 'Start Free',
    ctaTo: '/register',
  },
  {
    id: 'business',
    name: 'Business',
    price: 'Rs 999',
    cycle: 'per year',
    pitch: 'For growing teams that need billing + operations',
    bullets: ['Unlimited customers and staff', 'Invoices, PO, payroll, attendance', 'Advanced reports and exports'],
    cta: 'Explore Business',
    ctaTo: '/pricing',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Rs 2,499',
    cycle: 'per year',
    pitch: 'For advanced operations and multi-branch control',
    bullets: ['Inventory + branch capabilities', 'WhatsApp + API readiness', 'Priority support and custom controls'],
    cta: 'See Pro Plan',
    ctaTo: '/pricing',
  },
];

const IMPROVEMENTS = [
  {
    title: 'Clearer first screen',
    text: 'We now present who Bahi360 is for, what outcomes it drives, and where to begin in under 10 seconds.',
  },
  {
    title: 'Subscription-led flow',
    text: 'Plan options are visible on Home with direct paths to Pricing, reducing confusion before signup.',
  },
  {
    title: 'Trust through operations depth',
    text: 'The page highlights real modules like GST, GSTR-2B, payroll, inventory, and ledger instead of generic claims.',
  },
  {
    title: 'Faster decision path',
    text: 'Every section includes action paths: Start Free, View Pricing, or Contact for onboarding support.',
  },
];

const FAQ_PREVIEW = [
  'Can I start on Free and upgrade later without losing data?',
  'Do plans include payroll, attendance, and invoicing together?',
  'Can I use Bahi360 for multi-branch operations?',
  'Is GST and compliance workflow included?',
];

export default function Home() {
  const [contact, setContact] = useState({ name: '', email: '', message: '' });
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState('');
  const [contactError, setContactError] = useState('');

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactError('');
    setContactSuccess('');
    if (!contact.name || !contact.email || !contact.message) {
      setContactError('All fields are required.');
      return;
    }

    setContactLoading(true);
    try {
      const res = await api.post('/public/contact', contact);
      setContactSuccess(res.data.message);
      setContact({ name: '', email: '', message: '' });
    } catch (err) {
      setContactError(err.response?.data?.error || 'Failed to send message.');
    } finally {
      setContactLoading(false);
    }
  };

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-20 md:py-28 lg:py-32">
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(120deg, #0b3c5d 0%, #2fbf71 100%)', maskImage: 'radial-gradient(circle at 30% 20%, black 0%, transparent 70%)' }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide bg-primary-100 text-primary-700 uppercase">
                Bahi360 Business Operating System
              </span>
              <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-gray-900">
                Run HR, Finance, Ledger, and Growth from one control center.
              </h1>
              <p className="mt-6 text-lg text-gray-600 max-w-2xl">
                Bahi360 helps teams replace scattered tools with one platform for payroll, attendance, invoicing, inventory,
                compliance, and subscription-managed scaling.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-4">
                <Link to="/register" className="btn-primary !py-3 !px-7 text-base">
                  Start Free Trial
                </Link>
                <Link to="/pricing" className="btn-secondary-navy !py-3 !px-7 text-base">
                  View Subscription Plans
                </Link>
              </div>
              <p className="mt-4 text-sm text-gray-500">No credit card required for trial. Upgrade any time.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-6 md:p-8">
              <h2 className="text-xl font-semibold text-gray-900">What teams improve with Bahi360</h2>
              <ul className="mt-5 space-y-4">
                {[
                  'Reduce payroll processing effort with automated attendance and deductions.',
                  'Track customer-supplier cash movement in a real-time ledger.',
                  'Launch invoicing and collection workflows with payment status visibility.',
                  'Control usage and upgrades through structured subscription plans.',
                ].map((line) => (
                  <li key={line} className="flex items-start gap-3 text-sm text-gray-700">
                    <svg className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Built for daily operations, not just dashboards</h2>
            <p className="mt-4 text-lg text-gray-600">Each module solves a real workflow your team runs every day.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CORE_MODULES.map((module) => (
              <article key={module.title} className="rounded-2xl border border-gray-100 p-6 bg-white hover:shadow-md transition-shadow">
                <h3 className="text-lg font-semibold text-gray-900">{module.title}</h3>
                <p className="mt-3 text-sm text-gray-600 leading-relaxed">{module.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Choose the plan that matches your growth stage</h2>
            <p className="mt-4 text-lg text-gray-600">Simple annual pricing. Start with Free, move to Business or Pro as operations expand.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLAN_SUMMARY.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 p-6 bg-white ${plan.popular ? 'border-primary-500 shadow-lg' : 'border-gray-200 shadow-sm'}`}
              >
                {plan.popular && (
                  <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                    Most Popular
                  </span>
                )}
                <h3 className="mt-4 text-xl font-bold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold text-gray-900">{plan.price}</p>
                <p className="text-sm text-gray-500">{plan.cycle}</p>
                <p className="mt-3 text-sm text-gray-600">{plan.pitch}</p>
                <ul className="mt-5 space-y-2">
                  {plan.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaTo}
                  className={`mt-7 block text-center rounded-xl py-2.5 text-sm font-medium ${plan.popular ? 'bg-primary-600 text-white hover:bg-primary-700' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to="/pricing" className="text-primary-700 font-medium hover:text-primary-800">
              Compare all plan features and limits -&gt;
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Home page improvements delivered</h2>
            <p className="mt-4 text-lg text-gray-600">We focused on clarity, conversion path, and subscription visibility.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {IMPROVEMENTS.map((item) => (
              <article key={item.title} className="rounded-2xl border border-gray-200 p-6 bg-gray-50">
                <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-3 text-sm text-gray-600">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gradient-to-br from-primary-700 to-primary-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white">Still comparing options?</h2>
              <p className="mt-4 text-white/85 text-lg">
                We mapped common subscription questions to help you choose the right plan quickly.
              </p>
              <ul className="mt-6 space-y-3">
                {FAQ_PREVIEW.map((q) => (
                  <li key={q} className="text-sm text-white/90 flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-300 shrink-0" />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/faq" className="bg-white text-primary-700 rounded-lg py-2.5 px-5 text-sm font-semibold hover:bg-primary-50">
                  Read FAQs
                </Link>
                <Link to="/pricing" className="border border-white/30 text-white rounded-lg py-2.5 px-5 text-sm font-medium hover:bg-white/10">
                  Open Pricing
                </Link>
              </div>
            </div>

            <div id="contact" className="bg-white rounded-2xl border border-white/20 p-6 md:p-7">
              <h3 className="text-xl font-semibold text-gray-900">Talk to the Bahi360 team</h3>
              <p className="mt-2 text-sm text-gray-600">Share your use case and we will help you choose the right subscription setup.</p>

              <form onSubmit={handleContactSubmit} className="mt-5 space-y-4">
                {contactSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{contactSuccess}</div>
                )}
                {contactError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{contactError}</div>
                )}

                <input
                  type="text"
                  value={contact.name}
                  onChange={(e) => setContact((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Your name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Work email"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <textarea
                  rows={4}
                  value={contact.message}
                  onChange={(e) => setContact((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Tell us what you want to improve: payroll, invoicing, subscriptions, inventory..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                <button type="submit" disabled={contactLoading} className="btn-primary w-full !py-2.5">
                  {contactLoading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
