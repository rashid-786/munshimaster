const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function log({ tenantId, actorId, actorName, action, entityType, entityId, changes, req }) {
  try {
    const ip = req ? req.ip || req.connection?.remoteAddress || null : null;
    await db.execute(
      `INSERT INTO audit_logs (id, tenant_id, actor_id, actor_name, action, entity_type, entity_id, changes, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, actorId || null, actorName || null, action, entityType || null, entityId || null,
       changes ? JSON.stringify(changes) : null, ip]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

module.exports = { log };
