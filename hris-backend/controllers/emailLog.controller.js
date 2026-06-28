const db = require('../config/db');

exports.getLogs = async (req, res) => {
  try {
    const { entity_type, entity_id } = req.query;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id are required.' });
    }
    const [logs] = await db.query(
      `SELECT id, recipient, subject, status, error_message, sent_at, created_at
       FROM hris_saas.email_logs
       WHERE tenant_id = ? AND entity_type = ? AND entity_id = ?
       ORDER BY created_at DESC`,
      [req.tenantId, entity_type, entity_id]
    );
    res.json(logs || []);
  } catch (error) {
    console.error('getEmailLogs error:', error);
    res.status(500).json({ error: 'Failed to fetch email logs.' });
  }
};
