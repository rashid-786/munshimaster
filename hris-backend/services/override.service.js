const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { invalidateCache } = require('../utils/subscription');

/**
 * Override Service
 *
 * Manages per-tenant feature limit overrides stored in the
 * `tenant_feature_overrides` table. These overrides take
 * precedence over plan-based limits in `canAccess()`.
 *
 * Each override has a `max_value` (the new limit) and an
 * optional `expires_at`. When `max_value` is NULL, the
 * feature is unlimited for this tenant.
 *
 * All changes are recorded in `override_history` for audit.
 */

const VALID_FEATURE_KEYS = [
  'customers', 'suppliers', 'staff_members', 'branches',
  'monthly_transactions', 'products', 'entities',
];

/**
 * List all overrides for a tenant.
 */
async function listOverrides(tenantId) {
  const [rows] = await db.execute(
    `SELECT * FROM hris_saas.tenant_feature_overrides
     WHERE tenant_id = ?
     ORDER BY feature_key`,
    [tenantId]
  );
  return rows.map(r => ({
    id: r.id,
    tenantId: r.tenant_id,
    featureKey: r.feature_key,
    maxValue: r.max_value,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
  }));
}

/**
 * Create or update a feature override for a tenant.
 */
async function setOverride({ tenantId, featureKey, maxValue, expiresAt, adminId, adminName, reason }) {
  if (!VALID_FEATURE_KEYS.includes(featureKey)) {
    throw new Error(`Invalid feature key: "${featureKey}". Valid keys: ${VALID_FEATURE_KEYS.join(', ')}`);
  }

  // Check existing
  const [existing] = await db.execute(
    `SELECT * FROM hris_saas.tenant_feature_overrides
     WHERE tenant_id = ? AND feature_key = ?`,
    [tenantId, featureKey]
  );

  const oldValue = existing.length > 0 ? existing[0].max_value : null;

  if (existing.length > 0) {
    // Update
    await db.execute(
      `UPDATE hris_saas.tenant_feature_overrides
       SET max_value = ?, expires_at = ?
       WHERE tenant_id = ? AND feature_key = ?`,
      [maxValue, expiresAt || null, tenantId, featureKey]
    );
  } else {
    // Create
    await db.execute(
      `INSERT INTO hris_saas.tenant_feature_overrides
         (id, tenant_id, feature_key, max_value, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, featureKey, maxValue, expiresAt || null]
    );
  }

  // Record in override_history
  await db.execute(
    `INSERT INTO hris_saas.override_history
       (id, tenant_id, admin_id, admin_name, action,
        feature_key, old_value, new_value, expires_at, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(), tenantId, adminId, adminName,
      existing.length > 0 ? 'updated' : 'created',
      featureKey, oldValue, maxValue, expiresAt || null, reason || null,
    ]
  );

  // Invalidate the plan cache so canAccess picks up the new limit
  try { invalidateCache(featureKey); } catch {}

  return { featureKey, maxValue, expiresAt };
}

/**
 * Remove a feature override.
 */
async function removeOverride({ tenantId, featureKey, adminId, adminName, reason }) {
  const [existing] = await db.execute(
    `SELECT * FROM hris_saas.tenant_feature_overrides
     WHERE tenant_id = ? AND feature_key = ?`,
    [tenantId, featureKey]
  );

  if (existing.length === 0) {
    throw new Error(`No override found for "${featureKey}" on this tenant.`);
  }

  const oldValue = existing[0].max_value;

  await db.execute(
    `DELETE FROM hris_saas.tenant_feature_overrides
     WHERE tenant_id = ? AND feature_key = ?`,
    [tenantId, featureKey]
  );

  // Record in override_history
  await db.execute(
    `INSERT INTO hris_saas.override_history
       (id, tenant_id, admin_id, admin_name, action,
        feature_key, old_value, new_value, expires_at, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(), tenantId, adminId, adminName,
      'deleted', featureKey, oldValue, null, null, reason || null,
    ]
  );

  try { invalidateCache(featureKey); } catch {}

  return { featureKey, deleted: true };
}

/**
 * Grant extra quota — convenience wrapper for creating
 * a time-limited override on a specific dimension.
 */
async function grantExtraQuota({ tenantId, featureKey, extraAmount, durationDays, adminId, adminName, reason }) {
  if (!VALID_FEATURE_KEYS.includes(featureKey)) {
    throw new Error(`Invalid feature key: "${featureKey}".`);
  }

  // Get current plan limit
  const { getLimit } = require('../config/planLimits');
  const [tenant] = await db.execute(
    'SELECT subscription_plan FROM hris_saas.tenants WHERE id = ?',
    [tenantId]
  );
  const plan = tenant[0]?.subscription_plan || 'FREE';
  const planLimit = getLimit(plan, featureKey);
  const newLimit = planLimit === -1 ? -1 : planLimit + extraAmount;

  // Convert durationDays to expires_at
  let expiresAt = null;
  if (durationDays) {
    const d = new Date();
    d.setDate(d.getDate() + durationDays);
    expiresAt = d.toISOString();
  }

  return setOverride({
    tenantId, featureKey, maxValue: newLimit,
    expiresAt, adminId, adminName,
    reason: reason || `Extra quota: +${extraAmount} ${featureKey} for ${durationDays || 'unlimited'} days`,
  });
}

/**
 * Get override history for a tenant.
 */
async function getOverrideHistory(tenantId, limit = 50) {
  const [rows] = await db.execute(
    `SELECT * FROM hris_saas.override_history
     WHERE tenant_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [tenantId, limit]
  );
  return rows;
}

/**
 * Force a plan change for a tenant (super admin action).
 * Logs to both audit_logs and subscription_events.
 */
async function forcePlanChange({ tenantId, newPlan, adminId, adminName, reason }) {
  const lifecycle = require('./subscriptionLifecycle.service');
  const audit = require('./audit.service');

  const tenant = await (new (require('../repositories/TenantRepository'))(db)).findById(tenantId);
  if (!tenant) throw new Error('Tenant not found');

  const fromPlan = tenant.subscriptionPlan;

  // Use the lifecycle service to transition
  const result = await lifecycle.transitionSubscription(tenantId, 'active', {
    newPlan,
    reason: reason || `Force ${newPlan} by super admin`,
    eventType: 'admin_change',
  });

  // Audit log
  await audit.logAdminAction({
    tenantId,
    actorId: adminId,
    actorName: adminName,
    action: isPlanUpgrade(fromPlan, newPlan)
      ? audit.AUDIT_ACTIONS.PLAN_FORCE_UPGRADE
      : audit.AUDIT_ACTIONS.PLAN_FORCE_DOWNGRADE,
    details: { fromPlan, toPlan: newPlan, reason },
  });

  return result;
}

function isPlanUpgrade(fromPlan, toPlan) {
  const rank = { FREE: 0, MANAGE: 1, BUSINESS: 2, BUSINESS_PRO: 3 };
  const from = rank[fromPlan?.toUpperCase()] ?? 0;
  const to = rank[toPlan?.toUpperCase()] ?? 0;
  return to > from;
}

module.exports = {
  listOverrides,
  setOverride,
  removeOverride,
  grantExtraQuota,
  getOverrideHistory,
  forcePlanChange,
  VALID_FEATURE_KEYS,
};
