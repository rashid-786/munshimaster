const db = require('../config/db');
const { planRank } = require('../utils/subscription');

const PLAN_RANK = { free: 0, business: 1, pro: 2 };

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
      const currentRank = planRank(currentPlan);

      if (currentRank < minRank) {
        const planNames = { 0: 'free', 1: 'business', 2: 'pro' };
        return res.status(403).json({
          error: 'Upgrade required.',
          message: `This feature requires ${planNames[minRank] === 'business' ? 'Business' : 'Pro'} plan. Your current plan is ${currentPlan}.`,
          currentPlan,
          requiredPlan: planNames[minRank],
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
