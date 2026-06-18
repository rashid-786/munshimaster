const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// ── Parties (Buyers / Sellers) ──

exports.createParty = async (req, res) => {
  const { type, name, phone, address, amount, direction, entryDate, note } = req.body;
  if (!type || !name) return res.status(400).json({ error: 'type and name are required.' });
  try {
    const id = uuidv4();
    await db.execute(
      'INSERT INTO kirana_parties (id, tenant_id, type, name, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.tenantId, type, name, phone || null, address || null]
    );

    if (amount && direction && entryDate) {
      const txId = uuidv4();
      const amountCents = Math.round(parseFloat(amount) * 100);
      const txType = direction === 'to_receive' ? 'given' : 'received';
      await db.execute(
        'INSERT INTO kirana_transactions (id, tenant_id, party_id, type, amount, note, entry_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [txId, req.tenantId, id, txType, amountCents, note || null, entryDate, req.user.id]
      );
    }

    res.status(201).json({ message: `${type} added successfully.`, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create party.' });
  }
};

exports.getParties = async (req, res) => {
  const { type, search } = req.query;
  try {
    let query = 'SELECT id, type, name, phone, address, created_at FROM kirana_parties WHERE tenant_id = ?';
    const params = [req.tenantId];
    if (type) { query += ' AND type = ?'; params.push(type); }
    if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }
    query += ' ORDER BY name ASC';
    const [rows] = await db.execute(query, params);

    const result = [];
    for (const party of rows) {
      const [txns] = await db.execute(
        "SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE 0 END), 0) as total_received, COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE 0 END), 0) as total_given FROM kirana_transactions WHERE tenant_id = ? AND party_id = ?",
        [req.tenantId, party.id]
      );
      const balance = txns[0].total_received - txns[0].total_given;
      result.push({ ...party, totalReceived: txns[0].total_received, totalGiven: txns[0].total_given, balance });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch parties.' });
  }
};

exports.getPartyDetails = async (req, res) => {
  const { id } = req.params;
  try {
    const [parties] = await db.execute('SELECT * FROM kirana_parties WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    if (parties.length === 0) return res.status(404).json({ error: 'Party not found.' });
    const party = parties[0];

    const [txns] = await db.execute(
      `SELECT kt.*, e.first_name, e.last_name FROM kirana_transactions kt LEFT JOIN employees e ON kt.created_by = e.id WHERE kt.party_id = ? AND kt.tenant_id = ? ORDER BY kt.entry_date DESC, kt.created_at DESC`,
      [id, req.tenantId]
    );

    const totalReceived = txns.filter(t => t.type === 'received').reduce((s, t) => s + t.amount, 0);
    const totalGiven = txns.filter(t => t.type === 'given').reduce((s, t) => s + t.amount, 0);
    const balance = totalReceived - totalGiven;

    res.json({ party, transactions: txns, totalReceived, totalGiven, balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch party details.' });
  }
};

exports.updateParty = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address } = req.body;
  try {
    await db.execute('UPDATE kirana_parties SET name = ?, phone = ?, address = ? WHERE id = ? AND tenant_id = ?',
      [name, phone || null, address || null, id, req.tenantId]);
    res.json({ message: 'Updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update.' });
  }
};

exports.deleteParty = async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM kirana_transactions WHERE party_id = ? AND tenant_id = ?', [id, req.tenantId]);
    await db.execute('DELETE FROM kirana_parties WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    res.json({ message: 'Deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete.' });
  }
};

// ── Transactions ──

exports.createTransaction = async (req, res) => {
  const { partyId, type, amount, note, entryDate } = req.body;
  if (!partyId || !type || !amount || !entryDate) return res.status(400).json({ error: 'partyId, type, amount, entryDate required.' });
  try {
    const id = uuidv4();
    const amountCents = Math.round(parseFloat(amount) * 100);
    await db.execute(
      'INSERT INTO kirana_transactions (id, tenant_id, party_id, type, amount, note, entry_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.tenantId, partyId, type, amountCents, note || null, entryDate, req.user.id]
    );
    res.status(201).json({ message: 'Transaction added.', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add transaction.' });
  }
};

exports.deleteTransaction = async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM kirana_transactions WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete.' });
  }
};

// ── Summary ──

exports.getSummary = async (req, res) => {
  const { type } = req.query;
  try {
    let partyQuery = 'SELECT id FROM kirana_parties WHERE tenant_id = ?';
    const params = [req.tenantId];
    if (type) { partyQuery += ' AND type = ?'; params.push(type); }
    const [parties] = await db.execute(partyQuery, params);

    let youWillGet = 0, youWillGive = 0;
    for (const p of parties) {
      const [txns] = await db.execute(
        "SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE 0 END), 0) as r, COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE 0 END), 0) as g FROM kirana_transactions WHERE party_id = ?",
        [p.id]
      );
      const balance = txns[0].r - txns[0].g;
      if (balance > 0) youWillGive += balance;
      else youWillGet += Math.abs(balance);
    }

    res.json({ youWillGet, youWillGive, net: youWillGet - youWillGive });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get summary.' });
  }
};

// ── Staff ──

exports.createStaff = async (req, res) => {
  const { name, phone, role, salary, joinedAt } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  try {
    const id = uuidv4();
    const salaryCents = salary ? Math.round(parseFloat(salary) * 100) : null;
    await db.execute(
      'INSERT INTO kirana_staff (id, tenant_id, name, phone, role, salary, joined_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.tenantId, name, phone || null, role || null, salaryCents, joinedAt || null]
    );
    res.status(201).json({ message: 'Staff added.', id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add staff.' });
  }
};

exports.getStaff = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM kirana_staff WHERE tenant_id = ? ORDER BY name ASC', [req.tenantId]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch staff.' });
  }
};

exports.updateStaff = async (req, res) => {
  const { id } = req.params;
  const { name, phone, role, salary, joinedAt } = req.body;
  try {
    const salaryCents = salary ? Math.round(parseFloat(salary) * 100) : null;
    await db.execute(
      'UPDATE kirana_staff SET name=?, phone=?, role=?, salary=?, joined_at=? WHERE id=? AND tenant_id=?',
      [name, phone || null, role || null, salaryCents, joinedAt || null, id, req.tenantId]
    );
    res.json({ message: 'Updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update.' });
  }
};

exports.deleteStaff = async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM kirana_staff WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    res.json({ message: 'Deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete.' });
  }
};

// ── Cashbook ──

exports.createCashEntry = async (req, res) => {
  const { type, category, amount, note, entryDate } = req.body;
  if (!type || !amount || !entryDate) return res.status(400).json({ error: 'type, amount, entryDate required.' });
  try {
    const id = uuidv4();
    const amountCents = Math.round(parseFloat(amount) * 100);
    await db.execute(
      'INSERT INTO kirana_cashbook (id, tenant_id, type, category, amount, note, entry_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.tenantId, type, category || null, amountCents, note || null, entryDate, req.user.id]
    );
    res.status(201).json({ message: 'Entry added.', id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add entry.' });
  }
};

exports.getCashbook = async (req, res) => {
  const { startDate, endDate } = req.query;
  try {
    let query = 'SELECT kc.*, e.first_name, e.last_name FROM kirana_cashbook kc LEFT JOIN employees e ON kc.created_by = e.id WHERE kc.tenant_id = ?';
    const params = [req.tenantId];
    if (startDate) { query += ' AND kc.entry_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND kc.entry_date <= ?'; params.push(endDate); }
    query += ' ORDER BY kc.entry_date DESC, kc.created_at DESC';
    const [rows] = await db.execute(query, params);

    const summary = rows.reduce((acc, r) => {
      if (r.type === 'IN') acc.totalIn += r.amount;
      else acc.totalOut += r.amount;
      return acc;
    }, { totalIn: 0, totalOut: 0 });
    summary.balance = summary.totalIn - summary.totalOut;

    res.json({ entries: rows, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cashbook.' });
  }
};

exports.updateCashEntry = async (req, res) => {
  const { id } = req.params;
  const { type, category, amount, note, entryDate } = req.body;
  try {
    const updates = []; const params = [];
    if (type) { updates.push('type = ?'); params.push(type); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (amount) { updates.push('amount = ?'); params.push(Math.round(parseFloat(amount) * 100)); }
    if (note !== undefined) { updates.push('note = ?'); params.push(note); }
    if (entryDate) { updates.push('entry_date = ?'); params.push(entryDate); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });
    params.push(id, req.tenantId);
    await db.execute(`UPDATE kirana_cashbook SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
    res.json({ message: 'Updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update.' });
  }
};

exports.deleteCashEntry = async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute('DELETE FROM kirana_cashbook WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    res.json({ message: 'Deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete.' });
  }
};

// ── Reports ──

exports.getReport = async (req, res) => {
  const { type, startDate, endDate } = req.query;
  try {
    if (type === 'parties') {
      const [parties] = await db.execute('SELECT * FROM kirana_parties WHERE tenant_id = ? ORDER BY name', [req.tenantId]);
      const result = [];
      for (const p of parties) {
        const [txns] = await db.execute(
          "SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE 0 END),0) as r, COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE 0 END),0) as g FROM kirana_transactions WHERE party_id=?",
          [p.id]
        );
        result.push({ ...p, totalReceived: txns[0].r, totalGiven: txns[0].g, balance: txns[0].r - txns[0].g });
      }
      return res.json(result);
    }

    if (type === 'cashbook') {
      let query = 'SELECT * FROM kirana_cashbook WHERE tenant_id = ?';
      const params = [req.tenantId];
      if (startDate) { query += ' AND entry_date >= ?'; params.push(startDate); }
      if (endDate) { query += ' AND entry_date <= ?'; params.push(endDate); }
      query += ' ORDER BY entry_date DESC';
      const [rows] = await db.execute(query, params);
      return res.json(rows);
    }

    res.status(400).json({ error: 'Invalid report type.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
};
