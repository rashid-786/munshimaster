const { v4: uuidv4 } = require('uuid');
const TenantUsage = require('../models/TenantUsage');

/**
 * Repository for the `tenant_usage` table.
 *
 * Tracks monthly resource consumption per tenant for
 * usage-based billing and plan enforcement.
 */
class TenantUsageRepository {
  /**
   * @param {object} db — config/db.js module
   */
  constructor(db) {
    this.db = db;
  }

  // ─── Queries ──────────────────────────────────────

  /**
   * Get usage record for a specific tenant and month.
   * @param {string} tenantId
   * @param {string} month — 'YYYY-MM-DD' (first of month)
   * @returns {Promise<TenantUsage|null>}
   */
  async findByTenantAndMonth(tenantId, month) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenant_usage WHERE tenant_id = ? AND usage_month = ?`,
      [tenantId, month]
    );
    return TenantUsage.fromRow(rows[0]);
  }

  /**
   * Get all usage records for a tenant (history).
   * @param {string} tenantId
   * @param {number} [limit=12]
   * @returns {Promise<TenantUsage[]>}
   */
  async findByTenant(tenantId, limit = 12) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenant_usage
       WHERE tenant_id = ?
       ORDER BY usage_month DESC
       LIMIT ?`,
      [tenantId, limit]
    );
    return TenantUsage.fromRows(rows);
  }

  /**
   * Get the most recent usage record for a tenant.
   * @param {string} tenantId
   * @returns {Promise<TenantUsage|null>}
   */
  async findLatest(tenantId) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.tenant_usage
       WHERE tenant_id = ?
       ORDER BY usage_month DESC
       LIMIT 1`,
      [tenantId]
    );
    return TenantUsage.fromRow(rows[0]);
  }

  /**
   * Get current month's usage (upserts on read).
   * @param {string} tenantId
   * @returns {Promise<TenantUsage>}
   */
  async findCurrent(tenantId) {
    const month = this._currentMonth();
    let usage = await this.findByTenantAndMonth(tenantId, month);
    if (!usage) {
      usage = await this._createEmpty(tenantId, month);
    }
    return usage;
  }

  /**
   * Find tenants whose usage exceeds a given limit in any dimension.
   * Used for plan enforcement and upgrade prompts.
   * @param {string} dimension — entity_count | transaction_count | cashbook_entry_count | staff_count
   * @param {number} limit
   * @param {string} [month] — defaults to current month
   * @returns {Promise<{tenantId: string, current: number, limit: number}[]>}
   */
  async findExceeding(dimension, limit, month = null) {
    const targetMonth = month || this._currentMonth();
    const [rows] = await this.db.execute(
      `SELECT tenant_id, ${dimension} as current, ? as limit
       FROM hris_saas.tenant_usage
       WHERE usage_month = ? AND ${dimension} > ?
       ORDER BY ${dimension} DESC`,
      [limit, targetMonth, limit]
    );
    return rows.map(r => ({
      tenantId: r.tenant_id,
      current: parseInt(r.current, 10),
      limit,
    }));
  }

  /**
   * Aggregate usage across all tenants for a given month.
   * @param {string} [month] — defaults to current
   * @returns {Promise<object>}
   */
  async aggregate(month = null) {
    const targetMonth = month || this._currentMonth();
    const [[row]] = await this.db.execute(
      `SELECT
         COUNT(*) as tenant_count,
         COALESCE(SUM(entity_count), 0) as total_entities,
         COALESCE(SUM(transaction_count), 0) as total_transactions,
         COALESCE(SUM(cashbook_entry_count), 0) as total_cashbook_entries,
         COALESCE(SUM(staff_count), 0) as total_staff
       FROM hris_saas.tenant_usage
       WHERE usage_month = ?`,
      [targetMonth]
    );
    return {
      month: targetMonth,
      tenantCount: parseInt(row?.tenant_count || 0, 10),
      totalEntities: parseInt(row?.total_entities || 0, 10),
      totalTransactions: parseInt(row?.total_transactions || 0, 10),
      totalCashbookEntries: parseInt(row?.total_cashbook_entries || 0, 10),
      totalStaff: parseInt(row?.total_staff || 0, 10),
    };
  }

  // ─── Mutations ─────────────────────────────────────

  /**
   * Atomically upsert usage counters for a tenant in the current month.
   *
   * Uses a single INSERT … ON CONFLICT DO UPDATE statement to avoid
   * race conditions between concurrent requests.
   *
   * @param {string} tenantId
   * @param {object} counters
   * @param {number} [counters.entities]
   * @param {number} [counters.transactions]
   * @param {number} [counters.cashbookEntries]
   * @param {number} [counters.staff]
   * @returns {Promise<TenantUsage>}
   */
  async increment(tenantId, counters = {}) {
    const month = this._currentMonth();

    await this.db.execute(
      `INSERT INTO hris_saas.tenant_usage
         (id, tenant_id, usage_month, entity_count, transaction_count,
          cashbook_entry_count, staff_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON CONFLICT (tenant_id, usage_month)
       DO UPDATE SET
         entity_count        = tenant_usage.entity_count        + EXCLUDED.entity_count,
         transaction_count   = tenant_usage.transaction_count   + EXCLUDED.transaction_count,
         cashbook_entry_count = tenant_usage.cashbook_entry_count + EXCLUDED.cashbook_entry_count,
         staff_count         = tenant_usage.staff_count         + EXCLUDED.staff_count,
         updated_at          = NOW()`,
      [
        uuidv4(), tenantId, month,
        counters.entities || 0,
        counters.transactions || 0,
        counters.cashbookEntries || 0,
        counters.staff || 0,
      ]
    );

    return this.findByTenantAndMonth(tenantId, month);
  }

  /**
   * Overwrite all counters for a tenant in the current month.
   * Useful for daily sync jobs that recompute exact counts.
   *
   * @param {string} tenantId
   * @param {object} counters
   * @returns {Promise<TenantUsage>}
   */
  async setCounters(tenantId, counters = {}) {
    const month = this._currentMonth();
    const existing = await this.findByTenantAndMonth(tenantId, month);

    if (existing) {
      await this.db.execute(
        `UPDATE hris_saas.tenant_usage
         SET entity_count = ?, transaction_count = ?,
             cashbook_entry_count = ?, staff_count = ?,
             updated_at = NOW()
         WHERE tenant_id = ? AND usage_month = ?`,
        [
          counters.entities ?? existing.entityCount,
          counters.transactions ?? existing.transactionCount,
          counters.cashbookEntries ?? existing.cashbookEntryCount,
          counters.staff ?? existing.staffCount,
          tenantId, month,
        ]
      );
    } else {
      await this.db.execute(
        `INSERT INTO hris_saas.tenant_usage
           (id, tenant_id, usage_month, entity_count, transaction_count,
            cashbook_entry_count, staff_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          uuidv4(), tenantId, month,
          counters.entities || 0,
          counters.transactions || 0,
          counters.cashbookEntries || 0,
          counters.staff || 0,
        ]
      );
    }

    return this.findByTenantAndMonth(tenantId, month);
  }

  /**
   * Delete usage records older than a given date.
   * @param {string} beforeDate — 'YYYY-MM-DD'
   * @returns {Promise<number>} number of deleted rows
   */
  async purgeOlderThan(beforeDate) {
    const [result] = await this.db.execute(
      `DELETE FROM hris_saas.tenant_usage WHERE usage_month < ?`,
      [beforeDate]
    );
    return result.rowCount || 0;
  }

  // ─── Private ───────────────────────────────────────

  /** @returns {string} first day of current month as 'YYYY-MM-DD' */
  _currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }

  async _createEmpty(tenantId, month) {
    await this.db.execute(
      `INSERT INTO hris_saas.tenant_usage
         (id, tenant_id, usage_month, entity_count, transaction_count,
          cashbook_entry_count, staff_count, created_at)
       VALUES (?, ?, ?, 0, 0, 0, 0, NOW())`,
      [uuidv4(), tenantId, month]
    );
    return this.findByTenantAndMonth(tenantId, month);
  }
}

module.exports = TenantUsageRepository;
