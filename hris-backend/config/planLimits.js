/**
 * Per-plan usage limits.
 *
 * Derived from hris-frontend/src/config/subscriptionPlans.js
 * Plan ranks: FREE=0, MANAGE=1, BUSINESS=2, BUSINESS_PRO=3
 *
 * A value of -1 means unlimited.
 */
const PLAN_LIMITS = {
  FREE: {
    branches: 2,
    monthly_transactions: 500,
    cashbook_entries: 500,
    staff_members: 0,
  },
  MANAGE: {
    branches: 2,
    monthly_transactions: 3000,
    cashbook_entries: 3000,
    staff_members: 10,
  },
  BUSINESS: {
    branches: 3,
    monthly_transactions: -1,
    cashbook_entries: -1,
    staff_members: 25,
  },
  BUSINESS_PRO: {
    branches: 5,
    monthly_transactions: -1,
    cashbook_entries: -1,
    staff_members: -1,
  },
};

/**
 * Map user-facing limit keys to plan config dimensions.
 */
const LIMIT_KEY_MAP = {
  entities: 'max_branches',
  branches: 'max_branches',
  transactions: 'max_monthly_txns',
  monthly_transactions: 'max_monthly_txns',
  cashbook_entries: 'cashbook_entries',
  staff_count: 'max_staff',
  staff_members: 'max_staff',
  customers: 'max_customers',
  suppliers: 'max_suppliers',
  products: 'max_products',
};

const PLAN_RANK = { FREE: 0, MANAGE: 1, BUSINESS: 2, BUSINESS_PRO: 3 };
const LEGACY_RESOLVE = {
  FREE: 'FREE',
  MANAGE: 'MANAGE',
  MANAGE_MONTHLY: 'MANAGE',
  BUSINESS: 'BUSINESS',
  BUSINESS_PRO: 'BUSINESS_PRO',
  BUSINESS_MONTHLY: 'BUSINESS',
  PRO: 'BUSINESS_PRO',
  PRO_MONTHLY: 'BUSINESS_PRO',
};

function resolvePlan(raw) {
  if (!raw) return 'FREE';
  const upper = String(raw).toUpperCase();
  if (PLAN_RANK[upper] !== undefined) return upper;
  return LEGACY_RESOLVE[upper] || 'FREE';
}

function getLimit(plan, dimension) {
  const resolved = resolvePlan(plan);
  return PLAN_LIMITS[resolved]?.[dimension] ?? -1;
}

function isUnlimited(plan, dimension) {
  return getLimit(plan, dimension) === -1;
}

module.exports = { PLAN_LIMITS, PLAN_RANK, LIMIT_KEY_MAP, getLimit, isUnlimited, resolvePlan };
