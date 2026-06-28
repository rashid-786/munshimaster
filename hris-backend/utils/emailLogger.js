const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function logEmail({ tenantId, entityType, entityId, recipient, subject, status, errorMessage }) {
  try {
    await db.query(
      `INSERT INTO hris_saas.email_logs (id, tenant_id, entity_type, entity_id, recipient, subject, status, error_message, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        tenantId,
        entityType,
        entityId,
        recipient,
        subject,
        status,
        errorMessage || null,
        status === 'sent' ? new Date().toISOString() : null,
      ]
    );
  } catch (err) {
    console.error('[emailLogger] Failed to log email:', err.message);
  }
}

module.exports = { logEmail };
