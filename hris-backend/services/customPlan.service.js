const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { invalidateCache } = require('../utils/subscription');

/**
 * Custom Plan Service
 *
 * Manages custom plan definitions (named sets of limit + feature
 * overrides) and their assignment to tenants.
 *
 * A custom plan is based on a base_plan (FREE/MANAGE/BUSINESS/BUSINESS_PRO)
 * with overrides for specific limits and features stored as JSONB.
 * When a tenant is assigned a custom plan, the custom values take
 * precedence over the base plan's defaults.
 */

const VALID_BASE_PLANS = ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'];

/**
 * List all custom plans (optionally only active).
 */
async function listPlans(activeOnly = false) {
  let sql = `SELECT * FROM hris_saas.custom_plans`;
  const params = [];
  if (activeOnly) {
    sql += ` WHERE is_active = true`;
  }
  sql += ` ORDER BY created_at DESC`;
  const [rows] = await db.execute(sql, params);
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    basePlan: r.base_plan,
    limits: r.limits,
    features: r.features,
    monthlyPrice: r.monthly_price,
    yearlyPrice: r.yearly_price,
    isActive: r.is_active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Get a single custom plan by ID.
 */
async function getPlan(id) {
  const [rows] = await db.execute(
    `SELECT * FROM hris_saas.custom_plans WHERE id = ?`,
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    basePlan: r.base_plan,
    limits: r.limits,
    features: r.features,
    monthlyPrice: r.monthly_price,
    yearlyPrice: r.yearly_price,
    isActive: r.is_active,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Create a custom plan.
 */
async function createPlan({ name, description, basePlan, limits, features, monthlyPrice, yearlyPrice, createdBy }) {
  if (!name) throw new Error('Plan name is required.');
  if (!VALID_BASE_PLANS.includes(basePlan)) {
    throw new Error(`Invalid base plan: "${basePlan}". Valid: ${VALID_BASE_PLANS.join(', ')}`);
  }

  const id = uuidv4();
  await db.execute(
    `INSERT INTO hris_saas.custom_plans
       (id, name, description, base_plan, limits, features, monthly_price, yearly_price, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id, name, description || null, basePlan,
      JSON.stringify(limits || {}), JSON.stringify(features || {}),
      monthlyPrice || 0, yearlyPrice || 0, createdBy || null,
    ]
  );
  return getPlan(id);
}

/**
 * Update a custom plan.
 */
async function updatePlan(id, updates) {
  const existing = await getPlan(id);
  if (!existing) throw new Error('Custom plan not found.');

  const sets = [];
  const params = [];

  if (updates.name !== undefined) { sets.push('name = ?'); params.push(updates.name); }
  if (updates.description !== undefined) { sets.push('description = ?'); params.push(updates.description); }
  if (updates.basePlan !== undefined) {
    if (!VALID_BASE_PLANS.includes(updates.basePlan)) throw new Error('Invalid base plan.');
    sets.push('base_plan = ?'); params.push(updates.basePlan);
  }
  if (updates.limits !== undefined) { sets.push('limits = ?'); params.push(JSON.stringify(updates.limits)); }
  if (updates.features !== undefined) { sets.push('features = ?'); params.push(JSON.stringify(updates.features)); }
  if (updates.monthlyPrice !== undefined) { sets.push('monthly_price = ?'); params.push(updates.monthlyPrice); }
  if (updates.yearlyPrice !== undefined) { sets.push('yearly_price = ?'); params.push(updates.yearlyPrice); }
  if (updates.isActive !== undefined) { sets.push('is_active = ?'); params.push(updates.isActive); }

  if (sets.length === 0) return existing;

  sets.push('updated_at = NOW()');
  params.push(id);

  await db.execute(
    `UPDATE hris_saas.custom_plans SET ${sets.join(', ')} WHERE id = ?`,
    params
  );

  // Invalidate cache for any tenant assigned to this plan
  try { invalidateCache(id); } catch {}

  return getPlan(id);
}

/**
 * Assign a custom plan to a tenant.
 */
async function assignToTenant(tenantId, customPlanId, assignedBy) {
  const plan = await getPlan(customPlanId);
  if (!plan) throw new Error('Custom plan not found.');
  if (!plan.isActive) throw new Error('Custom plan is not active.');

  // Upsert into junction table
  await db.execute(
    `INSERT INTO hris_saas.tenant_custom_plans (id, tenant_id, custom_plan_id, assigned_at, assigned_by)
     VALUES (?, ?, ?, NOW(), ?)
     ON CONFLICT (tenant_id)
     DO UPDATE SET custom_plan_id = ?, assigned_at = NOW(), assigned_by = ?`,
    [uuidv4(), tenantId, customPlanId, assignedBy, customPlanId, assignedBy]
  );

  // Also apply the base plan + overrides to the tenant's subscription
  const { resolvePlan } = require('../config/planLimits');
  const targetPlan = plan.basePlan;

  // Update tenant's subscription plan
  await db.execute(
    `UPDATE hris_saas.tenants SET subscription_plan = ?, updated_at = NOW() WHERE id = ?`,
    [targetPlan, tenantId]
  );

  try { invalidateCache(targetPlan); } catch {}

  return { tenantId, customPlanId, plan };
}

/**
 * Remove a custom plan assignment from a tenant.
 */
async function removeFromTenant(tenantId) {
  await db.execute(
    `DELETE FROM hris_saas.tenant_custom_plans WHERE tenant_id = ?`,
    [tenantId]
  );
  return { tenantId, removed: true };
}

/**
 * Get the custom plan assigned to a tenant, if any.
 */
async function getTenantCustomPlan(tenantId) {
  const [rows] = await db.execute(
    `SELECT cp.* FROM hris_saas.custom_plans cp
     JOIN hris_saas.tenant_custom_plans tcp ON cp.id = tcp.custom_plan_id
     WHERE tcp.tenant_id = ? AND cp.is_active = true`,
    [tenantId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    basePlan: r.base_plan,
    limits: r.limits,
    features: r.features,
    monthlyPrice: r.monthly_price,
    yearlyPrice: r.yearly_price,
  };
}

/**
 * Resolve effective limits for a tenant (custom plan overrides base plan).
 * Returns merged limits object.
 */
async function resolveEffectiveLimits(tenantId, basePlan) {
  const custom = await getTenantCustomPlan(tenantId);
  if (!custom) return null;

  const { PLAN_LIMITS } = require('../config/planLimits');
  const base = PLAN_LIMITS[basePlan] || {};
  const overrides = custom.limits || {};

  const merged = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== null && val !== undefined) {
      merged[key] = val;
    }
  }
  return merged;
}

/**
 * Resolve effective features for a tenant (custom plan overrides base plan).
 */
async function resolveEffectiveFeatures(tenantId, basePlan) {
  const custom = await getTenantCustomPlan(tenantId);
  if (!custom) return null;

  // Get base features from the subscription_plans table
  const [planRows] = await db.execute(
    `SELECT features FROM hris_saas.subscription_plans WHERE id = ?`,
    [basePlan.toLowerCase()]
  );
  const base = planRows[0]?.features || {};
  const overrides = custom.features || {};

  return { ...base, ...overrides };
}

module.exports = {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  assignToTenant,
  removeFromTenant,
  getTenantCustomPlan,
  resolveEffectiveLimits,
  resolveEffectiveFeatures,
};
