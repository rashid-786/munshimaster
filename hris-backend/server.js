process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err?.message || err);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err?.message || err);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const tenantResolver = require('./middleware/tenant');
const authRoutes = require('./routes/auth.routes');
const employeeRoutes = require('./routes/employee.routes');
const timeRoutes = require('./routes/time.routes');
const payrollRoutes = require('./routes/payroll.routes');
const tenantRoutes = require('./routes/tenant.routes');
const supplierRoutes = require('./routes/supplier.routes');
const customerRoutes = require('./routes/customer.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const uploadRoutes = require('./routes/upload.routes');
const profileRoutes = require('./routes/profile.routes');
const superRoutes = require('./routes/super.routes');
const advanceRoutes = require('./routes/advance.routes');
const importRoutes = require('./routes/import.routes');
const auditRoutes = require('./routes/audit.routes');
const replacementRoutes = require('./routes/replacement.routes');
const balanceRoutes = require('./routes/balance.routes');
const reportRoutes = require('./routes/report.routes');
const kiranaRoutes = require('./routes/kirana.routes');
const notificationRoutes = require('./routes/notification.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const subscriptionController = require('./controllers/subscription.controller');
const retentionRoutes = require('./routes/retention.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const emailLogRoutes = require('./routes/emailLog.routes');
const productRoutes = require('./routes/product.routes');
const stockRoutes = require('./routes/stock.routes');
const complianceRoutes = require('./routes/compliance.routes');
const searchRoutes = require('./routes/search.routes');
const pieceWorkRoutes = require('./routes/pieceWork.routes');
const recurringInvoiceRoutes = require('./routes/recurringInvoice.routes');
const bankRoutes = require('./routes/bank.routes');
const whatsappRoutes = require('./routes/whatsapp.routes');
const einvoiceRoutes = require('./routes/einvoice.routes');
const paymentLinkRoutes = require('./routes/paymentLink.routes');
const noteRoutes = require('./routes/note.routes');
const ewaybillRoutes = require('./routes/ewaybill.routes');
const gstReturnRoutes = require('./routes/gstReturn.routes');
const gstr2bRoutes = require('./routes/gstr2b.routes');
const tdsRoutes = require('./routes/tds.routes');
const tallyRoutes = require('./routes/tally.routes');
const brandingRoutes = require('./routes/branding.routes');
const bulkImportRoutes = require('./routes/bulkImport.routes');
const cashFlowRoutes = require('./routes/cashFlow.routes');
const khataRoutes = require('./routes/khata.routes');
const portalRoutes = require('./routes/portal.routes');
const entityRoutes = require('./routes/entity.routes');
const consolidatedRoutes = require('./routes/consolidated.routes');
const invoiceTemplateRoutes = require('./routes/invoiceTemplate.routes');
const partyTransactionsRoutes = require('./controllers/partyTransactions.controller');
const transactionsRoutes = require('./routes/transactions.routes');
const { router: legalRoutes, publicRouter: legalPublicRoutes } = require('./routes/legal.routes');
const accountDeletionRoutes = require('./routes/accountDeletion.routes');
const cmsPublicRoutes = require('./routes/cms.routes');
const { planGate } = require('./middleware/planGate');
const { attachTenant } = require('./middleware/attachTenant');
const { requireFeature } = require('./middleware/requireFeature');
const { startLifecycleCron } = require('./cron/subscriptionLifecycle');
const { startAuditCleanupCron } = require('./cron/auditCleanup');
const { startNotificationCron } = require('./cron/notificationGenerator');
const { apiLimiter, paymentLimiter, superLimiter, publicLimiter, notificationsLimiter } = require('./middleware/rateLimiter');
const db = require('./config/db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use('/api/v1/core/subscription/webhook', express.raw({ type: 'application/json' }));
app.use('/api/v1/core/invoice-payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));

// ==========================================
// 1. PUBLIC ROUTES (No Tenant Header Required)
// ==========================================
app.use('/api/v1/auth', authRoutes);

// Public endpoints with generous rate limit
app.use('/api/v1/public', publicLimiter);
app.use('/api/v1/public/portal', portalRoutes);

// Public plan catalog — global, no tenant context required
app.get('/api/v1/core/subscription/plans', subscriptionController.getPlans);

// Public settings endpoint (no auth required)
app.get('/api/v1/public/settings', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT default_country_code FROM system_settings WHERE id = 1');
    res.json({ defaultCountryCode: rows.length > 0 ? rows[0].default_country_code : '+965' });
  } catch {
    res.json({ defaultCountryCode: '+965' });
  }
});

// Country detection endpoint (no auth required)
const COUNTRY_MAP = {
  KW: { code: '+965', country: 'KW', name: 'Kuwait' },
  SA: { code: '+966', country: 'SA', name: 'Saudi Arabia' },
  AE: { code: '+971', country: 'AE', name: 'UAE' },
  IN: { code: '+91', country: 'IN', name: 'India' },
  PK: { code: '+92', country: 'PK', name: 'Pakistan' },
  BD: { code: '+880', country: 'BD', name: 'Bangladesh' },
  EG: { code: '+20', country: 'EG', name: 'Egypt' },
  QA: { code: '+974', country: 'QA', name: 'Qatar' },
  BH: { code: '+973', country: 'BH', name: 'Bahrain' },
  OM: { code: '+968', country: 'OM', name: 'Oman' },
  US: { code: '+1', country: 'US', name: 'United States' },
  GB: { code: '+44', country: 'GB', name: 'United Kingdom' },
};
app.get('/api/v1/public/country', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT default_country_code, global_config FROM system_settings WHERE id = 1');
    if (rows.length > 0) {
      const gc = typeof rows[0].global_config === 'string' ? JSON.parse(rows[0].global_config) : (rows[0].global_config || {});
      const defaultCountry = gc.defaultCountry;
      if (defaultCountry && COUNTRY_MAP[defaultCountry]) {
        return res.json({ country: defaultCountry, countryCode: COUNTRY_MAP[defaultCountry].code });
      }
      const systemCode = rows[0].default_country_code || '+965';
      for (const [c, info] of Object.entries(COUNTRY_MAP)) {
        if (info.code === systemCode) { return res.json({ country: c, countryCode: info.code }); }
      }
    }
    res.json({ country: 'IN', countryCode: '+91' });
  } catch {
    res.json({ country: 'IN', countryCode: '+91' });
  }
});

// Global config endpoint (no auth required)
app.get('/api/v1/public/global-config', async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT global_config FROM system_settings WHERE id = 1");
    const gc = rows.length > 0 ? rows[0].global_config : {};
    const config = typeof gc === 'string' ? JSON.parse(gc) : (gc || {});
    res.json({ globalConfig: config });
  } catch {
    res.json({ globalConfig: {} });
  }
});

app.get('/api/v1/public/check-phone', async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: 'Phone number is required.' });
  try {
    const [rows] = await db.execute('SELECT id FROM tenants WHERE phone = ?', [phone]);
    res.json({ exists: rows.length > 0 });
  } catch { res.status(500).json({ error: 'Failed to check phone.' }); }
});

app.get('/api/v1/public/gst-tax', async (req, res) => {
  try {
    const ctrl = require('./controllers/gstTax.controller');
    return ctrl.listActive(req, res);
  } catch { res.status(500).json({ error: 'Failed to fetch GST rates.' }); }
});

app.get('/api/v1/public/units', async (req, res) => {
  try {
    const ctrl = require('./controllers/unitMaster.controller');
    return ctrl.listActive(req, res);
  } catch { res.status(500).json({ error: 'Failed to fetch units.' }); }
});

app.get('/api/v1/public/states', async (req, res) => {
  try {
    const countryCode = req.query.country_code || 'IN';
    const [rows] = await db.execute('SELECT id, state_name, state_code FROM hris_saas.system_states WHERE country_code = $1 ORDER BY state_name', [countryCode]);
    res.json({ states: rows });
  } catch (e) { console.error('/states error:', e.message); res.status(500).json({ error: 'Failed to fetch states.' }); }
});

// Realtime platform stats for the welcome/home screen (no auth required).
// Sources: active tenant accounts + branch (entity) city/location names.
app.get('/api/v1/public/stats', async (req, res) => {
  try {
    const [users] = await db.execute(
      "SELECT COUNT(*) AS c FROM hris_saas.tenants WHERE status IS DISTINCT FROM 'inactive'"
    );
    const [cityRows] = await db.execute(
      `SELECT COUNT(DISTINCT NULLIF(TRIM(branch_name), '')) AS c
         FROM hris_saas.tenants
        WHERE status = 'active'
          AND branch_name IS NOT NULL
          AND TRIM(branch_name) <> ''`
    );
    // `rating` stays null until a rating system exists.
    res.json({
      activeUsers: Number(users[0]?.c || 0),
      cities: Number(cityRows[0]?.c || 0),
      rating: null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

// Public legal document compliance URLs (e.g. /api/v1/public/legal/privacy-policy)
app.use('/api/v1/public/legal', legalPublicRoutes);

// Public CMS config + pages for the website
app.use('/api/v1/public/cms', cmsPublicRoutes);

// Contact form endpoint (no auth required)
app.post('/api/v1/public/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  if (!email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  try {
    const { sendEmail } = require('./utils/email');
    const html = `
      <div style="font-family: sans-serif; max-width: 600px;">
        <h2 style="color: #0B3C5D;">New Contact Form Inquiry</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Name</td><td style="padding: 8px 0;">${name.replace(/</g, '&lt;')}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email.replace(/</g, '&lt;')}">${email.replace(/</g, '&lt;')}</a></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-weight: 600; vertical-align: top;">Message</td><td style="padding: 8px 0;">${message.replace(/</g, '&lt;').replace(/\n/g, '<br>')}</td></tr>
        </table>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="color: #9ca3af; font-size: 12px;">Sent via bahi360.com contact form</p>
      </div>`;

    const { sent } = await sendEmail({
      to: process.env.SMTP_FROM || 'support@bahi360.com',
      subject: `Contact Form: ${name}`,
      html,
      replyTo: email,
    });

    if (sent) {
      res.json({ message: 'Thank you! We will get back to you soon.' });
    } else {
      res.status(500).json({ error: 'Failed to send message. Please try again later.' });
    }
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
});


// ==========================================
// 2. PROTECTED MULTI-TENANT ROUTES
// ==========================================

// Notification routes (before general apiLimiter to avoid getting blocked by high-volume core routes)
app.use('/api/v1/core/notifications', tenantResolver, notificationsLimiter, attachTenant, notificationRoutes);

app.use('/api/v1/core', tenantResolver, apiLimiter, attachTenant);
// Staff & attendance feature-gated routes
app.use('/api/v1/core/employees', requireFeature('staff_directory'), employeeRoutes);
app.use('/api/v1/core/time', requireFeature('attendance'), timeRoutes);
app.use('/api/v1/core/employees/import', requireFeature('staff_directory'), importRoutes);

// Payroll & HR (still plan-gated until feature config evolves)
app.use('/api/v1/core/payroll', planGate(1), payrollRoutes);
app.use('/api/v1/core/advances', planGate(1), advanceRoutes);
app.use('/api/v1/core/replacements', planGate(1), replacementRoutes);
app.use('/api/v1/core/audit-logs', planGate(2), auditRoutes);

// Business module (feature-gated)
app.use('/api/v1/core/customers', requireFeature('customers'), customerRoutes);
app.use('/api/v1/core/invoices', requireFeature('invoices'), invoiceRoutes);
app.use('/api/v1/core/products', requireFeature('inventory'), productRoutes);
app.use('/api/v1/core/stock', requireFeature('inventory'), stockRoutes);

// Business module (still plan-gated)
app.use('/api/v1/core/suppliers', planGate(0), supplierRoutes);
app.use('/api/v1/core/purchase-orders', planGate(1), purchaseRoutes);
app.use('/api/v1/core/balance', planGate(1), balanceRoutes);
app.use('/api/v1/core/reports', planGate(1), reportRoutes);

// Available to all plans (no gate)
app.use('/api/v1/core/tenant', tenantRoutes);
app.use('/api/v1/core/uploads', uploadRoutes);
app.use('/api/v1/core/profile', profileRoutes);
app.use('/api/v1/core/kirana', kiranaRoutes);
app.use('/api/v1/core/subscription', apiLimiter, subscriptionRoutes);
app.use('/api/v1/core/branding', brandingRoutes);
app.use('/api/v1/core/staff-reports', planGate(1), require('./routes/staffReports.routes'));
app.use('/api/v1/core/piece-work', planGate(1), pieceWorkRoutes);
app.use('/api/v1/core/retention', retentionRoutes);
app.use('/api/v1/core/dashboard', dashboardRoutes);
app.use('/api/v1/core/email-logs', emailLogRoutes);
app.use('/api/v1/core/compliance', complianceRoutes);
app.use('/api/v1/core/search', searchRoutes);
app.use('/api/v1/core/recurring-invoices', planGate(1), recurringInvoiceRoutes);
app.use('/api/v1/core/bank', planGate(1), bankRoutes);
app.use('/api/v1/core/whatsapp', planGate(1), whatsappRoutes);
app.use('/api/v1/core/einvoice', planGate(1), einvoiceRoutes);
app.use('/api/v1/core/invoice-payments', paymentLinkRoutes);
app.use('/api/v1/core/notes', planGate(1), noteRoutes);
app.use('/api/v1/core/gst-returns', planGate(1), gstReturnRoutes);
app.use('/api/v1/core/ewaybill', planGate(1), ewaybillRoutes);
app.use('/api/v1/core/gstr2b', planGate(1), gstr2bRoutes);
app.use('/api/v1/core/tds', planGate(1), tdsRoutes);
app.use('/api/v1/core/tally', tallyRoutes);
app.use('/api/v1/core/bulk-import', planGate(1), bulkImportRoutes);
app.use('/api/v1/core/cash-flow', planGate(1), cashFlowRoutes);
app.use('/api/v1/core/khata', khataRoutes);
app.use('/api/v1/core/entities', entityRoutes);
app.use('/api/v1/core/reports/consolidated', planGate(1), consolidatedRoutes);
app.use('/api/v1/core/transactions', requireFeature('invoices'), transactionsRoutes);
app.use('/api/v1/core/invoice-templates', invoiceTemplateRoutes);
app.use('/api/v1/core/legal', legalRoutes);
app.use('/api/v1/core/account-deletion', accountDeletionRoutes);
app.get('/api/v1/core/parties/:type/:id/transactions', partyTransactionsRoutes.getTransactions);
app.use('/uploads', express.static('uploads'));
app.use('/api/v1/uploads', express.static('uploads'));

// ==========================================
// 3. SUPER ADMIN ROUTES (No Tenant Header Required)
// ==========================================
app.use('/api/v1/super', superLimiter, superRoutes);

// Secure Test Route to verify multi-tenancy context later
const { authenticateToken } = require('./middleware/auth');
app.get('/api/v1/core/test-profile', authenticateToken, async (req, res) => {
  res.json({
    message: "Secure client isolation verified!",
    tenantContext: req.tenantId,
    userContext: req.user
  });
});


// Verify Database connectivity on startup
db.query('SELECT 1')
  .then(() => console.log('Database connection pool verified successfully.'))
  .catch(err => console.error('Database connection failed critical error:', err));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`SaaS Backend running securely on port ${PORT}`);
  // Start subscription expiry checker (every 10 minutes)
  if (process.env.NODE_ENV !== 'test') {
    startLifecycleCron(10 * 60 * 1000);
    startAuditCleanupCron(86400000);
   startNotificationCron(3600000);
  }
});
