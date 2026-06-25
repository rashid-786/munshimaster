const db = require('../config/db');

exports.getAuditLogs = async (req, res) => {
  const tenantId = req.tenantId;
  let { action, entityType, search, startDate, endDate, page = 1, limit = 50 } = req.query;
  page = Math.max(1, parseInt(page));
  limit = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset = (page - 1) * limit;

  const conditions = ['a.tenant_id = ?'];
  const params = [tenantId];

  if (action) { conditions.push('a.action = ?'); params.push(action); }
  if (entityType) { conditions.push('a.entity_type = ?'); params.push(entityType); }
  if (search) { conditions.push('(a.actor_name LIKE ? OR a.entity_id LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (startDate) { conditions.push('a.created_at >= ?'); params.push(startDate); }
  if (endDate) { conditions.push('a.created_at <= ?'); params.push(endDate + ' 23:59:59'); }

  try {
    const [rows] = await db.execute(
      `SELECT a.* FROM audit_logs a WHERE ${conditions.join(' AND ')} ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [countResult] = await db.execute(
      `SELECT COUNT(*) as total FROM audit_logs a WHERE ${conditions.join(' AND ')}`,
      params
    );
    const total = countResult[0].total;
    res.json({ logs: rows, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
};

exports.getAuditActions = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [rows] = await db.execute(
      'SELECT DISTINCT action FROM audit_logs WHERE tenant_id = ? ORDER BY action',
      [tenantId]
    );
    res.json(rows.map(r => r.action));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit actions.' });
  }
};

exports.getAuditDetail = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM audit_logs WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Log not found.' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit log detail.' });
  }
};
