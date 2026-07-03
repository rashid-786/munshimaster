const db = require('../config/db');
const SubscriptionEventRepository = require('../repositories/SubscriptionEventRepository');
const TenantRepository = require('../repositories/TenantRepository');
const { expire } = require('../services/subscriptionLifecycle.service');

const eventRepo = new SubscriptionEventRepository(db);
const tenantRepo = new TenantRepository(db);

const GRACE_PERIOD_DAYS = 7;

/**
 * Grace Period Handler
 *
 * Runs daily to manage subscription grace periods:
 *   1. Move eligible overdue subscriptions into grace_period
 *   2. Expire subscriptions whose grace period has ended
 *
 * A grace period gives tenants N extra days after the
 * subscription period end before access is revoked.
 */

/**
 * Move recently-expired active subscriptions into grace period.
 *
 * Trigger: status='active', current_period_end < NOW(),
 *          plan_id != 'free', within GRACE_PERIOD_DAYS of expiry
 */
async function enterGracePeriods() {
  try {
    const [rows] = await db.query(
      `UPDATE hris_saas.subscriptions
       SET status = 'grace_period',
           grace_period_ends_at = NOW() + INTERVAL '7 days',
           updated_at = NOW()
       WHERE status = 'active'
         AND plan_id != 'free'
         AND current_period_end < NOW()
         AND current_period_end >= NOW() - INTERVAL '7 days'
       RETURNING tenant_id, plan_id`,
    );

    for (const row of rows) {
      await tenantRepo.updateSubscription(row.tenant_id, {
        subscriptionStatus: 'grace_period',
      });

      await eventRepo.log({
        tenantId: row.tenant_id,
        oldPlan: row.plan_id,
        newPlan: row.plan_id,
        eventType: 'grace_period_start',
      });
    }

    if (rows.length > 0) {
      console.log(`[Cron:gracePeriodHandler] Moved ${rows.length} tenants to grace period`);
    }

    return rows.length;
  } catch (error) {
    console.error('[Cron:gracePeriodHandler] enterGracePeriods error:', error.message);
    return 0;
  }
}

/**
 * Expire subscriptions whose grace period has ended.
 *
 * Trigger: status='grace_period', grace_period_ends_at < NOW()
 */
async function expireGracePeriods() {
  try {
    const [rows] = await db.query(
      `SELECT tenant_id, plan_id
       FROM hris_saas.subscriptions
       WHERE status = 'grace_period'
         AND grace_period_ends_at IS NOT NULL
         AND grace_period_ends_at < NOW()`,
    );

    for (const row of rows) {
      try {
        await expire(row.tenant_id);
      } catch (err) {
        console.error(`[Cron:gracePeriodHandler] Failed to expire ${row.tenant_id}:`, err.message);
      }
    }

    if (rows.length > 0) {
      console.log(`[Cron:gracePeriodHandler] Expired ${rows.length} grace periods`);
    }

    return rows.length;
  } catch (error) {
    console.error('[Cron:gracePeriodHandler] expireGracePeriods error:', error.message);
    return 0;
  }
}

/**
 * Get grace period statistics for monitoring.
 */
async function getGracePeriodStats() {
  const [rows] = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE grace_period_ends_at IS NOT NULL AND grace_period_ends_at > NOW()) as active_grace,
       COUNT(*) FILTER (WHERE grace_period_ends_at IS NOT NULL AND grace_period_ends_at < NOW()) as overdue_grace
     FROM hris_saas.subscriptions
     WHERE status = 'grace_period'`
  );
  return rows[0] || { active_grace: 0, overdue_grace: 0 };
}

module.exports = { enterGracePeriods, expireGracePeriods, getGracePeriodStats };
