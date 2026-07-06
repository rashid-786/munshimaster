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

  // Merge plan_features into the JSONB features column
  const LEGACY_KEY_MAP = {
    monthly_transactions: 'monthly_txns',
    max_monthly_txns: 'monthly_txns',
    customers: 'ledger_customers',
    max_customers: 'ledger_customers',
    staff_members: 'staff_members',
    max_staff: 'staff_members',
    branches: 'branches',
    max_branches: 'branches',
    suppliers: 'suppliers',
    max_suppliers: 'suppliers',
    products: 'products',
    max_products: 'products',
  };
  const baseFeatures = sub[0].features || {};
  const [planFeatures] = await db.execute(
    'SELECT feature_key, feature_type, enabled, max_value, config FROM hris_saas.plan_features WHERE plan_id = ?',
    [sub[0].plan_id]
  );
  const mergedFeatures = { ...baseFeatures };
  for (const pf of planFeatures) {
    const val = pf.feature_type === 'boolean' || pf.feature_type === 'section'
      ? !!pf.enabled
      : pf.feature_type === 'limit'
        ? pf.enabled ? (pf.max_value !== null ? pf.max_value : -1) : 0
        : pf.feature_type === 'config' && pf.config
          ? pf.config
          : !!pf.enabled;
    mergedFeatures[pf.feature_key] = val;
    const legacyKey = LEGACY_KEY_MAP[pf.feature_key];
    if (legacyKey && legacyKey !== pf.feature_key) {
      mergedFeatures[legacyKey] = val;
    }
  }

  return {
    plan: sub[0].plan_id,
    planName: sub[0].plan_name,
    price: sub[0].price_inr,
    status: sub[0].status,
    trialEndsAt: sub[0].trial_ends_at,
    validUntil: sub[0].current_period_end,
    features: mergedFeatures,
    usage: {
      customers: customerCount[0].c,
      staff: staffCount[0].c,
    },
  };
}

/**
 * Plan rank for comparison
 * New plans: FREE=0, MANAGE=1, BUSINESS=2, BUSINESS_PRO=3
 * Legacy: free=0, manage=1, business=2
 */
const PLAN_RANK = { free: 0, manage: 1, manage_monthly: 1, business: 2, business_monthly: 2, business_pro: 3, business_pro_monthly: 3, pro: 3, pro_monthly: 3 };
const NEW_PLAN_RANK = { FREE: 0, MANAGE: 1, BUSINESS: 2, BUSINESS_PRO: 3 };

// Backward compat: old plan names used in existing data
const LEGACY_RANK = { free: 0, pro: 1, enterprise: 2 };

function planRank(planId) {
  if (!planId) return 0;
  // Try exact match first, then uppercase (for NEW_PLAN_RANK keys like BUSINESS_PRO)
  return NEW_PLAN_RANK[planId] ?? PLAN_RANK[planId] ?? LEGACY_RANK[planId]
    ?? NEW_PLAN_RANK[planId.toUpperCase()] ?? 0;
}

module.exports = {
  canAccess,
  getSubscriptionStatus,
  getPlanFeatures,
  invalidateCache,
  planRank,
  PLAN_RANK,
};
