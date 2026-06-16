const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

exports.uploadFiles = async (req, res) => {
  const { entity_type, entity_id } = req.body;

  if (!entity_type || !entity_id) {
    return res.status(400).json({ error: 'entity_type and entity_id are required.' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded.' });
  }

  try {
    const attachments = [];

    for (const file of req.files) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO attachments (id, tenant_id, entity_type, entity_id, stored_name, original_name, mime_type, file_size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.tenantId, entity_type, entity_id, file.filename, file.originalname, file.mimetype, file.size]
      );
      attachments.push({
        id,
        stored_name: file.filename,
        original_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
      });
    }

    res.status(201).json(attachments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save attachments.' });
  }
};

exports.getAttachments = async (req, res) => {
  const { entity_type, entity_id } = req.query;
  try {
    const [rows] = await db.query(
      'SELECT id, stored_name, original_name, mime_type, file_size, created_at FROM attachments WHERE tenant_id = ? AND entity_type = ? AND entity_id = ?',
      [req.tenantId, entity_type, entity_id]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attachments.' });
  }
};

exports.deleteAttachment = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT stored_name FROM attachments WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Attachment not found.' });
    const p = path.join(__dirname, '..', 'uploads', rows[0].stored_name);
    fs.unlink(p, () => {});
    await db.query('DELETE FROM attachments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Attachment deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete attachment.' });
  }
};
