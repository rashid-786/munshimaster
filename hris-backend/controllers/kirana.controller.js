const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { incrementUsage } = require('../services/usage.service');

// ── Parties (Buyers / Sellers) ──

exports.createParty = async (req, res) => {
  const { type, name, phone, address, amount, direction, note } = req.body;
  if (!type || !name) return res.status(400).json({ error: 'type and name are required.' });
  try {
    const id = uuidv4();
    const rawCents = amount ? Math.round(parseFloat(amount) * 100) : 0;
    const openingCents = direction === 'to_give' ? rawCents : -rawCents;
    await db.execute(
      'INSERT INTO kirana_parties (id, tenant_id, type, name, phone, address, notes, opening_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.tenantId, type, name, phone || null, address || null, note || null, openingCents]
    );

    res.status(201).json({ message: `${type} added successfully.`, id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create party.' });
  }
};

exports.getParties = async (req, res) => {
  const { type, search } = req.query;
  try {
    let query = 'SELECT id, type, name, phone, address, notes, opening_balance, created_at FROM kirana_parties WHERE tenant_id = ?';
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
      const ob = Number(party.opening_balance || 0);
      const tg = Number(txns[0].total_given || 0);
      const tr = Number(txns[0].total_received || 0);
      const balance = ob + tg - tr;
      result.push({ ...party, openingBalance: ob, totalGiven: tg, totalReceived: tr, balance });
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
    const ob = Number(party.opening_balance || 0);
    const balance = ob + totalGiven - totalReceived;

    res.json({ party, transactions: txns, openingBalance: ob, totalGiven, totalReceived, balance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch party details.' });
  }
};

exports.updateParty = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, note } = req.body;
  try {
    await db.execute(
      'UPDATE kirana_parties SET name = ?, phone = ?, address = ?, notes = ? WHERE id = ? AND tenant_id = ?',
      [name, phone || null, address || null, note || null, id, req.tenantId]
    );
    res.json({ message: 'Updated.' });
  } catch (error) {
    console.error(error);
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
    incrementUsage(req.tenantId, 'transactions').catch(() => {});
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

exports.getTransactions = async (req, res) => {
  const { startDate, endDate, partyId } = req.query;
  try {
    let query = `SELECT kt.*, kp.name as party_name, kp.type as party_type FROM kirana_transactions kt LEFT JOIN kirana_parties kp ON kt.party_id = kp.id WHERE kt.tenant_id = ?`;
    const params = [req.tenantId];
    if (startDate) { query += ' AND kt.entry_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND kt.entry_date <= ?'; params.push(endDate); }
    if (partyId) { query += ' AND kt.party_id = ?'; params.push(partyId); }
    query += ' ORDER BY kt.entry_date DESC, kt.created_at DESC';
    const [rows] = await db.execute(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
};

// ── Summary ──

exports.getSummary = async (req, res) => {
  const { type } = req.query;
  try {
    // Single-pass aggregate instead of one query per party (N+1).
    const aggParams = [req.tenantId];
    const outerParams = [req.tenantId];
    let typeClause = '';
    if (type) { typeClause = ' AND p.type = ?'; outerParams.push(type); }

    const [balanceRows] = await db.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN bal > 0 THEN bal ELSE 0 END), 0) as give_total,
         COALESCE(SUM(CASE WHEN bal < 0 THEN -bal ELSE 0 END), 0) as get_total
       FROM (
         SELECT p.opening_balance + COALESCE(agg.g, 0) - COALESCE(agg.r, 0) as bal
         FROM kirana_parties p
         LEFT JOIN (
           SELECT party_id,
             COALESCE(SUM(CASE WHEN type = 'given' THEN amount ELSE 0 END), 0) as g,
             COALESCE(SUM(CASE WHEN type = 'received' THEN amount ELSE 0 END), 0) as r
           FROM kirana_transactions
           WHERE tenant_id = ?
           GROUP BY party_id
         ) agg ON agg.party_id = p.id
         WHERE p.tenant_id = ?${typeClause}
       ) bal_q`,
      [...aggParams, ...outerParams]
    );

    const youWillGet = Number(balanceRows[0]?.get_total) || 0;
    const youWillGive = Number(balanceRows[0]?.give_total) || 0;

    // Counts so the app doesn't need to fetch full lists just to count rows.
    const [txnCount] = await db.execute('SELECT COUNT(*) as c FROM kirana_transactions WHERE tenant_id = ?', [req.tenantId]);
    const [cashCount] = await db.execute('SELECT COUNT(*) as c FROM kirana_cashbook WHERE tenant_id = ?', [req.tenantId]);
    const [invCount] = await db.execute('SELECT COUNT(*) as c FROM kirana_invoices WHERE tenant_id = ?', [req.tenantId]);

    res.json({
      youWillGet,
      youWillGive,
      net: youWillGet - youWillGive,
      counts: {
        partyTransactions: Number(txnCount[0]?.c) || 0,
        cashbookEntries: Number(cashCount[0]?.c) || 0,
        invoices: Number(invCount[0]?.c) || 0,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get summary.' });
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
    incrementUsage(req.tenantId, 'cashbook_entries').catch(() => {});
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

// ── Invoices ──

async function getNextInvoiceNumber(tenantId, dateStr, partyType) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const code = partyType === 'seller' ? 'PO' : 'INV';
  const prefix = `${code}-${mm}${yyyy}`;
  const [rows] = await db.execute(
    `SELECT invoice_number FROM kirana_invoices WHERE tenant_id = ? AND invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`,
    [tenantId, `${prefix}%`]
  );
  let next = 1;
  if (rows.length > 0) {
    const last = rows[0].invoice_number;
    const seqStr = last.slice(prefix.length);
    next = (parseInt(seqStr, 10) || 0) + 1;
  }
  return `${prefix}${String(next).padStart(2, '0')}`;
}

exports.getNextNumber = async (req, res) => {
  const { date, partyType } = req.query;
  if (!date) return res.status(400).json({ error: 'date query param required (YYYY-MM-DD).' });
  try {
    const invoiceNumber = await getNextInvoiceNumber(req.tenantId, date, partyType);
    res.json({ invoiceNumber });
  } catch (err) {
    console.error('Error generating next invoice number:', err);
    res.status(500).json({ error: 'Failed to generate invoice number.' });
  }
};

exports.createInvoice = async (req, res) => {
  const { partyId, partyType, partyName, invoiceDate, dueDate, items, discountAmount, taxAmount, notes, status } = req.body;
  if (!partyId || !partyType || !invoiceDate) return res.status(400).json({ error: 'partyId, partyType, invoiceDate required.' });
  try {
    const id = require('uuid').v4();
    const invDate = invoiceDate || new Date().toISOString().slice(0, 10);
    const invoiceNumber = await getNextInvoiceNumber(req.tenantId, invDate, partyType);
    const itemRows = items || [];
    let subtotal = 0;
    const mappedItems = itemRows.map((item) => {
      const qty = parseFloat(item.quantity) || 1;
      const rate = Math.round(parseFloat(item.rate) * 100);
      const amt = qty * rate;
      subtotal += amt;
      return { id: uuidv4(), name: item.name, quantity: qty, rate, amount: amt };
    });
    const discountVal = Math.round(parseFloat(discountAmount || 0) * 100);
    const taxVal = Math.round(parseFloat(taxAmount || 0) * 100);
    const totalAmount = subtotal - discountVal + taxVal;

    await db.execute(
      `INSERT INTO kirana_invoices (id, tenant_id, invoice_number, party_id, party_type, party_name, invoice_date, due_date, items, subtotal, discount_amount, tax_amount, total_amount, notes, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [id, req.tenantId, invoiceNumber, partyId, partyType, partyName || null, invDate, dueDate || null, JSON.stringify(mappedItems), Math.round(subtotal), discountVal, taxVal, Math.round(totalAmount), notes || null, status || 'draft', req.user?.id || null]
    );
    res.status(201).json({ message: 'Invoice created.', id, invoiceNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
};

exports.getInvoices = async (req, res) => {
  const { search, status, page = 1, limit = 35, startDate, endDate } = req.query;
  try {
    let query = 'SELECT * FROM kirana_invoices WHERE tenant_id = ?';
    const params = [req.tenantId];
    if (status && status !== 'all') { query += ' AND status = ?'; params.push(status); }
    if (search) { query += ' AND (invoice_number ILIKE ? OR party_name ILIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (startDate) { query += ' AND invoice_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND invoice_date <= ?'; params.push(endDate); }
    query += ' ORDER BY created_at DESC';
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ${parseInt(limit)} OFFSET ${offset}`;
    const [rows] = await db.execute(query, params);
    let countQuery = 'SELECT COUNT(*) as total FROM kirana_invoices WHERE tenant_id = ?';
    const countParams = [req.tenantId];
    if (status && status !== 'all') { countQuery += ' AND status = ?'; countParams.push(status); }
    if (startDate) { countQuery += ' AND invoice_date >= ?'; countParams.push(startDate); }
    if (endDate) { countQuery += ' AND invoice_date <= ?'; countParams.push(endDate); }
    const [countRows] = await db.execute(countQuery, countParams);
    res.json({ data: rows, total: parseInt(countRows[0].total), page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
};

exports.getInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM kirana_invoices WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    const inv = rows[0];
    inv.items = typeof inv.items === 'string' ? JSON.parse(inv.items) : (inv.items || []);
    res.json(inv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
};

exports.updateInvoice = async (req, res) => {
  const { id } = req.params;
  const { invoiceDate, dueDate, items, discountAmount, taxAmount, notes, status } = req.body;
  try {
    const [existing] = await db.execute('SELECT * FROM kirana_invoices WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const itemRows = items || existing[0].items;
    const parsedItems = typeof itemRows === 'string' ? JSON.parse(itemRows) : itemRows;
    let subtotalVal = 0;
    const mappedItems = (parsedItems || []).map((item) => {
      const qty = parseFloat(item.quantity) || 1;
      const rate = Math.round(parseFloat(item.rate) * 100);
      const amt = qty * rate;
      subtotalVal += amt;
      return { id: item.id || uuidv4(), name: item.name, quantity: qty, rate, amount: amt };
    });
    const discountVal = discountAmount !== undefined ? Math.round(parseFloat(discountAmount) * 100) : existing[0].discount_amount;
    const taxVal = taxAmount !== undefined ? Math.round(parseFloat(taxAmount) * 100) : existing[0].tax_amount;
    const totalAmt = subtotalVal - discountVal + taxVal;
    const invDate = invoiceDate || existing[0].invoice_date;

    await db.execute(
      `UPDATE kirana_invoices SET invoice_date = ?, due_date = ?, items = ?, subtotal = ?, discount_amount = ?, tax_amount = ?, total_amount = ?, notes = ?, status = COALESCE(?, status), updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [invDate, dueDate || null, JSON.stringify(mappedItems), Math.round(subtotalVal), discountVal, taxVal, Math.round(totalAmt), notes || null, status || null, id, req.tenantId]
    );
    res.json({ message: 'Invoice updated.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update invoice.' });
  }
};

exports.deleteInvoice = async (req, res) => {
  const { id } = req.params;
  try {
    const [existing] = await db.execute('SELECT status FROM kirana_invoices WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    if (existing[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be deleted.' });
    await db.execute('DELETE FROM kirana_invoices WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    res.json({ message: 'Invoice deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  try {
    const [existing] = await db.execute('SELECT status FROM kirana_invoices WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    await db.execute('UPDATE kirana_invoices SET status = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?', [status, id, req.tenantId]);
    res.json({ message: 'Status updated.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
};

// ── Reports ──

async function fetchKiranaParties(tenantId, { partyType, startDate, endDate } = {}) {
  let query = 'SELECT * FROM kirana_parties WHERE tenant_id = ?';
  const params = [tenantId];
  if (partyType) { query += ' AND type = ?'; params.push(partyType); }
  query += ' ORDER BY name';
  const [parties] = await db.execute(query, params);
  const result = [];
  for (const p of parties) {
    let txnQuery = "SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE 0 END),0) as r, COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE 0 END),0) as g FROM kirana_transactions WHERE party_id=?";
    const txnParams = [p.id];
    if (startDate) { txnQuery += ' AND entry_date >= ?'; txnParams.push(startDate); }
    if (endDate) { txnQuery += ' AND entry_date <= ?'; txnParams.push(endDate); }
    const [txns] = await db.execute(txnQuery, txnParams);
    let transactions = [];
    if (startDate || endDate) {
      let tq = 'SELECT id, type, amount, note, entry_date FROM kirana_transactions WHERE party_id = ?';
      const tp = [p.id];
      if (startDate) { tq += ' AND entry_date >= ?'; tp.push(startDate); }
      if (endDate) { tq += ' AND entry_date <= ?'; tp.push(endDate); }
      tq += ' ORDER BY entry_date DESC, created_at DESC';
      const [trows] = await db.execute(tq, tp);
      transactions = trows;
    }
    const ob = Number(p.opening_balance || 0);
    result.push({ ...p, openingBalance: ob, totalReceived: txns[0].r, totalGiven: txns[0].g, balance: ob + Number(txns[0].g) - Number(txns[0].r), transactions });
  }
  return result;
}

async function fetchKiranaCashbook(tenantId, { startDate, endDate } = {}) {
  let query = 'SELECT * FROM kirana_cashbook WHERE tenant_id = ?';
  const params = [tenantId];
  if (startDate) { query += ' AND entry_date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND entry_date <= ?'; params.push(endDate); }
  query += ' ORDER BY entry_date DESC';
  const [rows] = await db.execute(query, params);
  return rows;
}

exports.getReport = async (req, res) => {
  const { type, startDate, endDate, partyType } = req.query;
  try {
    if (type === 'parties') {
      const result = await fetchKiranaParties(req.tenantId, { partyType, startDate, endDate });
      return res.json(result);
    }
    if (type === 'cashbook') {
      const rows = await fetchKiranaCashbook(req.tenantId, { startDate, endDate });
      return res.json(rows);
    }
    res.status(400).json({ error: 'Invalid report type.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report.' });
  }
};

exports.downloadReportExcel = async (req, res) => {
  const tenantId = req.tenantId;
  const { type, startDate, endDate, partyType } = req.query;

  try {
    const [tenantRow] = await db.execute('SELECT company_name FROM tenants WHERE id = ?', [tenantId]);
    const companyName = tenantRow[0]?.company_name || 'Company';

    if (type === 'summary') {
      const ExcelJS = require('exceljs');

      const [cashbookRows, partyRows] = await Promise.all([
        fetchKiranaCashbook(tenantId, { startDate, endDate }),
        fetchKiranaParties(tenantId, { startDate, endDate }),
      ]);

      let totalIn = 0, totalOut = 0;
      for (const r of cashbookRows) {
        if (r.type === 'IN') totalIn += Number(r.amount || 0);
        else if (r.type === 'OUT') totalOut += Number(r.amount || 0);
      }

      let youWillGet = 0, youWillGive = 0, partyTxnCount = 0;
      for (const p of partyRows) {
        const ob = Number(p.opening_balance || 0);
        const bal = ob + Number(p.totalGiven || 0) - Number(p.totalReceived || 0);
        if (bal > 0) youWillGive += bal;
        else youWillGet += Math.abs(bal);
        partyTxnCount += Array.isArray(p.transactions) ? p.transactions.length : 0;
      }

      let invCount = 0;
      if (startDate || endDate) {
        let iq = 'SELECT COUNT(*) as c FROM kirana_invoices WHERE tenant_id = ?';
        const ip = [tenantId];
        if (startDate) { iq += ' AND invoice_date >= ?'; ip.push(startDate); }
        if (endDate) { iq += ' AND invoice_date <= ?'; ip.push(endDate); }
        const [irows] = await db.execute(iq, ip);
        invCount = Number(irows[0].c || 0);
      }

      const periodLabel = `${startDate || 'Earliest'} to ${endDate || 'Today'}`;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = companyName;

      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.mergeCells('A1', 'B1');
      summarySheet.getCell('A1').value = `${companyName} - Bahi Book Report`;
      summarySheet.getCell('A1').font = { size: 14, bold: true };
      summarySheet.addRow([]);
      summarySheet.addRow(['Period', periodLabel]);
      summarySheet.addRow([]);
      const summaryRows = [
        ['Total Receivable', `Rs.${(youWillGet / 100).toFixed(2)}`],
        ['Total Payable', `Rs.${(youWillGive / 100).toFixed(2)}`],
        ['Cash In', `Rs.${(totalIn / 100).toFixed(2)}`],
        ['Cash Out', `Rs.${(totalOut / 100).toFixed(2)}`],
        ['Net Cash Balance', `Rs.${((totalIn - totalOut) / 100).toFixed(2)}`],
        ['Party Transactions', String(partyTxnCount)],
        ['Cash Entries', String(cashbookRows.length)],
        ['Invoices', String(invCount)],
      ];
      summaryRows.forEach((r) => summarySheet.addRow(r));
      summarySheet.getRow(1).eachCell(cell => { cell.alignment = { horizontal: 'center' }; });
      summarySheet.columns = [
        { header: 'Metric', key: 'm', width: 22 },
        { header: 'Value', key: 'v', width: 20 },
      ];

      const cashSheet = workbook.addWorksheet('Cashbook');
      cashSheet.addRow(['Date', 'Type', 'Category', 'Amount', 'Note']);
      for (const r of cashbookRows) {
        cashSheet.addRow([
          r.entry_date ? String(r.entry_date).slice(0, 10) : '-',
          r.type || '-',
          r.category || '-',
          `Rs.${((r.amount || 0) / 100).toFixed(2)}`,
          r.note || '-',
        ]);
      }
      cashSheet.columns = [
        { header: 'Date', key: 'd', width: 14 },
        { header: 'Type', key: 't', width: 10 },
        { header: 'Category', key: 'c', width: 18 },
        { header: 'Amount', key: 'a', width: 16 },
        { header: 'Note', key: 'n', width: 30 },
      ];

      const partySheet = workbook.addWorksheet('Parties');
      partySheet.addRow(['Type', 'Name', 'Received', 'Given', 'Balance']);
      for (const p of partyRows) {
        const bal = Number(p.opening_balance || 0) + Number(p.totalGiven || 0) - Number(p.totalReceived || 0);
        partySheet.addRow([
          p.type || '-',
          p.name || '-',
          `Rs.${((p.totalReceived || 0) / 100).toFixed(2)}`,
          `Rs.${((p.totalGiven || 0) / 100).toFixed(2)}`,
          `Rs.${(bal / 100).toFixed(2)}`,
        ]);
      }
      partySheet.columns = [
        { header: 'Type', key: 't', width: 10 },
        { header: 'Name', key: 'n', width: 26 },
        { header: 'Received', key: 'r', width: 16 },
        { header: 'Given', key: 'g', width: 16 },
        { header: 'Balance', key: 'b', width: 16 },
      ];

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=bahi_book_report.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    let data, title, columns;
    if (type === 'parties') {
      data = await fetchKiranaParties(tenantId, { partyType, startDate, endDate });
      title = 'Kirana Parties Report';
      columns = ['Type', 'Name', 'Phone', 'Total Received', 'Total Given', 'Balance'];
    } else if (type === 'cashbook') {
      data = await fetchKiranaCashbook(tenantId, { startDate, endDate });
      title = 'Kirana Cashbook Report';
      columns = ['Date', 'Type', 'Category', 'Amount', 'Note'];
    } else {
      return res.status(400).json({ error: 'Invalid report type.' });
    }

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = companyName;
    const sheet = workbook.addWorksheet(title);

    sheet.mergeCells('A1', `${String.fromCharCode(64 + columns.length)}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${companyName} - ${title}`;
    titleCell.font = { size: 14, bold: true };
    titleCell.alignment = { horizontal: 'center' };
    sheet.addRow([]);

    const headerRow = sheet.addRow(columns);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      cell.alignment = { horizontal: 'center' };
    });

    for (const row of data) {
      let values;
      if (type === 'parties') {
        const bal = (row.balance || 0) / 100;
        values = [
          row.type || '-', row.name || '-', row.phone || '-',
          `Rs.${((row.totalReceived || 0) / 100).toFixed(2)}`,
          `Rs.${((row.totalGiven || 0) / 100).toFixed(2)}`,
          `Rs.${bal.toFixed(2)}`,
        ];
      } else {
        values = [
          row.entry_date ? row.entry_date.split('T')[0] : '-', row.type || '-', row.category || '-',
          row.amount ? `Rs.${(row.amount / 100).toFixed(2)}` : '0', row.note || '-',
        ];
      }
      sheet.addRow(values);
    }

    sheet.columns = columns.map((c, i) => ({
      header: c, key: c,
      width: Math.max(c.length * 2, i === 0 ? 25 : i === 1 ? 30 : 20),
    }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_report.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate Excel.' });
  }
};

exports.getCashflow = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;

    const [rows] = await db.execute(
      `SELECT TO_CHAR(entry_date, 'YYYY-MM') as month,
              COALESCE(SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END), 0) as income,
              COALESCE(SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END), 0) as expense
       FROM kirana_cashbook
       WHERE tenant_id = ? AND entry_date >= ?
       GROUP BY TO_CHAR(entry_date, 'YYYY-MM')
       ORDER BY month ASC`,
      [tenantId, startStr]
    );

    const map = {};
    for (const r of rows) {
      map[r.month] = { income: Number(r.income), expense: Number(r.expense) };
    }

    const result = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const entry = map[key] || { income: 0, expense: 0 };
      result.push({
        month: key,
        label: d.toLocaleDateString('en-IN', { month: 'short' }),
        income: entry.income,
        expense: entry.expense,
        net: entry.income - entry.expense,
      });
    }

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to load cash flow.' });
  }
};

// ── WhatsApp reminders ──

exports.createReminder = async (req, res) => {
  const { partyId, partyName, phone, amount, note } = req.body;
  if (!partyId || !partyName) return res.status(400).json({ error: 'partyId and partyName required.' });
  try {
    const id = uuidv4();
    const amountCents = Math.round(parseFloat(amount || 0) * 100);
    await db.execute(
      'INSERT INTO kirana_reminders (id, tenant_id, party_id, party_name, phone, amount, note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.tenantId, partyId, partyName, phone || null, amountCents, note || null, req.user.id]
    );
    res.status(201).json({ message: 'Reminder logged.', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to log reminder.' });
  }
};

exports.getReminders = async (req, res) => {
  const { limit = 20 } = req.query;
  try {
    const [rows] = await db.execute(
      'SELECT * FROM kirana_reminders WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      [req.tenantId, parseInt(limit)]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reminders.' });
  }
};
