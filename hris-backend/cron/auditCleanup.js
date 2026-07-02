const db = require('../config/db');
const { sendEmail } = require('../utils/email');
const { notifyAdmins } = require('../utils/notify');

const RETENTION_DAYS = 90;

async function cleanupOldAuditLogs() {
  try {
    // Find tenants that have audit logs older than 90 days
    const [tenants] = await db.query(`
      SELECT DISTINCT a.tenant_id, t.company_name
      FROM hris_saas.audit_logs a
      JOIN hris_saas.tenants t ON a.tenant_id = t.id
      WHERE a.created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'
    `);

    if (tenants.length === 0) {
      console.log(`[AuditCleanup] No tenants with logs older than ${RETENTION_DAYS} days.`);
      return;
    }

    for (const tenant of tenants) {
      const { tenant_id, company_name } = tenant;

      // Count how many logs will be deleted for this tenant
      const [countResult] = await db.query(
        `SELECT COUNT(*) as count FROM hris_saas.audit_logs
         WHERE tenant_id = $1 AND created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`,
        [tenant_id]
      );
      const logCount = parseInt(countResult[0]?.count || 0);
      if (logCount === 0) continue;

      // Send in-app notification to all tenant admins
      await notifyAdmins({
        tenantId: tenant_id,
        title: 'Audit Logs Cleanup',
        message: `${logCount} audit log${logCount !== 1 ? 's' : ''} older than ${RETENTION_DAYS} days will be automatically deleted.`,
        type: 'warning',
      });

      // Send email notification to admin
      const [admins] = await db.query(
        `SELECT e.email, e.first_name FROM hris_saas.employees e
         WHERE e.tenant_id = $1 AND e.role = 'tenant_admin' AND e.email IS NOT NULL`,
        [tenant_id]
      );

      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: `Audit Log Cleanup — ${company_name}`,
          html: `
            <!DOCTYPE html>
            <html><body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;">
              <div style="text-align:center;padding:24px 0;">
                <h1 style="color:#0B3C5D;margin:0;">bahi360</h1>
              </div>
              <p>Hi <strong>${admin.first_name || 'Admin'}</strong>,</p>
              <p>As part of routine data management, <strong>${logCount} audit log${logCount !== 1 ? 's' : ''}</strong>
              older than ${RETENTION_DAYS} days have been automatically deleted from your
              <strong>${company_name}</strong> account.</p>
              <p>Audit logs help track changes in your account. Going forward, logs older than
              ${RETENTION_DAYS} days will be removed automatically on a daily basis.</p>
              <p>If you need to retain audit logs for compliance purposes, please export them
              from the Audit Logs page before the retention period ends.</p>
              <p style="color:#6b7280;font-size:12px;margin-top:32px;">
                Bahi360 — Your Business in One Place
              </p>
            </body></html>`.trim(),
        });
      }
    }

    // Delete old audit logs across all tenants in one query
    const [deleteResult] = await db.query(
      `DELETE FROM hris_saas.audit_logs WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS} days'`
    );
    console.log(`[AuditCleanup] Deleted ${deleteResult.rowCount} audit log${deleteResult.rowCount !== 1 ? 's' : ''} older than ${RETENTION_DAYS} days.`);
  } catch (error) {
    console.error('[AuditCleanup] Error:', error.message || error);
  }
}

function startAuditCleanupCron(intervalMs = 86400000) {
  console.log(`[AuditCleanup] Started (interval: ${intervalMs}ms, retention: ${RETENTION_DAYS} days)`);
  cleanupOldAuditLogs();
  return setInterval(cleanupOldAuditLogs, intervalMs);
}

module.exports = { startAuditCleanupCron, cleanupOldAuditLogs };
