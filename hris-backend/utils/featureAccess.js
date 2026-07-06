const db = require('../config/db');

/**
 * Feature Access Resolver
 *
 * Resolves feature access for a tenant following strict priority:
 *   1. Tenant feature override (active, not expired)
 *   2. Tenant section visibility override
 *   3. Tenant subscription plan features (plan_features table)
 *   4. Global default feature configuration
 */

const OVERRIDE_TYPES = {
  ENABLE_FEATURE: 'ENABLE_FEATURE',
  DISABLE_FEATURE: 'DISABLE_FEATURE',
  INCREASE_LIMIT: 'INCREASE_LIMIT',
  REDUCE_LIMIT: 'REDUCE_LIMIT',
  READ_ONLY: 'READ_ONLY',
  FULL_ACCESS: 'FULL_ACCESS',
  REVOKE_OVERRIDE: 'REVOKE_OVERRIDE',
};

/**
 * Get the effective feature access for a tenant+feature.
 *
 * Returns:
 *   {
 *     featureKey,
 *     enabled: boolean,        // can the tenant use this feature?
 *     readOnly: boolean,       // read-only access (for READ_ONLY override)
 *     limit: number|null,      // effective limit (null = unlimited)
 *     source: 'override'|'section_visibility'|'plan'|'default',
 *     override: object|null,   // the active override row if any
 *     planDefault: object|null // the plan feature row if any
 *   }
 */
async function getTenantFeatureAccess(tenantId, featureKey) {
  // 1. Check tenant feature override (active, not expired)
  const [overrides] = await db.execute(
    `SELECT * FROM tenant_feature_overrides
     WHERE tenant_id = ?
       AND feature_key = ?
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, featureKey]
  );

  if (overrides.length > 0) {
    const ov = overrides[0];

    switch (ov.override_type) {
      case OVERRIDE_TYPES.DISABLE_FEATURE:
      case OVERRIDE_TYPES.REVOKE_OVERRIDE:
        return { featureKey, enabled: false, readOnly: false, limit: 0, source: 'override', override: ov, planDefault: null };

      case OVERRIDE_TYPES.ENABLE_FEATURE:
      case OVERRIDE_TYPES.FULL_ACCESS:
        return { featureKey, enabled: true, readOnly: false, limit: -1, source: 'override', override: ov, planDefault: null };

      case OVERRIDE_TYPES.READ_ONLY:
        return { featureKey, enabled: true, readOnly: true, limit: -1, source: 'override', override: ov, planDefault: null };

      case OVERRIDE_TYPES.INCREASE_LIMIT:
      case OVERRIDE_TYPES.REDUCE_LIMIT: {
        // Resolve the plan base limit first
        const planDefault = await getPlanDefaultForFeature(tenantId, featureKey);
        const baseLimit = planDefault?.max_value ?? 0;
        const delta = ov.max_value ?? 0;
        const limit = ov.override_type === OVERRIDE_TYPES.INCREASE_LIMIT
          ? baseLimit + delta
          : Math.max(0, baseLimit - delta);

        return { featureKey, enabled: limit > 0 || limit === -1, readOnly: false, limit, source: 'override', override: ov, planDefault };
      }
    }
  }

  // 2. Check tenant section visibility
  const [sections] = await db.execute(
    'SELECT visible FROM tenant_section_visibility WHERE tenant_id = ? AND section_key = ?',
    [tenantId, featureKey]
  );

  if (sections.length > 0 && !sections[0].visible) {
    return { featureKey, enabled: false, readOnly: false, limit: 0, source: 'section_visibility', override: null, planDefault: null };
  }

  // 3. Check subscription plan features
  const planDefault = await getPlanDefaultForFeature(tenantId, featureKey);
  if (planDefault) {
    return {
      featureKey,
      enabled: !!planDefault.enabled,
      readOnly: false,
      limit: planDefault.enabled ? planDefault.max_value : 0,
      source: 'plan',
      override: null,
      planDefault,
    };
  }

  // 4. Default — feature not accessible
  return { featureKey, enabled: false, readOnly: false, limit: 0, source: 'default', override: null, planDefault: null };
}

/**
 * Get the effective numeric limit for a feature.
 * Returns -1 for unlimited, 0 for blocked, or the actual limit number.
 */
async function getTenantFeatureLimit(tenantId, featureKey) {
  const access = await getTenantFeatureAccess(tenantId, featureKey);
  if (!access.enabled) return 0;
  return access.limit ?? -1;
}

/**
 * Quick boolean check — can the tenant access this feature?
 */
async function canTenantAccessFeature(tenantId, featureKey) {
  const access = await getTenantFeatureAccess(tenantId, featureKey);
  return access.enabled;
}

/**
 * Internal: get the plan's default feature config for a tenant.
 * Resolves the tenant's subscription plan, then looks up the feature
 * in the normalized plan_features table.
 */
async function getPlanDefaultForFeature(tenantId, featureKey) {
  const [sub] = await db.execute(
    `SELECT s.plan_id
     FROM subscriptions s
     WHERE s.tenant_id = ? AND s.status IN ('active','trialing')
     ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId]
  );
  if (sub.length === 0) return null;

  const [features] = await db.execute(
    'SELECT * FROM plan_features WHERE plan_id = ? AND feature_key = ?',
    [sub[0].plan_id, featureKey]
  );
  return features.length > 0 ? features[0] : null;
}

module.exports = {
  getTenantFeatureAccess,
  getTenantFeatureLimit,
  canTenantAccessFeature,
  OVERRIDE_TYPES,
};
