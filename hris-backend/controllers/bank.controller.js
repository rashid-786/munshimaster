const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { parseCSV, matchWithInvoices } = require('../utils/bankParser');

exports.importPreview = async (req, res) => {
  const tenantId = req.tenantId;
  if (!req.file) return res.status(400).json({ error: 'CSV/XLSX file is required.' });

  try {
    const result = parseCSV(req.file.buffer);
    if (result.errors.length > 0 && result.rows.length === 0) {
      return res.status(400).json({ error: result.errors.join(', ') });
    }

    const matched = await matchWithInvoices(tenantId, result.rows, db);

    const totalDebit = matched.reduce((s, r) => s + r.debit_amount, 0);
    const totalCredit = matched.reduce((s, r) => s + r.credit_amount, 0);

    res.json({
      rows: matched,
      format: result.format,
      totalDebit,
      totalCredit,
      count: matched.length,
      errors: result.errors,
    });
  } catch (error) {
    console.error('importPreview error:', error);
    res.status(500).json({ error: 'Failed to parse file.' });
  }
};

exports.importConfirm = async (req, res) => {
  const tenantId = req.tenantId;
  const { rows } = req.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No transactions to import.' });
  }

  const batchId = uuidv4();
  let imported = 0;

  try {
    await db.query('BEGIN');

    for (const row of rows) {
      const id = uuidv4();
      await db.query(
        `INSERT INTO bank_transactions (id, tenant_id, import_batch_id, entry_date, description, debit_amount, credit_amount, running_balance, category, matched_invoice_id, confidence, original_row)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, batchId, row.entry_date, row.description || null,
         row.debit_amount || 0, row.credit_amount || 0,
         row.running_balance || null, row.category || 'uncategorized',
         row.matched_invoice_id || null, row.confidence || null,
         row.row ? JSON.stringify(row.row) : null]
      );

      if (row.type === 'IN' || row.type === 'OUT') {
        await db.query(
          `INSERT INTO balance_sheet (id, tenant_id, type, payment_method, amount, description, entry_date, created_by)
           VALUES (?, ?, ?, 'bank', ?, ?, ?, ?)`,
          [uuidv4(), tenantId, row.type, row.amount, row.description || 'Bank import', row.entry_date, req.user?.id || null]
        );
      }
      imported++;
    }

    await db.query('COMMIT');
    res.json({ message: `${imported} transactions imported.`, batchId });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('importConfirm error:', error);
    res.status(500).json({ error: 'Failed to import transactions.' });
  }
};

exports.listTransactions = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, category, matched, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (startDate) { where += ' AND entry_date >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND entry_date <= ?'; params.push(endDate); }
  if (category) { where += ' AND category = ?'; params.push(category); }
  if (matched === 'yes') { where += ' AND matched_invoice_id IS NOT NULL'; }
  else if (matched === 'no') { where += ' AND matched_invoice_id IS NULL'; }

  try {
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM bank_transactions ${where}`, params);
    const [rows] = await db.query(
      `SELECT bt.*, i.invoice_number as matched_invoice
       FROM bank_transactions bt
       LEFT JOIN invoices i ON bt.matched_invoice_id = i.id
       ${where}
       ORDER BY bt.entry_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
};

exports.listImports = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [rows] = await db.query(
      `SELECT import_batch_id, MIN(entry_date) as start_date, MAX(entry_date) as end_date,
              COUNT(*) as count, MIN(created_at) as imported_at
       FROM bank_transactions WHERE tenant_id = ?
       GROUP BY import_batch_id ORDER BY imported_at DESC`,
      [tenantId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch import history.' });
  }
};

exports.categorize = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { category } = req.body;

  if (!category) return res.status(400).json({ error: 'Category is required.' });

  try {
    const [result] = await db.query(
      'UPDATE bank_transactions SET category = ? WHERE id = ? AND tenant_id = ?',
      [category, id, tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ message: 'Category updated.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
};

exports.match = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { invoice_id } = req.body;

  try {
    const [inv] = await db.query('SELECT id FROM invoices WHERE id = ? AND tenant_id = ?', [invoice_id, tenantId]);
    if (inv.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

    const [result] = await db.query(
      'UPDATE bank_transactions SET matched_invoice_id = ?, confidence = 100 WHERE id = ? AND tenant_id = ?',
      [invoice_id, id, tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ message: 'Transaction matched to invoice.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to match transaction.' });
  }
};
