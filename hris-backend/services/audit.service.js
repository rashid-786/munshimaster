const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Centralized Audit Service
 *
 * Provides structured logging for subscription lifecycle events,
 * plan changes, limit violations, and super admin actions.
 * Every audit entry is stored in `audit_logs` with consistent
 * schema for querying and reporting.
 */

const AUDIT_ACTIONS = {
  PLAN_CHANGE: 'plan.change',
  PLAN_UPGRADE: 'plan.upgrade',
  PLAN_DOWNGRADE: 'plan.downgrade',
  PLAN_CANCEL: 'plan.cancel',
  PLAN_REACTIVATE: 'plan.reactivate',
  PLAN_SUSPEND: 'plan.suspend',
  PLAN_EXPIRE: 'plan.expire',
  PLAN_TRIAL_START: 'plan.trial_start',
  PLAN_TRIAL_EXPIRED: 'plan.trial_expired',
  PLAN_RENEWAL: 'plan.renewal',
  PLAN_FORCE_UPGRADE: 'plan.force_upgrade',
  PLAN_FORCE_DOWNGRADE: 'plan.force_downgrade',
  LIMIT_VIOLATION: 'limit.violation',
  LIMIT_OVERRIDE_CREATED: 'limit.override.created',
  LIMIT_OVERRIDE_UPDATED: 'limit.override.updated',
  LIMIT_OVERRIDE_DELETED: 'limit.override.deleted',
  EXTRA_QUOTA_GRANTED: 'quota.extra_granted',
  ADMIN_ACTION: 'admin.action',
  UPDATE_BRANDING: 'branding.update',
  UPLOAD_BRANDING_IMAGE: 'branding.upload_image',
  VERIFY_DOMAIN: 'branding.verify_domain',
};

/**
 * Log a subscription audit event.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.action     — one of AUDIT_ACTIONS values
 * @param {string} [params.actorId]
 * @param {string} [params.actorName]
 * @param {string} [params.entityType]  — 'subscription' | 'tenant' | 'override' | etc
 * @param {string} [params.entityId]
 * @param {object} [params.changes]     — { from, to } or detailed diff
 * @param {object} [params.metadata]    — extra structured data
 * @param {object} [params.req]         — Express req object (for IP)
 */
async function log(params) {
  const {
    tenantId, action, actorId, actorName,
    entityType, entityId, changes, metadata, req,
  } = params;

  if (!tenantId || !action) {
    console.error('[Audit] Missing required fields: tenantId, action');
    return;
  }

  try {
    const ip = req ? req.ip || req.connection?.remoteAddress || null : null;
    await db.execute(
      `INSERT INTO hris_saas.audit_logs
         (id, tenant_id, actor_id, actor_name, action,
          entity_type, entity_id, changes, ip_address, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), tenantId, actorId || null, actorName || null, action,
        entityType || null, entityId || null,
        changes ? JSON.stringify(changes) : null,
        ip,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    console.error('[Audit] Log error:', err.message);
  }
}

/**
 * Log a plan change event (upgrade, downgrade, change).
 * Integrates with the subscription lifecycle service.
 */
async function logPlanChange({ tenantId, fromPlan, toPlan, reason, actorId, actorName, req }) {
  const isUpgrade = isPlanUpgrade(fromPlan, toPlan);
  const action = isUpgrade
    ? AUDIT_ACTIONS.PLAN_UPGRADE
    : AUDIT_ACTIONS.PLAN_DOWNGRADE;

  await log({
    tenantId,
    action,
    actorId,
    actorName,
    entityType: 'subscription',
    changes: { from: fromPlan, to: toPlan, reason },
    metadata: { fromPlan, toPlan, reason },
    req,
  });
}

/**
 * Log a limit violation event.
 */
async function logLimitViolation({ tenantId, limitKey, current, limit, resource, req }) {
  await log({
    tenantId,
    action: AUDIT_ACTIONS.LIMIT_VIOLATION,
    entityType: 'limit',
    entityId: limitKey,
    changes: { key: limitKey, current, limit, resource },
    metadata: { limitKey, currentUsage: current, allowedLimit: limit, resource },
    req,
  });
}

/**
 * Log a super admin action on a tenant.
 */
async function logAdminAction({ tenantId, actorId, actorName, action, details, req }) {
  await log({
    tenantId,
    action: action || AUDIT_ACTIONS.ADMIN_ACTION,
    actorId,
    actorName,
    entityType: 'tenant',
    entityId: tenantId,
    changes: details,
    metadata: details,
    req,
  });
}

/**
 * Simple rank-based comparison to determine if it's an upgrade.
 * @param {string} fromPlan
 * @param {string} toPlan
 * @returns {boolean}
 */
function isPlanUpgrade(fromPlan, toPlan) {
  const rank = { FREE: 0, MANAGE: 1, BUSINESS: 2, BUSINESS_PRO: 3 };
  const from = rank[fromPlan?.toUpperCase()] ?? 0;
  const to = rank[toPlan?.toUpperCase()] ?? 0;
  return to > from;
}

module.exports = {
  log,
  logPlanChange,
  logLimitViolation,
  logAdminAction,
  AUDIT_ACTIONS,
};
