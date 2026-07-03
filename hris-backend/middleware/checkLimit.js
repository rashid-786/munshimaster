const { checkUsage } = require('../services/usage.service');
const audit = require('../services/audit.service');

function checkLimit(limitKey) {
  return async (req, res, next) => {
    if (!req.tenant) {
      return res.status(401).json({
        success: false,
        code: 'LIMIT_REACHED',
        currentUsage: 0,
        allowedLimit: 0,
        upgradeRequired: true,
      });
    }

    try {
      const result = await checkUsage({
        tenantId: req.tenant.id,
        plan: req.tenant.subscription_plan,
        limitKey,
      });

      if (!result.allowed) {
        // Audit the limit violation
        await audit.logLimitViolation({
          tenantId: req.tenant.id,
          limitKey,
          current: result.currentUsage,
          limit: result.allowedLimit,
          resource: req.originalUrl || req.url,
          req,
        });

        return res.status(403).json({
          success: false,
          code: 'LIMIT_REACHED',
          currentUsage: result.currentUsage,
          allowedLimit: result.allowedLimit,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error('Check limit error:', error);
      res.status(500).json({ error: 'Failed to check usage limit.' });
    }
  };
}

module.exports = { checkLimit };
