const express = require('express');
const cors = require('cors');
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
const balanceRoutes = require('./routes/balance.routes');
const reportRoutes = require('./routes/report.routes');
const kiranaRoutes = require('./routes/kirana.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const { planGate } = require('./middleware/planGate');
const db = require('./config/db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// 1. PUBLIC ROUTES (No Tenant Header Required)
// ==========================================
// This handles /api/v1/auth/register completely cleanly
app.use('/api/v1/auth', authRoutes);

// Public settings endpoint (no auth required)
app.get('/api/v1/public/settings', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT default_country_code FROM system_settings WHERE id = 1');
    res.json({ defaultCountryCode: rows.length > 0 ? rows[0].default_country_code : '+965' });
  } catch {
    res.json({ defaultCountryCode: '+965' });
  }
});


// ==========================================
// 2. PROTECTED MULTI-TENANT ROUTES
// ==========================================
// Any routes defined below this line will strictly require the X-Tenant-ID header
app.use('/api/v1/core', tenantResolver);
// Staff management (Enterprise only, rank 2)
app.use('/api/v1/core/employees', planGate(2), employeeRoutes);
app.use('/api/v1/core/time', planGate(2), timeRoutes);
app.use('/api/v1/core/payroll', planGate(2), payrollRoutes);
app.use('/api/v1/core/advances', planGate(2), advanceRoutes);

// Business module (Pro+, rank 1)
app.use('/api/v1/core/suppliers', planGate(1), supplierRoutes);
app.use('/api/v1/core/customers', planGate(1), customerRoutes);
app.use('/api/v1/core/purchase-orders', planGate(1), purchaseRoutes);
app.use('/api/v1/core/invoices', planGate(1), invoiceRoutes);
app.use('/api/v1/core/balance', planGate(1), balanceRoutes);
app.use('/api/v1/core/reports', planGate(1), reportRoutes);

// Available to all plans (no gate)
app.use('/api/v1/core/tenant', tenantRoutes);
app.use('/api/v1/core/uploads', uploadRoutes);
app.use('/api/v1/core/profile', profileRoutes);
app.use('/api/v1/core/kirana', kiranaRoutes);
app.use('/api/v1/core/subscription', subscriptionRoutes);
app.use('/uploads', express.static('uploads'));
app.use('/api/v1/uploads', express.static('uploads'));

// ==========================================
// 3. SUPER ADMIN ROUTES (No Tenant Header Required)
// ==========================================
app.use('/api/v1/super', superRoutes);

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
app.listen(PORT, () => console.log(`SaaS Backend running securely on port ${PORT}`));
