const db = require('../config/db');
const { canTenantAccessFeature, getTenantFeatureLimit } = require('./featureAccess');

const FEATURE_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getPlanFeatures(planId) {
  const cached = FEATURE_CACHE.get(planId);
  if (cached && Date.now() - cached.ts < CACHE_TTL)
    return cached.features;

  const [rows] = await db.execute(
    'SELECT features FROM subscription_plans WHERE id = ?',
    [planId]
  );
  const features = rows.length > 0 ? rows[0].features : null;
  FEATURE_CACHE.set(planId, { features, ts: Date.now() });
  return features;
}

function invalidateCache(planId) {
  FEATURE_CACHE.delete(planId);
}

/**
 * Check if a tenant can access a feature.
 * Uses the new Feature Access Resolver (priority: override > section > plan > default).
 * Returns { allowed, plan, limit, usage }
 */
async function canAccess(tenantId, featureKey, currentValue = 0) {
  const allowed = await canTenantAccessFeature(tenantId, featureKey);
  const limit = await getTenantFeatureLimit(tenantId, featureKey);

  return {
    allowed: allowed && (limit === -1 || currentValue < limit),
    plan: 'resolved',
    limit,
    usage: currentValue,
  };
}

/**
 * Get current subscription with feature limits + usage counters.
 */
async function getSubscriptionStatus(tenantId) {
  const [sub] = await db.execute(
    `SELECT s.*, p.name as plan_name, p.price_inr, p.features
     FROM subscriptions s
     JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.tenant_id = ? AND s.status IN ('active','trialing')
     ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId]
  );

  if (sub.length === 0) {
    return { plan: 'free', status: 'active', features: {}, usage: {} };
  }

  // Count current usage across key metrics
  const [customerCount] = await db.execute(
    'SELECT COUNT(*) as c FROM customers WHERE tenant_id = ?', [tenantId]
  );
  const [staffCount] = await db.execute(
    'SELECT COUNT(*) as c FROM employees WHERE tenant_id = ? AND COALESCE(status,\'active\') != \'deactivated\'',
    [tenantId]
  );

  return {
    plan: sub[0].plan_id,
    planName: sub[0].plan_name,
    price: sub[0].price_inr,
    status: sub[0].status,
    trialEndsAt: sub[0].trial_ends_at,
    validUntil: sub[0].current_period_end,
    features: sub[0].features,
    usage: {
      customers: customerCount[0].c,
      staff: staffCount[0].c,
    },
  };
}

/**
 * Plan rank for comparison
 * New plans: FREE=0, MANAGE=1, BUSINESS=2, BUSINESS_PRO=3
 * Legacy: free=0, business=1, pro=2
 */
const PLAN_RANK = { free: 0, manage: 1, manage_monthly: 1, business: 2, business_monthly: 2, pro: 3, pro_monthly: 3 };
const NEW_PLAN_RANK = { FREE: 0, MANAGE: 1, BUSINESS: 2, BUSINESS_PRO: 3 };

// Backward compat: old plan names used in existing data
const LEGACY_RANK = { free: 0, pro: 1, enterprise: 2 };

function planRank(planId) {
  return NEW_PLAN_RANK[planId] ?? PLAN_RANK[planId] ?? LEGACY_RANK[planId] ?? 0;
}

module.exports = {
  canAccess,
  getSubscriptionStatus,
  getPlanFeatures,
  invalidateCache,
  planRank,
  PLAN_RANK,
};
