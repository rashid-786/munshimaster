const SERVICES = [
  {
    title: 'Employee Management',
    desc: 'Complete employee lifecycle management with role-based access, document storage, and automated onboarding workflows.',
    features: ['Role-based access control', 'Employee self-service portal', 'Document & file management', 'Automated onboarding'],
  },
  {
    title: 'Time & Attendance',
    desc: 'Real-time attendance tracking with clock-in/out, calendar views, and configurable weekend policies.',
    features: ['Clock-in/out tracking', 'Calendar-based attendance view', 'Configurable work week', 'Attendance reports & analytics'],
  },
  {
    title: 'Payroll Processing',
    desc: 'Hourly-rate payroll with auto-calculations, deduction management, and downloadable PDF payslips.',
    features: ['Hourly rate calculation', 'Deduction management', 'PDF payslip generation', 'Payroll history & reports'],
  },
  {
    title: 'Leave Management',
    desc: 'Streamlined leave requests with approval workflows, balance tracking, and department-wide reporting.',
    features: ['Leave request & approval', 'Balance tracking', 'Department reports', 'Configurable leave types'],
  },
  {
    title: 'Purchase Orders',
    desc: 'Create and manage purchase orders with auto-numbering, status tracking, and download capabilities.',
    features: ['Auto-numbered POs', 'Status tracking', 'PO history & search', 'PDF export'],
  },
  {
    title: 'Invoicing',
    desc: 'Professional invoice generation with auto-numbering, GST calculation, and payment status tracking.',
    features: ['Auto-numbered invoices', '18% GST auto-calculation', 'Payment status tracking', 'Invoice PDF download'],
  },
  {
    title: 'Supplier Management',
    desc: 'Centralized supplier directory with search, transaction history, and performance tracking.',
    features: ['Supplier directory', 'Transaction history', 'Search & filter', 'Contact management'],
  },
  {
    title: 'Customer Management',
    desc: 'Customer directory linked to invoices and orders, with full search and history capabilities.',
    features: ['Customer database', 'Invoice linkage', 'Order history', 'Search & filter'],
  },
];

export default function Services() {
  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Our Services</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Comprehensive HR solutions designed to scale with your organization.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SERVICES.map((s) => (
              <div key={s.title} className="p-6 lg:p-8 rounded-2xl border border-gray-100 bg-white hover:shadow-lg hover:border-indigo-100 transition-all">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">{s.desc}</p>
                <ul className="space-y-2">
                  {s.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
