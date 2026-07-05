const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { getSectionState, SECTION_HIERARCHY } = require('../utils/sectionAccess');
const saService = require('../services/superAdmin.service');

const SECTION_LABELS = {
  bahi_book: 'Bahi Book',
  buyers: 'Buyers',
  sellers: 'Sellers',
  cashbook: 'Cashbook',
  reports: 'Reports',
  business_dashboard: 'Business Dashboard',
  staff_management: 'Staff Management',
  expenses: 'Expenses',
  campaigns: 'Campaigns',
  settings: 'Settings',
};

/**
 * Get all sections with their current visibility state for a tenant.
 * Shows plan default vs override status.
 */
exports.getSections = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const [tenant] = await db.execute('SELECT id, subscription_plan FROM hris_saas.tenants WHERE id = ?', [tenantId]);
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const plan = (tenant[0].subscription_plan || 'FREE').toUpperCase();

    // Get all overrides from DB
    const [overrides] = await db.execute(
      `SELECT section_key, visible, read_only, reason, set_by, created_at, updated_at
       FROM hris_saas.tenant_section_visibility
       WHERE tenant_id = ?
       ORDER BY section_key`,
      [tenantId]
    );
    const overrideMap = {};
    overrides.forEach(o => { overrideMap[o.section_key] = o; });

    // Build all sections with their state
    const sections = Object.keys(SECTION_LABELS).map(key => {
      const ov = overrideMap[key];
      const isOverridden = !!ov;
      const isParent = Object.values(SECTION_HIERARCHY).includes(key);
      const children = Object.entries(SECTION_HIERARCHY)
        .filter(([, parent]) => parent === key)
        .map(([childKey]) => childKey);

      return {
        sectionKey: key,
        label: SECTION_LABELS[key],
        parentSectionKey: SECTION_HIERARCHY[key] || null,
        children,
        isParent,
        visible: ov ? ov.visible : getPlanDefaultVisible(key, plan),
        readOnly: ov ? ov.read_only : false,
        source: isOverridden ? 'override' : 'plan',
        reason: ov?.reason || null,
        setBy: ov?.set_by || null,
        updatedAt: ov?.updated_at || null,
        overrideId: ov ? ov.id : null,
      };
    });

    return res.json({ sections });
  } catch (err) {
    console.error('[SectionVisibility] getSections error:', err);
    return res.status(500).json({ error: 'Failed to fetch sections.' });
  }
};

/**
 * Set visibility for a section (create or update override).
 */
exports.setSectionVisibility = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { sectionKey, visible, readOnly, reason } = req.body;
    const admin = req.user;

    if (!sectionKey || visible === undefined) {
      return res.status(400).json({ error: 'sectionKey and visible are required.' });
    }

    if (!SECTION_LABELS[sectionKey]) {
      return res.status(400).json({ error: `Unknown section key "${sectionKey}".` });
    }

    if (!reason) {
      return res.status(400).json({ error: 'reason is required for visibility changes.' });
    }

    const [tenant] = await db.execute('SELECT id, company_name FROM hris_saas.tenants WHERE id = ?', [tenantId]);
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    // Get existing state for audit
    const [existing] = await db.execute(
      'SELECT visible, read_only FROM hris_saas.tenant_section_visibility WHERE tenant_id = ? AND section_key = ?',
      [tenantId, sectionKey]
    );

    const oldVisible = existing.length > 0 ? existing[0].visible : null;
    const oldReadOnly = existing.length > 0 ? existing[0].read_only : null;

    // Upsert
    if (existing.length > 0) {
      await db.execute(
        `UPDATE hris_saas.tenant_section_visibility
         SET visible = ?, read_only = COALESCE(?, read_only), reason = ?, set_by = ?, updated_at = NOW()
         WHERE tenant_id = ? AND section_key = ?`,
        [visible, readOnly !== undefined ? readOnly : null, reason, admin.id, tenantId, sectionKey]
      );
    } else {
      await db.execute(
        `INSERT INTO hris_saas.tenant_section_visibility (id, tenant_id, section_key, visible, read_only, reason, set_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), tenantId, sectionKey, visible, readOnly || false, reason, admin.id]
      );
    }

    // Record in history
    await db.execute(
      `INSERT INTO hris_saas.tenant_section_visibility_history
         (id, tenant_id, section_key, action, old_visible, new_visible, old_read_only, new_read_only, reason, changed_by, changed_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), tenantId, sectionKey,
        visible ? 'visible' : 'hidden',
        oldVisible, visible,
        oldReadOnly, readOnly !== undefined ? readOnly : oldReadOnly,
        reason, admin.id, admin.name,
      ]
    );

    // Audit logs
    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: 'section.visibility_updated',
      entityType: 'section_visibility', entityId: sectionKey,
      tenantId,
      details: { sectionKey, visible, readOnly, reason },
      req,
    });

    await saService.logTenantAudit({
      tenantId, actorId: admin.id, actorName: admin.name,
      action: 'super_admin.section_visibility_updated',
      entityType: 'section_visibility', entityId: sectionKey,
      changes: { sectionKey, visible, readOnly, reason },
      req,
    });

    return res.json({ message: 'Section visibility updated.', sectionKey, visible, readOnly });
  } catch (err) {
    console.error('[SectionVisibility] setSectionVisibility error:', err);
    return res.status(500).json({ error: 'Failed to update section visibility.' });
  }
};

/**
 * Update a specific section (partial update).
 */
exports.updateSection = async (req, res) => {
  try {
    const { tenantId, sectionKey } = req.params;
    const { visible, readOnly, reason } = req.body;
    const admin = req.user;

    const [existing] = await db.execute(
      'SELECT * FROM hris_saas.tenant_section_visibility WHERE tenant_id = ? AND section_key = ?',
      [tenantId, sectionKey]
    );

    if (existing.length === 0) {
      // No override exists yet — create one
      if (!reason) {
        return res.status(400).json({ error: 'reason is required.' });
      }
      await db.execute(
        `INSERT INTO hris_saas.tenant_section_visibility (id, tenant_id, section_key, visible, read_only, reason, set_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), tenantId, sectionKey, visible !== undefined ? visible : true, readOnly || false, reason, admin.id]
      );
    } else {
      const sets = [];
      const params = [];

      if (visible !== undefined) {
        sets.push('visible = ?');
        params.push(visible);
      }
      if (readOnly !== undefined) {
        sets.push('read_only = ?');
        params.push(readOnly);
      }
      if (reason) {
        sets.push('reason = ?');
        params.push(reason);
      }
      sets.push('set_by = ?');
      params.push(admin.id);
      sets.push('updated_at = NOW()');
      params.push(tenantId, sectionKey);

      await db.execute(
        `UPDATE hris_saas.tenant_section_visibility SET ${sets.join(', ')} WHERE tenant_id = ? AND section_key = ?`,
        params
      );
    }

    // History
    await db.execute(
      `INSERT INTO hris_saas.tenant_section_visibility_history
         (id, tenant_id, section_key, action, old_visible, new_visible, old_read_only, new_read_only, reason, changed_by, changed_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), tenantId, sectionKey,
        readOnly ? 'read_only' : 'editable',
        existing[0]?.visible ?? null, visible !== undefined ? visible : existing[0]?.visible,
        existing[0]?.read_only ?? false, readOnly !== undefined ? readOnly : (existing[0]?.read_only ?? false),
        reason || 'Updated', admin.id, admin.name,
      ]
    );

    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: 'section.visibility_updated',
      entityType: 'section_visibility', entityId: sectionKey,
      tenantId,
      details: { sectionKey, visible, readOnly, reason },
      req,
    });

    return res.json({ message: 'Section updated.', sectionKey });
  } catch (err) {
    console.error('[SectionVisibility] updateSection error:', err);
    return res.status(500).json({ error: 'Failed to update section.' });
  }
};

/**
 * Reset a section to plan default (delete override).
 */
exports.resetSection = async (req, res) => {
  try {
    const { tenantId, sectionKey } = req.params;
    const admin = req.user;

    const [existing] = await db.execute(
      'SELECT * FROM hris_saas.tenant_section_visibility WHERE tenant_id = ? AND section_key = ?',
      [tenantId, sectionKey]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'No override found for this section.' });
    }

    await db.execute(
      'DELETE FROM hris_saas.tenant_section_visibility WHERE id = ?',
      [existing[0].id]
    );

    // History
    await db.execute(
      `INSERT INTO hris_saas.tenant_section_visibility_history
         (id, tenant_id, section_key, action, old_visible, new_visible, old_read_only, new_read_only, reason, changed_by, changed_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), tenantId, sectionKey, 'reset',
        existing[0].visible, null,
        existing[0].read_only, null,
        'Reset to plan default', admin.id, admin.name,
      ]
    );

    await saService.logAction({
      adminId: admin.id, adminName: admin.name,
      action: 'section.visibility_reset',
      entityType: 'section_visibility', entityId: sectionKey,
      tenantId,
      details: { sectionKey, action: 'reset_to_plan_default' },
      req,
    });

    return res.json({ message: 'Section reset to plan default.', sectionKey });
  } catch (err) {
    console.error('[SectionVisibility] resetSection error:', err);
    return res.status(500).json({ error: 'Failed to reset section.' });
  }
};

/**
 * Get section visibility change history for a tenant.
 */
exports.getSectionHistory = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { sectionKey, limit = 50 } = req.query;

    let sql = `SELECT * FROM hris_saas.tenant_section_visibility_history
               WHERE tenant_id = ?`;
    const params = [tenantId];

    if (sectionKey) {
      sql += ' AND section_key = ?';
      params.push(sectionKey);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(String(limit));

    const [rows] = await db.execute(sql, params);
    return res.json({ history: rows });
  } catch (err) {
    console.error('[SectionVisibility] getSectionHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch history.' });
  }
};

/**
 * Plan default visibility helper
 */
function getPlanDefaultVisible(sectionKey, plan) {
  const defaults = {
    bahi_book: ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
    buyers: ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
    sellers: ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
    cashbook: ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
    reports: ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
    business_dashboard: ['BUSINESS', 'BUSINESS_PRO'],
    staff_management: ['MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
    expenses: ['BUSINESS', 'BUSINESS_PRO'],
    campaigns: ['BUSINESS', 'BUSINESS_PRO'],
    settings: ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'],
  };
  return (defaults[sectionKey] || []).includes(plan);
}
