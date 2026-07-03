const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const SubscriptionEventRepository = require('../repositories/SubscriptionEventRepository');

const eventRepo = new SubscriptionEventRepository(db);

/**
 * Renewal Reminder
 *
 * Runs daily and sends reminders (both in-app notification and
 * subscription event) to tenants whose subscription is expiring
 * within the defined windows:
 *   - 7 days before → "expiry_warning"
 *   - 3 days before → "renewal_reminder"
 *   - 1 day before  → "renewal_reminder" (urgent)
 *
 * Each tenant is reminded at most once per window to avoid spam.
 * The `last_notification_sent_at` and `notification_count`
 * columns on the subscription row track delivery state.
 */

const REMINDER_WINDOWS = [
  { days: 7,  eventType: 'expiry_warning',  label: '7-day warning' },
  { days: 3,  eventType: 'renewal_reminder', label: '3-day reminder' },
  { days: 1,  eventType: 'renewal_reminder', label: '1-day urgent reminder' },
];

async function sendRenewalReminders() {
  let total = 0;

  try {
    for (const window of REMINDER_WINDOWS) {
      const count = await processWindow(window);
      total += count;
    }

    if (total > 0) {
      console.log(`[Cron:renewalReminder] Sent ${total} renewal reminders`);
    }

    return total;
  } catch (error) {
    console.error('[Cron:renewalReminder] Error:', error.message);
    return 0;
  }
}

/**
 * Find subscriptions expiring exactly at `days` from now and
 * send reminders to tenants whose last notification was more
 * than 12 hours ago (to avoid duplicate/redundant sends).
 */
async function processWindow({ days, eventType, label }) {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago

  const [tenants] = await db.query(
    `SELECT t.id as tenant_id, t.company_name, t.subscription_plan,
            s.plan_id, s.current_period_end, s.trial_ends_at,
            s.last_notification_sent_at, s.notification_count
     FROM hris_saas.tenants t
     JOIN hris_saas.subscriptions s ON s.tenant_id = t.id
     WHERE t.subscription_status IN ('active', 'trialing')
       AND (
         (s.status = 'active' AND s.current_period_end IS NOT NULL
           AND s.current_period_end::date = (CURRENT_DATE + ?::integer))
          OR
          (s.status = 'trialing' AND s.trial_ends_at IS NOT NULL
           AND s.trial_ends_at::date = (CURRENT_DATE + ?::integer))
       )
       AND (s.last_notification_sent_at IS NULL OR s.last_notification_sent_at < ?)`,
    [days, days, cutoff]
  );

  if (tenants.length === 0) return 0;

  let sent = 0;

  for (const tenant of tenants) {
    try {
      // Log the reminder event
      await eventRepo.log({
        tenantId: tenant.tenant_id,
        oldPlan: tenant.subscription_plan,
        newPlan: tenant.subscription_plan,
        eventType,
      });

      // Update notification tracking on the subscription
      await db.query(
        `UPDATE hris_saas.subscriptions
         SET last_notification_sent_at = NOW(),
             notification_count = COALESCE(notification_count, 0) + 1,
             updated_at = NOW()
         WHERE tenant_id = ? AND status IN ('active', 'trialing')`,
        [tenant.tenant_id]
      );

      // Create in-app notification for tenant admin(s)
      const [admins] = await db.query(
        `SELECT id FROM hris_saas.employees
         WHERE tenant_id = ? AND role = 'tenant_admin' AND status = 'active'`,
        [tenant.tenant_id]
      );

      for (const admin of admins) {
        const isTrial = tenant.trial_ends_at !== null;
        const title = isTrial
          ? 'Trial Expiring Soon'
          : 'Subscription Renewal Reminder';
        const message = isTrial
          ? `Your free trial ends in ${days} day${days > 1 ? 's' : ''}. Upgrade to keep your features active.`
          : `Your ${tenant.plan_id} plan renews in ${days} day${days > 1 ? 's' : ''}. Ensure you have sufficient balance.`;

        await db.query(
          `INSERT INTO hris_saas.notifications
             (id, tenant_id, recipient_id, title, message, type, entity_type, created_at)
           VALUES ($1, $2, $3, $4, $5, 'warning', 'subscription', NOW())`,
          [uuidv4(), tenant.tenant_id, admin.id, title, message]
        );
      }

      sent++;
    } catch (err) {
      console.error(`[Cron:renewalReminder] Failed for tenant ${tenant.tenant_id}:`, err.message);
    }
  }

  return sent;
}

/**
 * Get reminder statistics for monitoring.
 */
async function getReminderStats() {
  const [rows] = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE current_period_end::date = CURRENT_DATE + 1) as due_tomorrow,
       COUNT(*) FILTER (WHERE current_period_end::date = CURRENT_DATE + 3) as due_in_3_days,
       COUNT(*) FILTER (WHERE current_period_end::date = CURRENT_DATE + 7) as due_in_7_days
     FROM hris_saas.subscriptions
     WHERE status = 'active' AND plan_id != 'free'`
  );
  return rows[0] || { due_tomorrow: 0, due_in_3_days: 0, due_in_7_days: 0 };
}

module.exports = { sendRenewalReminders, getReminderStats };
