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
  my_bahi_book: 'My Bahi Book',
  my_business: 'My Business',
  my_staff: 'My Staff (HR)',
  entities: 'Entities',
  staff_directory: 'Staff Directory',
  attendance: 'Attendance',
  leaves: 'Leaves',
  payroll: 'Payroll',
  advances: 'Advances',
  replacements: 'Replacements',
  suppliers: 'Suppliers',
  customers: 'Customers',
  purchase_orders: 'Purchase Orders',
  invoices: 'Invoices',
  recurring_invoices: 'Recurring',
  bank_import: 'Bank Import',
  credit_debit_notes: 'Credit/Debit Notes',
  balance_sheet: 'Balance Sheet',
  advanced_reports: 'Reports',
  pl_statement: 'P&L Statement',
  cash_flow: 'Cash Flow',
  gst_returns: 'GST Returns',
  gstr2b_reco: 'GSTR-2B Reco',
  tds_management: 'TDS Management',
  tally_export: 'Tally Export',
  bulk_import: 'Bulk Import',
  products: 'Inventory',
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

    const planCode = (tenant[0].subscription_plan || 'FREE').toLowerCase();

    // Get ALL plan features for default visibility + section-type identification
    const [allPlanFeatures] = await db.execute(
      `SELECT feature_key, feature_type, enabled FROM hris_saas.plan_features
       WHERE plan_id = ?`,
      [planCode]
    );
    const planDefaults = {};
    const planSectionKeys = [];
    allPlanFeatures.forEach(f => {
      planDefaults[f.feature_key] = f.enabled;
      if (f.feature_type === 'section') planSectionKeys.push(f.feature_key);
    });

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

    // Build children of plan-level sections from hierarchy
    const childrenOfPlanSection = {};
    Object.entries(SECTION_HIERARCHY).forEach(([child, parent]) => {
      if (parent && planSectionKeys.includes(parent)) {
        childrenOfPlanSection[child] = parent;
      }
    });

    // Determine which keys to show
    let allKeys;
    if (planSectionKeys.length > 0) {
      // Show plan section features + their hierarchy children
      allKeys = [...planSectionKeys, ...Object.keys(childrenOfPlanSection)];
    } else {
      // Fallback for plans without section-type features: show SECTION_LABELS keys
      // that have a matching plan feature or any old override
      const overrideKeys = new Set(overrides.map(o => o.section_key));
      allKeys = Object.keys(SECTION_LABELS).filter(k =>
        k in planDefaults || overrideKeys.has(k)
      );
    }

    const sections = Array.from(allKeys).map(key => {
      const ov = overrideMap[key];
      const isOverridden = !!ov;
      const parent = SECTION_HIERARCHY[key] || null;
      const isParent = Object.values(SECTION_HIERARCHY).includes(key);
      const children = Object.entries(SECTION_HIERARCHY)
        .filter(([, p]) => p === key)
        .map(([childKey]) => childKey);

      // Default visibility: plan's enabled field, or fallback to false
      const planDefault = key in planDefaults ? planDefaults[key] : false;

      // Cascade parent visibility only if child has no plan feature of its own
      let visible = ov ? ov.visible : planDefault;
      if (!ov && parent && !(key in planDefaults) && parent in planDefaults && !planDefaults[parent]) {
        visible = false;
      }

      return {
        sectionKey: key,
        label: SECTION_LABELS[key] || key,
        parentSectionKey: parent,
        children,
        isParent,
        visible,
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
/**
 * Get section visibility for the current tenant (tenant-facing).
 * Returns only visible + readOnly flags for each section.
 */
exports.getTenantSections = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [overrides] = await db.execute(
      `SELECT section_key, visible, read_only
       FROM hris_saas.tenant_section_visibility
       WHERE tenant_id = ?`,
      [tenantId]
    );

    const sections = {};
    overrides.forEach(o => {
      sections[o.section_key] = { visible: o.visible, readOnly: o.read_only };
    });

    return res.json({ sections });
  } catch (err) {
    console.error('[SectionVisibility] getTenantSections error:', err);
    return res.status(500).json({ error: 'Failed to fetch section visibility.' });
  }
};

exports.setSectionVisibility = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { sectionKey, visible, readOnly, reason } = req.body;
    const admin = req.user;

    if (!sectionKey) {
      return res.status(400).json({ error: 'sectionKey is required.' });
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
      const sets = [];
      const params = [];
      if (visible !== undefined) { sets.push('visible = ?'); params.push(visible); }
      if (readOnly !== undefined) { sets.push('read_only = ?'); params.push(readOnly); }
      sets.push('reason = ?', 'set_by = ?', 'updated_at = NOW()');
      params.push(reason, admin.id, tenantId, sectionKey);
      await db.execute(
        `UPDATE hris_saas.tenant_section_visibility SET ${sets.join(', ')} WHERE tenant_id = ? AND section_key = ?`,
        params
      );
    } else {
      await db.execute(
        `INSERT INTO hris_saas.tenant_section_visibility (id, tenant_id, section_key, visible, read_only, reason, set_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [uuidv4(), tenantId, sectionKey, visible ?? true, readOnly ?? false, reason, admin.id]
      );
    }

    // Record in history
    const action = visible !== undefined ? (visible ? 'visible' : 'hidden') : (readOnly !== undefined ? 'read_only_toggled' : 'updated');
    await db.execute(
      `INSERT INTO hris_saas.tenant_section_visibility_history
         (id, tenant_id, section_key, action, old_visible, new_visible, old_read_only, new_read_only, reason, changed_by, changed_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        uuidv4(), tenantId, sectionKey,
        action,
        oldVisible, visible !== undefined ? visible : oldVisible,
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
