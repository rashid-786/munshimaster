const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

async function create({ tenantId, recipientId, title, message, type = 'info', actorId = null, actorName = null, entityType = null, entityId = null }) {
  try {
    await db.execute(
      `INSERT INTO notifications (id, tenant_id, recipient_id, actor_id, actor_name, title, message, type, entity_type, entity_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, recipientId, actorId, actorName, title, message, type, entityType, entityId]
    );
  } catch (err) {
    console.error('Notification create error:', err);
  }
}

async function notifyAdmins({ tenantId, title, message, type = 'info', actorId = null, actorName = null, entityType = null, entityId = null }) {
  try {
    const [admins] = await db.execute(
      `SELECT id FROM employees WHERE tenant_id = ? AND role = 'tenant_admin'`,
      [tenantId]
    );
    for (const admin of admins) {
      await create({ tenantId, recipientId: admin.id, title, message, type, actorId, actorName, entityType, entityId });
    }
  } catch (err) {
    console.error('notifyAdmins error:', err);
  }
}

module.exports = { create, notifyAdmins };
