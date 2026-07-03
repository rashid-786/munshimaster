/**
 * TenantUsage model — tracks monthly resource usage per tenant.
 *
 * Maps to the `tenant_usage` table in the `hris_saas` schema.
 *
 * @property {string}  id
 * @property {string}  tenantId
 * @property {string}  usageMonth       — first day of the month (DATE)
 * @property {number}  entityCount
 * @property {number}  transactionCount
 * @property {number}  cashbookEntryCount
 * @property {number}  staffCount
 * @property {string}  [createdAt]
 * @property {string}  [updatedAt]
 */
class TenantUsage {
  constructor(data = {}) {
    this.id = data.id || null;
    this.tenantId = data.tenant_id || data.tenantId || null;
    this.usageMonth = data.usage_month || data.usageMonth || null;
    this.entityCount = parseInt(data.entity_count ?? data.entityCount ?? 0, 10);
    this.transactionCount = parseInt(data.transaction_count ?? data.transactionCount ?? 0, 10);
    this.cashbookEntryCount = parseInt(data.cashbook_entry_count ?? data.cashbookEntryCount ?? 0, 10);
    this.staffCount = parseInt(data.staff_count ?? data.staffCount ?? 0, 10);
    this.createdAt = data.created_at || data.createdAt || null;
    this.updatedAt = data.updated_at || data.updatedAt || null;
  }

  /** Create from a DB row (snake_case keys). */
  static fromRow(row) {
    if (!row) return null;
    return new TenantUsage(row);
  }

  /** Create an array from DB rows. */
  static fromRows(rows) {
    return (rows || []).map(TenantUsage.fromRow);
  }

  /** Return a plain object with snake_case keys for DB writes. */
  toDB() {
    return {
      id: this.id,
      tenant_id: this.tenantId,
      usage_month: this.usageMonth,
      entity_count: this.entityCount,
      transaction_count: this.transactionCount,
      cashbook_entry_count: this.cashbookEntryCount,
      staff_count: this.staffCount,
    };
  }

  /** Total usage across all tracked dimensions. */
  get total() {
    return this.entityCount + this.transactionCount + this.cashbookEntryCount + this.staffCount;
  }
}

module.exports = TenantUsage;
