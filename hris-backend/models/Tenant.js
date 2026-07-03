/**
 * Tenant model — represents a subscription tenant.
 *
 * Maps to the `tenants` table in the `hris_saas` schema.
 *
 * @property {string}   id
 * @property {string}   tenantName          — display name (maps to tenant_name)
 * @property {string}   companyName          — legacy name (maps to company_name)
 * @property {string}   subscriptionPlan     — plan id: FREE | MANAGE | BUSINESS | BUSINESS_PRO
 * @property {string}   subscriptionStatus   — active | trialing | cancelled | expired | past_due | suspended | grace_period
 * @property {string}   [startDate]          — subscription start
 * @property {string}   [expiryDate]         — subscription expiry
 * @property {string}   [branchName]
 * @property {string}   [entityType]
 * @property {string}   [organizationId]
 * @property {string}   [subdomain]
 * @property {string}   [phone]
 * @property {string}   [email]
 * @property {string}   [status]             — legacy status (active | inactive)
 * @property {object}   [settings]
 * @property {string}   [createdAt]
 * @property {string}   [updatedAt]
 */
class Tenant {
  constructor(data = {}) {
    this.id = data.id || null;
    this.tenantName = data.tenant_name || data.tenantName || null;
    this.companyName = data.company_name || data.companyName || null;
    this.subscriptionPlan = data.subscription_plan || data.subscriptionPlan || 'FREE';
    this.subscriptionStatus = data.subscription_status || data.subscriptionStatus || 'active';
    this.startDate = data.start_date || data.startDate || null;
    this.expiryDate = data.expiry_date || data.expiryDate || null;
    this.branchName = data.branch_name || data.branchName || null;
    this.entityType = data.entity_type || data.entityType || 'primary';
    this.organizationId = data.organization_id || data.organizationId || null;
    this.subdomain = data.subdomain || null;
    this.phone = data.phone || null;
    this.email = data.email || null;
    this.status = data.status || 'active';
    this.settings = data.settings || {};
    this.createdAt = data.created_at || data.createdAt || null;
    this.updatedAt = data.updated_at || data.updatedAt || null;
  }

  /** Create a Tenant from a DB row (snake_case keys). */
  static fromRow(row) {
    if (!row) return null;
    return new Tenant(row);
  }

  /** Create an array of Tenants from DB rows. */
  static fromRows(rows) {
    return (rows || []).map(Tenant.fromRow);
  }

  /** Return a plain object with snake_case keys for DB writes. */
  toDB() {
    return {
      id: this.id,
      tenant_name: this.tenantName,
      company_name: this.companyName,
      subscription_plan: this.subscriptionPlan,
      subscription_status: this.subscriptionStatus,
      start_date: this.startDate,
      expiry_date: this.expiryDate,
      branch_name: this.branchName,
      entity_type: this.entityType,
      organization_id: this.organizationId,
      subdomain: this.subdomain,
      phone: this.phone,
      email: this.email,
      status: this.status,
      settings: this.settings ? JSON.stringify(this.settings) : null,
    };
  }

  /** Human-readable label for the plan. */
  get planLabel() {
    const labels = {
      FREE: 'Free',
      MANAGE: 'Manage',
      BUSINESS: 'Business',
      BUSINESS_PRO: 'Business Pro',
    };
    return labels[this.subscriptionPlan] || this.subscriptionPlan;
  }

  /** Whether the tenant's subscription is currently active. */
  get isActive() {
    return ['active', 'trialing', 'grace_period'].includes(this.subscriptionStatus);
  }

  /** Whether the subscription has expired or is past due. */
  get isExpired() {
    return ['expired', 'past_due', 'grace_period'].includes(this.subscriptionStatus);
  }

  /** Whether the tenant is in a non-working state. */
  get isSuspended() {
    return this.subscriptionStatus === 'suspended';
  }

  /** Whether the tenant is in grace period (active but overdue). */
  get isInGracePeriod() {
    return this.subscriptionStatus === 'grace_period';
  }
}

module.exports = Tenant;
