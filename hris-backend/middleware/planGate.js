const db = require('../config/db');

const PLAN_RANK = { free: 0, pro: 1, enterprise: 2 };

function planGate(minRank) {
  return async (req, res, next) => {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context missing.' });
    }

    try {
      const [rows] = await db.execute(
        'SELECT subscription_plan FROM tenants WHERE id = ?',
        [tenantId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found.' });
      }

      const currentPlan = rows[0].subscription_plan || 'free';
      const currentRank = PLAN_RANK[currentPlan] ?? 0;

      if (currentRank < minRank) {
        return res.status(403).json({
          error: 'Upgrade required.',
          message: `This feature requires ${minRank === 1 ? 'Pro' : 'Enterprise'} plan. Your current plan is ${currentPlan}.`,
          currentPlan,
          requiredPlan: minRank <= 1 ? 'pro' : 'enterprise',
        });
      }

      next();
    } catch (error) {
      console.error('Plan gate error:', error);
      res.status(500).json({ error: 'Failed to verify subscription plan.' });
    }
  };
}

module.exports = { planGate, PLAN_RANK };
