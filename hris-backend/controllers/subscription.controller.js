const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { getSubscriptionStatus, invalidateCache } = require('../utils/subscription');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_00000000000000',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'test_secret',
});

// =============================================
// Plan listing
// =============================================
exports.getPlans = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, name, price_inr, period, trial_days, features FROM subscription_plans WHERE is_active = true ORDER BY price_inr'
    );
    res.json({ plans: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch plans.' });
  }
};

// =============================================
// Get current subscription with features + usage
// =============================================
exports.getSubscription = async (req, res) => {
  try {
    const status = await getSubscriptionStatus(req.tenantId);
    res.json(status);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch subscription.' });
  }
};

// =============================================
// Legacy: select plan on first onboarding
// =============================================
exports.selectPlan = async (req, res) => {
  const tenantId = req.tenantId;
  const { plan } = req.body;

  const validPlans = ['free', 'business', 'pro', 'business_monthly', 'pro_monthly'];
  if (!validPlans.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Choose free, business, or pro.' });
  }

  try {
    // Deactivate existing subscription
    await db.execute(
      `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
       WHERE tenant_id = ? AND status IN ('active','trialing')`,
      [tenantId]
    );

    // Create new subscription
    const subId = uuidv4();
    const periodEnd = plan === 'free' ? '2099-12-31' : new Date(Date.now() + 14 * 86400000).toISOString();
    const status = plan === 'free' ? 'active' : 'trialing';
    const trialEnd = plan === 'free' ? null : new Date(Date.now() + 14 * 86400000);

    await db.execute(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
       VALUES (?, ?, ?, ?, ?, NOW(), ?)`,
      [subId, tenantId, plan, status, trialEnd, periodEnd]
    );

    await db.execute('UPDATE tenants SET subscription_plan = ? WHERE id = ?', [plan, tenantId]);

    invalidateCache(plan);
    res.json({ message: `Plan set to ${plan}.`, plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to set plan.' });
  }
};

// =============================================
// Profile completion (kept for backward compat)
// =============================================
exports.getProfileCompletion = async (req, res) => {
  const tenantId = req.tenantId;
  const employeeId = req.user.id;

  try {
    const [tenantRows] = await db.execute(
      'SELECT company_name, phone FROM tenants WHERE id = ?', [tenantId]
    );
    const [empRows] = await db.execute(
      'SELECT first_name, last_name, email FROM employees WHERE id = ? AND tenant_id = ?',
      [employeeId, tenantId]
    );

    if (tenantRows.length === 0 || empRows.length === 0) {
      return res.status(404).json({ error: 'Not found.' });
    }

    const tenant = tenantRows[0];
    const emp = empRows[0];

    const checks = [
      { field: 'company_name', label: 'Company Name', filled: !!tenant.company_name },
      { field: 'first_name', label: 'First Name', filled: !!emp.first_name },
      { field: 'last_name', label: 'Last Name', filled: !!emp.last_name },
      { field: 'email', label: 'Email', filled: !!emp.email },
      { field: 'phone', label: 'Phone Number', filled: !!tenant.phone },
    ];

    const filled = checks.filter(c => c.filled).length;
    const total = checks.length;
    const percent = Math.round((filled / total) * 100);

    res.json({ percent, filled, total, checks });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate profile completion.' });
  }
};

// =============================================
// FEATURE CHECK — used by frontend gating
// =============================================
exports.checkFeature = async (req, res) => {
  const { feature } = req.query;
  if (!feature) return res.status(400).json({ error: 'Feature key required.' });

  const { canAccess } = require('../utils/subscription');
  const result = await canAccess(req.tenantId, feature);
  res.json({ feature, ...result });
};

// =============================================
// RAZORPAY: Create order
// =============================================
exports.createOrder = async (req, res) => {
  const tenantId = req.tenantId;
  const { planId } = req.body;

  if (!planId || !['business', 'pro', 'business_monthly', 'pro_monthly'].includes(planId)) {
    return res.status(400).json({ error: 'Invalid plan.' });
  }

  try {
    const [plan] = await db.execute(
      'SELECT * FROM subscription_plans WHERE id = ? AND is_active = true', [planId]
    );
    if (plan.length === 0) return res.status(404).json({ error: 'Plan not found.' });

    const amount = Math.round(plan[0].price_inr * 100); // in paise
    const receipt = `bahi_${tenantId.slice(0, 8)}_${Date.now()}`;

    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      receipt,
      notes: { tenant_id: tenantId, plan_id: planId },
    });

    // Calculate expected period
    const now = new Date();
    const periodEnd = new Date(now);
    if (planId.endsWith('_monthly')) {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Save pending payment
    await db.execute(
      `INSERT INTO payments (id, tenant_id, order_id, amount, currency, status, plan_id, receipt, period_start, period_end)
       VALUES (?, ?, ?, ?, ?, 'created', ?, ?, NOW(), ?)`,
      [uuidv4(), tenantId, order.id, plan[0].price_inr, 'INR', planId, receipt, periodEnd]
    );

    // Get tenant info for prefill
    const [tenant] = await db.execute(
      'SELECT company_name FROM tenants WHERE id = ?', [tenantId]
    );
    const [admin] = await db.execute(
      "SELECT email, phone FROM employees WHERE tenant_id = ? AND role = 'tenant_admin' LIMIT 1",
      [tenantId]
    );

    res.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.RAZORPAY_KEY_ID,
      tenantName: tenant[0]?.company_name || '',
      email: admin[0]?.email || '',
      contact: admin[0]?.phone || '',
      period: plan[0].period,
    });
  } catch (error) {
    console.error('Razorpay createOrder error:', error);
    res.status(500).json({ error: 'Failed to create payment order.' });
  }
};

// =============================================
// RAZORPAY: Verify payment after success
// =============================================
exports.verifyPayment = async (req, res) => {
  const tenantId = req.tenantId;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId } = req.body;

  // Verify signature
  const body = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment verification failed.' });
  }

  try {
    const [plan] = await db.execute(
      'SELECT * FROM subscription_plans WHERE id = ?', [planId]
    );
    if (plan.length === 0) return res.status(404).json({ error: 'Plan not found.' });

    // Calculate period based on plan
    const now = new Date();
    const periodEnd = new Date(now);
    if (planId.endsWith('_monthly')) {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    // Deactivate old subscription
    await db.execute(
      `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
       WHERE tenant_id = ? AND status IN ('active','trialing')`,
      [tenantId]
    );

    // Create new subscription
    const subId = uuidv4();
    await db.execute(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'active', NOW(), ?)`,
      [subId, tenantId, planId, periodEnd]
    );

    // Update tenant
    await db.execute('UPDATE tenants SET subscription_plan = ? WHERE id = ?', [planId, tenantId]);

    // Update payment record
    await db.execute(
      `UPDATE payments SET payment_id = ?, status = 'captured', subscription_id = ?,
       period_start = NOW(), period_end = ?
       WHERE order_id = ?`,
      [razorpay_payment_id, subId, periodEnd, razorpay_order_id]
    );

    invalidateCache(planId);

    res.json({
      message: 'Subscription activated!',
      plan: planId,
      validUntil: periodEnd,
    });
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ error: 'Failed to activate subscription.' });
  }
};

// =============================================
// RAZORPAY: Webhook (idempotent — async fallback)
// =============================================
exports.webhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];

  if (!secret) return res.status(200).json({ status: 'webhook not configured' });

  // req.body is a Buffer from express.raw middleware
  const rawBody = req.body;

  const isValid = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex') === signature;

  if (!isValid) return res.status(400).json({ error: 'Invalid signature' });

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = payload.event;
  const payment = payload.payload?.payment?.entity;
  const order = payload.payload?.order?.entity;

  try {
    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentId = payment?.id || order?.id;
      const orderId = payment?.order_id || order?.id;

      if (!orderId) return res.json({ status: 'skipped', reason: 'no order_id' });

      // Idempotency: skip if payment already processed (subscription exists)
      const [existingSub] = await db.execute(
        `SELECT s.id FROM subscriptions s
         JOIN payments p ON p.subscription_id = s.id
         WHERE p.order_id = ? AND s.status = 'active'`,
        [orderId]
      );
      if (existingSub.length > 0) return res.json({ status: 'duplicate' });

      // Also skip if payment record already has a payment_id (caught by verifyPayment)
      const [existingPay] = await db.execute(
        'SELECT id, tenant_id, plan_id, status FROM payments WHERE order_id = ?',
        [orderId]
      );
      if (existingPay.length === 0) {
        return res.json({ status: 'skipped', reason: 'order not found in payments table' });
      }

      const pay = existingPay[0];
      if (pay.status !== 'created') return res.json({ status: 'duplicate', reason: 'payment already processed' });

      const tenantId = pay.tenant_id;
      const planId = pay.plan_id;

      // Calculate period_end
      const periodEnd = new Date();
      if (planId.endsWith('_monthly')) {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      }

      // Deactivate old subscription
      await db.execute(
        `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
         WHERE tenant_id = ? AND status IN ('active','trialing')`,
        [tenantId]
      );

      // Create new subscription
      const subId = crypto.randomUUID();
      await db.execute(
        `INSERT INTO subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end)
         VALUES (?, ?, ?, 'active', NOW(), ?)`,
        [subId, tenantId, planId, periodEnd]
      );

      // Update tenant's plan
      await db.execute(
        `UPDATE tenants SET subscription_plan = ? WHERE id = ?`,
        [planId, tenantId]
      );

      // Update payment record
      await db.execute(
        `UPDATE payments SET payment_id = ?, status = 'captured', subscription_id = ?,
             period_start = NOW(), period_end = ?, error_details = ?
         WHERE order_id = ?`,
        [paymentId, subId, periodEnd, JSON.stringify(payment || order), orderId]
      );

      // Invalidate plan cache
      planCache.delete(tenantId);

      return res.json({ status: 'ok', event, action: 'subscription_activated' });
    }

    if (event === 'payment.failed') {
      if (!payment?.order_id) return res.json({ status: 'skipped', reason: 'no order_id' });

      const errorDetails = {
        id: payment.id,
        error_code: payment.error_code,
        error_description: payment.error_description,
        error_source: payment.error_source,
        error_step: payment.error_step,
        error_reason: payment.error_reason,
        method: payment.method,
      };

      // Also cancel the order if payment failed
      await db.execute(
        `UPDATE payments SET status = 'failed', payment_id = ?, error_details = ?
         WHERE order_id = ? AND status = 'created'`,
        [payment.id, JSON.stringify(errorDetails), payment.order_id]
      );

      return res.json({ status: 'ok', event, action: 'payment_failed_recorded' });
    }

    // Acknowledge other events silently
    res.json({ status: 'ok', event });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// =============================================
// Start trial for a paid plan
// =============================================
exports.startTrial = async (req, res) => {
  const tenantId = req.tenantId;
  const { planId } = req.body;

  if (!planId || !['business', 'pro', 'business_monthly', 'pro_monthly'].includes(planId)) {
    return res.status(400).json({ error: 'Invalid plan for trial.' });
  }

  try {
    const [plan] = await db.execute(
      'SELECT trial_days FROM subscription_plans WHERE id = ?', [planId]
    );
    if (plan.length === 0) return res.status(404).json({ error: 'Plan not found.' });

    const trialDays = plan[0].trial_days;
    const trialEnd = new Date(Date.now() + trialDays * 86400000);
    const periodEnd = new Date(Date.now() + trialDays * 86400000);

    // Deactivate old
    await db.execute(
      `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
       WHERE tenant_id = ? AND status IN ('active','trialing')`,
      [tenantId]
    );

    const subId = uuidv4();
    await db.execute(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
       VALUES (?, ?, ?, 'trialing', ?, NOW(), ?)`,
      [subId, tenantId, planId, trialEnd, periodEnd]
    );

    await db.execute('UPDATE tenants SET subscription_plan = ? WHERE id = ?', [planId, tenantId]);

    res.json({
      message: `Trial started! You have ${trialDays} days free.`,
      plan: planId,
      trialEndsAt: trialEnd,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to start trial.' });
  }
};

// =============================================
// DOWNGRADE PREVIEW — show what will be lost
// =============================================
exports.getDowngradePreview = async (req, res) => {
  try {
    const status = await getSubscriptionStatus(req.tenantId);
    if (!status || status.plan === 'free') {
      return res.json({ plan: 'free', willLose: [], willKeep: [] });
    }

    const [freePlan] = await db.execute(
      'SELECT features FROM subscription_plans WHERE id = ?', ['free']
    );
    const currentFeatures = status.features || {};
    const freeFeatures = freePlan.length > 0 ? freePlan[0].features : {};

    const willLose = [];
    const willKeep = [];

    const LABEL_MAP = {
      ledger_customers: 'Unlimited Ledger Customers',
      staff_members: 'Unlimited Staff Members',
      monthly_txns: 'Unlimited Monthly Transactions',
      reports: 'Advanced Reports',
      invoices: 'Invoicing',
      purchase_orders: 'Purchase Orders',
      payroll: 'Payroll',
      inventory: 'Inventory',
      branches: 'Multi-Branch Support',
      export: 'Excel/PDF Export',
      whatsapp: 'WhatsApp Integration',
      api: 'API Access',
      branding: 'White-Label Branding',
      support: 'Priority Support',
    };

    for (const [key, label] of Object.entries(LABEL_MAP)) {
      const current = currentFeatures[key];
      const freeVal = freeFeatures[key];
      const currentUnlimited = current === -1;
      const currentEnabled = current === true;
      const currentString = typeof current === 'string' && current !== freeVal;
      const currentNumeric = typeof current === 'number' && current > 0 && (!freeVal || current > freeVal);

      if (currentUnlimited || currentEnabled || currentString || currentNumeric) {
        willLose.push(label);
      } else {
        willKeep.push(label);
      }
    }

    // Add usage-based context
    const [customerCount] = await db.execute(
      'SELECT COUNT(*) as c FROM customers WHERE tenant_id = ?', [req.tenantId]
    );
    const [staffCount] = await db.execute(
      'SELECT COUNT(*) as c FROM employees WHERE tenant_id = ? AND COALESCE(status,\'active\') != \'deactivated\'',
      [req.tenantId]
    );
    const customerTotal = Number(customerCount[0]?.c || 0);
    const staffTotal = Number(staffCount[0]?.c || 0);
    const freeCustomerLimit = Number(freeFeatures.ledger_customers || 0);
    const freeStaffLimit = Number(freeFeatures.staff_members || 0);

    const warnings = [];
    if (customerTotal > freeCustomerLimit && freeCustomerLimit > 0) {
      warnings.push(`You have ${customerTotal} customers — Free plan allows only ${freeCustomerLimit}. Some data will become inaccessible.`);
    }
    if (staffTotal > freeStaffLimit && freeStaffLimit > 0) {
      warnings.push(`You have ${staffTotal} staff members — Free plan allows only ${freeStaffLimit}. Extra staff accounts will be locked.`);
    }

    res.json({
      currentPlan: status.plan,
      currentPlanName: status.planName,
      willLose,
      willKeep,
      warnings,
    });
  } catch (error) {
    console.error('getDowngradePreview error:', error);
    res.status(500).json({ error: 'Failed to compute downgrade preview.' });
  }
};

// =============================================
// CANCEL — cancel at period end (no immediate downgrade)
// =============================================
exports.cancelSubscription = async (req, res) => {
  try {
    const [sub] = await db.execute(
      `SELECT id, plan_id, status, current_period_end
       FROM subscriptions
       WHERE tenant_id = ? AND status IN ('active','trialing')
       ORDER BY created_at DESC LIMIT 1`,
      [req.tenantId]
    );

    if (sub.length === 0) {
      return res.status(400).json({ error: 'No active subscription to cancel.' });
    }

    if (sub[0].plan_id === 'free') {
      return res.status(400).json({ error: 'Free plan cannot be cancelled.' });
    }

    if (sub[0].status === 'cancelled') {
      return res.status(400).json({ error: 'Already cancelled.' });
    }

    await db.execute(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW()
       WHERE id = ?`,
      [sub[0].id]
    );

    invalidateCache(sub[0].plan_id);

    res.json({
      message: 'Subscription cancelled. You retain access until ' + new Date(sub[0].current_period_end).toLocaleDateString(),
      plan: sub[0].plan_id,
      validUntil: sub[0].current_period_end,
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription.' });
  }
};

// =============================================
// Immediate downgrade (with confirmation)
// =============================================
exports.downgradeToFree = async (req, res) => {
  try {
    const [sub] = await db.execute(
      `SELECT id, plan_id, status
       FROM subscriptions
       WHERE tenant_id = ? AND status IN ('active','trialing','cancelled')
       ORDER BY created_at DESC LIMIT 1`,
      [req.tenantId]
    );

    if (sub.length === 0 || sub[0].plan_id === 'free') {
      return res.status(400).json({ error: 'Already on Free plan.' });
    }

    // Deactivate current
    await db.execute(
      `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
       WHERE id = ?`,
      [sub[0].id]
    );

    // Create free sub
    const subId = uuidv4();
    await db.execute(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end)
       VALUES (?, ?, 'free', 'active', NOW(), '2099-12-31')`,
      [subId, req.tenantId]
    );

    await db.execute(
      'UPDATE tenants SET subscription_plan = ? WHERE id = ?',
      ['free', req.tenantId]
    );

    invalidateCache('free');

    res.json({ message: 'Downgraded to Free plan.', plan: 'free' });
  } catch (error) {
    console.error('downgradeToFree error:', error);
    res.status(500).json({ error: 'Failed to downgrade.' });
  }
};

// =============================================
// Cancel an unpaid Razorpay order (mark as failed)
// =============================================
exports.cancelOrder = async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Order ID is required.' });

  try {
    await db.execute(
      `UPDATE payments SET status = 'failed' WHERE order_id = ? AND tenant_id = ? AND status = 'created'`,
      [orderId, req.tenantId]
    );
    res.json({ message: 'Order cancelled.' });
  } catch (error) {
    console.error('cancelOrder error:', error);
    res.status(500).json({ error: 'Failed to cancel order.' });
  }
};

// =============================================
// PAYMENT HISTORY
// =============================================
exports.getPaymentHistory = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.id, p.order_id, p.payment_id, p.amount, p.currency, p.status,
              p.plan_id, p.period_start, p.period_end, p.created_at,
              sp.name as plan_name
       FROM payments p
       LEFT JOIN subscription_plans sp ON p.plan_id = sp.id
       WHERE p.tenant_id = ?
       ORDER BY p.created_at DESC`,
      [req.tenantId]
    );

    res.json({ payments: rows });
  } catch (error) {
    console.error('getPaymentHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history.' });
  }
};

// =============================================
// RECEIPT — generate HTML receipt for a payment
// =============================================
exports.getReceipt = async (req, res) => {
  const { paymentId } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT p.*, sp.name as plan_name, t.company_name, t.subdomain
       FROM payments p
       JOIN tenants t ON p.tenant_id = t.id
       LEFT JOIN subscription_plans sp ON p.plan_id = sp.id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [paymentId, req.tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found.' });
    }

    const p = rows[0];
    const date = new Date(p.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const periodStart = p.period_start ? new Date(p.period_start).toLocaleDateString('en-IN') : '-';
    const periodEnd = p.period_end ? new Date(p.period_end).toLocaleDateString('en-IN') : '-';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt - ${p.company_name}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; max-width: 640px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
  .header { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px; }
  .header h1 { color: #0B3C5D; margin: 0; font-size: 24px; }
  .header p { color: #6b7280; margin: 4px 0 0; font-size: 14px; }
  .details { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .details div { flex: 1; }
  .details h3 { font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 4px; }
  .details p { margin: 0; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f9fafb; text-align: left; padding: 10px 12px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
  td { padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f3f4f6; }
  .total td { font-weight: 700; font-size: 16px; border-top: 2px solid #e5e7eb; }
  .footer { text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  .badge-success { background: #d1fae5; color: #065f46; }
  .badge-created { background: #fef3c7; color: #92400e; }
  .badge-failed { background: #fee2e2; color: #991b1b; }
</style></head><body>
  <div class="header">
    <h1>Bahi360</h1>
    <p>Payment Receipt</p>
  </div>
  <div class="details">
    <div>
      <h3>Bill To</h3>
      <p>${p.company_name}</p>
      <p style="font-size:12px;color:#6b7280;">${p.subdomain}.bahi360.com</p>
    </div>
    <div style="text-align:right;">
      <h3>Receipt Date</h3>
      <p>${date}</p>
      <h3 style="margin-top:12px;">Payment ID</h3>
      <p style="font-size:12px;word-break:break-all;">${p.payment_id || p.order_id || '-'}</p>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th>Period</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>
      <tr><td>${p.plan_name || p.plan_id}${p.plan_id && p.plan_id.endsWith('_monthly') ? ' — Monthly Subscription' : ' — Annual Subscription'}</td><td>${periodStart} – ${periodEnd}</td><td style="text-align:right;">₹${Number(p.amount).toLocaleString('en-IN')}</td></tr>
      <tr class="total"><td colspan="2">Total Paid</td><td style="text-align:right;">₹${Number(p.amount).toLocaleString('en-IN')}</td></tr>
    </tbody>
  </table>
  <div style="text-align:center;margin-bottom:24px;">
    <span class="badge badge-${p.status}">${p.status.charAt(0).toUpperCase() + p.status.slice(1)}</span>
  </div>
  <div class="footer">
    <p>Bahi360 — Your Business in One Place</p>
    <p>For support: support@bahi360.com</p>
  </div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('getReceipt error:', error);
    res.status(500).json({ error: 'Failed to generate receipt.' });
  }
};
