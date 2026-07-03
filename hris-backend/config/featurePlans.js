/**
 * Minimum plan rank required for each feature.
 *
 * Derived from hris-frontend/src/config/subscriptionPlans.js
 * Plan ranks: FREE=0, MANAGE=1, BUSINESS=2, BUSINESS_PRO=3
 *
 * A feature is available on a tenant's plan when:
 *   PLAN_RANK[tenantPlan] >= FEATURE_PLANS[featureKey]
 */
const FEATURE_PLANS = {
  entities: 0,
  invoices: 0,
  customers: 0,
  products: 0,
  staff_directory: 0,
  attendance: 0,
  leaves: 0,

  purchase_orders: 1,
  suppliers: 0,
  credit_debit_notes: 1,

  inventory: 2,
  advanced_reports: 2,
  multi_branch: 2,
  whatsapp: 2,
  bank_import: 2,
  gst_returns: 2,
  e_invoicing: 2,
  bulk_import: 2,
  recurring_invoices: 2,
  cash_flow: 2,
  balance_sheet: 2,
  pl_statement: 2,
  tally_export: 2,
  tds_management: 2,
  gstr2b_reco: 2,
  sidepanel_customization: 2,

  payroll: 3,
  advances: 3,
  replacements: 3,
  audit_logs: 3,
  api_access: 3,
  white_label: 3,
  priority_support: 3,
};

const PLAN_RANK = { FREE: 0, MANAGE: 1, BUSINESS: 2, BUSINESS_PRO: 3 };
const LEGACY_RESOLVE = {
  FREE: 'FREE',
  MANAGE: 'MANAGE',
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

function getRank(plan) {
  return PLAN_RANK[resolvePlan(plan)] ?? 0;
}

function hasFeature(plan, feature) {
  if (!feature) return true;
  const minRank = FEATURE_PLANS[feature];
  if (minRank === undefined) return true;
  return getRank(plan) >= minRank;
}

module.exports = { FEATURE_PLANS, PLAN_RANK, hasFeature, getRank, resolvePlan };
