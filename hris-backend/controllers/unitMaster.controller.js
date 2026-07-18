const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

exports.list = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM hris_saas.unit_master ORDER BY display_order ASC');
    res.json(rows);
  } catch (err) {
    console.error('Unit list error:', err);
    res.status(500).json({ error: 'Failed to fetch units.' });
  }
};

exports.listActive = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, name FROM hris_saas.unit_master WHERE is_active = true ORDER BY display_order ASC');
    res.json(rows);
  } catch (err) {
    console.error('Unit active list error:', err);
    res.status(500).json({ error: 'Failed to fetch units.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description, is_active, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const id = uuidv4();
    const order = display_order || 0;
    await db.execute(
      'INSERT INTO hris_saas.unit_master (id, name, description, is_active, display_order) VALUES (?,?,?,?,?)',
      [id, name, description || null, is_active !== false, order]
    );
    await log({ tenantId: req.tenant?.id, actorId: req.user?.id, actorName: req.user?.name, action: 'unit.created', entityType: 'unit_master', entityId: id, req });
    const [result] = await db.execute('SELECT * FROM hris_saas.unit_master WHERE id = ?', [id]);
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Unit create error:', err);
    res.status(500).json({ error: 'Failed to create unit.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_active, display_order } = req.body;

    const [existing] = await db.execute('SELECT * FROM hris_saas.unit_master WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Unit not found.' });

    await db.execute(
      'UPDATE hris_saas.unit_master SET name=?, description=?, is_active=?, display_order=?, updated_at=NOW() WHERE id=?',
      [name || existing[0].name, description !== undefined ? description : existing[0].description, is_active !== undefined ? is_active : existing[0].is_active, display_order ?? existing[0].display_order, id]
    );
    await log({ tenantId: req.tenant?.id, actorId: req.user?.id, actorName: req.user?.name, action: 'unit.updated', entityType: 'unit_master', entityId: id, req });
    const [result] = await db.execute('SELECT * FROM hris_saas.unit_master WHERE id = ?', [id]);
    res.json(result[0]);
  } catch (err) {
    console.error('Unit update error:', err);
    res.status(500).json({ error: 'Failed to update unit.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.execute('SELECT * FROM hris_saas.unit_master WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Unit not found.' });

    await db.execute('DELETE FROM hris_saas.unit_master WHERE id = ?', [id]);
    await log({ tenantId: req.tenant?.id, actorId: req.user?.id, actorName: req.user?.name, action: 'unit.deleted', entityType: 'unit_master', entityId: id, req });
    res.json({ success: true });
  } catch (err) {
    console.error('Unit delete error:', err);
    res.status(500).json({ error: 'Failed to delete unit.' });
  }
};
