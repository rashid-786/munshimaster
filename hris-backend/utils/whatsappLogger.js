const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function logWhatsApp({ tenantId, entityType, entityId, recipient, message, status, errorMessage }) {
  try {
    await db.query(
      `INSERT INTO hris_saas.whatsapp_logs (id, tenant_id, entity_type, entity_id, recipient, message, status, error_message, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        uuidv4(),
        tenantId,
        entityType,
        entityId || null,
        recipient,
        message,
        status,
        errorMessage || null,
        status === 'sent' ? new Date().toISOString() : null,
      ]
    );
  } catch (err) {
    console.error('[whatsappLogger] Failed to log:', err.message);
  }
}

module.exports = { logWhatsApp };
