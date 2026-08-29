const db = require('../config/db');

/**
 * Shared guard for the "one free trial per account" rule.
 *
 * A trial is considered consumed once ANY subscription tied to the user's
 * phone number has a `trial_ends_at` set — regardless of the current
 * subscription_status of the tenant. This intentionally covers every state a
 * trial subscription can reach (expired, cancelled, suspended, grace_period,
 * converted-to-paid) so a user can never restart a trial by re-activating,
 * re-registering, or starting a fresh subscription on the same phone.
 */

const TRIAL_RESTRICTION_MESSAGE =
  "Your free trial has already been used. Trials are limited to one per account. Please subscribe to a paid plan to continue.";

class TrialNotEligibleError extends Error {
  constructor(message = TRIAL_RESTRICTION_MESSAGE) {
    super(message);
    this.name = 'TrialNotEligibleError';
    this.code = 'TRIAL_RESTRICTED';
    this.status = 400;
  }
}

/**
 * Resolve every tenant id associated with a phone number — the tenant that
 * registered with that phone plus any tenant whose admin employee uses it.
 *
 * @param {string|null|undefined} phone
 * @returns {Promise<string[]>}
 */
async function resolveTenantIdsByPhone(phone) {
  if (!phone) return [];

  const [rows] = await db.execute(
    `SELECT DISTINCT t.id
       FROM hris_saas.tenants t
       LEFT JOIN hris_saas.employees e ON e.tenant_id = t.id
      WHERE t.phone = ?
         OR e.phone = ?`,
    [phone, phone]
  );

  return rows.map((r) => r.id);
}

/**
 * Whether a trial has already been used for any of the given tenant ids.
 *
 * Signal 1: any subscription row that carries a `trial_ends_at` — a trial was
 * started on that tenant. Once a trial row exists (any status), the trial has
 * effectively been consumed for the account.
 *
 * Signal 2 (supplementary): any `trial_start` / `trial_expired` event logged
 * for those tenants — catches trials recorded through the lifecycle service
 * even if the subscription row is missing a trial_ends_at.
 *
 * @param {string[]} tenantIds
 * @returns {Promise<boolean>}
 */
async function hasUsedTrial(tenantIds) {
  if (!tenantIds || tenantIds.length === 0) return false;

  const [subRows] = await db.execute(
    `SELECT COUNT(*) AS c
       FROM hris_saas.subscriptions s
      WHERE s.tenant_id = ANY($1::varchar[])
        AND s.trial_ends_at IS NOT NULL`,
    [tenantIds]
  );

  if (Number(subRows[0]?.c || 0) > 0) return true;

  const [eventRows] = await db.execute(
    `SELECT COUNT(*) AS c
       FROM hris_saas.subscription_events e
      WHERE e.tenant_id = ANY($1::varchar[])
        AND e.event_type IN ('trial_start', 'trial_expired')`,
    [tenantIds]
  );

  return Number(eventRows[0]?.c || 0) > 0;
}

/**
 * Check whether the given tenant (and any other tenant sharing the phone
 * number) has already consumed a free trial.
 *
 * @param {string} tenantId
 * @param {string|null|undefined} [phone]
 * @param {object} [opts]
 * @param {boolean} [opts.force] - allow an audited admin/support override
 * @throws {TrialNotEligibleError} when the trial was already consumed
 */
async function assertTrialEligible(tenantId, phone = null, opts = {}) {
  if (opts.force) return;

  const tenantIds = await resolveTenantIdsByPhone(phone);

  if (!tenantIds.includes(tenantId)) {
    tenantIds.push(tenantId);
  }

  const used = await hasUsedTrial(tenantIds);
  if (used) {
    throw new TrialNotEligibleError();
  }
}

module.exports = {
  TRIAL_RESTRICTION_MESSAGE,
  TrialNotEligibleError,
  resolveTenantIdsByPhone,
  hasUsedTrial,
  assertTrialEligible,
};