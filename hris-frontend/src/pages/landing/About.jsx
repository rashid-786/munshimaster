import { Link } from 'react-router-dom';

const BRAND_PILLARS = [
  {
    title: 'Manage',
    desc: 'Bring finance, HR, billing, and compliance workflows into one operational system with shared visibility.',
  },
  {
    title: 'Grow',
    desc: 'Use subscription plans and feature controls to expand capabilities in step with your business maturity.',
  },
  {
    title: 'Simplify',
    desc: 'Reduce manual handoffs and tool-switching by giving teams one platform for day-to-day execution.',
  },
];

const VALUES = [
  {
    title: 'Practical Innovation',
    desc: 'We focus on solutions that reduce real operational friction, not vanity features.',
  },
  {
    title: 'Operational Trust',
    desc: 'Business-critical workflows need reliability, auditability, and predictable outcomes.',
  },
  {
    title: 'Scalable Simplicity',
    desc: 'The product stays usable for small teams while supporting larger, more complex operations.',
  },
];

export default function About() {
  return (
    <div>
      <section className="bg-gradient-to-br from-primary-50 via-white to-emerald-50 py-20 md:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">About Bahi360</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
            Bahi360 is built for businesses that want one dependable operating layer across finance, people, and growth workflows.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Our Brand Promise</h2>
              <p className="mt-5 text-gray-600 leading-relaxed">
                We believe business teams should not need separate systems for ledger, payroll, attendance, invoicing,
                subscriptions, and compliance. Bahi360 unifies these workflows so operators can run with speed and control.
              </p>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Our guiding line is simple: Manage. Grow. Simplify. Every release, workflow, and subscription tier is shaped
                around this promise.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/services" className="btn-primary !py-2.5 !px-6 text-sm">Explore Services</Link>
                <Link to="/pricing" className="btn-secondary-navy !py-2.5 !px-6 text-sm">View Plans</Link>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-7">
              <h3 className="text-xl font-semibold text-gray-900">Brand Pillars</h3>
              <div className="mt-5 space-y-4">
                {BRAND_PILLARS.map((pillar) => (
                  <article key={pillar.title} className="bg-white rounded-xl border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-900">{pillar.title}</h4>
                    <p className="mt-1.5 text-sm text-gray-600">{pillar.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">What Shapes Our Product Decisions</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {VALUES.map((value) => (
              <article key={value.title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <h3 className="text-lg font-semibold text-gray-900">{value.title}</h3>
                <p className="mt-3 text-sm text-gray-600">{value.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
