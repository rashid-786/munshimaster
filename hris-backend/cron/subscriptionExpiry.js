const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { notifyExpiringTrials } = require('../controllers/retention.controller');

/**
 * Processes expired trials and paid subscriptions.
 * - Trials: expired → downgrade to free immediately
 * - Paid: expired → downgrade to free
 *
 * Intended to run on a setInterval every 10-60 minutes.
 */
async function processExpiredSubscriptions() {
  const now = new Date();
  let totalDowngraded = 0;

  try {
    // 1. Expired trials
    const [trialRows] = await db.query(
      `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
       WHERE status = 'trialing' AND trial_ends_at < ?
       RETURNING tenant_id`,
      [now]
    );

    for (const row of trialRows) {
      await downgradeToFree(row.tenant_id);
      totalDowngraded++;
    }

    // 2. Expired paid subscriptions
    const [paidRows] = await db.query(
      `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
       WHERE status = 'active' AND current_period_end < ? AND plan_id != 'free'
       RETURNING tenant_id`,
      [now]
    );

    for (const row of paidRows) {
      await downgradeToFree(row.tenant_id);
      totalDowngraded++;
    }

    // 3. Cancelled subscriptions that have reached period end
    const [cancelledRows] = await db.query(
      `UPDATE subscriptions SET status = 'expired', ended_at = NOW()
       WHERE status = 'cancelled' AND current_period_end < ?
       RETURNING tenant_id`,
      [now]
    );

    for (const row of cancelledRows) {
      await downgradeToFree(row.tenant_id);
      totalDowngraded++;
    }

    if (totalDowngraded > 0) {
      console.log(`[Cron] Downgraded ${totalDowngraded} expired subscriptions to free`);
    }
  } catch (error) {
    console.error('[Cron] subscriptionExpiry error:', error.message);
  }
}

async function downgradeToFree(tenantId) {
  const subId = uuidv4();
  await db.query(
    `INSERT INTO subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end)
     VALUES (?, ?, 'free', 'active', NOW(), '2099-12-31')`,
    [subId, tenantId]
  );

  await db.query(
    'UPDATE tenants SET subscription_plan = ? WHERE id = ?',
    ['free', tenantId]
  );

  try {
    const { invalidateCache } = require('../utils/subscription');
    invalidateCache('free');
  } catch {}
}

/**
 * Start the cron loop. Runs every `intervalMs` milliseconds.
 */
function startExpiryCron(intervalMs = 10 * 60 * 1000) {
  console.log(`[Cron] subscriptionExpiry started (interval: ${intervalMs}ms)`);
  processExpiredSubscriptions();
  return setInterval(processExpiredSubscriptions, intervalMs);
}

module.exports = { processExpiredSubscriptions, startExpiryCron, downgradeToFree };
