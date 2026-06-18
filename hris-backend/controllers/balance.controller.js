const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.createEntry = async (req, res) => {
  const tenantId = req.tenantId;
  const { type, paymentMethod, amount, description, entryDate } = req.body;

  if (!type || !paymentMethod || !amount || !entryDate) {
    return res.status(400).json({ error: 'type, paymentMethod, amount, and entryDate are required.' });
  }

  try {
    const amountInCents = Math.round(parseFloat(amount) * 100);
    if (amountInCents <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero.' });
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO balance_sheet (id, tenant_id, type, payment_method, amount, description, entry_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, type, paymentMethod, amountInCents, description || null, entryDate, req.user.id]
    );

    res.status(201).json({ message: 'Entry added successfully.', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create balance entry.' });
  }
};

exports.getEntries = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;

  try {
    let query = `SELECT bs.*, e.first_name, e.last_name
                 FROM balance_sheet bs
                 LEFT JOIN employees e ON bs.created_by = e.id
                 WHERE bs.tenant_id = ?`;
    const params = [tenantId];

    if (startDate) {
      query += ' AND bs.entry_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND bs.entry_date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY bs.entry_date DESC, bs.created_at DESC';

    const [rows] = await db.execute(query, params);

    const summary = rows.reduce((acc, r) => {
      if (r.type === 'IN') acc.totalIn += r.amount;
      else acc.totalOut += r.amount;
      return acc;
    }, { totalIn: 0, totalOut: 0 });
    summary.balance = summary.totalIn - summary.totalOut;

    res.json({ entries: rows, summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch balance entries.' });
  }
};

exports.updateEntry = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { type, paymentMethod, amount, description, entryDate } = req.body;

  try {
    const updates = [];
    const params = [];

    if (type) { updates.push('type = ?'); params.push(type); }
    if (paymentMethod) { updates.push('payment_method = ?'); params.push(paymentMethod); }
    if (amount) { updates.push('amount = ?'); params.push(Math.round(parseFloat(amount) * 100)); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (entryDate) { updates.push('entry_date = ?'); params.push(entryDate); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id, tenantId);
    const [result] = await db.execute(
      `UPDATE balance_sheet SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    res.json({ message: 'Entry updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update entry.' });
  }
};

exports.deleteEntry = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  try {
    const [result] = await db.execute(
      'DELETE FROM balance_sheet WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    res.json({ message: 'Entry deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
};
