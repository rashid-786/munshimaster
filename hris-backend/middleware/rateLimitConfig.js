const db = require('../config/db');

/**
 * Runtime rate-limit configuration, loaded from
 * `system_settings.global_config.rateLimit` so the Super Admin can change
 * limits (and enable/disable rate limiting) without code changes.
 *
 * Values are cached and refreshed every `TTL_MS` plus on demand after the
 * Super Admin saves settings.
 */
const DEFAULT_CONFIG = {
  enabled: true,
  windowMinutes: 15,
  generalLimit: 1000, // authenticated business APIs, per tenant
  authLimit: 20, // login/register/OTP, per IP
  publicLimit: 120, // public endpoints, per IP per minute
  paymentLimit: 60, // payment/subscription, per tenant
  superLimit: 200, // super admin, per IP
  notificationsLimit: 60, // notifications, per tenant per minute
  exemptedRoutes: [], // path prefixes that bypass rate limiting, e.g. ['/core/subscription/webhook']
};

const TTL_MS = 5 * 60 * 1000;

let cached = { ...DEFAULT_CONFIG };
let lastLoad = 0;
let refreshPromise = null;

async function loadFromDb() {
  try {
    const [rows] = await db.execute(
      'SELECT global_config FROM system_settings WHERE id = 1'
    );
    const gc = rows.length > 0 ? rows[0].global_config : {};
    const parsed = typeof gc === 'string' ? JSON.parse(gc) : (gc || {});
    const rl = parsed.rateLimit || {};
    cached = {
      ...DEFAULT_CONFIG,
      ...rl,
      exemptedRoutes: Array.isArray(rl.exemptedRoutes) ? rl.exemptedRoutes : [],
    };
  } catch (error) {
    // Keep defaults if the config can't be read (e.g. DB briefly unavailable).
    console.error('[RateLimitConfig] failed to load, using defaults:', error?.message);
    cached = { ...DEFAULT_CONFIG };
  }
  lastLoad = Date.now();
}

function refreshRateLimitConfig() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = loadFromDb().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

/** Returns the current (cached) config. */
function getRateLimitConfig() {
  if (Date.now() - lastLoad > TTL_MS) {
    // Fire-and-forget refresh; callers use the last-known values immediately.
    refreshRateLimitConfig().catch(() => {});
  }
  return cached;
}

module.exports = {
  getRateLimitConfig,
  refreshRateLimitConfig,
  DEFAULT_CONFIG,
};