const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Super Admin Service
 *
 * Shared utilities for the Super Admin module:
 * - Audit logging for all super admin actions
 * - Tenant section visibility management
 * - Plan features querying
 * - Campaign & referral management
 */

const SA_ACTIONS = {
  TENANT_CREATED: 'tenant.created',
  TENANT_UPDATED: 'tenant.updated',
  TENANT_DELETED: 'tenant.deleted',
  TENANT_SUSPENDED: 'tenant.suspended',
  TENANT_REACTIVATED: 'tenant.reactivated',
  TENANT_ADMIN_UPDATED: 'tenant.admin_updated',
  TENANT_NOTES_UPDATED: 'tenant.notes_updated',
  PLAN_FORCE_CHANGED: 'plan.force_changed',
  OVERRIDE_CREATED: 'override.created',
  OVERRIDE_UPDATED: 'override.updated',
  OVERRIDE_DELETED: 'override.deleted',
  EXTRA_QUOTA_GRANTED: 'quota.extra_granted',
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_DELETED: 'campaign.deleted',
  CAMPAIGN_ACTIVATED: 'campaign.activated',
  CAMPAIGN_DEACTIVATED: 'campaign.deactivated',
  REFERRAL_UPDATED: 'referral.updated',
  SECTION_VISIBILITY_UPDATED: 'section.visibility_updated',
  SECTION_HIDDEN: 'section.hidden',
  SECTION_SHOWN: 'section.shown',
  SECTION_READ_ONLY: 'section.read_only',
  CUSTOM_PLAN_CREATED: 'custom_plan.created',
  CUSTOM_PLAN_UPDATED: 'custom_plan.updated',
  CUSTOM_PLAN_ASSIGNED: 'custom_plan.assigned',
  CUSTOM_PLAN_REMOVED: 'custom_plan.removed',
  BRANDING_UPDATED: 'branding.updated',
  SYSTEM_SETTINGS_UPDATED: 'system.settings_updated',
  ADMIN_LOGIN: 'admin.login',
  ADMIN_USER_CHANGED: 'admin.user_changed',
  BULK_ACTION: 'admin.bulk_action',
  TENANT_PLAN_CHANGED: 'tenant.plan_changed',
  PLAN_CREATED: 'plan.created',
  PLAN_UPDATED: 'plan.updated',
  PLAN_DEACTIVATED: 'plan.deactivated',
  TRIAL_EXTENDED: 'tenant.trial_extended',
  EMPLOYEE_UPDATED: 'employee.updated',
};

/**
 * Log a super admin action to sa_action_log
 * Supports enhanced fields: oldValue, newValue, reason, actorRole, userAgent
 */
async function logAction({ adminId, adminName, action, entityType, entityId, tenantId, details, oldValue, newValue, reason, actorRole, req }) {
  try {
    const ip = req ? req.ip || req.connection?.remoteAddress || null : null;
    const ua = req ? req.headers?.['user-agent'] || null : null;
    await db.execute(
      `INSERT INTO hris_saas.sa_action_log
         (id, admin_id, admin_name, actor_role, action, entity_type, entity_id, tenant_id,
          old_value, new_value, reason, details, ip_address, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), adminId, adminName, actorRole || 'super_admin', action,
        entityType || null, entityId || null, tenantId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        reason || null,
        details ? JSON.stringify(details) : null,
        ip, ua,
      ]
    );
  } catch (err) {
    console.error('[SuperAdminService] Log error:', err.message);
  }
}

/**
 * Also log to tenant audit_logs for tenant-scoped actions
 */
async function logTenantAudit({ tenantId, actorId, actorName, action, entityType, entityId, changes, req }) {
  try {
    const ip = req ? req.ip || req.connection?.remoteAddress || null : null;
    await db.execute(
      `INSERT INTO hris_saas.audit_logs
         (id, tenant_id, actor_id, actor_name, action, entity_type, entity_id, changes, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), tenantId, actorId || null, actorName || null, action,
        entityType || null, entityId || null,
        changes ? JSON.stringify(changes) : null,
        ip,
      ]
    );
  } catch (err) {
    console.error('[SuperAdminService] Tenant audit error:', err.message);
  }
}

/**
 * Get or create section visibility rows for a tenant
 */
async function ensureSectionVisibility(tenantId) {
  const sections = ['entities', 'my_bahi_book', 'my_staff', 'my_business', 'settings'];
  const [tenantRows] = await db.execute(
    'SELECT subscription_plan FROM hris_saas.tenants WHERE id = ?', [tenantId]
  );
  const plan = tenantRows[0]?.subscription_plan || 'FREE';

  const defaults = {
    entities: true,
    my_bahi_book: plan === 'FREE' || plan === 'MANAGE',
    my_staff: plan === 'MANAGE' || plan === 'BUSINESS' || plan === 'BUSINESS_PRO',
    my_business: plan === 'BUSINESS' || plan === 'BUSINESS_PRO',
    settings: true,
  };

  for (const key of sections) {
    const [existing] = await db.execute(
      'SELECT id FROM hris_saas.tenant_section_visibility WHERE tenant_id = ? AND section_key = ?',
      [tenantId, key]
    );
    if (existing.length === 0) {
      await db.execute(
        'INSERT INTO hris_saas.tenant_section_visibility (id, tenant_id, section_key, visible) VALUES (?, ?, ?, ?)',
        [uuidv4(), tenantId, key, defaults[key]]
      );
    }
  }
}

/**
 * Get section visibility for a tenant
 */
async function getSectionVisibility(tenantId) {
  const [rows] = await db.execute(
    'SELECT section_key, visible, reason, updated_at FROM hris_saas.tenant_section_visibility WHERE tenant_id = ? ORDER BY section_key',
    [tenantId]
  );
  return rows;
}

/**
 * Update section visibility for a tenant
 */
async function updateSectionVisibility(tenantId, sectionKey, visible, reason, setBy) {
  const [existing] = await db.execute(
    'SELECT id FROM hris_saas.tenant_section_visibility WHERE tenant_id = ? AND section_key = ?',
    [tenantId, sectionKey]
  );

  if (existing.length > 0) {
    await db.execute(
      'UPDATE hris_saas.tenant_section_visibility SET visible = ?, reason = ?, set_by = ?, updated_at = NOW() WHERE tenant_id = ? AND section_key = ?',
      [visible, reason || null, setBy || null, tenantId, sectionKey]
    );
  } else {
    await db.execute(
      'INSERT INTO hris_saas.tenant_section_visibility (id, tenant_id, section_key, visible, reason, set_by) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), tenantId, sectionKey, visible, reason || null, setBy || null]
    );
  }
}

/**
 * Get all plan features for a specific plan
 */
async function getPlanFeatures(planId) {
  const [rows] = await db.execute(
    'SELECT * FROM hris_saas.plan_features WHERE plan_id = ? ORDER BY feature_type, feature_key',
    [planId]
  );
  return rows;
}

/**
 * Get all features across all plans (for super admin overview)
 */
async function getAllPlanFeatures() {
  const [rows] = await db.execute(
    `SELECT pf.*, sp.name as plan_name
     FROM hris_saas.plan_features pf
     JOIN hris_saas.subscription_plans sp ON pf.plan_id = sp.id
     ORDER BY sp.id, pf.feature_key`
  );
  return rows;
}

/**
 * Update a plan feature
 */
async function updatePlanFeature(planId, featureKey, updates) {
  const sets = [];
  const params = [];

  if (updates.enabled !== undefined) {
    sets.push('enabled = ?');
    params.push(updates.enabled);
  }
  if (updates.max_value !== undefined) {
    sets.push('max_value = ?');
    params.push(updates.max_value);
  }
  if (updates.config !== undefined) {
    sets.push('config = ?');
    params.push(JSON.stringify(updates.config));
  }

  if (sets.length === 0) return null;

  params.push(planId, featureKey);
  await db.execute(
    `UPDATE hris_saas.plan_features SET ${sets.join(', ')} WHERE plan_id = ? AND feature_key = ?`,
    params
  );

  const [updated] = await db.execute(
    'SELECT * FROM hris_saas.plan_features WHERE plan_id = ? AND feature_key = ?',
    [planId, featureKey]
  );
  return updated[0] || null;
}

/**
 * Get all subscription plans (with feature counts)
 */
async function getAllPlans() {
  const [plans] = await db.execute(
    `SELECT sp.*,
            (SELECT COUNT(*) FROM hris_saas.plan_features pf WHERE pf.plan_id = sp.id) as feature_count,
            (SELECT COUNT(*) FROM hris_saas.subscriptions s WHERE s.plan_id = sp.id AND s.status IN ('active','trialing')) as active_subscribers
     FROM hris_saas.subscription_plans sp
     ORDER BY sp.id`
  );
  return plans;
}

/**
 * Get campaigns list with stats
 */
async function getCampaigns() {
  const [rows] = await db.execute(
    `SELECT c.*,
            (SELECT COUNT(*) FROM campaign_redemptions cr WHERE cr.campaign_id = c.id) as total_redemptions
     FROM campaigns c
     ORDER BY c.created_at DESC`
  );
  return rows;
}

/**
 * Create a campaign
 */
async function createCampaign(data) {
  const id = uuidv4();
  await db.execute(
    `INSERT INTO campaigns (id, name, description, discount_pct, discount_months, code, applies_to, max_redemptions, starts_at, ends_at, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      id, data.name, data.description || null,
      data.discountPct || null, data.discountMonths || null,
      data.code || null, data.appliesTo || 'all',
      data.maxRedemptions || 0,
      data.startsAt, data.endsAt,
      data.isActive !== undefined ? data.isActive : true,
    ]
  );
  const [campaign] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
  return campaign[0];
}

/**
 * Update a campaign
 */
async function updateCampaign(id, data) {
  const sets = [];
  const params = [];

  const fields = {
    name: 'name', description: 'description',
    discountPct: 'discount_pct', discountMonths: 'discount_months',
    code: 'code', appliesTo: 'applies_to',
    maxRedemptions: 'max_redemptions', isActive: 'is_active',
    startsAt: 'starts_at', endsAt: 'ends_at',
  };

  for (const [key, col] of Object.entries(fields)) {
    if (data[key] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(data[key]);
    }
  }

  if (sets.length === 0) return null;

  params.push(id);
  await db.execute(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`, params);

  const [campaign] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
  return campaign[0];
}

/**
 * Delete a campaign
 */
async function deleteCampaign(id) {
  await db.execute('DELETE FROM campaign_redemptions WHERE campaign_id = ?', [id]);
  await db.execute('DELETE FROM campaigns WHERE id = ?', [id]);
}

/**
 * Get referral statistics
 */
async function getReferralStats() {
  const [totalReferrals] = await db.execute('SELECT COUNT(*) as c FROM referral_redemptions');
  const [pendingReferrals] = await db.execute("SELECT COUNT(*) as c FROM referral_redemptions WHERE status = 'pending'");
  const [creditedReferrals] = await db.execute("SELECT COUNT(*) as c FROM referral_redemptions WHERE status = 'credited'");
  const [topReferrers] = await db.execute(
    `SELECT rr.referrer_id, t.company_name, COUNT(*) as count
     FROM referral_redemptions rr
     JOIN hris_saas.tenants t ON rr.referrer_id = t.id
     GROUP BY rr.referrer_id, t.company_name
     ORDER BY count DESC LIMIT 10`
  );

  return {
    total: Number(totalReferrals[0]?.c || 0),
    pending: Number(pendingReferrals[0]?.c || 0),
    credited: Number(creditedReferrals[0]?.c || 0),
    topReferrers: topReferrers || [],
  };
}

/**
 * Get all referral redemptions with details
 */
async function getReferrals(limit = 50, offset = 0) {
  const [rows] = await db.execute(
    `SELECT rr.*,
            rt.company_name as referrer_name,
            rd.company_name as referred_name
     FROM referral_redemptions rr
     LEFT JOIN hris_saas.tenants rt ON rr.referrer_id = rt.id
     LEFT JOIN hris_saas.tenants rd ON rr.referred_id = rd.id
     ORDER BY rr.created_at DESC LIMIT ? OFFSET ?`,
    [String(limit), String(offset)]
  );
  const [countResult] = await db.execute('SELECT COUNT(*) as count FROM referral_redemptions');
  return { referrals: rows, total: Number(countResult[0]?.count || 0) };
}

/**
 * Update a referral redemption status
 */
async function updateReferral(id, status) {
  const valid = ['pending', 'credited', 'expired'];
  if (!valid.includes(status)) throw new Error(`Invalid status: ${status}. Valid: ${valid.join(', ')}`);

  const creditedAt = status === 'credited' ? 'NOW()' : null;
  if (creditedAt) {
    await db.execute(
      'UPDATE referral_redemptions SET status = ?, credited_at = NOW() WHERE id = ?',
      [status, id]
    );
  } else {
    await db.execute(
      'UPDATE referral_redemptions SET status = ? WHERE id = ?',
      [status, id]
    );
  }
}

/**
 * Get revenue analytics
 */
async function getRevenueAnalytics() {
  // Revenue by month (last 12 months)
  const [revenueByMonth] = await db.execute(
    `SELECT DATE_TRUNC('month', created_at) as month,
            SUM(amount) as revenue,
            COUNT(*) as payment_count
     FROM hris_saas.payments
     WHERE status IN ('captured', 'completed')
       AND created_at >= NOW() - INTERVAL '12 months'
     GROUP BY month ORDER BY month`
  );

  // Revenue by plan
  const [revenueByPlan] = await db.execute(
    `SELECT p.plan_id, sp.name as plan_name,
            SUM(p.amount) as revenue,
            COUNT(*) as payment_count
     FROM hris_saas.payments p
     JOIN hris_saas.subscription_plans sp ON p.plan_id = sp.id
     WHERE p.status IN ('captured', 'completed')
     GROUP BY p.plan_id, sp.name
     ORDER BY revenue DESC`
  );

  // Total revenue (all time)
  const [totalRevenue] = await db.execute(
    "SELECT COALESCE(SUM(amount),0) as total FROM hris_saas.payments WHERE status IN ('captured', 'completed')"
  );

  // Revenue this month
  const [monthlyRevenue] = await db.execute(
    `SELECT COALESCE(SUM(amount),0) as total
     FROM hris_saas.payments
     WHERE status IN ('captured', 'completed')
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`
  );

  // Previous month revenue
  const [prevMonthRevenue] = await db.execute(
    `SELECT COALESCE(SUM(amount),0) as total
     FROM hris_saas.payments
     WHERE status IN ('captured', 'completed')
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')`
  );

  // MRR (sum of active subscription amounts / 12 for yearly)
  const [mrr] = await db.execute(
    `SELECT COALESCE(SUM(
       CASE
         WHEN sp.period = 'year' THEN sp.price_inr / 12
         WHEN sp.period = 'month' THEN sp.price_inr
         ELSE sp.price_inr
       END
     ), 0) as mrr
     FROM hris_saas.subscriptions s
     JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
     WHERE s.status IN ('active', 'trialing')`
  );

  return {
    totalRevenue: Number(totalRevenue[0]?.total || 0),
    monthlyRevenue: Number(monthlyRevenue[0]?.total || 0),
    prevMonthRevenue: Number(prevMonthRevenue[0]?.total || 0),
    mrr: Number(mrr[0]?.mrr || 0),
    revenueByMonth: revenueByMonth || [],
    revenueByPlan: revenueByPlan || [],
  };
}

/**
 * Get subscription distribution analytics
 */
async function getSubscriptionAnalytics() {
  const [total] = await db.execute('SELECT COUNT(*) as c FROM hris_saas.subscriptions');
  const [byStatus] = await db.execute(
    `SELECT status, COUNT(*) as count FROM hris_saas.subscriptions GROUP BY status`
  );
  const [byPlan] = await db.execute(
    `SELECT s.plan_id, sp.name as plan_name, COUNT(*) as count
     FROM hris_saas.subscriptions s
     JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
     WHERE s.status IN ('active', 'trialing')
     GROUP BY s.plan_id, sp.name
     ORDER BY count DESC`
  );
  const [trials] = await db.execute(
    `SELECT COUNT(*) as c FROM hris_saas.subscriptions WHERE status = 'trialing'`
  );
  const [expiredSoon] = await db.execute(
    `SELECT COUNT(*) as c FROM hris_saas.subscriptions
     WHERE status = 'active'
       AND current_period_end BETWEEN NOW() AND NOW() + INTERVAL '7 days'`
  );

  return {
    total: Number(total[0]?.c || 0),
    byStatus: byStatus || [],
    byPlan: byPlan || [],
    activeTrials: Number(trials[0]?.c || 0),
    expiringWithin7Days: Number(expiredSoon[0]?.c || 0),
  };
}

/**
 * Get tenant usage analytics
 */
async function getTenantUsageAnalytics() {
  const [totalTenants] = await db.execute('SELECT COUNT(*) as c FROM hris_saas.tenants');
  const [activeTenants] = await db.execute("SELECT COUNT(*) as c FROM hris_saas.tenants WHERE status = 'active'");
  const [byPlan] = await db.execute(
    `SELECT subscription_plan, COUNT(*) as count FROM hris_saas.tenants GROUP BY subscription_plan ORDER BY count DESC`
  );
  const [recentSignups] = await db.execute(
    `SELECT DATE_TRUNC('day', created_at) as day, COUNT(*) as count
     FROM hris_saas.tenants
     WHERE created_at >= NOW() - INTERVAL '30 days'
     GROUP BY day ORDER BY day`
  );

  return {
    total: Number(totalTenants[0]?.c || 0),
    active: Number(activeTenants[0]?.c || 0),
    byPlan: byPlan || [],
    recentSignups: recentSignups || [],
  };
}

// ═══════════════════════════════════════════════════════════
// TRIAL EXTENSION
// ═══════════════════════════════════════════════════════════

const EXTENSION_REASONS = ['sales_follow_up', 'customer_request', 'promotional_offer', 'internal_testing', 'payment_delay', 'other'];

/**
 * Extend a tenant's trial period
 */
async function extendTrial(tenantId, opts = {}) {
  const { extensionType, extensionDays, customTrialEndDate, reason, adminId, adminName, req } = opts;

  if (!reason || !EXTENSION_REASONS.includes(reason)) {
    throw new Error(`Invalid reason. Allowed: ${EXTENSION_REASONS.join(', ')}`);
  }

  const [tenants] = await db.execute(
    `SELECT t.id, t.company_name, t.subscription_plan, t.subscription_status, t.status,
            s.id as sub_id, s.trial_ends_at, s.current_period_end, s.status as sub_status
     FROM hris_saas.tenants t
     LEFT JOIN hris_saas.subscriptions s ON s.tenant_id = t.id AND s.status IN ('trialing', 'active')
     WHERE t.id = ?`,
    [tenantId]
  );
  if (tenants.length === 0) throw new Error('Tenant not found.');

  const tenant = tenants[0];
  const now = new Date();

  // Calculate new trial end date
  let newTrialEnd;
  if (customTrialEndDate) {
    newTrialEnd = new Date(customTrialEndDate);
  } else if (extensionType === 'custom_days' && extensionDays) {
    newTrialEnd = new Date(now);
    newTrialEnd.setDate(newTrialEnd.getDate() + Number(extensionDays));
  } else if (extensionType === '7') {
    newTrialEnd = new Date(now);
    newTrialEnd.setDate(newTrialEnd.getDate() + 7);
  } else if (extensionType === '15') {
    newTrialEnd = new Date(now);
    newTrialEnd.setDate(newTrialEnd.getDate() + 15);
  } else if (extensionType === '30') {
    newTrialEnd = new Date(now);
    newTrialEnd.setDate(newTrialEnd.getDate() + 30);
  } else if (extensionType === '60') {
    newTrialEnd = new Date(now);
    newTrialEnd.setDate(newTrialEnd.getDate() + 60);
  } else {
    throw new Error('Invalid extension type. Use: 7, 15, 30, 60, custom_days, or provide customTrialEndDate.');
  }

  // Validate new trial end is in the future
  if (newTrialEnd <= now) {
    throw new Error('New trial end date must be in the future.');
  }

  const oldTrialEnd = tenant.trial_ends_at;

  // Update or create subscription
  if (tenant.sub_id) {
    // Update existing subscription
    await db.execute(
      `UPDATE hris_saas.subscriptions SET
        trial_ends_at = ?,
        current_period_end = ?,
        status = 'trialing',
        updated_at = NOW()
       WHERE id = ?`,
      [newTrialEnd, newTrialEnd, tenant.sub_id]
    );
  } else {
    // Create new trial subscription
    const subId = uuidv4();
    await db.execute(
      `INSERT INTO hris_saas.subscriptions (id, tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, 'trialing', ?, NOW(), ?, NOW(), NOW())`,
      [subId, tenantId, tenant.subscription_plan || 'free', newTrialEnd, newTrialEnd]
    );
  }

  // Update tenant status
  await db.execute(
    `UPDATE hris_saas.tenants SET
      subscription_status = 'trialing',
      status = 'active',
      expiry_date = ?
     WHERE id = ?`,
    [newTrialEnd, tenantId]
  );

  // Log subscription event
  try {
    await db.execute(
      `INSERT INTO hris_saas.subscription_events (id, tenant_id, old_plan, new_plan, event_type, created_at)
       VALUES (?, ?, ?, ?, 'trial_extended', NOW())`,
      [uuidv4(), tenantId, tenant.subscription_plan || 'free', tenant.subscription_plan || 'free']
    );
  } catch (_) {}

  // Log to sa_action_log
  await logAction({
    adminId, adminName,
    action: SA_ACTIONS.TRIAL_EXTENDED,
    entityType: 'tenant', entityId: tenantId,
    tenantId,
    details: {
      companyName: tenant.company_name,
      oldTrialEnd,
      newTrialEnd,
      extensionType,
      extensionDays: extensionDays || null,
      reason,
    },
    req,
  });

  // Log to tenant audit log
  await logTenantAudit({
    tenantId, actorId: adminId, actorName: adminName,
    action: 'super_admin.trial_extended',
    entityType: 'subscription',
    changes: {
      oldTrialEnd,
      newTrialEnd,
      extensionType,
      extensionDays: extensionDays || null,
      reason,
    },
    req,
  });

  return {
    oldTrialEnd,
    newTrialEnd,
    extensionType,
    extensionDays: extensionDays || null,
    reason,
  };
}

// ═══════════════════════════════════════════════════════════
// SUBSCRIPTION PLAN MANAGEMENT
// ═══════════════════════════════════════════════════════════

const ALLOWED_PERIODS = ['month', 'quarter', 'year', 'custom', 'lifetime', 'trial'];

/**
 * Create a new subscription plan
 */
async function createPlan(data) {
  const { name, code, description, price, currency, period, trialDays, isActive } = data;

  if (!name || !code) throw new Error('name and code are required.');
  if (period && !ALLOWED_PERIODS.includes(period)) {
    throw new Error(`Invalid period. Allowed: ${ALLOWED_PERIODS.join(', ')}`);
  }

  const id = code.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const [existing] = await db.execute('SELECT id FROM hris_saas.subscription_plans WHERE id = ?', [id]);
  if (existing.length > 0) throw new Error(`Plan code "${id}" already exists.`);

  await db.execute(
    `INSERT INTO hris_saas.subscription_plans (id, name, price_inr, period, trial_days, features, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, '{}', ?, NOW())`,
    [id, name, price || 0, period || 'year', trialDays || 0, isActive !== undefined ? isActive : true]
  );

  // Seed default plan_features so the toggle UI has entries to work with
  const DEFAULT_FEATURES = [
    { feature_key: 'entities', feature_type: 'section', enabled: true, max_value: null },
    { feature_key: 'my_bahi_book', feature_type: 'section', enabled: true, max_value: null },
    { feature_key: 'settings', feature_type: 'section', enabled: true, max_value: null },
    { feature_key: 'invoices', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'payroll', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'attendance', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'leaves', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'advances', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'replacements', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'purchase_orders', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'inventory', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'balance_sheet', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'reports', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'advanced_reports', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'bank_import', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'gst_returns', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'e_invoicing', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'bulk_import', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'tally_export', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'tds_management', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'gstr2b_reco', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'audit_logs', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'recurring_invoices', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'credit_debit_notes', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'pl_statement', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'cash_flow', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'whatsapp', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'api_access', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'white_label', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'priority_support', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'multi_branch', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'staff_directory', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'customers', feature_type: 'limit', enabled: true, max_value: null },
    { feature_key: 'suppliers', feature_type: 'limit', enabled: true, max_value: null },
    { feature_key: 'staff_members', feature_type: 'limit', enabled: true, max_value: 2 },
    { feature_key: 'branches', feature_type: 'limit', enabled: true, max_value: 1 },
    { feature_key: 'monthly_transactions', feature_type: 'limit', enabled: true, max_value: 500 },
    { feature_key: 'products', feature_type: 'limit', enabled: true, max_value: null },
    { feature_key: 'cashbook_entries', feature_type: 'limit', enabled: true, max_value: 500 },
    { feature_key: 'buyers', feature_type: 'limit', enabled: true, max_value: null },
    { feature_key: 'sellers', feature_type: 'limit', enabled: true, max_value: null },
    { feature_key: 'expenses', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'business_dashboard', feature_type: 'boolean', enabled: false, max_value: null },
    { feature_key: 'kirana', feature_type: 'boolean', enabled: true, max_value: null },
    { feature_key: 'staff_count', feature_type: 'limit', enabled: true, max_value: 2 },
    { feature_key: 'transactions', feature_type: 'limit', enabled: true, max_value: 500 },
  ];

  for (const f of DEFAULT_FEATURES) {
    await db.execute(
      `INSERT INTO hris_saas.plan_features (id, plan_id, feature_key, feature_type, enabled, max_value, config)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [uuidv4(), id, f.feature_key, f.feature_type, f.enabled, f.max_value]
    );
  }

  const [plan] = await db.execute('SELECT * FROM hris_saas.subscription_plans WHERE id = ?', [id]);
  return plan[0];
}

/**
 * Update a subscription plan
 */
async function updatePlan(planId, data) {
  const [existing] = await db.execute('SELECT id FROM hris_saas.subscription_plans WHERE id = ?', [planId]);
  if (existing.length === 0) throw new Error('Plan not found.');

  const sets = [];
  const params = [];

  const fields = {
    name: 'name', price: 'price_inr',
    period: 'period', trialDays: 'trial_days', isActive: 'is_active',
  };

  for (const [key, col] of Object.entries(fields)) {
    if (data[key] !== undefined) {
      if (key === 'period' && !ALLOWED_PERIODS.includes(data[key])) {
        throw new Error(`Invalid period. Allowed: ${ALLOWED_PERIODS.join(', ')}`);
      }
      sets.push(`${col} = ?`);
      params.push(data[key]);
    }
  }

  if (sets.length === 0) throw new Error('No fields to update.');

  params.push(planId);
  await db.execute(`UPDATE hris_saas.subscription_plans SET ${sets.join(', ')} WHERE id = ?`, params);

  const [plan] = await db.execute('SELECT * FROM hris_saas.subscription_plans WHERE id = ?', [planId]);
  return plan[0];
}

/**
 * Deactivate/deprecate a plan (never delete — preserve subscription history)
 */
async function deactivatePlan(planId, status = 'inactive') {
  const [existing] = await db.execute('SELECT id FROM hris_saas.subscription_plans WHERE id = ?', [planId]);
  if (existing.length === 0) throw new Error('Plan not found.');

  await db.execute('UPDATE hris_saas.subscription_plans SET is_active = false WHERE id = ?', [planId]);
  return { id: planId, is_active: false };
}

/**
 * Delete a plan permanently (with safeguards)
 */
async function deletePlan(planId) {
  const [existing] = await db.execute('SELECT id, name, is_active FROM hris_saas.subscription_plans WHERE id = ?', [planId]);
  if (existing.length === 0) throw new Error('Plan not found.');

  // Prevent deleting plans that have active/trialing subscribers
  const [activeSubs] = await db.execute(
    "SELECT COUNT(*) as cnt FROM hris_saas.subscriptions WHERE plan_id = ? AND status IN ('active','trialing')",
    [planId]
  );
  if (Number(activeSubs[0].cnt) > 0) {
    throw new Error(`Cannot delete "${existing[0].name}" — ${activeSubs[0].cnt} tenant(s) have active subscriptions. Deactivate the plan instead.`);
  }

  // Check if any tenants currently have this plan assigned
  const [tenantsOnPlan] = await db.execute(
    'SELECT COUNT(*) as cnt FROM hris_saas.tenants WHERE subscription_plan = ?',
    [planId]
  );
  const tenantCount = Number(tenantsOnPlan[0].cnt);
  if (tenantCount > 0) {
    throw new Error(`Cannot delete "${existing[0].name}" — ${tenantCount} tenant(s) are currently assigned to this plan. Reassign them first.`);
  }

  // Delete plan features
  await db.execute('DELETE FROM hris_saas.plan_features WHERE plan_id = ?', [planId]);
  // Delete expired/cancelled subscriptions referencing this plan
  await db.execute("DELETE FROM hris_saas.subscriptions WHERE plan_id = ? AND status NOT IN ('active','trialing')", [planId]);
  // Delete the plan itself
  await db.execute('DELETE FROM hris_saas.subscription_plans WHERE id = ?', [planId]);

  return { deleted: true, planId };
}

/**
 * Bulk-upsert features for a plan (replaces all existing features)
 */
async function bulkUpdatePlanFeatures(planId, features) {
  if (!Array.isArray(features)) throw new Error('features must be an array.');

  const [existing] = await db.execute('SELECT id FROM hris_saas.subscription_plans WHERE id = ?', [planId]);
  if (existing.length === 0) throw new Error('Plan not found.');

  // Delete existing features for this plan
  await db.execute('DELETE FROM hris_saas.plan_features WHERE plan_id = ?', [planId]);

  // Insert new features
  for (const f of features) {
    await db.execute(
      `INSERT INTO hris_saas.plan_features (id, plan_id, feature_key, feature_type, enabled, max_value, config)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), planId,
        f.feature_key || f.featureKey,
        f.feature_type || f.featureType || 'boolean',
        f.enabled !== undefined ? f.enabled : true,
        f.max_value !== undefined ? f.max_value : (f.maxValue !== undefined ? f.maxValue : null),
        f.config ? JSON.stringify(f.config) : null,
      ]
    );
  }

  // Clear the features cache so subsequent reads get fresh data
  try { require('../utils/subscription').invalidateCache(planId); } catch (e) {}

  // Sync plan_features back to the JSONB column on subscription_plans,
  // including legacy key mappings so frontend DB_LIMIT_MAP lookups work
  await db.execute(
    `UPDATE hris_saas.subscription_plans sp
     SET features = COALESCE(sp.features, '{}'::jsonb) || (
       WITH pf_values AS (
         SELECT feature_key,
            CASE
              WHEN feature_type IN ('boolean','section') THEN to_jsonb(enabled)
              WHEN feature_type = 'limit' AND NOT enabled THEN to_jsonb(0)
              WHEN feature_type = 'limit' AND max_value IS NOT NULL THEN to_jsonb(max_value)
              WHEN feature_type = 'limit' AND max_value IS NULL THEN to_jsonb(-1)
              WHEN feature_type = 'config' AND config IS NOT NULL THEN config
              ELSE to_jsonb(enabled)
            END AS val
         FROM hris_saas.plan_features
         WHERE plan_id = sp.id
       ),
       pf_mapped AS (
         SELECT feature_key, val FROM pf_values
         UNION ALL
         SELECT mk.legacy_key, pfv.val
         FROM pf_values pfv
         JOIN (VALUES
           ('monthly_transactions','monthly_txns'),
           ('max_monthly_txns','monthly_txns'),
           ('customers','ledger_customers'),
           ('max_customers','ledger_customers'),
           ('staff_members','staff_members'),
           ('max_staff','staff_members'),
           ('branches','branches'),
           ('max_branches','branches'),
           ('suppliers','suppliers'),
           ('max_suppliers','suppliers'),
           ('products','products'),
           ('max_products','products')
         ) AS mk(plan_key, legacy_key) ON pfv.feature_key = mk.plan_key
       )
       SELECT COALESCE(jsonb_object_agg(feature_key, val), '{}'::jsonb)
       FROM pf_mapped
       WHERE feature_key IS NOT NULL
     )
     WHERE sp.id = ?`,
    [planId]
  );

  return { planId, featureCount: features.length };
}

/**
 * Change a tenant's plan (with audit trail)
 */
async function changeTenantPlan(tenantId, newPlan, opts = {}) {
  const { adminId, adminName, reason, startDate, endDate, trialStartDate, trialEndDate } = opts;

  const [tenants] = await db.execute('SELECT id, company_name, subscription_plan, subscription_status FROM hris_saas.tenants WHERE id = ?', [tenantId]);
  if (tenants.length === 0) throw new Error('Tenant not found.');
  const tenant = tenants[0];

  const [planRows] = await db.execute('SELECT * FROM hris_saas.subscription_plans WHERE id = ?', [newPlan.toLowerCase()]);
  if (planRows.length === 0) throw new Error(`Plan "${newPlan}" not found.`);

  const oldPlan = tenant.subscription_plan || 'free';

  // Update tenant's subscription_plan
  await db.execute(
    'UPDATE hris_saas.tenants SET subscription_plan = ? WHERE id = ?',
    [newPlan.toLowerCase(), tenantId]
  );

  // Update or create a subscription record
  const [existingSub] = await db.execute(
    "SELECT id FROM hris_saas.subscriptions WHERE tenant_id = ? AND status IN ('active', 'trialing') LIMIT 1",
    [tenantId]
  );

  if (existingSub.length > 0) {
    await db.execute(
      `UPDATE hris_saas.subscriptions SET plan_id = ?, status = 'active',
       current_period_start = ?, current_period_end = ?,
       trial_ends_at = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        newPlan.toLowerCase(),
        startDate || new Date(),
        endDate || '2099-12-31',
        trialEndDate || null,
        existingSub[0].id,
      ]
    );
  } else {
    await db.execute(
      `INSERT INTO hris_saas.subscriptions (id, tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        uuidv4(), tenantId, newPlan.toLowerCase(),
        trialEndDate ? 'trialing' : 'active',
        trialEndDate || null,
        startDate || new Date(),
        endDate || '2099-12-31',
      ]
    );
  }

  // Log subscription event
  try {
    await db.execute(
      `INSERT INTO hris_saas.subscription_events (id, tenant_id, old_plan, new_plan, event_type, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), tenantId, oldPlan, newPlan.toLowerCase(), 'admin_change']
    );
  } catch (_) {}

  // Log to sa_action_log
  await logAction({
    adminId, adminName,
    action: SA_ACTIONS.TENANT_PLAN_CHANGED,
    entityType: 'tenant', entityId: tenantId,
    tenantId,
    details: { oldPlan: tenant.subscription_plan, newPlan: newPlan.toLowerCase(), reason, companyName: tenant.company_name },
    req: opts.req,
  });

  // Log to tenant audit log
  await logTenantAudit({
    tenantId, actorId: adminId, actorName: adminName,
    action: 'super_admin.plan_changed',
    entityType: 'subscription', entityId: tenantId,
    changes: { oldPlan: tenant.subscription_plan, newPlan: newPlan.toLowerCase(), reason, startDate, endDate, trialStartDate, trialEndDate },
    req: opts.req,
  });

  return {
    oldPlan: tenant.subscription_plan,
    newPlan: newPlan.toLowerCase(),
    status: trialEndDate ? 'trialing' : 'active',
  };
}

module.exports = {
  SA_ACTIONS,
  logAction,
  logTenantAudit,
  ensureSectionVisibility,
  getSectionVisibility,
  updateSectionVisibility,
  getPlanFeatures,
  getAllPlanFeatures,
  updatePlanFeature,
  getAllPlans,
  createPlan,
  updatePlan,
  deactivatePlan,
  deletePlan,
  bulkUpdatePlanFeatures,
  changeTenantPlan,
  extendTrial,
  getCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getReferralStats,
  getReferrals,
  updateReferral,
  getRevenueAnalytics,
  getSubscriptionAnalytics,
  getTenantUsageAnalytics,
};
