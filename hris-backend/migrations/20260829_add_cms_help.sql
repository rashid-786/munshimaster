-- ============================================================
-- Migration: CMS help & support content
-- ============================================================
-- Dynamic help topics, FAQs and support settings rendered by the
-- mobile Help & Support screen.
-- ============================================================

CREATE TABLE IF NOT EXISTS hris_saas.cms_help_topics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(60) NOT NULL UNIQUE,
  label         VARCHAR(120) NOT NULL,
  subtitle      VARCHAR(200),
  content       TEXT,
  icon          VARCHAR(10) DEFAULT '📘',
  sort_order    INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hris_saas.cms_help_faqs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      VARCHAR(300) NOT NULL,
  answer        TEXT NOT NULL,
  sort_order    INT NOT NULL DEFAULT 0,
  is_visible    BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hris_saas.cms_help_settings (
  id                 INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  hero_title         VARCHAR(200),
  hero_subtitle      VARCHAR(300),
  tutorials_title    VARCHAR(200),
  tutorials_subtitle VARCHAR(300),
  contact_whatsapp   VARCHAR(50),
  contact_phone      VARCHAR(50),
  contact_email      VARCHAR(200),
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed help topics with onboarding content
INSERT INTO hris_saas.cms_help_topics (key, label, subtitle, content, icon, sort_order) VALUES
('gettingStarted', 'Getting Started', 'Setup your business and basics',
 '<h3>Welcome to Bahi360</h3><p>Bahi360 is an all-in-one app to run your business — manage your Bahi Khata (ledger), staff, attendance, payroll, invoices and cash.</p><h3>First steps</h3><ul><li>Set up your business profile in <b>More → Business Setup</b>.</li><li>Add your buyers and sellers under <b>My Bahi Book</b>.</li><li>Add your staff under <b>My Staff</b>.</li><li>Choose the plan that fits from <b>More → Subscription & Billing</b>.</li></ul><p>Your data stays backed up and synced with your account — just sign in on any device.</p>',
 '🚀', 1),
('bahiBook', 'My Bahi Book', 'Buyers, sellers, ledger',
 '<h3>Bahi Book (Ledger)</h3><p>Track who owes you and who you owe with a digital khata.</p><h3>Add a buyer or seller</h3><ol><li>Open <b>My Bahi Book</b> from the home screen.</li><li>Tap <b>Buyers</b> or <b>Sellers</b>.</li><li>Tap <b>Add</b> and enter name, mobile and opening balance.</li></ol><h3>Record a transaction</h3><p>Open a party and tap <b>Add Credit</b> (sale on credit) or <b>Add Debit</b> (payment received). You can also record cash sales directly.</p>',
 '📖', 2),
('cashbook', 'Cashbook', 'Daily entries and cash flow',
 '<h3>Cashbook</h3><p>Record daily income and expenses to keep a running cash balance.</p><h3>Add an entry</h3><ol><li>Open <b>Cashbook</b>.</li><li>Tap <b>Add Entry</b>.</li><li>Choose the type (income or expense), enter the amount and a note, and save.</li></ol><p>Your cashbook automatically updates your running cash balance and appears in reports.</p>',
 '💰', 3),
('invoices', 'Invoices', 'Create and manage invoices',
 '<h3>Invoices</h3><p>Create professional invoices for your buyers and keep payment history.</p><h3>Create an invoice</h3><ol><li>Open <b>Invoices</b>.</li><li>Tap <b>Create Invoice</b>.</li><li>Select the buyer, add items, quantities and prices, then save.</li></ol><p>You can download or share invoices as PDFs, and mark them paid or partially paid.</p>',
 '📄', 4),
('staff', 'My Staff', 'Manage employees',
 '<h3>Manage Staff</h3><p>Add and manage your employees, their roles and pay.</p><h3>Add a staff member</h3><ol><li>Open <b>My Staff</b>.</li><li>Tap <b>Add Staff</b>.</li><li>Enter their name, role, salary type (monthly, hourly or pay-per-piece) and base rate.</li></ol><p>You can give advances, manage leaves and track piece-work rates from the staff profile.</p>',
 '👥', 5),
('attendance', 'Attendance', 'Mark and track attendance',
 '<h3>Attendance</h3><p>Mark staff attendance daily and view calendars for the month.</p><h3>Mark attendance</h3><ol><li>Open <b>Attendance</b>.</li><li>Select the date.</li><li>Mark each staff member present, on leave or half-day, and log hours if hourly.</li></ol><p>Attendance feeds directly into payroll so salary is calculated from actual work.</p>',
 '📅', 6),
('payroll', 'Payroll', 'Run payroll and salary slips',
 '<h3>Payroll</h3><p>Calculate and run payroll for your staff in a few taps.</p><h3>Run payroll</h3><ol><li>Open <b>Payroll</b>.</li><li>Choose the pay period (weekly, bi-weekly or monthly).</li><li>Select staff and tap <b>Generate</b>.</li><li>Review the preview and confirm.</li></ol><p>You can make <b>partial payments</b> — enter a partial amount to pay now. Salary slips and history are created automatically.</p>',
 '💳', 7),
('subscription', 'Subscription', 'Plans, billing and payments',
 '<h3>Subscription</h3><p>Manage your plan, billing and payment history.</p><h3>Upgrade or manage</h3><ol><li>Open <b>More → Subscription & Billing</b>.</li><li>Choose a plan and billing cycle.</li><li>Start a free trial or pay securely.</li></ol><p>You can view invoices, payment history and downgrade or cancel from the same screen.</p>',
 '⭐', 8)
ON CONFLICT (key) DO NOTHING;

-- Seed FAQs
INSERT INTO hris_saas.cms_help_faqs (question, answer, sort_order) VALUES
('How do I add a buyer or seller?', 'Open My Bahi Book from the home screen, tap Buyers or Sellers, then tap Add. Enter the name, mobile number and opening balance to save.', 1),
('How do I mark staff attendance?', 'Open Attendance, select the date, then mark each staff member present, on leave or half-day. Hours are logged automatically for hourly staff.', 2),
('How is advance deducted from payroll?', 'Advances given to staff are automatically deducted from their salary when you run payroll, based on the pending advance balance.', 3),
('Can I pay staff partially?', 'Yes. When running payroll, enter a partial amount for a staff member to pay part now. The remaining amount stays outstanding and appears on the salary slip.', 4),
('How do I create an invoice?', 'Open Invoices, tap Create Invoice, select the buyer, add items and quantities, then save. You can share or download it as a PDF.', 5),
('How do I upgrade my plan?', 'Go to More → Subscription & Billing, choose a plan and billing cycle, then start a free trial or pay securely.', 6),
('Is my data backed up?', 'Yes. Your data stays synced with your account and is restored when you sign in on any device. Paid plans can also download a full backup from More → Backup & Restore.', 7)
ON CONFLICT DO NOTHING;

-- Seed help settings
INSERT INTO hris_saas.cms_help_settings (id, hero_title, hero_subtitle, tutorials_title, tutorials_subtitle, contact_whatsapp, contact_phone, contact_email)
VALUES (1, 'How can we help?', 'Find answers or contact our support team.', 'Learn Bahi360', 'Watch tutorials and learn how to manage your business faster.', '971500000000', '', 'support@bahi360.com')
ON CONFLICT (id) DO NOTHING;