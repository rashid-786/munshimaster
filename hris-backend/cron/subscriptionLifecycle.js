const { checkExpired } = require('./expiryChecker');
const { sendRenewalReminders } = require('./renewalReminder');
const { enterGracePeriods, expireGracePeriods } = require('./gracePeriodHandler');

/**
 * Subscription Lifecycle Orchestrator
 *
 * Runs all subscription lifecycle checks in order:
 *   1. Enter grace periods  — move overdue active subs into grace
 *   2. Check for expired    — expire trials, paid subs, cancelled past end
 *   3. Expire grace periods — expire subs whose grace period ended
 *   4. Send reminders       — warn about upcoming renewals
 *
 * This replaces the legacy subscriptionExpiry cron.
 */

async function runLifecycleChecks() {
  console.log('[Cron:Lifecycle] Starting subscription lifecycle checks');

  const results = {
    enteredGracePeriod: 0,
    expired: 0,
    expiredGracePeriods: 0,
    remindersSent: 0,
  };

  try {
    results.enteredGracePeriod = await enterGracePeriods();
  } catch (err) {
    console.error('[Cron:Lifecycle] enterGracePeriods failed:', err.message);
  }

  try {
    results.expired = await checkExpired();
  } catch (err) {
    console.error('[Cron:Lifecycle] checkExpired failed:', err.message);
  }

  try {
    results.expiredGracePeriods = await expireGracePeriods();
  } catch (err) {
    console.error('[Cron:Lifecycle] expireGracePeriods failed:', err.message);
  }

  try {
    results.remindersSent = await sendRenewalReminders();
  } catch (err) {
    console.error('[Cron:Lifecycle] sendRenewalReminders failed:', err.message);
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  if (total > 0) {
    console.log('[Cron:Lifecycle] Completed:', JSON.stringify(results));
  }

  return results;
}

/**
 * Start the lifecycle cron loop.
 * Legacy exports for backward compat with server.js.
 */
function startLifecycleCron(intervalMs = 10 * 60 * 1000) {
  console.log(`[Cron:Lifecycle] Started (interval: ${intervalMs}ms)`);
  runLifecycleChecks();
  return setInterval(runLifecycleChecks, intervalMs);
}

// Legacy alias for backward compat with existing server.js imports
const processExpiredSubscriptions = checkExpired;
const startExpiryCron = startLifecycleCron;

module.exports = {
  runLifecycleChecks,
  startLifecycleCron,
  processExpiredSubscriptions,
  startExpiryCron,
};
