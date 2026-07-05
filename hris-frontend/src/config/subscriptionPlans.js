/**
 * ──────────────────────────────────────────────────────
 * Bahi360 Subscription Plans — Single Source of Truth
 * ──────────────────────────────────────────────────────
 *
 * All plan checks, feature gates, and usage limits
 * across frontend menus, backend authorization, and
 * business logic MUST derive from this configuration.
 *
 * @module subscriptionPlans
 */

// ─── Types (JSDoc — project is JavaScript) ──────────

/**
 * @typedef {'FREE'|'MANAGE'|'BUSINESS'|'BUSINESS_PRO'} PlanType
 *
 * @typedef {'invoices'|'purchase_orders'|'payroll'|'inventory'|
 *           'advanced_reports'|'multi_branch'|'whatsapp'|
 *           'api_access'|'white_label'|'priority_support'|
 *           'bank_import'|'gst_returns'|'e_invoicing'|
 *           'bulk_import'|'recurring_invoices'|'credit_debit_notes'|
 *           'cash_flow'|'products'|'staff_directory'|'attendance'|
 *           'leaves'|'advances'|'replacements'|'audit_logs'|
 *           'entities'|'customers'|'suppliers'|'balance_sheet'|
 *           'pl_statement'|'tally_export'|'tds_management'|
 *           'gstr2b_reco'|'sidepanel_customization'} FeatureType
 *
 * @typedef {'customers'|'suppliers'|'staff_members'|'branches'|
 *           'monthly_transactions'|'products'} LimitType
 *
 * @typedef {Object} PlanDefinition
 * @property {PlanType} id
 * @property {string} name
 * @property {number} rank
 * @property {string[]} legacyIds
 * @property {Record<LimitType, number>} limits
 * @property {Record<FeatureType, boolean>} features
 * @property {Object} [metadata]
 * @property {string} [metadata.description]
 * @property {number} [metadata.priceMonthly]
 * @property {number} [metadata.priceYearly]
 */

// ─── Plans ───────────────────────────────────────────

/** @type {Record<PlanType, PlanDefinition>} */
export const PLANS = {
  FREE: {
    id: 'FREE',
    name: 'Free',
    rank: 0,
    legacyIds: ['free'],
    limits: {
      customers: 50,
      suppliers: 10,
      staff_members: 0,
      branches: 2,
      monthly_transactions: 500,
      products: 0,
    },
    features: {
      entities: true,
      invoices: true,
      purchase_orders: false,
      payroll: false,
      inventory: false,
      advanced_reports: true,
      multi_branch: false,
      whatsapp: false,
      api_access: false,
      white_label: false,
      priority_support: false,
      bank_import: false,
      gst_returns: false,
      e_invoicing: false,
      bulk_import: false,
      recurring_invoices: false,
      credit_debit_notes: false,
      cash_flow: false,
      products: false,
      staff_directory: false,
      attendance: false,
      leaves: false,
      advances: false,
      replacements: false,
      audit_logs: false,
      customers: true,
      suppliers: true,
      balance_sheet: false,
      pl_statement: false,
      tally_export: false,
      tds_management: false,
      gstr2b_reco: false,
      sidepanel_customization: false,
    },
    metadata: {
      description: '500 monthly txns, 2 stores, buyers & sellers',
      priceMonthly: 0,
      priceYearly: 0,
    },
  },

  MANAGE: {
    id: 'MANAGE',
    name: 'Manage',
    rank: 1,
    legacyIds: ['manage', 'manage_monthly'],
    limits: {
      customers: 250,
      suppliers: 50,
      staff_members: 10,
      branches: 2,
      monthly_transactions: 3000,
      products: 0,
    },
    features: {
      entities: true,
      invoices: true,
      purchase_orders: false,
      payroll: true,
      inventory: false,
      advanced_reports: true,
      multi_branch: false,
      whatsapp: false,
      api_access: false,
      white_label: false,
      priority_support: false,
      bank_import: false,
      gst_returns: false,
      e_invoicing: false,
      bulk_import: false,
      recurring_invoices: false,
      credit_debit_notes: false,
      cash_flow: false,
      products: true,
      staff_directory: true,
      attendance: true,
      leaves: true,
      advances: true,
      replacements: true,
      audit_logs: false,
      customers: true,
      suppliers: true,
      balance_sheet: false,
      pl_statement: false,
      tally_export: false,
      tds_management: false,
      gstr2b_reco: false,
      sidepanel_customization: false,
    },
    metadata: {
      description: '3,000 monthly txns, 10 staff, payroll & attendance',
      priceMonthly: 49,
      priceYearly: 499,
    },
  },

  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business',
    rank: 2,
    legacyIds: ['business', 'business_monthly'],
    limits: {
      customers: -1,
      suppliers: -1,
      staff_members: 25,
      branches: 3,
      monthly_transactions: 10000,
      products: -1,
    },
    features: {
      entities: true,
      invoices: true,
      purchase_orders: true,
      payroll: true,
      inventory: true,
      advanced_reports: true,
      multi_branch: true,
      whatsapp: false,
      api_access: false,
      white_label: false,
      priority_support: false,
      bank_import: false,
      gst_returns: false,
      e_invoicing: false,
      bulk_import: false,
      recurring_invoices: false,
      credit_debit_notes: false,
      cash_flow: false,
      products: true,
      staff_directory: true,
      attendance: true,
      leaves: true,
      advances: true,
      replacements: true,
      audit_logs: false,
      customers: true,
      suppliers: true,
      balance_sheet: true,
      pl_statement: false,
      tally_export: false,
      tds_management: false,
      gstr2b_reco: false,
      sidepanel_customization: false,
    },
    metadata: {
      description: '10,000 monthly txns, 25 staff, inventory & POs',
      priceMonthly: 99,
      priceYearly: 1069,
    },
  },

  BUSINESS_PRO: {
    id: 'BUSINESS_PRO',
    name: 'Business Pro',
    rank: 3,
    legacyIds: ['pro', 'pro_monthly'],
    limits: {
      customers: -1,
      suppliers: -1,
      staff_members: 50,
      branches: 5,
      monthly_transactions: 20000,
      products: -1,
    },
    features: {
      entities: true,
      invoices: true,
      purchase_orders: true,
      payroll: true,
      inventory: true,
      advanced_reports: true,
      multi_branch: true,
      whatsapp: true,
      api_access: true,
      white_label: true,
      priority_support: true,
      bank_import: true,
      gst_returns: true,
      e_invoicing: true,
      bulk_import: true,
      recurring_invoices: true,
      credit_debit_notes: true,
      cash_flow: true,
      products: true,
      staff_directory: true,
      attendance: true,
      leaves: true,
      advances: true,
      replacements: true,
      audit_logs: true,
      customers: true,
      suppliers: true,
      balance_sheet: true,
      pl_statement: true,
      tally_export: true,
      tds_management: true,
      gstr2b_reco: true,
      sidepanel_customization: true,
    },
    metadata: {
      description: '20,000 monthly txns, 50 staff, all features',
      priceMonthly: 149,
      priceYearly: 1609,
    },
  },
};

// ─── Derived Helpers ─────────────────────────────────

/** Reverse map: legacy plan id → new PlanType */
const LEGACY_MAP = {};
for (const [planId, plan] of Object.entries(PLANS)) {
  for (const legacy of plan.legacyIds) {
    LEGACY_MAP[legacy] = planId;
  }
}

// ─── Utility Functions ──────────────────────────────

/**
 * Resolve any plan identifier (new or legacy) to a PlanType key.
 * @param {string} plan
 * @returns {PlanType}
 */
export function resolvePlan(plan) {
  if (!plan) return 'FREE';
  const upper = plan.toUpperCase();
  if (PLANS[upper]) return upper;
  if (LEGACY_MAP[plan.toLowerCase()]) return LEGACY_MAP[plan.toLowerCase()];
  return 'FREE';
}

/**
 * Return the full plan definition.
 * @param {string} plan - Plan id or legacy id
 * @returns {PlanDefinition}
 */
export function getPlan(plan) {
  const key = resolvePlan(plan);
  return PLANS[key];
}

/**
 * Return numeric rank for a plan (higher = more features).
 * Falls back to 0 (FREE) for unknown plans.
 * @param {string} plan
 * @returns {number}
 */
export function getRank(plan) {
  return getPlan(plan).rank;
}

/**
 * Check whether `plan` has a given feature enabled.
 * @param {string} plan - Plan id or legacy id
 * @param {FeatureType} feature
 * @returns {boolean}
 */
export function hasFeature(plan, feature) {
  const p = getPlan(plan);
  return p.features[feature] === true;
}

/**
 * Return the numeric limit for a given dimension.
 * Returns -1 for unlimited, 0 for blocked.
 * @param {string} plan - Plan id or legacy id
 * @param {LimitType} limit
 * @returns {number} -1 = unlimited
 */
export function getLimit(plan, limit) {
  const p = getPlan(plan);
  return p.limits[limit] ?? 0;
}

/**
 * Check if a plan allows unlimited usage for a limit dimension.
 * @param {string} plan
 * @param {LimitType} limit
 * @returns {boolean}
 */
export function isUnlimited(plan, limit) {
  return getLimit(plan, limit) === -1;
}

/**
 * Check whether current rank meets the minimum required rank.
 * Accepts a plan name string or numeric rank for `minimum`.
 * @param {string|number} currentPlan - Current plan id or numeric rank
 * @param {string|number} minimum - Required plan id or numeric rank
 * @returns {boolean}
 */
export function meetsRequirement(currentPlan, minimum) {
  const currentRank = typeof currentPlan === 'number' ? currentPlan : getRank(currentPlan);
  const minRank = typeof minimum === 'number' ? minimum : getRank(minimum);
  return currentRank >= minRank;
}

// ─── Display Maps ───────────────────────────────────

/** @type {Record<string, string>} */
export const PLAN_LABELS = {
  FREE: 'Free',
  MANAGE: 'Manage',
  BUSINESS: 'Business',
  BUSINESS_PRO: 'Business Pro',
};

/** @type {Record<string, string>} */
export const PLAN_COLORS = {
  FREE: 'bg-gray-100 text-gray-600',
  MANAGE: 'bg-blue-100 text-blue-700',
  BUSINESS: 'bg-indigo-100 text-indigo-700',
  BUSINESS_PRO: 'bg-purple-100 text-purple-700',
};

/** @type {Record<FeatureType, string>} */
export const FEATURE_LABELS = {
  entities: 'Multi-Entity Management',
  invoices: 'Invoicing',
  purchase_orders: 'Purchase Orders',
  payroll: 'Payroll',
  inventory: 'Inventory Management',
  advanced_reports: 'Advanced Reports',
  multi_branch: 'Multi-Branch Support',
  whatsapp: 'WhatsApp Integration',
  api_access: 'API Access',
  white_label: 'White-Label Branding',
  priority_support: 'Priority Support',
  bank_import: 'Bank Import',
  gst_returns: 'GST Returns',
  e_invoicing: 'E-Invoicing',
  bulk_import: 'Bulk Import',
  recurring_invoices: 'Recurring Invoices',
  credit_debit_notes: 'Credit / Debit Notes',
  cash_flow: 'Cash Flow',
  products: 'Products / Inventory',
  staff_directory: 'Staff Directory',
  attendance: 'Attendance',
  leaves: 'Leaves',
  advances: 'Advances',
  replacements: 'Replacements',
  audit_logs: 'Audit Logs',
  customers: 'Customer Management',
  suppliers: 'Supplier Management',
  balance_sheet: 'Balance Sheet',
  pl_statement: 'P&L Statement',
  tally_export: 'Tally Export',
  tds_management: 'TDS Management',
  gstr2b_reco: 'GSTR-2B Reconciliation',
  sidepanel_customization: 'Side Panel Customization',
};

/** @type {Record<LimitType, string>} */
export const LIMIT_LABELS = {
  customers: 'Customers',
  suppliers: 'Suppliers',
  staff_members: 'Staff Members',
  branches: 'Branches',
  monthly_transactions: 'Monthly Transactions',
  products: 'Products',
};

// ─── Sidebar/Route Configuration ────────────────────

/**
 * Menu section definitions keyed by feature.
 * Each section lists what plan feature enables it and its route items.
 *
 * Frontend menus and backend route guards should read from here
 * rather than hardcoding plan names.
 */
export const MENU_SECTIONS = [
  {
    feature: 'entities',
    requiredPlan: 'FREE',
    label: 'Entities',
    icon: 'entity',
    route: '/admin/entities',
    type: 'link',
  },
  {
    feature: null,
    requiredPlan: 'FREE',
    label: 'My Bahi Book',
    icon: 'ledger',
    route: '/admin/ledger',
    type: 'group',
    items: [
      { feature: 'customers',    requiredPlan: 'FREE',    label: 'Buyers',    route: '/admin/ledger/buyers' },
      { feature: null,           requiredPlan: 'FREE',    label: 'Sellers',   route: '/admin/ledger/sellers' },
      { feature: null,           requiredPlan: 'FREE',    label: 'Cashbook',  route: '/admin/ledger/cashbook' },
      { feature: null,           requiredPlan: 'FREE',    label: 'Reports',   route: '/admin/ledger/reports' },
    ],
  },
  {
    feature: 'staff_directory',
    requiredPlan: 'MANAGE',
    label: 'My Staff',
    icon: 'staff',
    route: '/admin/hr',
    type: 'group',
    items: [
      { feature: 'staff_directory', requiredPlan: 'MANAGE', label: 'Staff Directory', route: '/admin/employees' },
      { feature: 'attendance',      requiredPlan: 'MANAGE', label: 'Attendance',      route: '/admin/calendar' },
      { feature: 'leaves',          requiredPlan: 'MANAGE', label: 'Leaves',           route: '/admin/leaves' },
      { feature: 'payroll',         requiredPlan: 'MANAGE', label: 'Payroll',          route: '/admin/payroll' },
      { feature: 'advances',        requiredPlan: 'MANAGE', label: 'Advances',         route: '/admin/advances' },
      { feature: 'replacements',    requiredPlan: 'MANAGE', label: 'Replacements',     route: '/admin/replacements' },
    ],
  },
  {
    feature: 'invoices',
    requiredPlan: 'BUSINESS',
    label: 'My Business',
    icon: 'business',
    route: '/admin/business',
    type: 'group',
    items: [
      { feature: 'suppliers',           requiredPlan: 'BUSINESS', label: 'Suppliers',         route: '/admin/suppliers' },
      { feature: 'customers',           requiredPlan: 'BUSINESS', label: 'Customers',         route: '/admin/customers' },
      { feature: 'purchase_orders',     requiredPlan: 'BUSINESS', label: 'Purchase Orders',   route: '/admin/purchase-orders' },
      { feature: 'invoices',            requiredPlan: 'BUSINESS', label: 'Invoices',          route: '/admin/invoices' },
      { feature: 'recurring_invoices',  requiredPlan: 'BUSINESS', label: 'Recurring',         route: '/admin/recurring-invoices' },
      { feature: 'bank_import',         requiredPlan: 'BUSINESS', label: 'Bank Import',       route: '/admin/bank' },
      { feature: 'credit_debit_notes',  requiredPlan: 'BUSINESS', label: 'Credit/Debit Notes',route: '/admin/notes' },
      { feature: 'balance_sheet',       requiredPlan: 'BUSINESS', label: 'Balance Sheet',     route: '/admin/balance' },
      { feature: 'advanced_reports',    requiredPlan: 'BUSINESS', label: 'Reports',           route: '/admin/reports' },
      { feature: 'pl_statement',        requiredPlan: 'BUSINESS', label: 'P&L Statement',     route: '/admin/pl' },
      { feature: 'cash_flow',           requiredPlan: 'BUSINESS', label: 'Cash Flow',         route: '/admin/cash-flow' },
      { feature: 'gst_returns',         requiredPlan: 'BUSINESS', label: 'GST Returns',       route: '/admin/gst-returns' },
      { feature: 'gstr2b_reco',         requiredPlan: 'BUSINESS', label: 'GSTR-2B Reco',      route: '/admin/gstr2b' },
      { feature: 'tds_management',      requiredPlan: 'BUSINESS', label: 'TDS Management',    route: '/admin/tds' },
      { feature: 'tally_export',        requiredPlan: 'BUSINESS', label: 'Tally Export',      route: '/admin/tally' },
      { feature: 'bulk_import',         requiredPlan: 'BUSINESS', label: 'Bulk Import',       route: '/admin/bulk-import' },
      { feature: 'products',            requiredPlan: 'BUSINESS', label: 'Inventory',         route: '/admin/products' },
    ],
  },
  {
    feature: null,
    requiredPlan: 'FREE',
    label: 'Payments',
    icon: 'payments',
    route: '/admin/payments',
    type: 'link',
  },
  {
    feature: null,
    requiredPlan: 'FREE',
    label: 'Usage',
    icon: 'payments',
    route: '/admin/usage',
    type: 'link',
  },
  {
    feature: null,
    requiredPlan: 'FREE',
    label: 'Subscription',
    icon: 'upgrade',
    route: '/admin/subscription',
    type: 'link',
  },
  {
    feature: null,
    requiredPlan: 'FREE',
    label: 'Refer & Earn',
    icon: 'upgrade',
    route: '/admin/referrals',
    type: 'link',
  },
  {
    feature: null,
    requiredPlan: 'FREE',
    label: 'Settings',
    icon: 'settings',
    route: '/admin/settings',
    type: 'group',
    items: [
      { feature: null,                requiredPlan: 'FREE',          label: 'General',       route: '/admin/settings' },
      { feature: null,                requiredPlan: 'FREE',          label: 'Business',      route: '/admin/settings/business' },
      { feature: 'e_invoicing',       requiredPlan: 'BUSINESS',      label: 'E-Invoicing',   route: '/admin/settings/einvoice' },
      { feature: 'whatsapp',          requiredPlan: 'BUSINESS',      label: 'WhatsApp',      route: '/admin/settings/whatsapp' },
      { feature: 'sidepanel_customization', requiredPlan: 'BUSINESS', label: 'Sidebar',      route: '/admin/settings/sidebar' },
      { feature: null,                requiredPlan: 'FREE',          label: 'Password',      route: '/admin/settings/password' },
    ],
  },
  {
    feature: 'audit_logs',
    requiredPlan: 'BUSINESS_PRO',
    label: 'Audit Logs',
    icon: 'audit',
    route: '/admin/audit-logs',
    type: 'link',
  },
];

// ─── Exports for convenience ─────────────────────────

export default PLANS;
