const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const SubscriptionEventRepository = require('../repositories/SubscriptionEventRepository');
const TenantRepository = require('../repositories/TenantRepository');
const Tenant = require('../models/Tenant');
const { invalidateCache } = require('../utils/subscription');
const audit = require('./audit.service');

const eventRepo = new SubscriptionEventRepository(db);
const tenantRepo = new TenantRepository(db);

// ─── State machine ─────────────────────────────────────────────

/**
 * Allowed status transitions.
 * Each key maps to an array of valid destination statuses.
 */
const TRANSITIONS = {
  trialing:      ['active', 'cancelled', 'expired', 'grace_period'],
  active:        ['cancelled', 'expired', 'suspended', 'grace_period'],
  grace_period:  ['active', 'expired', 'suspended', 'cancelled'],
  suspended:     ['active', 'expired', 'cancelled'],
  cancelled:     ['active', 'expired'],
  expired:       ['active'],      // only re-activation
};

const EVENT_TYPE_MAP = {
  'trialing→active':      'upgrade',
  'trialing→cancelled':   'cancellation',
  'trialing→expired':     'trial_expired',
  'trialing→grace_period':'grace_period_start',
  'active→cancelled':     'cancellation',
  'active→expired':       'expired',
  'active→suspended':     'suspended',
  'active→grace_period':  'grace_period_start',
  'grace_period→active':  'renewal',
  'grace_period→expired': 'grace_period_expired',
  'grace_period→suspended':'suspended',
  'grace_period→cancelled':'cancellation',
  'suspended→active':     'reactivated',
  'suspended→expired':    'expired',
  'suspended→cancelled':  'cancellation',
  'cancelled→active':     'reactivated',
  'cancelled→expired':    'expired',
  'expired→active':       'reactivated',
};

/**
 * Derive a human-readable reason for the transition.
 */
function deriveReason(fromStatus, toStatus, reason) {
  if (reason) return reason;
  const map = {
    'active→expired':        'Subscription period ended',
    'trialing→expired':      'Trial period ended',
    'grace_period→expired':  'Grace period ended without payment',
    'active→suspended':      'Payment failure',
    'active→cancelled':      'User requested cancellation',
    'trialing→active':       'Payment successful',
    'grace_period→active':   'Payment received during grace period',
    'suspended→active':      'Account reactivated after payment',
    'cancelled→active':      'Subscription restarted',
    'expired→active':        'Subscription renewed after expiry',
  };
  return map[`${fromStatus}→${toStatus}`] || `Status changed from ${fromStatus} to ${toStatus}`;
}

/**
 * Validate that a status transition is allowed.
 * @throws {Error} if the transition is not permitted
 */
function validateTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) {
    throw new Error(`Subscription is already ${toStatus}`);
  }
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed) {
    throw new Error(`Unknown source status: ${fromStatus}`);
  }
  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Cannot transition from '${fromStatus}' to '${toStatus}'. ` +
      `Allowed destinations: ${allowed.join(', ')}`
    );
  }
}

/**
 * Determine the event type for a transition.
 */
function resolveEventType(fromStatus, toStatus) {
  return EVENT_TYPE_MAP[`${fromStatus}→${toStatus}`] || 'admin_change';
}

// ─── Core transition ──────────────────────────────────────────

/**
 * Transition a tenant's subscription to a new status.
 *
 * This is the single source of truth for all subscription status
 * changes. It validates the transition, persists it, and logs an
 * event in one atomic operation.
 *
 * @param {string} tenantId
 * @param {string} toStatus  — target status
 * @param {object} [opts]
 * @param {string} [opts.newPlan]        — optionally change the plan too
 * @param {string} [opts.oldPlan]        — explicit old plan (auto-detected if omitted)
 * @param {string} [opts.reason]         — human-readable reason
 * @param {string} [opts.eventType]      — override auto-detected event type
 * @param {string} [opts.subscriptionId] — target subscription (uses latest active if omitted)
 * @param {string} [opts.periodEnd]      — new period end date
 * @param {object} [opts.meta]           — extra metadata (e.g. { invoiceId })
 * @returns {Promise<{tenant: object, subscription: object, event: object}>}
 */
async function transitionSubscription(tenantId, toStatus, opts = {}) {
  const {
    newPlan,
    reason,
    subscriptionId,
    periodEnd,
  } = opts;

  // --- Load current state ---
  const tenant = await tenantRepo.findById(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  let eventType = opts.eventType;
  let fromPlan = opts.oldPlan || tenant.subscriptionPlan;
  const fromStatus = tenant.subscriptionStatus;

  // --- Validate ---
  validateTransition(fromStatus, toStatus);

  // --- Resolve event type ---
  if (eventType && !EVENT_TYPE_MAP[`${fromStatus}→${toStatus}`]) {
    // custom event type (for cron jobs etc) — pass through
  } else if (!eventType) {
    eventType = resolveEventType(fromStatus, toStatus);
  }

  const transitionReason = deriveReason(fromStatus, toStatus, reason);

  // --- Update subscription row ---
  const setEnded = ['expired', 'cancelled'].includes(toStatus);

  const updates = [];
  updates.push(`status = '${toStatus}'`);
  updates.push('updated_at = NOW()');

  if (toStatus === 'cancelled') updates.push('cancelled_at = NOW()');
  if (toStatus === 'suspended') {
    updates.push('suspended_at = NOW()');
    updates.push(`suspension_reason = '${transitionReason.replace(/'/g, "''")}'`);
  }
  if (toStatus !== 'suspended') updates.push("suspension_reason = NULL");
  if (setEnded) updates.push('ended_at = NOW()');
  if (periodEnd) updates.push(`current_period_end = '${periodEnd}'`);
  if (toStatus === 'active') {
    updates.push('cancelled_at = NULL');
    updates.push('ended_at = NULL');
    updates.push('suspended_at = NULL');
    updates.push('suspension_reason = NULL');
  }

  let sql;
  if (subscriptionId) {
    sql = `UPDATE hris_saas.subscriptions SET ${updates.join(', ')} WHERE id = ?`;
    await db.execute(sql, [subscriptionId]);
  } else {
    // PostgreSQL doesn't support UPDATE ... ORDER BY ... LIMIT
    // Use a subquery to target the latest subscription
    sql = `UPDATE hris_saas.subscriptions SET ${updates.join(', ')}
           WHERE id = (
             SELECT id FROM hris_saas.subscriptions
             WHERE tenant_id = ?
               AND status IN ('active','trialing','grace_period','suspended','cancelled')
             ORDER BY created_at DESC LIMIT 1
           )`;
    await db.execute(sql, [tenantId]);
  }

  // --- Update tenant ---
  const tenantUpdates = {
    subscriptionStatus: toStatus,
  };
  if (newPlan) {
    tenantUpdates.subscriptionPlan = newPlan;
  }
  if (periodEnd) {
    tenantUpdates.expiryDate = periodEnd;
  }
  const updatedTenant = await tenantRepo.updateSubscription(tenantId, tenantUpdates);

  // --- Log event ---
  const event = await eventRepo.log({
    tenantId,
    oldPlan: fromPlan,
    newPlan: newPlan || fromPlan,
    eventType,
  });

  // --- Audit log the plan change ---
  if (fromPlan !== (newPlan || fromPlan)) {
    await audit.logPlanChange({
      tenantId,
      fromPlan,
      toPlan: newPlan || fromPlan,
      reason: transitionReason,
    });
  }

  // --- Invalidate cache ---
  try {
    invalidateCache(newPlan || fromPlan);
  } catch {}

  // --- Re-fetch subscription for response ---
  const [subRows] = await db.execute(
    `SELECT * FROM hris_saas.subscriptions
     WHERE tenant_id = ?
     ORDER BY created_at DESC LIMIT 1`,
    [tenantId]
  );

  return {
    tenant: updatedTenant,
    subscription: subRows[0] || null,
    event,
    reason: transitionReason,
  };
}

// ─── Convenience transitions ──────────────────────────────────

/**
 * Cancel subscription at period end. The tenant retains access
 * until current_period_end, then the cron job expires them.
 */
async function cancel(tenantId, reason = null) {
  return transitionSubscription(tenantId, 'cancelled', { reason });
}

/**
 * Immediately suspend a subscription (e.g. payment failure).
 */
async function suspend(tenantId, reason = 'Payment failure') {
  return transitionSubscription(tenantId, 'suspended', { reason });
}

/**
 * Reactivate a suspended, cancelled, or expired subscription.
 */
async function reactivate(tenantId, planId = null, periodEnd = null) {
  const tenant = await tenantRepo.findById(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  return transitionSubscription(tenantId, 'active', {
    newPlan: planId || tenant.subscriptionPlan,
    periodEnd: periodEnd || tenant.expiryDate,
    reason: 'Subscription reactivated',
  });
}

/**
 * Mark as expired and downgrade to free plan.
 *
 * The tenant's subscription_status is set to 'active' because the
 * newly created free subscription allows continued minimal access.
 * The 'expired' event is captured in the subscription_events log.
 */
async function expire(tenantId) {
  const tenant = await tenantRepo.findById(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  // Step 1: Log the expiry event (before we change the status)
  await eventRepo.log({
    tenantId,
    oldPlan: tenant.subscriptionPlan,
    newPlan: 'FREE',
    eventType: 'expired',
  });

  // Step 2: Deactivate the old subscription
  await db.execute(
    `UPDATE hris_saas.subscriptions SET status = 'expired', ended_at = NOW(), updated_at = NOW()
     WHERE id = (
       SELECT id FROM hris_saas.subscriptions
       WHERE tenant_id = ? AND status IN ('active','trialing','grace_period','suspended','cancelled')
       ORDER BY created_at DESC LIMIT 1
     )`,
    [tenantId]
  );

  // Step 3: Create a free subscription row for continued minimal access
  const subId = uuidv4();
  await db.execute(
    `INSERT INTO hris_saas.subscriptions
       (id, tenant_id, plan_id, status, current_period_start, current_period_end)
     VALUES (?, ?, 'free', 'active', NOW(), '2099-12-31')`,
    [subId, tenantId]
  );

  // Step 4: Update tenant — set to free plan with active status
  const updatedTenant = await tenantRepo.updateSubscription(tenantId, {
    subscriptionPlan: 'FREE',
    subscriptionStatus: 'active',
  });

  try { invalidateCache('free'); } catch {}

  return { tenant: updatedTenant, reason: 'Subscription period ended. Downgraded to Free.' };
}

/**
 * Move an active/trialing subscription into grace period.
 */
async function enterGracePeriod(tenantId, gracePeriodEnd, reason = 'Payment overdue') {
  return transitionSubscription(tenantId, 'grace_period', {
    reason,
    periodEnd: gracePeriodEnd,
  });
}

/**
 * Start a trial for a paid plan.
 */
async function startTrial(tenantId, planId, trialDays = 14) {
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + trialDays);

  // Deactivate any existing active sub
  await db.execute(
    `UPDATE hris_saas.subscriptions SET status = 'expired', ended_at = NOW()
     WHERE tenant_id = ? AND status IN ('active','trialing')`,
    [tenantId]
  );

  // Create trial subscription
  const subId = uuidv4();
  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + trialDays);

  await db.execute(
    `INSERT INTO hris_saas.subscriptions
       (id, tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
     VALUES (?, ?, ?, 'trialing', ?, NOW(), ?)`,
    [subId, tenantId, planId, trialEnd, periodEnd]
  );

  // Update tenant
  await tenantRepo.updateSubscription(tenantId, {
    subscriptionPlan: planId,
    subscriptionStatus: 'trialing',
    expiryDate: periodEnd.toISOString(),
  });

  // Log event
  const event = await eventRepo.log({
    tenantId,
    oldPlan: 'FREE',
    newPlan: planId,
    eventType: 'trial_start',
  });

  try { invalidateCache(planId); } catch {}

  return { subscriptionId: subId, trialEndsAt: trialEnd, event };
}

/**
 * Renew an active subscription (reset period).
 */
async function renew(tenantId, periodEnd, planId = null) {
  const tenant = await tenantRepo.findById(tenantId);
  if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);

  const targetPlan = planId || tenant.subscriptionPlan;

  // If currently in grace_period or suspended, reactivate + renew
  if (['grace_period', 'suspended'].includes(tenant.subscriptionStatus)) {
    return transitionSubscription(tenantId, 'active', {
      newPlan: targetPlan,
      periodEnd,
      eventType: 'renewal',
      reason: 'Subscription renewed after payment',
    });
  }

  // Otherwise just extend the period
  const [sub] = await db.execute(
    `UPDATE hris_saas.subscriptions
     SET current_period_end = ?, updated_at = NOW()
     WHERE tenant_id = ? AND status IN ('active','trialing')
     ORDER BY created_at DESC LIMIT 1
     RETURNING *`,
    [periodEnd, tenantId]
  );

  await tenantRepo.updateSubscription(tenantId, {
    subscriptionPlan: targetPlan,
    subscriptionStatus: 'active',
    expiryDate: periodEnd,
  });

  const event = await eventRepo.log({
    tenantId,
    oldPlan: tenant.subscriptionPlan,
    newPlan: targetPlan,
    eventType: 'renewal',
  });

  try { invalidateCache(targetPlan); } catch {}

  return { subscription: sub[0] || null, event };
}

// ─── Bulk queries ─────────────────────────────────────────────

/**
 * Find all tenants whose subscription is expiring within N days.
 * Used by expiry-warning cron.
 */
async function findExpiringWithin(withinDays = 7) {
  return tenantRepo.findExpiring(withinDays);
}

/**
 * Find all tenants whose grace period is ending within N days.
 */
async function findGracePeriodExpiringWithin(withinDays = 3) {
  const [rows] = await db.execute(
    `SELECT t.* FROM hris_saas.tenants t
     JOIN hris_saas.subscriptions s ON s.tenant_id = t.id
     WHERE t.subscription_status = 'grace_period'
       AND s.grace_period_ends_at IS NOT NULL
       AND s.grace_period_ends_at BETWEEN NOW() AND NOW() + INTERVAL ? DAY
     ORDER BY s.grace_period_ends_at`,
    [withinDays]
  );
  return rows.map(r => new Tenant(r));
}

/**
 * Find all tenants whose grace period has already ended.
 */
async function findExpiredGracePeriods() {
  const [rows] = await db.execute(
    `SELECT t.* FROM hris_saas.tenants t
     JOIN hris_saas.subscriptions s ON s.tenant_id = t.id
     WHERE t.subscription_status = 'grace_period'
       AND s.grace_period_ends_at IS NOT NULL
       AND s.grace_period_ends_at < NOW()`,
  );
  return rows.map(r => new Tenant(r));
}

module.exports = {
  transitionSubscription,
  cancel,
  suspend,
  reactivate,
  expire,
  enterGracePeriod,
  startTrial,
  renew,
  findExpiringWithin,
  findGracePeriodExpiringWithin,
  findExpiredGracePeriods,
  TRANSITIONS,
  EVENT_TYPE_MAP,
  validateTransition,
};
