const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/**
 * Tenant account deletion requests.
 *
 * A tenant requests deletion from the app. A Super Admin reviews the request
 * and either approves it (which permanently deletes the tenant and all of its
 * data) or rejects it, in line with the Account Deletion Policy.
 */

const STATUS_PENDING = 'pending';
const STATUS_APPROVED = 'approved';
const STATUS_REJECTED = 'rejected';
const STATUS_CANCELLED = 'cancelled';

// Tables referencing tenant_id that must be purged before the tenant row.
// Kept in dependency order (leaf tables first). Some tables are not listed
// because they carry ON DELETE CASCADE foreign keys.
const DELETE_ORDER = [
  'hris_saas.referral_redemptions', // referrer_id / referred_id
  'hris_saas.referral_codes',
  'hris_saas.campaign_redemptions',
  'hris_saas.conversion_events',
  'hris_saas.subscription_events',
  'hris_saas.tenant_section_visibility',
  'hris_saas.tenant_feature_overrides',
  'hris_saas.tenant_custom_plans',
  'hris_saas.tenant_branding',
  'hris_saas.tenant_usage',
  'hris_saas.payments',
  'hris_saas.subscriptions',
  'hris_saas.email_logs',
  'hris_saas.attachments',
  'hris_saas.invoices',
  'hris_saas.purchase_orders',
  'hris_saas.suppliers',
  'hris_saas.customers',
  'hris_saas.staff_replacements',
  'hris_saas.payroll',
  'hris_saas.leaves',
  'hris_saas.attendance',
  'hris_saas.employees',
];

/**
 * Permanently delete a tenant and all associated data (same behaviour as the
 * existing super admin "Delete Tenant" action).
 */
async function deleteTenantFull(tenantId) {
  await db.query('START TRANSACTION');
  try {
    for (const table of DELETE_ORDER) {
      if (table.includes('referral_redemptions')) {
        await db.execute(`DELETE FROM ${table} WHERE referrer_id = ? OR referred_id = ?`, [tenantId, tenantId]);
      } else {
        await db.execute(`DELETE FROM ${table} WHERE tenant_id = ?`, [tenantId]);
      }
    }
    await db.execute('DELETE FROM hris_saas.tenants WHERE id = ?', [tenantId]);
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

// ─── Tenant-facing ────────────────────────────────────────────

async function requestDeletion({ tenantId, userId, reason }) {
  const [existing] = await db.execute(
    `SELECT id FROM hris_saas.tenant_deletion_requests
      WHERE tenant_id = ? AND status = 'pending'`,
    [tenantId]
  );
  if (existing.length > 0) {
    const err = new Error('A deletion request is already pending for this account.');
    err.code = 'DELETION_REQUEST_PENDING';
    throw err;
  }

  const id = uuidv4();
  await db.execute(
    `INSERT INTO hris_saas.tenant_deletion_requests (id, tenant_id, user_id, reason, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [id, tenantId, userId, reason || null]
  );

  return { requestId: id, status: STATUS_PENDING };
}

async function getRequestForTenant(tenantId) {
  const [rows] = await db.execute(
    `SELECT * FROM hris_saas.tenant_deletion_requests
      WHERE tenant_id = ?
      ORDER BY requested_at DESC
      LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
}

async function cancelRequest(tenantId, userId) {
  const [rows] = await db.execute(
    `SELECT id FROM hris_saas.tenant_deletion_requests
      WHERE tenant_id = ? AND status = 'pending'
      ORDER BY requested_at DESC
      LIMIT 1`,
    [tenantId]
  );
  if (rows.length === 0) {
    const err = new Error('No pending deletion request to cancel.');
    err.code = 'NO_PENDING_REQUEST';
    throw err;
  }

  await db.execute(
    `UPDATE hris_saas.tenant_deletion_requests SET status = 'cancelled' WHERE id = ?`,
    [rows[0].id]
  );

  return { cancelled: true };
}

// ─── Super admin-facing ───────────────────────────────────────

async function listRequests({ status, limit = 100 } = {}) {
  const params = [];
  let where = '';
  if (status && status !== 'all') {
    params.push(status);
    where = 'WHERE r.status = ?';
  }
  params.push(limit);

  const [rows] = await db.execute(
    `SELECT r.*, t.company_name, t.phone, e.first_name, e.last_name, e.email AS user_email
       FROM hris_saas.tenant_deletion_requests r
       LEFT JOIN hris_saas.tenants t ON t.id = r.tenant_id
       LEFT JOIN hris_saas.employees e ON e.id = r.user_id
       ${where}
      ORDER BY
        CASE r.status WHEN 'pending' THEN 0 ELSE 1 END,
        r.requested_at DESC
      LIMIT ?`,
    params
  );
  return { requests: rows };
}

async function getRequest(id) {
  const [rows] = await db.execute(
    `SELECT r.*, t.company_name, t.phone, t.subscription_plan, t.subscription_status,
            e.first_name, e.last_name, e.email AS user_email
       FROM hris_saas.tenant_deletion_requests r
       LEFT JOIN hris_saas.tenants t ON t.id = r.tenant_id
       LEFT JOIN hris_saas.employees e ON e.id = r.user_id
      WHERE r.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function approveRequest(id, adminId, reviewNote) {
  const request = await getRequest(id);
  if (!request) throw new Error('Deletion request not found.');
  if (request.status !== STATUS_PENDING) throw new Error(`Request is already ${request.status}.`);

  // Mark as approved first, then permanently delete the tenant.
  await db.execute(
    `UPDATE hris_saas.tenant_deletion_requests
        SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
      WHERE id = ?`,
    [adminId, reviewNote || null, id]
  );

  if (request.tenant_id) {
    await deleteTenantFull(request.tenant_id);
    await db.execute(
      `UPDATE hris_saas.tenant_deletion_requests SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );
  }

  return getRequest(id);
}

async function rejectRequest(id, adminId, reviewNote) {
  const request = await getRequest(id);
  if (!request) throw new Error('Deletion request not found.');
  if (request.status !== STATUS_PENDING) throw new Error(`Request is already ${request.status}.`);

  await db.execute(
    `UPDATE hris_saas.tenant_deletion_requests
        SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_note = ?
      WHERE id = ?`,
    [adminId, reviewNote || null, id]
  );

  return getRequest(id);
}

module.exports = {
  requestDeletion,
  getRequestForTenant,
  cancelRequest,
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  deleteTenantFull,
  STATUS_PENDING,
  STATUS_APPROVED,
  STATUS_REJECTED,
  STATUS_CANCELLED,
};