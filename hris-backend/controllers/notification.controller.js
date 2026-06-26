const db = require('../config/db');

exports.getNotifications = async (req, res) => {
  const tenantId = req.tenantId;
  const recipientId = req.user.id;

  try {
    const [rows] = await db.execute(
      `SELECT id, title, message, type, entity_type, entity_id, is_read, actor_name, created_at
       FROM notifications
       WHERE tenant_id = ? AND recipient_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [tenantId, recipientId]
    );

    const [[{ count }]] = await db.execute(
      `SELECT COUNT(*) as count FROM notifications WHERE tenant_id = ? AND recipient_id = ? AND is_read = 0`,
      [tenantId, recipientId]
    );

    res.json({ notifications: rows, unreadCount: parseInt(count) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
};

exports.markAsRead = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    await db.execute(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND tenant_id = ? AND recipient_id = ?`,
      [id, tenantId, req.user.id]
    );
    res.json({ message: 'Marked as read.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark notification as read.' });
  }
};

exports.markAllAsRead = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    await db.execute(
      `UPDATE notifications SET is_read = 1 WHERE tenant_id = ? AND recipient_id = ? AND is_read = 0`,
      [tenantId, req.user.id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark notifications as read.' });
  }
};
