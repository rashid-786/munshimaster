const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [tenant] = await db.query(
      `SELECT organization_id FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    if (tenant.length === 0) return res.json([]);

    const orgId = tenant[0].organization_id;
    const [entities] = await db.query(
      `SELECT id, company_name, branch_name, entity_type, subscription_plan, status, created_at
       FROM hris_saas.tenants
       WHERE organization_id = $1 AND status = 'active'
       ORDER BY entity_type DESC, created_at`, [orgId]
    );
    res.json(entities);
  } catch (error) {
    console.error('List entities error:', error);
    res.status(500).json({ error: 'Failed to list entities.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { companyName, branchName, gstin, settings } = req.body;

  if (!companyName) return res.status(400).json({ error: 'Company name is required.' });

  try {
    const [parent] = await db.query(
      `SELECT organization_id FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    if (parent.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const parentTenant = parent[0];
    const orgId = parentTenant.organization_id;
    const entityId = uuidv4();
    const entitySettings = settings || {};

    if (gstin) entitySettings.sellerGstin = gstin;

    await db.query(
      `INSERT INTO hris_saas.tenants (id, company_name, branch_name, entity_type, organization_id, settings, subdomain, subscription_plan, status, created_at)
       VALUES ($1, $2, $3, 'branch', $4, $5, $6, $7, 'active', NOW())`,
      [entityId, companyName, branchName || null, orgId, JSON.stringify(entitySettings),
       `branch_${entityId.slice(0, 8)}`, parentTenant.subscription_plan || 'free']
    );

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

    res.json({ message: 'Entity created.', id: entityId, companyName, branchName });
  } catch (error) {
    console.error('Create entity error:', error);
    res.status(500).json({ error: 'Failed to create entity.' });
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
    const [user] = await db.query(
      `SELECT id, email, first_name, last_name, role FROM hris_saas.employees
       WHERE tenant_id = $1 AND status = 'active' LIMIT 1`,
      [targetTenantId]
    );
    if (user.length === 0) return res.status(403).json({ error: 'No user found for target entity.' });

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
      res.status(500).json({ error: 'Failed to switch entity.' });
    }
  };

  exports.update = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { companyName, branchName, gstin } = req.body;

    try {
      const [tenant] = await db.query(
        `SELECT organization_id FROM hris_saas.tenants WHERE id = $1`, [tenantId]
      );
      if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

      const orgId = tenant[0].organization_id;

      // Verify target entity belongs to same org
      const [target] = await db.query(
        `SELECT id, settings FROM hris_saas.tenants WHERE id = $1 AND organization_id = $2`,
        [id, orgId]
      );
      if (target.length === 0) return res.status(404).json({ error: 'Entity not found.' });

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

      res.json({ message: 'Entity updated.' });
    } catch (error) {
      console.error('Update entity error:', error);
      res.status(500).json({ error: 'Failed to update entity.' });
    }
  };

  exports.remove = async (req, res) => {
    const tenantId = req.tenantId;
    const { id } = req.params;

    try {
      const [tenant] = await db.query(
        `SELECT organization_id FROM hris_saas.tenants WHERE id = $1`, [tenantId]
      );
      if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

      const orgId = tenant[0].organization_id;

      // Cannot delete self
      if (id === tenantId) return res.status(400).json({ error: 'Cannot delete the current entity.' });

      // Verify target entity belongs to same org and is a branch
      const [target] = await db.query(
        `SELECT id FROM hris_saas.tenants WHERE id = $1 AND organization_id = $2 AND entity_type = 'branch'`,
        [id, orgId]
      );
      if (target.length === 0) return res.status(404).json({ error: 'Entity not found or is the primary entity.' });

      await db.query(`UPDATE hris_saas.tenants SET status = 'inactive' WHERE id = $1`, [id]);

      res.json({ message: 'Entity deactivated.' });
    } catch (error) {
      console.error('Delete entity error:', error);
      res.status(500).json({ error: 'Failed to delete entity.' });
    }
  };
