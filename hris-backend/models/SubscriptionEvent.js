/**
 * SubscriptionEvent model — logs plan changes for audit and analytics.
 *
 * Maps to the `subscription_events` table in the `hris_saas` schema.
 *
 * @property {string} id
 * @property {string} tenantId
 * @property {string} oldPlan
 * @property {string} newPlan
 * @property {string} eventType   — upgrade | downgrade | renewal | trial_start
 *                                  | trial_expired | cancellation | payment_failure | admin_change
 * @property {string} [createdAt]
 */
class SubscriptionEvent {
  constructor(data = {}) {
    this.id = data.id || null;
    this.tenantId = data.tenant_id || data.tenantId || null;
    this.oldPlan = data.old_plan || data.oldPlan || '';
    this.newPlan = data.new_plan || data.newPlan || '';
    this.eventType = data.event_type || data.eventType || '';
    this.createdAt = data.created_at || data.createdAt || null;
  }

  /** Create from a DB row (snake_case keys). */
  static fromRow(row) {
    if (!row) return null;
    return new SubscriptionEvent(row);
  }

  /** Create an array from DB rows. */
  static fromRows(rows) {
    return (rows || []).map(SubscriptionEvent.fromRow);
  }

  /** Return a plain object with snake_case keys for DB writes. */
  toDB() {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      old_plan: this.oldPlan,
      new_plan: this.newPlan,
      event_type: this.eventType,
    };
  }

  /** Human-readable description of the event. */
  get description() {
    const labels = {
      upgrade: 'Plan Upgrade',
      downgrade: 'Plan Downgrade',
      renewal: 'Plan Renewal',
      trial_start: 'Trial Started',
      trial_expired: 'Trial Expired',
      cancellation: 'Subscription Cancelled',
      payment_failure: 'Payment Failed',
      admin_change: 'Admin Change',
      suspended: 'Subscription Suspended',
      reactivated: 'Subscription Reactivated',
      expired: 'Subscription Expired',
      grace_period_start: 'Grace Period Started',
      grace_period_expired: 'Grace Period Expired',
      renewal_reminder: 'Renewal Reminder Sent',
      expiry_warning: 'Expiry Warning Sent',
    };
    return labels[this.eventType] || this.eventType;
  }
}

module.exports = SubscriptionEvent;
