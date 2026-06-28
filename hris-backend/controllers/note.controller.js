const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

const TYPES = { credit: 'credit', debit: 'debit' };
const TABLE = (t) => t === 'credit' ? 'credit_notes' : 'debit_notes';
const ITEM_TABLE = (t) => t === 'credit' ? 'credit_note_items' : 'debit_note_items';
const PREFIX = (t) => t === 'credit' ? 'CN' : 'DN';
const NUMBER_COL = (t) => t === 'credit' ? 'credit_note_number' : 'debit_note_number';
const DATE_COL = (t) => t === 'credit' ? 'cn_date' : 'dn_date';

async function getNextNumber(tenantId, type) {
  const prefix = PREFIX(type);
  const table = TABLE(type);
  const col = NUMBER_COL(type);
  const [[{ next }]] = await db.query(
    `SELECT COALESCE(MAX(CAST(SUBSTRING(${col}, ${prefix.length + 2}) AS INTEGER)), 0) + 1 as next
     FROM ${table} WHERE tenant_id = $1`, [tenantId]
  );
  return `${prefix}-${String(next).padStart(4, '0')}`;
}

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { type, status, page = 1, limit = 20 } = req.query;
  if (!type || !TYPES[type]) return res.status(400).json({ error: 'Invalid type. Must be "credit" or "debit".' });

  const table = TABLE(type);
  const numberCol = NUMBER_COL(type);
  const dateCol = DATE_COL(type);
  const refJoin = type === 'credit'
    ? `LEFT JOIN hris_saas.invoices i ON cn.invoice_id = i.id`
    : `LEFT JOIN hris_saas.invoices i ON dn.invoice_id = i.id`;
  const alias = type === 'credit' ? 'cn' : 'dn';
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = `WHERE ${alias}.tenant_id = $1`;
  const params = [tenantId];
  if (status) { params.push(status); where += ` AND ${alias}.status = $${params.length}`; }

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM ${table} ${alias} ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT ${alias}.*, i.invoice_number as ref_invoice
       FROM ${table} ${alias}
       ${refJoin}
       ${where}
       ORDER BY ${alias}.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: `Failed to fetch ${type} notes.` });
  }
};

exports.getOne = async (req, res) => {
  const tenantId = req.tenantId;
  const { id, type } = req.params;
  if (!type || !TYPES[type]) return res.status(400).json({ error: 'Invalid type.' });

  const table = TABLE(type);
  const itemTable = ITEM_TABLE(type);
  const fkCol = type === 'credit' ? 'credit_note_id' : 'debit_note_id';

  try {
    const [notes] = await db.query(
      `SELECT n.*, i.invoice_number as ref_invoice,
              c.name as customer_name, c.gstin as customer_gstin
       FROM ${table} n
       LEFT JOIN hris_saas.invoices i ON n.invoice_id = i.id
       LEFT JOIN hris_saas.customers c ON i.customer_id = c.id
       WHERE n.id = $1 AND n.tenant_id = $2`, [id, tenantId]
    );
    if (notes.length === 0) return res.status(404).json({ error: 'Note not found.' });

    const [items] = await db.query(
      `SELECT * FROM ${itemTable} WHERE ${fkCol} = $1 ORDER BY id`, [id]
    );
    res.json({ ...notes[0], items });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch ${type} note.` });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { type } = req.params;
  if (!type || !TYPES[type]) return res.status(400).json({ error: 'Invalid type.' });

  const { invoice_id, date, reason, notes, items, gst_type, place_of_supply } = req.body;
  if (!items || !items.length) return res.status(400).json({ error: 'At least one item required.' });

  const table = TABLE(type);
  const itemTable = ITEM_TABLE(type);
  const fkCol = type === 'credit' ? 'credit_note_id' : 'debit_note_id';
  const numberCol = NUMBER_COL(type);
  const dateCol = DATE_COL(type);

  try {
    const docNumber = await getNextNumber(tenantId, type);
    const docId = uuidv4();

    let subtotal = 0, taxAmount = 0;
    const lineItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const unitPrice = Math.round(parseFloat(item.unit_price) || 0);
      const totalPrice = Math.round(qty * unitPrice);
      const cgstRate = parseFloat(item.cgst_rate) || 0;
      const sgstRate = parseFloat(item.sgst_rate) || 0;
      const igstRate = parseFloat(item.igst_rate) || 0;
      const itemTax = Math.round(totalPrice * (cgstRate + sgstRate + igstRate) / 100);
      subtotal += totalPrice;
      taxAmount += itemTax;
      return { id: uuidv4(), ...item, quantity: qty, unit_price: unitPrice, total_price: totalPrice, cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate };
    });

    const totalAmount = subtotal + taxAmount;

    await db.query('BEGIN');

    await db.query(
      `INSERT INTO ${table} (id, tenant_id, invoice_id, ${numberCol}, ${dateCol}, status, subtotal, tax_amount, total_amount, reason, gst_type, place_of_supply, notes)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12)`,
      [docId, tenantId, invoice_id || null, docNumber, date || new Date().toISOString().split('T')[0],
       subtotal, taxAmount, totalAmount, reason || null, gst_type || null, place_of_supply || null, notes || null]
    );

    for (const item of lineItems) {
      await db.query(
        `INSERT INTO ${itemTable} (id, ${fkCol}, description, quantity, unit_price, total_price, product_id, hsn_code, cgst_rate, sgst_rate, igst_rate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [item.id, docId, item.description, item.quantity, item.unit_price, item.total_price,
         item.product_id || null, item.hsn_code || null, item.cgst_rate, item.sgst_rate, item.igst_rate]
      );
    }

    await db.query('COMMIT');

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: `${type}_note.created`, entityType: `${type}_note`, entityId: docId,
      changes: { number: docNumber }, req,
    });

    res.status(201).json({ message: `${type} note created.`, id: docId, number: docNumber });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error(`Create ${type} note error:`, error);
    res.status(500).json({ error: `Failed to create ${type} note.` });
  }
};

exports.updateStatus = async (req, res) => {
  const tenantId = req.tenantId;
  const { id, type } = req.params;
  const { status } = req.body;
  if (!type || !TYPES[type]) return res.status(400).json({ error: 'Invalid type.' });
  if (!['draft', 'issued', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  const table = TABLE(type);
  const numberCol = NUMBER_COL(type);

  try {
    const [rows] = await db.query(
      `UPDATE ${table} SET status = $1 WHERE id = $2 AND tenant_id = $3`,
      [status, id, tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Note not found.' });

    await log({
      tenantId, actorId: req.user.id, actorName: req.user.name,
      action: `${type}_note.${status}`, entityType: `${type}_note`, entityId: id, req,
    });

    res.json({ message: `Note ${status}.` });
  } catch (error) {
    res.status(500).json({ error: `Failed to update status.` });
  }
};

exports.delete = async (req, res) => {
  const tenantId = req.tenantId;
  const { id, type } = req.params;
  if (!type || !TYPES[type]) return res.status(400).json({ error: 'Invalid type.' });

  const table = TABLE(type);
  const itemTable = ITEM_TABLE(type);
  const fkCol = type === 'credit' ? 'credit_note_id' : 'debit_note_id';

  try {
    const [notes] = await db.query(
      `SELECT status FROM ${table} WHERE id = $1 AND tenant_id = $2`, [id, tenantId]
    );
    if (notes.length === 0) return res.status(404).json({ error: 'Note not found.' });
    if (notes[0].status !== 'draft') return res.status(400).json({ error: 'Only draft notes can be deleted.' });

    await db.query('BEGIN');
    await db.query(`DELETE FROM ${itemTable} WHERE ${fkCol} = $1`, [id]);
    await db.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await db.query('COMMIT');

    res.json({ message: 'Note deleted.' });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: 'Failed to delete note.' });
  }
};
