const db = require('../config/db');
const { expire } = require('../services/subscriptionLifecycle.service');

/**
 * Expiry Checker
 *
 * Runs every few minutes to detect subscriptions that have
 * passed their period end and marks them as expired.
 *
 * Active paid subscriptions are NOT expired here — they go
 * through grace_period first (handled by gracePeriodHandler).
 *
 * Handles two cases:
 *   1. Expired trials       → expire + downgrade to free
 *   2. Cancelled past end   → expire + downgrade to free
 */
async function checkExpired() {
  const now = new Date();
  let total = 0;

  try {
    // 1. Expired trials
    const [trialRows] = await db.query(
      `UPDATE hris_saas.subscriptions SET status = 'expired', ended_at = NOW()
       WHERE status = 'trialing' AND trial_ends_at < ?
       RETURNING tenant_id`,
      [now]
    );

    for (const row of trialRows) {
      await expire(row.tenant_id);
      total++;
    }

    // 2. Stale active subscriptions past period end + 7 days (fell through cracks)
    const [staleRows] = await db.query(
      `UPDATE hris_saas.subscriptions SET status = 'expired', ended_at = NOW()
       WHERE status = 'active'
         AND plan_id != 'free'
         AND current_period_end < NOW() - INTERVAL '7 days'
       RETURNING tenant_id`,
    );

    for (const row of staleRows) {
      await expire(row.tenant_id);
      total++;
    }

    // 3. Cancelled subscriptions past period end
    const [cancelledRows] = await db.query(
      `UPDATE hris_saas.subscriptions SET status = 'expired', ended_at = NOW()
       WHERE status = 'cancelled' AND current_period_end < ?
       RETURNING tenant_id`,
      [now]
    );

    for (const row of cancelledRows) {
      await expire(row.tenant_id);
      total++;
    }

    if (total > 0) {
      console.log(`[Cron:expiryChecker] Expired ${total} subscriptions`);
    }

    return total;
  } catch (error) {
    console.error('[Cron:expiryChecker] Error:', error.message);
    return 0;
  }
}

/**
 * Find subscriptions expiring within `withinDays` days (for warning emails).
 */
async function findExpiringSoon(withinDays = 7) {
  const [rows] = await db.query(
    `SELECT t.*, s.plan_id, s.current_period_end, s.trial_ends_at
     FROM hris_saas.tenants t
     JOIN hris_saas.subscriptions s ON s.tenant_id = t.id
     WHERE t.subscription_status IN ('active', 'trialing')
       AND (
         (s.status = 'active' AND s.current_period_end BETWEEN NOW() AND NOW() + INTERVAL ? DAY)
         OR
         (s.status = 'trialing' AND s.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL ? DAY)
       )
     ORDER BY s.current_period_end`,
    [withinDays, withinDays]
  );
  return rows;
}

module.exports = { checkExpired, findExpiringSoon };
