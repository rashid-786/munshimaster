const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.createAdvance = async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, amount, reason } = req.body;

  try {
    const amountInCents = Math.round(parseFloat(amount) * 100);

    if (amountInCents <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero.' });
    }

    if (req.user.role === 'tenant_admin') {
      const advanceId = uuidv4();
      await db.execute(
        `INSERT INTO employee_advances (id, tenant_id, employee_id, amount, remaining_balance, reason, status, approved_by, approved_at)
         VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, NOW())`,
        [advanceId, tenantId, employeeId, amountInCents, amountInCents, reason, req.user.id]
      );
      return res.status(201).json({ message: 'Advance granted successfully.', advanceId });
    }

    if (req.user.role === 'employee') {
      const advanceId = uuidv4();
      await db.execute(
        `INSERT INTO employee_advances (id, tenant_id, employee_id, amount, remaining_balance, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [advanceId, tenantId, req.user.id, amountInCents, amountInCents, reason]
      );
      return res.status(201).json({ message: 'Advance request submitted for approval.', advanceId });
    }

    return res.status(403).json({ error: 'Unauthorized.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process advance request.' });
  }
};

exports.getAdvances = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    let query, params;
    if (req.user.role === 'tenant_admin') {
      query = `SELECT ea.*, e.first_name, e.last_name, e.email
               FROM employee_advances ea
               JOIN employees e ON ea.employee_id = e.id
               WHERE ea.tenant_id = ?
               ORDER BY ea.created_at DESC`;
      params = [tenantId];
    } else {
      query = `SELECT ea.*, e.first_name, e.last_name, e.email
               FROM employee_advances ea
               JOIN employees e ON ea.employee_id = e.id
               WHERE ea.tenant_id = ? AND ea.employee_id = ?
               ORDER BY ea.created_at DESC`;
      params = [tenantId, req.user.id];
    }

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch advances.' });
  }
};

exports.approveAdvance = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [result] = await db.execute(
      `UPDATE employee_advances SET status = 'approved', approved_by = ?, approved_at = NOW()
       WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [req.user.id, id, tenantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pending advance not found.' });
    }

    res.json({ message: 'Advance approved successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve advance.' });
  }
};

exports.rejectAdvance = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [result] = await db.execute(
      `UPDATE employee_advances SET status = 'rejected', approved_by = ?, approved_at = NOW()
       WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [req.user.id, id, tenantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pending advance not found.' });
    }

    res.json({ message: 'Advance rejected.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject advance.' });
  }
};
