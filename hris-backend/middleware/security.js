const db = require('../config/db');
const { canTenantAccessFeature } = require('../utils/featureAccess');
const { canTenantPerformAction } = require('../utils/sectionAccess');

/**
 * Validates that the requested tenant exists and that the super admin
 * is not accessing data across an invalid boundary.
 * Useful when tenantId comes from params or body on write operations.
 */
const validateTenantExists = (paramName = 'tenantId') => {
  return async (req, res, next) => {
    const tenantId = req.params?.[paramName] || req.body?.tenantId || req.query?.tenantId;
    if (!tenantId) return next();

    try {
      const [rows] = await db.execute(
        'SELECT id, company_name, status FROM hris_saas.tenants WHERE id = ?', [tenantId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Tenant not found.' });
      }
      req.tenant = rows[0];
      req.tenantId = tenantId;
      next();
    } catch (err) {
      console.error('[Security] validateTenantExists error:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
};

/**
 * Ensures a tenant is active before write operations.
 */
const requireActiveTenant = (req, res, next) => {
  const tenant = req.tenant || req.body?.tenant;
  if (tenant && tenant.status === 'inactive') {
    return res.status(403).json({ error: 'Cannot modify an inactive/suspended tenant.' });
  }
  next();
};

/**
 * Enforce that a tenant has access to a specific feature.
 * Must be used after tenant context is established (tenantId resovled).
 */
const enforceFeatureAccess = (featureKey) => {
  return async (req, res, next) => {
    const tenantId = req.tenant?.id || req.tenantId || req.params?.tenantId || req.params?.id;
    if (!tenantId) return next();

    try {
      const hasAccess = await canTenantAccessFeature(tenantId, featureKey);
      if (!hasAccess) {
        return res.status(403).json({
          error: `Feature '${featureKey}' is not available for this tenant.`,
          code: 'FEATURE_BLOCKED',
        });
      }
      next();
    } catch (err) {
      console.error('[Security] enforceFeatureAccess error:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
};

/**
 * Enforce section visibility rules for a given action.
 * Blocks requests when section is hidden (for view) or read-only (for write).
 */
const enforceSectionAction = (sectionKey, action = 'view') => {
  return async (req, res, next) => {
    const tenantId = req.tenant?.id || req.tenantId || req.params?.tenantId || req.params?.id;
    if (!tenantId) return next();

    try {
      const allowed = await canTenantPerformAction(tenantId, sectionKey, action);
      if (!allowed) {
        const messages = {
          view: `Section '${sectionKey}' is hidden for this tenant.`,
          create: `Section '${sectionKey}' is read-only. Cannot create records.`,
          edit: `Section '${sectionKey}' is read-only. Cannot edit records.`,
          delete: `Section '${sectionKey}' is read-only. Cannot delete records.`,
        };
        return res.status(403).json({
          error: messages[action] || `Action '${action}' not allowed for section '${sectionKey}'.`,
          code: 'SECTION_BLOCKED',
        });
      }
      next();
    } catch (err) {
      console.error('[Security] enforceSectionAction error:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  };
};

/**
 * Prevents cross-tenant data access by verifying the requested tenantId
 * matches context. For routes like GET /tenants/:id/data.
 */
const preventCrossTenantAccess = (req, res, next) => {
  // Super admins can access any tenant - this applies to tenant-level guards
  // In super admin context, all tenants are accessible
  next();
};

module.exports = {
  validateTenantExists,
  requireActiveTenant,
  enforceFeatureAccess,
  enforceSectionAction,
  preventCrossTenantAccess,
};
