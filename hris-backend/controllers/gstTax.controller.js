const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

exports.list = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM hris_saas.gst_tax_rates ORDER BY display_order ASC');
    res.json(rows);
  } catch (err) {
    console.error('GST list error:', err);
    res.status(500).json({ error: 'Failed to fetch GST tax rates.' });
  }
};

exports.listActive = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, name, gst_percentage, cess_percentage FROM hris_saas.gst_tax_rates WHERE is_active = true ORDER BY display_order ASC');
    res.json(rows);
  } catch (err) {
    console.error('GST active list error:', err);
    res.status(500).json({ error: 'Failed to fetch GST tax rates.' });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, gst_percentage, cess_percentage, description, is_active, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required.' });

    const id = uuidv4();
    const order = display_order || 0;
    await db.execute(
      'INSERT INTO hris_saas.gst_tax_rates (id, name, gst_percentage, cess_percentage, description, is_active, display_order) VALUES (?,?,?,?,?,?,?)',
      [id, name, gst_percentage || 0, cess_percentage || 0, description || null, is_active !== false, order]
    );
    await log(req, 'created', `Created GST tax rate: ${name}`, 'gst_tax_rates', id);
    const [result] = await db.execute('SELECT * FROM hris_saas.gst_tax_rates WHERE id = ?', [id]);
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('GST create error:', err);
    res.status(500).json({ error: 'Failed to create GST tax rate.' });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gst_percentage, cess_percentage, description, is_active, display_order } = req.body;

    const [existing] = await db.execute('SELECT * FROM hris_saas.gst_tax_rates WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'GST tax rate not found.' });

    await db.execute(
      'UPDATE hris_saas.gst_tax_rates SET name=?, gst_percentage=?, cess_percentage=?, description=?, is_active=?, display_order=?, updated_at=NOW() WHERE id=?',
      [name || existing[0].name, gst_percentage ?? existing[0].gst_percentage, cess_percentage ?? existing[0].cess_percentage, description !== undefined ? description : existing[0].description, is_active !== undefined ? is_active : existing[0].is_active, display_order ?? existing[0].display_order, id]
    );
    await log(req, 'updated', `Updated GST tax rate: ${name || existing[0].name}`, 'gst_tax_rates', id);
    const [result] = await db.execute('SELECT * FROM hris_saas.gst_tax_rates WHERE id = ?', [id]);
    res.json(result[0]);
  } catch (err) {
    console.error('GST update error:', err);
    res.status(500).json({ error: 'Failed to update GST tax rate.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.execute('SELECT * FROM hris_saas.gst_tax_rates WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'GST tax rate not found.' });

    await db.execute('DELETE FROM hris_saas.gst_tax_rates WHERE id = ?', [id]);
    await log(req, 'deleted', `Deleted GST tax rate: ${existing[0].name}`, 'gst_tax_rates', id);
    res.json({ success: true });
  } catch (err) {
    console.error('GST delete error:', err);
    res.status(500).json({ error: 'Failed to delete GST tax rate.' });
  }
};
