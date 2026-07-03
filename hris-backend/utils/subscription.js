const db = require('../config/db');

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
 * Returns { allowed, plan, limit, usage }
 */
async function canAccess(tenantId, featureKey, currentValue = 0) {
  // 1. Check tenant feature overrides first (promos, discounts)
  const [overrides] = await db.execute(
    `SELECT max_value FROM tenant_feature_overrides
     WHERE tenant_id = ? AND feature_key = ?
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [tenantId, featureKey]
  );
  if (overrides.length > 0) {
    const maxVal = overrides[0].max_value;
    return {
      allowed: maxVal === null || currentValue < maxVal,
      plan: 'override',
      limit: maxVal,
      usage: currentValue,
    };
  }

  // 2. Get active subscription
  const [sub] = await db.execute(
    `SELECT s.plan_id, s.status
     FROM subscriptions s
     WHERE s.tenant_id = ? AND s.status IN ('active','trialing')
     ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId]
  );
  if (sub.length === 0) return { allowed: false, plan: 'none', limit: 0, usage: currentValue };

  const features = await getPlanFeatures(sub[0].plan_id);
  if (!features) return { allowed: false, plan: sub[0].plan_id, limit: 0, usage: currentValue };

  const limit = features[featureKey];
  if (limit === undefined) return { allowed: false, plan: sub[0].plan_id, limit: 0, usage: currentValue };
  if (limit === -1) return { allowed: true, plan: sub[0].plan_id, limit: -1, usage: currentValue };
  if (limit === false || limit === 0) return { allowed: false, plan: sub[0].plan_id, limit: 0, usage: currentValue };

  return {
    allowed: currentValue < Number(limit),
    plan: sub[0].plan_id,
    limit: Number(limit),
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
const PLAN_RANK = { free: 0, business: 1, business_monthly: 1, pro: 2, pro_monthly: 2 };
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
