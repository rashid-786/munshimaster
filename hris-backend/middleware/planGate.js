const db = require('../config/db');
const { planRank } = require('../utils/subscription');

const PLAN_NAMES = { 0: 'free', 1: 'manage', 2: 'business', 3: 'business_pro' };

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
        const required = PLAN_NAMES[minRank] || 'free';
        return res.status(403).json({
          error: 'Upgrade required.',
          message: `This feature requires ${required === 'manage' ? 'Manage' : required === 'business' ? 'Business' : 'Business Pro'} plan. Your current plan is ${currentPlan}.`,
          currentPlan,
          requiredPlan: required,
        });
      }

      next();
    } catch (error) {
      console.error('Plan gate error:', error);
      res.status(500).json({ error: 'Failed to verify subscription plan.' });
    }
  };
}

module.exports = { planGate };
