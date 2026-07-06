const db = require('../config/db');

/**
 * Section Access Resolver
 *
 * Checks whether a tenant can view or edit a given section.
 * Respects parent-section hierarchy (if parent is hidden, child is hidden).
 */

const SECTION_HIERARCHY = {
  // Plan-level sections (new)
  my_bahi_book: null,
  my_business: null,
  my_staff: null,
  entities: null,
  // Child items → reparented under plan sections
  buyers: 'my_bahi_book',
  sellers: 'my_bahi_book',
  cashbook: 'my_bahi_book',
  reports: 'my_bahi_book',
  expenses: 'my_business',
  campaigns: 'my_business',
  // Business sub-menus
  suppliers: 'my_business',
  customers: 'my_business',
  purchase_orders: 'my_business',
  invoices: 'my_business',
  recurring_invoices: 'my_business',
  bank_import: 'my_business',
  credit_debit_notes: 'my_business',
  balance_sheet: 'my_business',
  advanced_reports: 'my_business',
  pl_statement: 'my_business',
  cash_flow: 'my_business',
  gst_returns: 'my_business',
  gstr2b_reco: 'my_business',
  tds_management: 'my_business',
  tally_export: 'my_business',
  bulk_import: 'my_business',
  products: 'my_business',
  // HR sub-menus under my_staff
  staff_directory: 'my_staff',
  attendance: 'my_staff',
  leaves: 'my_staff',
  payroll: 'my_staff',
  advances: 'my_staff',
  replacements: 'my_staff',
  // Legacy top-level keys (retained for backward compat)
  bahi_book: null,
  business_dashboard: null,
  staff_management: null,
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
    // New plan-level sections
    my_bahi_book: ['free', 'manage', 'manage_monthly', 'business', 'business_monthly', 'business_pro_monthly'],
    my_business: ['business', 'business_monthly', 'business_pro_monthly'],
    my_staff: ['free', 'manage', 'manage_monthly', 'business', 'business_monthly', 'business_pro_monthly'],
    entities: ['free', 'manage', 'manage_monthly', 'business', 'business_monthly', 'business_pro_monthly'],
    // Legacy keys
    bahi_book: ['FREE', 'MANAGE', 'MANAGE_MONTHLY'],
    buyers: ['MANAGE', 'MANAGE_MONTHLY', 'BUSINESS', 'BUSINESS_PRO'],
    sellers: ['MANAGE', 'MANAGE_MONTHLY', 'BUSINESS', 'BUSINESS_PRO'],
    cashbook: ['MANAGE', 'MANAGE_MONTHLY', 'BUSINESS', 'BUSINESS_PRO'],
    reports: ['MANAGE', 'MANAGE_MONTHLY', 'BUSINESS', 'BUSINESS_PRO'],
    business_dashboard: ['BUSINESS', 'BUSINESS_PRO'],
    staff_management: ['MANAGE', 'MANAGE_MONTHLY', 'BUSINESS', 'BUSINESS_PRO'],
    expenses: ['BUSINESS', 'BUSINESS_PRO'],
    campaigns: ['BUSINESS', 'BUSINESS_PRO'],
    suppliers: ['BUSINESS', 'BUSINESS_PRO'],
    customers: ['BUSINESS', 'BUSINESS_PRO'],
    purchase_orders: ['BUSINESS', 'BUSINESS_PRO'],
    invoices: ['BUSINESS', 'BUSINESS_PRO'],
    recurring_invoices: ['BUSINESS', 'BUSINESS_PRO'],
    bank_import: ['BUSINESS', 'BUSINESS_PRO'],
    credit_debit_notes: ['BUSINESS', 'BUSINESS_PRO'],
    balance_sheet: ['BUSINESS', 'BUSINESS_PRO'],
    advanced_reports: ['BUSINESS', 'BUSINESS_PRO'],
    pl_statement: ['BUSINESS', 'BUSINESS_PRO'],
    cash_flow: ['BUSINESS', 'BUSINESS_PRO'],
    gst_returns: ['BUSINESS', 'BUSINESS_PRO'],
    gstr2b_reco: ['BUSINESS', 'BUSINESS_PRO'],
    tds_management: ['BUSINESS', 'BUSINESS_PRO'],
    tally_export: ['BUSINESS', 'BUSINESS_PRO'],
    bulk_import: ['BUSINESS', 'BUSINESS_PRO'],
    products: ['BUSINESS', 'BUSINESS_PRO'],
    settings: ['FREE', 'MANAGE', 'MANAGE_MONTHLY', 'BUSINESS', 'BUSINESS_PRO'],
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
