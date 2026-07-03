const { v4: uuidv4 } = require('uuid');
const SubscriptionEvent = require('../models/SubscriptionEvent');

/**
 * Repository for the `subscription_events` table.
 *
 * Provides an audit trail of all plan changes per tenant
 * for analytics, billing disputes, and usage insights.
 */
class SubscriptionEventRepository {
  /**
   * @param {object} db — config/db.js module
   */
  constructor(db) {
    this.db = db;
  }

  // ─── Queries ──────────────────────────────────────

  /**
   * Get event by primary key.
   * @param {string} id
   * @returns {Promise<SubscriptionEvent|null>}
   */
  async findById(id) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.subscription_events WHERE id = ?`,
      [id]
    );
    return SubscriptionEvent.fromRow(rows[0]);
  }

  /**
   * Get all events for a tenant, most recent first.
   * @param {string} tenantId
   * @param {number} [limit=50]
   * @returns {Promise<SubscriptionEvent[]>}
   */
  async findByTenant(tenantId, limit = 50) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.subscription_events
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [tenantId, limit]
    );
    return SubscriptionEvent.fromRows(rows);
  }

  /**
   * Get the latest event for a tenant.
   * @param {string} tenantId
   * @returns {Promise<SubscriptionEvent|null>}
   */
  async findLatest(tenantId) {
    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.subscription_events
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenantId]
    );
    return SubscriptionEvent.fromRow(rows[0]);
  }

  /**
   * Get events of a specific type within a date range.
   * @param {string} eventType — upgrade | downgrade | renewal | ...
   * @param {object} [opts]
   * @param {string} [opts.from]
   * @param {string} [opts.to]
   * @param {number} [opts.limit=100]
   * @returns {Promise<SubscriptionEvent[]>}
   */
  async findByType(eventType, opts = {}) {
    const conditions = ['event_type = ?'];
    const params = [eventType];
    const { from, to, limit = 100 } = opts;

    if (from) { conditions.push('created_at >= ?'); params.push(from); }
    if (to) { conditions.push('created_at <= ?'); params.push(to); }

    const [rows] = await this.db.execute(
      `SELECT * FROM hris_saas.subscription_events
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT ?`,
      [...params, limit]
    );
    return SubscriptionEvent.fromRows(rows);
  }

  /**
   * Aggregate event counts by type for a date range.
   * @param {string} [from]
   * @param {string} [to]
   * @returns {Promise<object>}  e.g. { upgrade: 12, downgrade: 3, ... }
   */
  async countByType(from = null, to = null) {
    const conditions = [];
    const params = [];
    if (from) { conditions.push('created_at >= ?'); params.push(from); }
    if (to) { conditions.push('created_at <= ?'); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.db.execute(
      `SELECT event_type, COUNT(*) as count
       FROM hris_saas.subscription_events
       ${where}
       GROUP BY event_type
       ORDER BY count DESC`
    );
    const result = {};
    for (const row of rows) {
      result[row.event_type] = parseInt(row.count, 10);
    }
    return result;
  }

  /**
   * Count plan changes (upgrade/downgrade) per day for charting.
   * @param {string} [from]
   * @param {string} [to]
   * @returns {Promise<{date: string, upgrades: number, downgrades: number}[]>}
   */
  async dailyTrend(from = null, to = null) {
    const conditions = [];
    const params = [];
    if (from) { conditions.push('created_at >= ?'); params.push(from); }
    if (to) { conditions.push('created_at <= ?'); params.push(to); }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.db.execute(
      `SELECT
         DATE(created_at) as date,
         COUNT(*) FILTER (WHERE event_type = 'upgrade') as upgrades,
         COUNT(*) FILTER (WHERE event_type = 'downgrade') as downgrades
       FROM hris_saas.subscription_events
       ${where}
       GROUP BY DATE(created_at)
       ORDER BY date`
    );
    return rows.map(r => ({
      date: r.date,
      upgrades: parseInt(r.upgrades, 10),
      downgrades: parseInt(r.downgrades, 10),
    }));
  }

  // ─── Mutations ─────────────────────────────────────

  /**
   * Log a subscription event.
   * @param {object} data
   * @param {string} data.tenantId
   * @param {string} data.oldPlan
   * @param {string} data.newPlan
   * @param {string} data.eventType
   * @returns {Promise<SubscriptionEvent>}
   */
  async log(data) {
    const id = uuidv4();
    await this.db.execute(
      `INSERT INTO hris_saas.subscription_events
         (id, tenant_id, old_plan, new_plan, event_type, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [id, data.tenantId, data.oldPlan, data.newPlan, data.eventType]
    );
    return this.findById(id);
  }

  /**
   * Convenience: log an upgrade event.
   * @param {string} tenantId
   * @param {string} fromPlan
   * @param {string} toPlan
   * @returns {Promise<SubscriptionEvent>}
   */
  async logUpgrade(tenantId, fromPlan, toPlan) {
    return this.log({ tenantId, oldPlan: fromPlan, newPlan: toPlan, eventType: 'upgrade' });
  }

  /**
   * Convenience: log a downgrade event.
   * @param {string} tenantId
   * @param {string} fromPlan
   * @param {string} toPlan
   * @returns {Promise<SubscriptionEvent>}
   */
  async logDowngrade(tenantId, fromPlan, toPlan) {
    return this.log({ tenantId, oldPlan: fromPlan, newPlan: toPlan, eventType: 'downgrade' });
  }

  /**
   * Convenience: log a cancellation event.
   * @param {string} tenantId
   * @param {string} currentPlan
   * @returns {Promise<SubscriptionEvent>}
   */
  async logCancellation(tenantId, currentPlan) {
    return this.log({ tenantId, oldPlan: currentPlan, newPlan: currentPlan, eventType: 'cancellation' });
  }

  /**
   * Delete events older than a given date (data retention).
   * @param {string} beforeDate — 'YYYY-MM-DD'
   * @returns {Promise<number>} deleted row count
   */
  async purgeOlderThan(beforeDate) {
    const [result] = await this.db.execute(
      `DELETE FROM hris_saas.subscription_events WHERE created_at < ?`,
      [beforeDate]
    );
    return result.rowCount || 0;
  }
}

module.exports = SubscriptionEventRepository;
