const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { create, notifyAdmins } = require('../utils/notify');

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
        `INSERT INTO employee_advances (id, tenant_id, employee_id, amount, remaining_balance, reason, status, approved_by, approved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, NOW(), NOW())`,
        [advanceId, tenantId, employeeId, amountInCents, amountInCents, reason, req.user.id]
      );
      return res.status(201).json({ message: 'Advance granted successfully.', advanceId });
    }

    if (req.user.role === 'employee') {
      const advanceId = uuidv4();
      await db.execute(
        `INSERT INTO employee_advances (id, tenant_id, employee_id, amount, remaining_balance, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [advanceId, tenantId, req.user.id, amountInCents, amountInCents, reason]
      );
      notifyAdmins({
        tenantId,
        title: 'Advance Request',
        message: `${req.user.name} requested an advance of ${(amountInCents / 100).toFixed(2)} — ${reason || 'No reason given'}`,
        type: 'advance',
        actorId: req.user.id,
        actorName: req.user.name,
        entityType: 'advance',
        entityId: advanceId,
      });
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
    const [[advance]] = await db.execute(
      'SELECT employee_id, amount, reason FROM employee_advances WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!advance) return res.status(404).json({ error: 'Advance not found.' });

    await db.execute(
      `UPDATE employee_advances SET status = 'approved', approved_by = ?, approved_at = NOW()
       WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [req.user.id, id, tenantId]
    );

    await create({
      tenantId,
      recipientId: advance.employee_id,
      title: 'Advance Approved',
      message: `Your advance request of ${(advance.amount / 100).toFixed(2)} has been approved by ${req.user.name}`,
      type: 'advance',
      actorId: req.user.id,
      actorName: req.user.name,
      entityType: 'advance',
      entityId: id,
    });

    res.json({ message: 'Advance approved successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to approve advance.' });
  }
};

exports.updateAdvance = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { amount, reason, status } = req.body;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [[advance]] = await db.execute(
      'SELECT status, amount FROM employee_advances WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!advance) return res.status(404).json({ error: 'Advance not found.' });

    const sets = [];
    const params = [];

    if (amount !== undefined) {
      const amountInCents = Math.round(parseFloat(amount) * 100);
      if (amountInCents <= 0) return res.status(400).json({ error: 'Amount must be greater than zero.' });
      const difference = amountInCents - Number(advance.amount);
      sets.push('amount = ?', 'remaining_balance = remaining_balance + ?');
      params.push(amountInCents, difference);
    }

    if (reason !== undefined) {
      sets.push('reason = ?');
      params.push(reason || null);
    }

    if (status !== undefined) {
      const validStatuses = ['pending', 'approved', 'rejected'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be pending, approved, or rejected.' });
      }
      sets.push('status = ?');
      params.push(status);
      if (status === 'approved') {
        sets.push('approved_by = ?', 'approved_at = NOW()');
        params.push(req.user.id);
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'Nothing to update.' });
    }

    params.push(id, tenantId);
    await db.execute(
      `UPDATE employee_advances SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    res.json({ message: 'Advance updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update advance.' });
  }
};

exports.deleteAdvance = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [[advance]] = await db.execute(
      'SELECT status FROM employee_advances WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!advance) return res.status(404).json({ error: 'Advance not found.' });

    await db.execute('DELETE FROM employee_advances WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    res.json({ message: 'Advance deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete advance.' });
  }
};

exports.rejectAdvance = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [[advance]] = await db.execute(
      'SELECT employee_id, amount, reason FROM employee_advances WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!advance) return res.status(404).json({ error: 'Advance not found.' });

    await db.execute(
      `UPDATE employee_advances SET status = 'rejected', approved_by = ?, approved_at = NOW()
       WHERE id = ? AND tenant_id = ? AND status = 'pending'`,
      [req.user.id, id, tenantId]
    );

    await create({
      tenantId,
      recipientId: advance.employee_id,
      title: 'Advance Rejected',
      message: `Your advance request of ${(advance.amount / 100).toFixed(2)} has been rejected by ${req.user.name}`,
      type: 'advance',
      actorId: req.user.id,
      actorName: req.user.name,
      entityType: 'advance',
      entityId: id,
    });

    res.json({ message: 'Advance rejected.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject advance.' });
  }
};
