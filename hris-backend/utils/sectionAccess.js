const db = require('../config/db');

/**
 * Section Access Resolver
 *
 * Checks whether a tenant can view or edit a given section.
 * Respects parent-section hierarchy (if parent is hidden, child is hidden).
 */

const SECTION_HIERARCHY = {
  bahi_book: null,
  buyers: 'bahi_book',
  sellers: 'bahi_book',
  cashbook: 'bahi_book',
  reports: 'bahi_book',
  business_dashboard: null,
  staff_management: null,
  expenses: 'business_dashboard',
  campaigns: 'business_dashboard',
  settings: null,
};

/**
 * Get section visibility state from DB (cached per call).
 * Returns { visible, read_only, source: 'override'|'plan' }
 */
async function getSectionState(tenantId, sectionKey) {
  // 1. Check tenant_section_visibility (override)
  const [rows] = await db.execute(
    `SELECT visible, read_only, set_by
     FROM tenant_section_visibility
     WHERE tenant_id = ? AND section_key = ?`,
    [tenantId, sectionKey]
  );

  if (rows.length > 0) {
    return {
      visible: rows[0].visible,
      readOnly: rows[0].read_only,
      source: rows[0].set_by ? 'override' : 'plan',
    };
  }

  // 2. Fall back to plan default
  const [tenant] = await db.execute(
    'SELECT subscription_plan FROM tenants WHERE id = ?',
    [tenantId]
  );
  const plan = (tenant[0]?.subscription_plan || 'FREE').toUpperCase();

  return {
    visible: getPlanDefaultVisible(sectionKey, plan),
    readOnly: false,
    source: 'plan',
  };
}

/**
 * Check if a section is visible for a tenant.
 * Respects parent hierarchy — if parent is hidden, child is hidden.
 */
async function isTenantSectionVisible(tenantId, sectionKey) {
  const parentKey = SECTION_HIERARCHY[sectionKey];
  if (parentKey) {
    const parentState = await getSectionState(tenantId, parentKey);
    if (!parentState.visible) return false;
  }

  const state = await getSectionState(tenantId, sectionKey);
  return state.visible;
}

/**
 * Check if a section is read-only for a tenant.
 */
async function isTenantSectionReadonly(tenantId, sectionKey) {
  const state = await getSectionState(tenantId, sectionKey);
  return state.readOnly;
}

/**
 * Check if a tenant can perform a specific action on a section.
 * Actions: 'view', 'create', 'edit', 'delete'
 */
async function canTenantPerformAction(tenantId, sectionKey, action) {
  if (action === 'view') {
    return isTenantSectionVisible(tenantId, sectionKey);
  }

  // Create/edit/delete require section to be visible AND not read-only
  const visible = await isTenantSectionVisible(tenantId, sectionKey);
  if (!visible) return false;

  if (['create', 'edit', 'delete'].includes(action)) {
    const readOnly = await isTenantSectionReadonly(tenantId, sectionKey);
    return !readOnly;
  }

  return false;
}

/**
 * Plan default visibility by section key and plan name.
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

module.exports = {
  isTenantSectionVisible,
  isTenantSectionReadonly,
  canTenantPerformAction,
  getSectionState,
  SECTION_HIERARCHY,
};
