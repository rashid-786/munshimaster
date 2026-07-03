const { FEATURE_PLANS, resolvePlan, PLAN_RANK } = require('../config/featurePlans');

function requireFeature(featureKey) {
  return (req, res, next) => {
    if (!req.tenant) {
      return res.status(401).json({
        success: false,
        code: 'FEATURE_LOCKED',
        feature: featureKey,
        currentPlan: null,
        upgradeRequired: true,
      });
    }

    const currentPlan = resolvePlan(req.tenant.subscription_plan);
    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    const minRank = FEATURE_PLANS[featureKey];

    if (minRank === undefined) {
      return next();
    }

    if (currentRank < minRank) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_LOCKED',
        feature: featureKey,
        currentPlan,
        upgradeRequired: true,
      });
    }

    next();
  };
}

module.exports = { requireFeature };
