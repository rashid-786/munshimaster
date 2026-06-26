import { useState } from 'react';

const FAQS = [
  {
    q: 'What is bahi360 and how does it work?',
    a: 'bahi360 is a cloud-based business management platform that helps organizations manage employee data, payroll, attendance, leaves, and more. Simply register your organization, add your employees, and start managing your workforce from a single dashboard.',
  },
  {
    q: 'How is payroll calculated?',
    a: 'Payroll is calculated on an hourly basis. The hourly rate is derived from the employee\'s base salary divided by (working days × 8 hours). Overtime and deductions are applied automatically, and payslips are generated as downloadable PDFs.',
  },
  {
    q: 'Can I customize the working days and weekends?',
    a: 'Yes. You can configure which days of the week are working days and which are weekends in your organization settings. The system automatically adjusts attendance tracking and payroll calculations accordingly.',
  },
  {
    q: 'Is my data secure?',
    a: 'Absolutely. We use encrypted connections (HTTPS), hashed passwords (bcrypt), and role-based access control to ensure your data remains private and secure. Each tenant\'s data is fully isolated in our multi-tenant architecture.',
  },
  {
    q: 'Can employees log in with their phone number?',
    a: 'Yes. Employees can log in using either their email address or phone number, along with their password. Phone numbers are unique within each organization.',
  },
  {
    q: 'What file types are supported for uploads?',
    a: 'We support PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG, GIF, TXT, and CSV files. The maximum file size is 10MB per upload.',
  },
  {
    q: 'How do invoices and purchase orders work?',
    a: 'Invoices and purchase orders are auto-numbered sequentially per tenant (PO-0001, INV-0001). They include 18% GST auto-calculation and can be downloaded as PDFs. Status tracking helps you manage the workflow from draft to paid/received.',
  },
  {
    q: 'Can I change the brand color?',
    a: 'Yes. Organization administrators can customize the primary brand color from the Settings page. The entire interface adapts to your chosen color scheme.',
  },
  {
    q: 'Is there a mobile app?',
    a: 'Our platform is fully responsive and works on all devices through the web browser. A dedicated mobile application is on our roadmap.',
  },
  {
    q: 'How do I get started?',
    a: 'Simply click "Start Free Trial" to register your organization. You\'ll be guided through the setup process, and you can start adding employees and configuring your HR settings immediately.',
  },
];

const FaqItem = ({ faq, index }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border border-gray-200 rounded-xl overflow-hidden transition-all ${open ? 'shadow-sm' : ''}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900 pr-4">{faq.q}</span>
        <svg
          className={`w-5 h-5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-6 pb-4">
          <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
        </div>
      )}
    </div>
  );
};

export default function Faq() {
  return (
    <div>
      <section className="bg-gradient-to-br from-indigo-50 via-white to-indigo-50 py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900">Frequently Asked Questions</h1>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Everything you need to know about bahi360.
          </p>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          {FAQS.map((faq, i) => (
            <FaqItem key={i} faq={faq} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
