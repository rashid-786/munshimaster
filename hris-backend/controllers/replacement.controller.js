const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

exports.getReplacements = async (req, res) => {
  const tenantId = req.tenantId;
  const { permanentId, adhocId, status, startDate, endDate } = req.query;

  try {
    let query = `
      SELECT sr.*,
             pe.first_name AS permanent_first_name, pe.last_name AS permanent_last_name,
             ae.first_name AS adhoc_first_name, ae.last_name AS adhoc_last_name,
             l.leave_type, l.status AS leave_status
      FROM staff_replacements sr
      JOIN employees pe ON sr.permanent_employee_id = pe.id
      JOIN employees ae ON sr.adhoc_employee_id = ae.id
      LEFT JOIN leaves l ON sr.leave_id = l.id
      WHERE sr.tenant_id = ?
    `;
    const params = [tenantId];

    if (permanentId) { query += ' AND sr.permanent_employee_id = ?'; params.push(permanentId); }
    if (adhocId) { query += ' AND sr.adhoc_employee_id = ?'; params.push(adhocId); }
    if (status) { query += ' AND sr.status = ?'; params.push(status); }
    if (startDate) { query += ' AND sr.end_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND sr.start_date <= ?'; params.push(endDate); }

    query += ' ORDER BY sr.created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch replacements.' });
  }
};

exports.createReplacement = async (req, res) => {
  const tenantId = req.tenantId;
  const { permanentEmployeeId, adhocEmployeeId, leaveId, startDate, endDate } = req.body;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  if (!permanentEmployeeId || !adhocEmployeeId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Permanent employee, adhoc employee, start date, and end date are required.' });
  }

  try {
    const [perm] = await db.execute(
      "SELECT id, job_type FROM employees WHERE id = ? AND tenant_id = ? AND job_type = 'permanent'",
      [permanentEmployeeId, tenantId]
    );
    if (perm.length === 0) {
      return res.status(400).json({ error: 'Permanent employee not found or is not a permanent staff.' });
    }

    const [adhoc] = await db.execute(
      "SELECT id FROM employees WHERE id = ? AND tenant_id = ? AND job_type = 'adhoc' AND status = 'active'",
      [adhocEmployeeId, tenantId]
    );
    if (adhoc.length === 0) {
      return res.status(400).json({ error: 'Adhoc employee not found or is not active.' });
    }

    // Validation: prevent overlapping assignments for the same adhoc staff
    const [overlap] = await db.execute(
      `SELECT id FROM staff_replacements
       WHERE tenant_id = ? AND adhoc_employee_id = ? AND status = 'active'
       AND start_date <= ? AND end_date >= ?`,
      [tenantId, adhocEmployeeId, endDate, startDate]
    );
    if (overlap.length > 0) {
      return res.status(400).json({ error: 'This adhoc staff is already assigned to another replacement during this period.' });
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO staff_replacements (id, tenant_id, permanent_employee_id, adhoc_employee_id, leave_id, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, permanentEmployeeId, adhocEmployeeId, leaveId || null, startDate, endDate]
    );

    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'replacement.created', entityType: 'replacement', entityId: id, req });

    res.status(201).json({ message: 'Replacement created successfully.', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create replacement.' });
  }
};

exports.endReplacement = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [result] = await db.execute(
      "UPDATE staff_replacements SET status = 'completed' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Replacement not found.' });
    }
    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'replacement.ended', entityType: 'replacement', entityId: id, req });
    res.json({ message: 'Replacement ended successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to end replacement.' });
  }
};

exports.deleteReplacement = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [result] = await db.execute(
      'DELETE FROM staff_replacements WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Replacement not found.' });
    }
    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'replacement.deleted', entityType: 'replacement', entityId: id, req });
    res.json({ message: 'Replacement deleted permanently.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete replacement.' });
  }
};
