const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { getTenantFeatureAccess } = require('../utils/featureAccess');
const saService = require('../services/superAdmin.service');
const SA_ACTIONS = saService.SA_ACTIONS;

/**
 * Get effective features for a tenant.
 * Returns every known feature with its resolved access state (merged plan + override).
 */
exports.getTenantFeatures = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const [tenant] = await db.execute('SELECT id, subscription_plan FROM hris_saas.tenants WHERE id = ?', [tenantId]);
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    // Get all known feature keys from plan_features table
    const [allPlanFeatures] = await db.execute(
      `SELECT DISTINCT feature_key, feature_type FROM hris_saas.plan_features ORDER BY feature_key`
    );

    // Resolve access for each feature
    const features = [];
    for (const pf of allPlanFeatures) {
      const access = await getTenantFeatureAccess(tenantId, pf.feature_key);
      features.push({
        featureKey: pf.feature_key,
        featureType: pf.feature_type,
        enabled: access.enabled,
        readOnly: access.readOnly,
        limit: access.limit,
        source: access.source,
        override: access.override ? {
          id: access.override.id,
          overrideType: access.override.override_type,
          maxValue: access.override.max_value,
          isTemporary: !!access.override.is_temporary,
          expiresAt: access.override.expires_at,
          reason: access.override.reason,
          createdAt: access.override.created_at,
        } : null,
      });
    }

    // Also get all active overrides (including ones that might be for custom/unknown features)
    const [activeOverrides] = await db.execute(
      `SELECT * FROM hris_saas.tenant_feature_overrides
       WHERE tenant_id = ?
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC`,
      [tenantId]
    );

    return res.json({ features, overrides: activeOverrides });
  } catch (err) {
    console.error('[FeatureOverride] getTenantFeatures error:', err);
    return res.status(500).json({ error: 'Failed to fetch tenant features.' });
  }
};

/**
 * Create a new feature override.
 */
exports.createFeatureOverride = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { featureKey, overrideType, maxValue, isTemporary, expiresAt, reason } = req.body;
    const admin = req.user;

    if (!featureKey || !overrideType) {
      return res.status(400).json({ error: 'featureKey and overrideType are required.' });
    }

    const validTypes = ['ENABLE_FEATURE', 'DISABLE_FEATURE', 'INCREASE_LIMIT', 'REDUCE_LIMIT', 'READ_ONLY', 'FULL_ACCESS', 'REVOKE_OVERRIDE'];
    if (!validTypes.includes(overrideType)) {
      return res.status(400).json({ error: `Invalid overrideType. Valid: ${validTypes.join(', ')}` });
    }

    if (!reason) {
      return res.status(400).json({ error: 'reason is required for all overrides.' });
    }

    // Check tenant exists
    const [tenant] = await db.execute('SELECT id, company_name FROM hris_saas.tenants WHERE id = ?', [tenantId]);
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const id = uuidv4();

    // If an override already exists for this feature, update it instead
    const [existing] = await db.execute(
      `SELECT id FROM hris_saas.tenant_feature_overrides
       WHERE tenant_id = ? AND feature_key = ?`,
      [tenantId, featureKey]
    );

    if (existing.length > 0) {
      // Update existing override
      await db.execute(
        `UPDATE hris_saas.tenant_feature_overrides
         SET override_type = ?, max_value = ?, is_temporary = ?,
             expires_at = ?, reason = ?, created_by = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          overrideType,
          maxValue ?? null,
          isTemporary ? true : false,
          isTemporary ? (expiresAt || null) : null,
          reason,
          admin.id,
          existing[0].id,
        ]
      );
    } else {
      // Create new
      await db.execute(
        `INSERT INTO hris_saas.tenant_feature_overrides
           (id, tenant_id, feature_key, override_type, max_value, is_temporary, expires_at, reason, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          id, tenantId, featureKey, overrideType,
          maxValue ?? null,
          isTemporary ? true : false,
          isTemporary ? (expiresAt || null) : null,
          reason,
          admin.id,
        ]
      );
    }

    // Audit logs
    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: SA_ACTIONS.OVERRIDE_CREATED || 'override.created',
      entityType: 'feature_override', entityId: existing.length > 0 ? existing[0].id : id,
      tenantId,
      details: { featureKey, overrideType, maxValue, isTemporary, expiresAt, reason },
      req,
    });

    await saService.logTenantAudit({
      tenantId, actorId: admin.id, actorName: admin.name,
      action: 'super_admin.feature_override_created',
      entityType: 'feature_override',
      changes: { featureKey, overrideType, maxValue, isTemporary, expiresAt, reason },
      req,
    });

    // Return the created/updated override
    const [result] = await db.execute(
      'SELECT * FROM hris_saas.tenant_feature_overrides WHERE id = ?',
      [existing.length > 0 ? existing[0].id : id]
    );

    return res.status(201).json({ override: result[0] });
  } catch (err) {
    console.error('[FeatureOverride] createFeatureOverride error:', err);
    return res.status(500).json({ error: 'Failed to create feature override.' });
  }
};

/**
 * Update an existing feature override.
 */
exports.updateFeatureOverride = async (req, res) => {
  try {
    const { tenantId, overrideId } = req.params;
    const { overrideType, maxValue, isTemporary, expiresAt, reason } = req.body;
    const admin = req.user;

    const [existing] = await db.execute(
      'SELECT * FROM hris_saas.tenant_feature_overrides WHERE id = ? AND tenant_id = ?',
      [overrideId, tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Override not found.' });

    const sets = [];
    const params = [];

    if (overrideType) {
      const validTypes = ['ENABLE_FEATURE', 'DISABLE_FEATURE', 'INCREASE_LIMIT', 'REDUCE_LIMIT', 'READ_ONLY', 'FULL_ACCESS', 'REVOKE_OVERRIDE'];
      if (!validTypes.includes(overrideType)) {
        return res.status(400).json({ error: `Invalid overrideType. Valid: ${validTypes.join(', ')}` });
      }
      sets.push('override_type = ?');
      params.push(overrideType);
    }
    if (maxValue !== undefined) {
      sets.push('max_value = ?');
      params.push(maxValue);
    }
    if (isTemporary !== undefined) {
      sets.push('is_temporary = ?');
      params.push(isTemporary);
    }
    if (expiresAt !== undefined) {
      sets.push('expires_at = ?');
      params.push(expiresAt);
    }
    if (reason !== undefined) {
      sets.push('reason = ?');
      params.push(reason);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    sets.push('updated_at = NOW()');
    params.push(overrideId);

    await db.execute(
      `UPDATE hris_saas.tenant_feature_overrides SET ${sets.join(', ')} WHERE id = ?`,
      params
    );

    // Audit
    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: 'override.updated',
      entityType: 'feature_override', entityId: overrideId,
      tenantId,
      details: { featureKey: existing[0].feature_key, changes: req.body },
      req,
    });

    await saService.logTenantAudit({
      tenantId, actorId: admin.id, actorName: admin.name,
      action: 'super_admin.feature_override_updated',
      entityType: 'feature_override',
      changes: { featureKey: existing[0].feature_key, changes: req.body },
      req,
    });

    const [result] = await db.execute(
      'SELECT * FROM hris_saas.tenant_feature_overrides WHERE id = ?',
      [overrideId]
    );

    return res.json({ override: result[0] });
  } catch (err) {
    console.error('[FeatureOverride] updateFeatureOverride error:', err);
    return res.status(500).json({ error: 'Failed to update feature override.' });
  }
};

/**
 * Delete (revoke) a feature override.
 */
exports.deleteFeatureOverride = async (req, res) => {
  try {
    const { tenantId, overrideId } = req.params;
    const admin = req.user;

    const [existing] = await db.execute(
      'SELECT * FROM hris_saas.tenant_feature_overrides WHERE id = ? AND tenant_id = ?',
      [overrideId, tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Override not found.' });

    await db.execute('DELETE FROM hris_saas.tenant_feature_overrides WHERE id = ?', [overrideId]);

    // Audit
    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: 'override.deleted',
      entityType: 'feature_override', entityId: overrideId,
      tenantId,
      details: { featureKey: existing[0].feature_key, overrideType: existing[0].override_type },
      req,
    });

    await saService.logTenantAudit({
      tenantId, actorId: admin.id, actorName: admin.name,
      action: 'super_admin.feature_override_deleted',
      entityType: 'feature_override',
      changes: { featureKey: existing[0].feature_key, overrideType: existing[0].override_type },
      req,
    });

    return res.json({ success: true, featureKey: existing[0].feature_key });
  } catch (err) {
    console.error('[FeatureOverride] deleteFeatureOverride error:', err);
    return res.status(500).json({ error: 'Failed to delete feature override.' });
  }
};

/**
 * Batch set overrides for a tenant (super admin bulk action).
 */
exports.bulkSetFeatureOverrides = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { overrides } = req.body;
    const admin = req.user;

    if (!Array.isArray(overrides)) {
      return res.status(400).json({ error: 'overrides must be an array.' });
    }

    const results = [];
    for (const ov of overrides) {
      const { featureKey, overrideType, maxValue, isTemporary, expiresAt, reason } = ov;

      const [existing] = await db.execute(
        'SELECT id FROM hris_saas.tenant_feature_overrides WHERE tenant_id = ? AND feature_key = ?',
        [tenantId, featureKey]
      );

      if (existing.length > 0) {
        await db.execute(
          `UPDATE hris_saas.tenant_feature_overrides
           SET override_type = ?, max_value = ?, is_temporary = ?,
               expires_at = ?, reason = ?, updated_at = NOW()
           WHERE id = ?`,
          [overrideType, maxValue ?? null, isTemporary ? true : false, isTemporary ? (expiresAt || null) : null, reason, existing[0].id]
        );
        results.push({ featureKey, action: 'updated' });
      } else {
        await db.execute(
          `INSERT INTO hris_saas.tenant_feature_overrides (id, tenant_id, feature_key, override_type, max_value, is_temporary, expires_at, reason, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [uuidv4(), tenantId, featureKey, overrideType, maxValue ?? null, isTemporary ? true : false, isTemporary ? (expiresAt || null) : null, reason, admin.id]
        );
        results.push({ featureKey, action: 'created' });
      }
    }

    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: 'override.bulk_created',
      entityType: 'feature_override',
      tenantId,
      details: { count: overrides.length, overrides: overrides.map(o => ({ featureKey: o.featureKey, overrideType: o.overrideType })) },
      req,
    });

    return res.json({ success: true, results });
  } catch (err) {
    console.error('[FeatureOverride] bulkSetFeatureOverrides error:', err);
    return res.status(500).json({ error: 'Failed to set bulk overrides.' });
  }
};

exports.revokeAllFeatureOverrides = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const admin = req.user;

    const [existing] = await db.execute(
      'SELECT id, feature_key FROM hris_saas.tenant_feature_overrides WHERE tenant_id = ?',
      [tenantId]
    );

    await db.execute(
      'DELETE FROM hris_saas.tenant_feature_overrides WHERE tenant_id = ?',
      [tenantId]
    );

    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: 'override.all_revoked',
      entityType: 'feature_override',
      tenantId,
      details: { count: existing.length, featureKeys: existing.map(r => r.feature_key) },
      req,
    });

    await saService.logTenantAudit({
      tenantId, actorId: admin.id, actorName: admin.name,
      action: 'super_admin.all_overrides_revoked',
      entityType: 'feature_override',
      changes: { count: existing.length, featureKeys: existing.map(r => r.feature_key) },
      req,
    });

    return res.json({ success: true, revoked: existing.length });
  } catch (err) {
    console.error('[FeatureOverride] revokeAllFeatureOverrides error:', err);
    return res.status(500).json({ error: 'Failed to revoke all overrides.' });
  }
};
