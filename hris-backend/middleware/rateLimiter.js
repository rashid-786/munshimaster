const rateLimit = require('express-rate-limit');

// General API limiter: 500 requests per 15 min
exports.apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Strict auth limiter: login/register
exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

// OTP send limiter: prevent SMS bombing.
// Bypassed during internal testing (ENABLE_TEST_OTP=true) so testers using the
// fixed OTP never hit the per-IP limit. Production (no test flag) keeps the limit.
exports.otpLimiter =
  process.env.ENABLE_TEST_OTP === 'true'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: parseInt(process.env.OTP_RATE_LIMIT || '10'),
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many OTP requests. Please wait before requesting a new code.' },
      });

// Payment / subscription limiter
exports.paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please try again later.' },
});

// Super admin limiter
exports.superLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

// Public endpoints (settings, country detection)
exports.publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});

// Notifications limiter: more generous since frontend polls
exports.notificationsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests.' },
});
