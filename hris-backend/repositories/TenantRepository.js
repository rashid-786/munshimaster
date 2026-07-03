const { v4: uuidv4 } = require('uuid');
const Tenant = require('../models/Tenant');

/**
 * Repository for the `tenants` table.
 *
 * All methods accept an injected `db` from config/db.js
 * to keep the repository testable and framework-agnostic.
 */
class TenantRepository {
  /**
   * @param {object} db — the db module from config/db.js (must have .execute() and .query())
   */
  constructor(db) {
    this.db = db;
  }

  // ─── Queries ──────────────────────────────────────

  /**
   * Find a tenant by its primary key.
   * @param {string} id
   * @returns {Promise<Tenant|null>}
   */
  async findById(id) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants WHERE id = ?`,
      [id]
    );
    return Tenant.fromRow(rows[0]);
  }

  /**
   * Find a tenant by subdomain.
   * @param {string} subdomain
   * @returns {Promise<Tenant|null>}
   */
  async findBySubdomain(subdomain) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants WHERE subdomain = ?`,
      [subdomain]
    );
    return Tenant.fromRow(rows[0]);
  }

  /**
   * Find a tenant by phone number (used for phone-based login).
   * @param {string} phone
   * @returns {Promise<Tenant|null>}
   */
  async findByPhone(phone) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants WHERE phone = ?`,
      [phone]
    );
    return Tenant.fromRow(rows[0]);
  }

  /**
   * List all tenants in an organization (branch entities).
   * @param {string} organizationId
   * @returns {Promise<Tenant[]>}
   */
  async findByOrganization(organizationId) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants WHERE organization_id = ? ORDER BY entity_type DESC`,
      [organizationId]
    );
    return Tenant.fromRows(rows);
  }

  /**
   * Find all tenants with a given subscription status.
   * @param {string} status — active | trialing | cancelled | expired | past_due | suspended | grace_period
   * @returns {Promise<Tenant[]>}
   */
  async findBySubscriptionStatus(status) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants WHERE subscription_status = ? ORDER BY created_at DESC`,
      [status]
    );
    return Tenant.fromRows(rows);
  }

  /**
   * Find all tenants whose subscription is expiring within `withinDays`.
   * @param {number} withinDays
   * @returns {Promise<Tenant[]>}
   */
  async findExpiring(withinDays = 7) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants
       WHERE subscription_status = 'active'
         AND expiry_date IS NOT NULL
         AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL ? DAY
       ORDER BY expiry_date`,
      [withinDays]
    );
    return Tenant.fromRows(rows);
  }

  /**
   * Find all expired tenants.
   * @returns {Promise<Tenant[]>}
   */
  async findExpired() {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants
       WHERE subscription_status IN ('active','trialing')
         AND expiry_date IS NOT NULL
         AND expiry_date < NOW()
       ORDER BY expiry_date`
    );
    return Tenant.fromRows(rows);
  }

  /**
   * List all tenants (paginated).
   * @param {object} opts
   * @param {number} [opts.page=1]
   * @param {number} [opts.limit=50]
   * @returns {Promise<{rows: Tenant[], total: number}>}
   */
  async findAll({ page = 1, limit = 50 } = {}) {
    const offset = (page - 1) * limit;
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenants ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const [[{ count }]] = await this.db.execute(
      `SELECT COUNT(*) as count FROM hris_saas.tenants`
    );
    return { rows: Tenant.fromRows(rows), total: parseInt(count, 10) };
  }

  /**
   * Return total tenant count.
   * @returns {Promise<number>}
   */
  async count() {
    const [[{ count }]] = await this.db.execute(
      `SELECT COUNT(*) as count FROM hris_saas.tenants`
    );
    return parseInt(count, 10);
  }

  /**
   * Count tenants by subscription plan.
   * @returns {Promise<object>}  e.g. { FREE: 5, BUSINESS: 12, BUSINESS_PRO: 3 }
   */
  async countByPlan() {
    const [rows] = await this.db.execute(
      `SELECT subscription_plan, COUNT(*) as count
       FROM hris_saas.tenants
       GROUP BY subscription_plan
       ORDER BY count DESC`
    );
    const result = {};
    for (const row of rows) {
      result[row.subscription_plan] = parseInt(row.count, 10);
    }
    return result;
  }

  // ─── Mutations ─────────────────────────────────────

  /**
   * Create a new tenant.
   * @param {Tenant} tenant
   * @returns {Promise<Tenant>}
   */
  async create(tenant) {
    const id = tenant.id || uuidv4();
    const data = { ...tenant.toDB(), id };

    await this.db.execute(
      `INSERT INTO hris_saas.tenants
         (id, tenant_name, company_name, subscription_plan, subscription_status,
          start_date, expiry_date, branch_name, entity_type, organization_id,
          subdomain, phone, email, status, settings, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        data.id, data.tenant_name, data.company_name,
        data.subscription_plan, data.subscription_status,
        data.start_date, data.expiry_date,
        data.branch_name, data.entity_type, data.organization_id,
        data.subdomain, data.phone, data.email,
        data.status, data.settings,
      ]
    );
    return this.findById(id);
  }

  /**
   * Update subscription plan and status.
   * @param {string} id
   * @param {object} changes
   * @param {string} [changes.subscriptionPlan]
   * @param {string} [changes.subscriptionStatus]
   * @param {string} [changes.expiryDate]
   * @returns {Promise<Tenant>}
   */
  async updateSubscription(id, changes = {}) {
    const sets = [];
    const params = [];

    if (changes.subscriptionPlan !== undefined) {
      sets.push('subscription_plan = ?');
      params.push(changes.subscriptionPlan);
    }
    if (changes.subscriptionStatus !== undefined) {
      sets.push('subscription_status = ?');
      params.push(changes.subscriptionStatus);
    }
    if (changes.startDate !== undefined) {
      sets.push('start_date = ?');
      params.push(changes.startDate);
    }
    if (changes.expiryDate !== undefined) {
      sets.push('expiry_date = ?');
      params.push(changes.expiryDate);
    }

    if (sets.length === 0) return this.findById(id);

    sets.push('updated_at = NOW()');
    params.push(id);

    await this.db.execute(
      `UPDATE hris_saas.tenants SET ${sets.join(', ')} WHERE id = ?`,
      params
    );
    return this.findById(id);
  }

  /**
   * Upgrade a tenant to a new plan and log the event.
   * @param {object} db — db instance (for transaction)
   * @param {string} tenantId
   * @param {string} newPlan
   * @param {string} [expiryDate]
   * @param {string} [eventType='upgrade']
   * @returns {Promise<Tenant>}
   */
  async upgrade(db, tenantId, newPlan, expiryDate = null, eventType = 'upgrade') {
    const tenant = await this.findById(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const oldPlan = tenant.subscriptionPlan;

    await db.execute(
      `UPDATE hris_saas.tenants
       SET subscription_plan = ?, subscription_status = 'active',
           start_date = COALESCE(start_date, NOW()),
           expiry_date = ?, updated_at = NOW()
       WHERE id = ?`,
      [newPlan, expiryDate, tenantId]
    );

    await db.execute(
      `INSERT INTO hris_saas.subscription_events (id, tenant_id, old_plan, new_plan, event_type, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [uuidv4(), tenantId, oldPlan, newPlan, eventType]
    );

    return this.findById(tenantId);
  }

  /**
   * Downgrade a tenant to FREE and log the event.
   * @param {object} db — db instance (for transaction)
   * @param {string} tenantId
   * @param {string} [reason='downgrade']
   * @returns {Promise<Tenant>}
   */
  async downgradeToFree(db, tenantId, reason = 'downgrade') {
    return this.upgrade(db, tenantId, 'FREE', null, reason);
  }

  /**
   * Soft-delete a tenant (set status to inactive).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deactivate(id) {
    await this.db.execute(
      `UPDATE hris_saas.tenants SET status = 'inactive', subscription_status = 'expired', updated_at = NOW() WHERE id = ?`,
      [id]
    );
  }

  /**
   * Permanently delete a tenant and all cascade data.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    await this.db.execute(`DELETE FROM hris_saas.tenants WHERE id = ?`, [id]);
  }
}

module.exports = TenantRepository;
