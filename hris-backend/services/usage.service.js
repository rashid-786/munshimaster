const db = require('../config/db');
const { getTenantFeatureLimit } = require('../utils/featureAccess');
const TenantUsageRepository = require('../repositories/TenantUsageRepository');
const { LIMIT_KEY_MAP } = require('../config/planLimits');

const usageRepo = new TenantUsageRepository(db);

const USAGE_TYPE_TO_COUNTER = {
  transactions: 'transactions',
  cashbook_entries: 'cashbookEntries',
  staff_count: 'staff',
  entities: 'entities',
};

const USAGE_QUERIES = {
  entities: `
    SELECT COUNT(*)::int as count
    FROM tenants
    WHERE organization_id = (SELECT organization_id FROM tenants WHERE id = ?)
      AND status = 'active'
  `,
  branches: `
    SELECT COUNT(*)::int as count
    FROM tenants
    WHERE organization_id = (SELECT organization_id FROM tenants WHERE id = ?)
      AND status = 'active'
  `,
  transactions: `
    SELECT COUNT(*)::int as count
    FROM kirana_transactions
    WHERE tenant_id = ?
      AND created_at >= date_trunc('month', NOW())
  `,
  cashbook_entries: `
    SELECT COUNT(*)::int as count
    FROM kirana_cashbook
    WHERE tenant_id = ?
      AND created_at >= date_trunc('month', NOW())
  `,
  staff_count: `
    SELECT COUNT(*)::int as count
    FROM employees
    WHERE tenant_id = ?
      AND COALESCE(status, 'active') != 'deactivated'
  `,
};

/**
 * Check whether a tenant's current usage for a given dimension
 * is within the plan's allowed limit.
 *
 * @param {object} params
 * @param {string} params.tenantId
 * @param {string} params.plan         — e.g. 'FREE', 'BUSINESS'
 * @param {string} params.limitKey     — 'entities' | 'transactions' | 'cashbook_entries' | 'staff_count'
 * @returns {Promise<{allowed: boolean, currentUsage: number, allowedLimit: number}>}
 */
async function checkUsage({ tenantId, plan, limitKey }) {
  // Resolve the plan_features key via LIMIT_KEY_MAP (e.g. entities → branches)
  const featureKey = LIMIT_KEY_MAP[limitKey] || limitKey;
  const allowedLimit = await getTenantFeatureLimit(tenantId, featureKey);
  if (allowedLimit === -1 || allowedLimit === null || allowedLimit === undefined) {
    return { allowed: true, currentUsage: 0, allowedLimit: -1 };
  }

  const query = USAGE_QUERIES[limitKey];

  if (!query) {
    return { allowed: true, currentUsage: 0, allowedLimit: -1 };
  }

  let currentUsage = 0;

  try {
    const [rows] = await db.execute(query, [tenantId]);
    currentUsage = parseInt(rows[0]?.count ?? 0, 10);

    if (limitKey === 'entities' && currentUsage === 0) {
      const [fallback] = await db.execute('SELECT COUNT(*)::int as count FROM tenants WHERE id = ?', [tenantId]);
      currentUsage = parseInt(fallback[0]?.count ?? 1, 10);
    }
  } catch {
    return { allowed: false, currentUsage: 0, allowedLimit, error: 'Usage query failed' };
  }

  return {
    allowed: currentUsage < allowedLimit,
    currentUsage,
    allowedLimit,
  };
}

/**
 * Increment a tenant's usage counter for the current month.
 *
 * Automatically creates the monthly row on first use (upsert).
 * Safe for concurrent calls — backed by an atomic INSERT … ON CONFLICT.
 *
 * @param {string} tenantId
 * @param {'transactions'|'cashbook_entries'|'staff_count'|'entities'} usageType
 * @returns {Promise<TenantUsage>}
 */
async function incrementUsage(tenantId, usageType) {
  const counterKey = USAGE_TYPE_TO_COUNTER[usageType];
  if (!counterKey) {
    throw new Error(`Unknown usage type: "${usageType}". Expected one of: ${Object.keys(USAGE_TYPE_TO_COUNTER).join(', ')}`);
  }
  return usageRepo.increment(tenantId, { [counterKey]: 1 });
}

module.exports = { checkUsage, incrementUsage, USAGE_QUERIES };
