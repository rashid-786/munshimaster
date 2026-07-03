const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { incrementUsage, checkUsage } = require('../services/usage.service');
const { resolvePlan, PLAN_RANK } = require('../config/planLimits');

const entityLabel = (plan) => (PLAN_RANK[resolvePlan(plan)] ?? 0) <= 1 ? 'store' : 'entity';

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [tenant] = await db.query(
      `SELECT organization_id, company_name, branch_name, entity_type, subscription_plan, status, created_at
       FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    if (tenant.length === 0) return res.json([]);

    const row = tenant[0];

    // If no organization_id, this tenant is a standalone primary entity
    if (!row.organization_id) {
      // Auto-bootstrap: set itself as primary org
      await db.query(
        `UPDATE hris_saas.tenants
         SET organization_id = $1, entity_type = 'primary'
         WHERE id = $1 AND organization_id IS NULL`,
        [tenantId]
      );
      const [entities] = await db.query(
        `SELECT id, company_name, branch_name, entity_type, subscription_plan, status, created_at
         FROM hris_saas.tenants
         WHERE id = $1 AND status = 'active'`, [tenantId]
      );
      return res.json(entities);
    }

    const [entities] = await db.query(
      `SELECT id, company_name, branch_name, entity_type, subscription_plan, status, created_at
       FROM hris_saas.tenants
       WHERE organization_id = $1 AND status = 'active'
       ORDER BY entity_type DESC, created_at`, [row.organization_id]
    );
    res.json(entities);
  } catch (error) {
    console.error('List entities error:', error);
    res.status(500).json({ error: 'Failed to list.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { companyName, branchName, gstin, settings } = req.body;

  if (!companyName) return res.status(400).json({ error: 'Company name is required.' });

  try {
    const [parent] = await db.query(
      `SELECT organization_id, subscription_plan FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    if (parent.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const parentTenant = parent[0];
    let orgId = parentTenant.organization_id;

    // Auto-bootstrap: if parent has no org, set itself as primary
    if (!orgId) {
      await db.query(
        `UPDATE hris_saas.tenants
         SET organization_id = $1, entity_type = 'primary'
         WHERE id = $1 AND organization_id IS NULL`,
        [tenantId]
      );
      orgId = tenantId;
    }

    // Enforce entity limit for the tenant's plan
    const plan = resolvePlan(parentTenant.subscription_plan);
    const limitCheck = await checkUsage({
      tenantId,
      plan,
      limitKey: 'entities',
    });
    if (!limitCheck.allowed) {
      const label = entityLabel(parentTenant.subscription_plan);
      return res.status(403).json({
        error: `${label.charAt(0).toUpperCase() + label.slice(1)} limit reached.`,
        message: `Your plan allows a maximum of ${limitCheck.allowedLimit} ${label}s.`,
        currentUsage: limitCheck.currentUsage,
        allowedLimit: limitCheck.allowedLimit,
      });
    }

    const entityId = uuidv4();
    const entitySettings = settings || {};

    if (gstin) entitySettings.sellerGstin = gstin;

    await db.query(
      `INSERT INTO hris_saas.tenants (id, company_name, branch_name, entity_type, organization_id, settings, subdomain, subscription_plan, status, created_at)
       VALUES ($1, $2, $3, 'branch', $4, $5, $6, $7, 'active', NOW())`,
      [entityId, companyName, branchName || null, orgId, JSON.stringify(entitySettings),
       `branch_${entityId.slice(0, 8)}`, parentTenant.subscription_plan || 'free']
    );

    incrementUsage(tenantId, 'entities').catch(() => {});

    try {
      await db.query(
        `INSERT INTO hris_saas.employees (id, tenant_id, email, phone, first_name, last_name, role, status, created_at, password_hash, base_salary)
         SELECT gen_random_uuid()::varchar, $1, email, phone, first_name, last_name, 'tenant_admin', 'active', NOW(), password_hash, base_salary
         FROM hris_saas.employees WHERE tenant_id = $2 AND role = 'tenant_admin' LIMIT 1`,
        [entityId, tenantId]
      );
    } catch (copyErr) {
      console.warn('Could not copy admin user to new entity:', copyErr.message);
    }

    const label = entityLabel(parentTenant.subscription_plan);
    res.json({ message: `${label.charAt(0).toUpperCase() + label.slice(1)} created.`, id: entityId, companyName, branchName });
  } catch (error) {
    console.error('Create entity error:', error);
    res.status(500).json({ error: 'Failed to create.' });
  }
};

exports.switch = async (req, res) => {
  const currentTenantId = req.tenantId;
  const { targetTenantId } = req.body;

  if (!targetTenantId) return res.status(400).json({ error: 'targetTenantId is required.' });

  try {
    // Verify both tenants share the same organization
    const [tenants] = await db.query(
      `SELECT t1.organization_id as org1, t2.organization_id as org2,
              t2.id, t2.company_name, t2.branch_name, t2.subscription_plan
       FROM hris_saas.tenants t1
       CROSS JOIN hris_saas.tenants t2
       WHERE t1.id = $1 AND t2.id = $2`,
      [currentTenantId, targetTenantId]
    );
    if (tenants.length === 0 || tenants[0].org1 !== tenants[0].org2) {
      return res.status(403).json({ error: 'Cannot switch to this entity.' });
    }

    // Generate new JWT for the target tenant
    const target = tenants[0];
    const subPlan = target.subscription_plan;
    const [user] = await db.query(
      `SELECT id, email, first_name, last_name, role FROM hris_saas.employees
       WHERE tenant_id = $1 AND status = 'active' LIMIT 1`,
      [targetTenantId]
    );
    if (user.length === 0) return res.status(403).json({ error: `No user found for target ${entityLabel(subPlan)}.` });

    const userName = `${user[0].first_name} ${user[0].last_name}`.trim() || 'User';
    const token = jwt.sign(
      { id: user[0].id, tenantId: targetTenantId, role: user[0].role, name: userName },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      tenant: {
        id: target.id,
        companyName: target.company_name,
        branchName: target.branch_name,
        subscriptionPlan: target.subscription_plan,
      },
      });
    } catch (error) {
      console.error('Switch entity error:', error);
      res.status(500).json({ error: 'Failed to switch.' });
    }
  };

  exports.update = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { companyName, branchName, gstin } = req.body;

    try {
      const [tenant] = await db.query(
        `SELECT organization_id, subscription_plan FROM hris_saas.tenants WHERE id = $1`, [tenantId]
      );
      if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

      const { organization_id: orgId, subscription_plan } = tenant[0];

      // Verify target entity belongs to same org
      const [target] = await db.query(
        `SELECT id, settings FROM hris_saas.tenants WHERE id = $1 AND organization_id = $2`,
        [id, orgId]
      );
      if (target.length === 0) return res.status(404).json({ error: `${entityLabel(subscription_plan).charAt(0).toUpperCase() + entityLabel(subscription_plan).slice(1)} not found.` });

      let settings = target[0].settings || {};
      if (gstin !== undefined) settings = { ...settings, sellerGstin: gstin };

      await db.query(
        `UPDATE hris_saas.tenants
         SET company_name = COALESCE($1, company_name),
             branch_name = COALESCE($2, branch_name),
             settings = $3::jsonb
         WHERE id = $4`,
        [companyName || null, branchName !== undefined ? branchName : null, JSON.stringify(settings), id]
      );

      const label = entityLabel(subscription_plan);
      res.json({ message: `${label.charAt(0).toUpperCase() + label.slice(1)} updated.` });
    } catch (error) {
      console.error('Update entity error:', error);
      res.status(500).json({ error: 'Failed to update.' });
    }
  };

  exports.remove = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;

    try {
      const [tenant] = await db.query(
        `SELECT organization_id, subscription_plan FROM hris_saas.tenants WHERE id = $1`, [tenantId]
      );
      if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

      const { organization_id: orgId, subscription_plan } = tenant[0];

      // Cannot delete self
      if (id === tenantId) return res.status(400).json({ error: `Cannot delete the current ${entityLabel(subscription_plan)}.` });

      // Verify target entity belongs to same org and is a branch
      const [target] = await db.query(
        `SELECT id FROM hris_saas.tenants WHERE id = $1 AND organization_id = $2 AND entity_type = 'branch'`,
        [id, orgId]
      );
      if (target.length === 0) return res.status(404).json({ error: `${entityLabel(subscription_plan).charAt(0).toUpperCase() + entityLabel(subscription_plan).slice(1)} not found or is the primary ${entityLabel(subscription_plan)}.` });

      await db.query(`UPDATE hris_saas.tenants SET status = 'inactive' WHERE id = $1`, [id]);

      const label = entityLabel(subscription_plan);
      res.json({ message: `${label.charAt(0).toUpperCase() + label.slice(1)} deactivated.` });
    } catch (error) {
      console.error('Delete entity error:', error);
      res.status(500).json({ error: 'Failed to delete.' });
    }
  };
