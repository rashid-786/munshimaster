const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { getRateLimitConfig } = require('./rateLimitConfig');

/**
 * Central rate limiting for Bahi360.
 *
 * - Config is loaded dynamically from `system_settings.global_config.rateLimit`
 *   (Super Admin can change limits / enable-disable enforcement). The `limit`
 *   and `skip` are evaluated per request, so changes apply without a redeploy.
 * - Authenticated business APIs are keyed by TENANT (not just IP), so one
 *   tenant's traffic never consumes another tenant's budget — this also avoids
 *   the shared-bucket problem behind Cloudflare/Hostinger proxies.
 * - Each 429 is logged with endpoint, IP, tenant, user and limit.
 */

function isExempted(req, cfg) {
  return cfg.exemptedRoutes.some((prefix) => req.path.startsWith(prefix));
}

/** Shared 429 handler with detailed logging (labelled per limiter). */
function makeRateLimitHandler(label) {
  return (req, res, next, optionsUsed) => {
    const tenant = req.tenantId || req.headers['x-tenant-id'] || '-';
    const user = req.user?.id || '-';
    console.warn(
      `[RateLimit] 429 ${label} ${req.method} ${req.originalUrl} ip=${req.ip} tenant=${tenant} user=${user}`
    );
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  };
}

function baseOptions({ keyByTenant, label }) {
  return {
    standardHeaders: true,
    legacyHeaders: false,
    handler: makeRateLimitHandler(label),
    // Disabled globally or exempted route → bypass.
    skip: (req) => {
      const cfg = getRateLimitConfig();
      return !cfg.enabled || isExempted(req, cfg);
    },
    keyGenerator: (req) =>
      keyByTenant && req.tenantId
        ? `tenant:${req.tenantId}`
        : `ip:${ipKeyGenerator(req)}`,
  };
}

// `windowMs` must be a static number with the default MemoryStore; it is derived
// from the default config at load. Changes to `windowMinutes` apply on restart,
// while `limit`/`enabled`/`exemptedRoutes` apply immediately.
const WINDOW_MS = getRateLimitConfig().windowMinutes * 60000;

// Authenticated business APIs (higher limit, per tenant)
exports.apiLimiter = rateLimit({
  ...baseOptions({ keyByTenant: true, label: 'api' }),
  windowMs: WINDOW_MS,
  limit: () => getRateLimitConfig().generalLimit,
});

// Auth (login / register / OTP) — strict, per IP
exports.authLimiter = rateLimit({
  ...baseOptions({ keyByTenant: false, label: 'auth' }),
  windowMs: WINDOW_MS,
  limit: () => getRateLimitConfig().authLimit,
  message: { error: 'Too many login attempts. Please try again later.' },
});

// OTP send limiter: prevent SMS bombing.
// Bypassed during internal testing (ENABLE_TEST_OTP=true) so testers using the
// fixed OTP never hit the per-IP limit. Production (no test flag) keeps the limit.
exports.otpLimiter =
  process.env.ENABLE_TEST_OTP === 'true'
    ? (req, res, next) => next()
    : rateLimit({
        ...baseOptions({ keyByTenant: false, label: 'otp' }),
        windowMs: WINDOW_MS,
        limit: () => getRateLimitConfig().authLimit,
        message: { error: 'Too many OTP requests. Please wait before requesting a new code.' },
      });

// Payment / subscription limiter
exports.paymentLimiter = rateLimit({
  ...baseOptions({ keyByTenant: true, label: 'payment' }),
  windowMs: WINDOW_MS,
  limit: () => getRateLimitConfig().paymentLimit,
});

// Super admin limiter
exports.superLimiter = rateLimit({
  ...baseOptions({ keyByTenant: false, label: 'super' }),
  windowMs: WINDOW_MS,
  limit: () => getRateLimitConfig().superLimit,
});

// Public endpoints (settings, country detection, global config) — medium, per IP
exports.publicLimiter = rateLimit({
  ...baseOptions({ keyByTenant: false, label: 'public' }),
  windowMs: 60 * 1000,
  limit: () => getRateLimitConfig().publicLimit,
  message: { error: 'Too many requests.' },
});

// Notifications limiter: more generous since the frontend polls
exports.notificationsLimiter = rateLimit({
  ...baseOptions({ keyByTenant: true, label: 'notifications' }),
  windowMs: 60 * 1000,
  limit: () => getRateLimitConfig().notificationsLimit,
});