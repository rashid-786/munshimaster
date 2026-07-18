const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

const DIRECTION = { sales_invoice: 'sales', payment_in: 'sales', sales_return: 'sales', credit_note: 'sales', delivery_challan: 'sales', quotation: 'sales', proforma_invoice: 'sales', purchase_invoice: 'purchase', payment_out: 'purchase', purchase_return: 'purchase', debit_note: 'purchase', purchase_order: 'purchase' };

const DOC_TYPES = Object.keys(DIRECTION);

const PARTY_TYPES = { sales_invoice: 'customer', payment_in: 'customer', sales_return: 'customer', credit_note: 'customer', delivery_challan: 'customer', quotation: 'customer', proforma_invoice: 'customer', purchase_invoice: 'supplier', payment_out: 'supplier', purchase_return: 'supplier', debit_note: 'supplier', purchase_order: 'supplier' };

const DOC_PREFIXES = { sales_invoice: 'INV', payment_in: 'PAYIN', sales_return: 'SR', credit_note: 'CN', delivery_challan: 'DC', quotation: 'QTN', proforma_invoice: 'PRO', purchase_invoice: 'BILL', payment_out: 'PAYOUT', purchase_return: 'PR', debit_note: 'DN', purchase_order: 'PO' };

const DOC_LABELS = { sales_invoice: 'Sales Invoice', payment_in: 'Payment Received', sales_return: 'Sales Return', credit_note: 'Credit Note', delivery_challan: 'Delivery Challan', quotation: 'Quotation', proforma_invoice: 'Proforma Invoice', purchase_invoice: 'Purchase Invoice', payment_out: 'Payment Made', purchase_return: 'Purchase Return', debit_note: 'Debit Note', purchase_order: 'Purchase Order' };

const STATUS_FLOW = {
  sales_invoice: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
  payment_in: ['draft', 'completed', 'cancelled'],
  sales_return: ['draft', 'issued', 'cancelled'],
  credit_note: ['draft', 'issued', 'cancelled'],
  delivery_challan: ['draft', 'sent', 'delivered', 'cancelled'],
  quotation: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled'],
  proforma_invoice: ['draft', 'sent', 'converted', 'cancelled'],
  purchase_invoice: ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'],
  payment_out: ['draft', 'completed', 'cancelled'],
  purchase_return: ['draft', 'issued', 'cancelled'],
  debit_note: ['draft', 'issued', 'cancelled'],
  purchase_order: ['draft', 'sent', 'approved', 'received', 'cancelled'],
};

function gstSplit(taxableAmount, gstRate, gstType) {
  if (gstType === 'intra') {
    const half = Math.round(taxableAmount * gstRate / 100 / 2);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: Math.round(taxableAmount * gstRate / 100) };
}

function computeItemTotals(item, gstType) {
  const rate = Math.round(item.rate || 0);
  const qty = parseFloat(item.quantity || 1);
  const discPct = parseFloat(item.discount_percent || 0);
  const gstRate = parseFloat(item.gst_rate || 0);
  const lineTotal = rate * qty;
  const discAmt = Math.round(lineTotal * discPct / 100);
  const taxable = lineTotal - discAmt;
  const gst = gstSplit(taxable, gstRate, gstType);
  return {
    discount_amount: discAmt,
    taxable_value: taxable,
    cgst_amount: gst.cgst,
    sgst_amount: gst.sgst,
    igst_amount: gst.igst,
    total_amount: taxable + gst.cgst + gst.sgst + gst.igst,
  };
}

function computeTotals(items, gstType) {
  let subtotal = 0, discountAmount = 0, taxableAmount = 0;
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0, grandTotal = 0;
  for (const item of items) {
    const c = computeItemTotals(item, gstType);
    subtotal += item.rate * parseFloat(item.quantity || 1);
    discountAmount += c.discount_amount;
    taxableAmount += c.taxable_value;
    cgstAmount += c.cgst_amount;
    sgstAmount += c.sgst_amount;
    igstAmount += c.igst_amount;
    grandTotal += c.total_amount;
  }
  const roundOff = Math.round(grandTotal) - grandTotal;
  grandTotal = Math.round(grandTotal);
  return { subtotal, discountAmount, taxableAmount, cgstAmount, sgstAmount, igstAmount, roundOff, grandTotal };
}

async function getNextNumber(tenantId, transactionType) {
  const year = String(new Date().getFullYear());
  const prefix = DOC_PREFIXES[transactionType] || 'DOC';
  const [rows] = await db.execute(
    `UPDATE hris_saas.document_sequences SET last_number = last_number + 1
     WHERE tenant_id = ? AND transaction_type = ? AND year = ?
     RETURNING last_number`,
    [tenantId, transactionType, year]
  );
  if (rows.length > 0) {
    return `${prefix}-${year}-${String(rows[0].last_number).padStart(4, '0')}`;
  }
  await db.execute(
    `INSERT INTO hris_saas.document_sequences (id, tenant_id, transaction_type, prefix, last_number, year)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [uuidv4(), tenantId, transactionType, prefix, year]
  );
  return `${prefix}-${year}-0001`;
}

async function seedSequence(tenantId, transactionType) {
  const year = String(new Date().getFullYear());
  const prefix = DOC_PREFIXES[transactionType] || 'DOC';
  const [existing] = await db.execute(
    'SELECT id FROM hris_saas.document_sequences WHERE tenant_id = ? AND transaction_type = ? AND year = ?',
    [tenantId, transactionType, year]
  );
  if (existing.length > 0) return;
  const [maxRow] = await db.execute(
    `SELECT MAX(CAST(SUBSTRING(document_number, LENGTH(?) + 6) AS INTEGER)) AS max_num
     FROM hris_saas.transactions
     WHERE tenant_id = ? AND transaction_type = ? AND document_number LIKE ?`,
    [`${prefix}-${year}-`, tenantId, transactionType, `${prefix}-${year}-%`]
  );
  const startNum = (maxRow[0] && maxRow[0].max_num) || 0;
  await db.execute(
    `INSERT INTO hris_saas.document_sequences (id, tenant_id, transaction_type, prefix, last_number, year)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuidv4(), tenantId, transactionType, prefix, startNum, year]
  );
}

async function syncBalanceDue(tenantId, txnId) {
  const [rows] = await db.execute(
    `SELECT grand_total, COALESCE(SUM(COALESCE(tp.amount_allocated, 0)), 0) AS total_paid
     FROM hris_saas.transactions t
     LEFT JOIN hris_saas.transaction_payments tp ON tp.allocated_to_id = t.id AND tp.tenant_id = ?
     WHERE t.id = ? AND t.tenant_id = ?
     GROUP BY t.id`,
    [tenantId, txnId, tenantId]
  );
  if (rows.length === 0) return { amount_paid: 0, balance_due: 0 };
  const gt = parseInt(rows[0].grand_total || 0);
  const paid = parseInt(rows[0].total_paid || 0);
  const balance = gt - paid;
  const status = paid >= gt ? 'paid' : paid > 0 ? 'partial' : undefined;
  await db.execute(
    'UPDATE hris_saas.transactions SET amount_paid = ?, balance_due = ? WHERE id = ? AND tenant_id = ?',
    [paid, balance < 0 ? 0 : balance, txnId, tenantId]
  );
  if (status) {
    await db.execute(
      'UPDATE hris_saas.transactions SET status = ? WHERE id = ? AND tenant_id = ? AND status IN (\'sent\',\'partial\',\'overdue\')',
      [status, txnId, tenantId]
    );
  }
  return { amount_paid: paid, balance_due: balance < 0 ? 0 : balance };
}

exports.seed = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    for (const docType of DOC_TYPES) {
      await seedSequence(tenantId, docType);
    }
    res.json({ message: 'Sequences seeded for all document types.' });
  } catch (err) {
    console.error('Seed sequences error:', err);
    res.status(500).json({ error: 'Failed to seed sequences.' });
  }
};

exports.list = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const { direction, transactionType, partyId, status, startDate, endDate, search, page = 1, limit = 35 } = req.query;
    const conditions = ['t.tenant_id = ?'];
    const params = [tenantId];

    if (direction) { conditions.push('t.direction = ?'); params.push(direction); }
    if (transactionType) { conditions.push('t.transaction_type = ?'); params.push(transactionType); }
    if (partyId) { conditions.push('t.party_id = ?'); params.push(partyId); }
    if (status && status !== 'all') { conditions.push('t.status = ?'); params.push(status); }
    if (startDate) { conditions.push('t.document_date >= ?'); params.push(startDate); }
    if (endDate) { conditions.push('t.document_date <= ?'); params.push(endDate); }
    if (search) { conditions.push('(t.document_number ILIKE ? OR t.party_name ILIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const where = conditions.join(' AND ');
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM hris_saas.transactions t WHERE ${where}`, params);
    const total = parseInt(countRows[0].total);
    const [rows] = await db.execute(
      `SELECT t.* FROM hris_saas.transactions t WHERE ${where} ORDER BY t.document_date DESC, t.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const NUM = ['subtotal', 'taxable_amount', 'discount_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'grand_total', 'amount_paid', 'balance_due'];
    const converted = rows.map(r => { const o = { ...r }; NUM.forEach(k => { if (o[k] !== undefined && o[k] !== null) o[k] = Number(o[k]); }); return o; });
    res.json({ data: converted, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Transaction list error:', err);
    res.status(500).json({ error: 'Failed to list transactions.' });
  }
};

exports.get = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const [rows] = await db.execute(
      'SELECT * FROM hris_saas.transactions WHERE id = ? AND tenant_id = ?',
      [req.params.id, tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Transaction not found.' });
    const txn = rows[0];
    const NUM = ['subtotal', 'taxable_amount', 'discount_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'grand_total', 'amount_paid', 'balance_due'];
    NUM.forEach(k => { if (txn[k] !== undefined && txn[k] !== null) txn[k] = Number(txn[k]); });
    const [items] = await db.execute(
      'SELECT * FROM hris_saas.transaction_items WHERE transaction_id = ? ORDER BY sort_order',
      [txn.id]
    );
    items.forEach(item => {
      ['rate', 'quantity', 'discount_percent', 'discount_amount', 'taxable_value', 'gst_rate', 'cgst_amount', 'sgst_amount', 'igst_amount', 'total_amount'].forEach(k => {
        if (item[k] !== undefined && item[k] !== null) item[k] = Number(item[k]);
      });
    });
    const [payments] = await db.execute(
      `SELECT tp.*, t.document_number AS allocated_to_number
       FROM hris_saas.transaction_payments tp
       LEFT JOIN hris_saas.transactions t ON t.id = tp.allocated_to_id
       WHERE tp.payment_transaction_id = ?`,
      [txn.id]
    );
    const [references] = await db.execute(
      `SELECT tr.*, t.document_number AS target_number, t.transaction_type AS target_type
       FROM hris_saas.transaction_references tr
       LEFT JOIN hris_saas.transactions t ON t.id = tr.target_id
       WHERE tr.source_id = ?`,
      [txn.id]
    );
    res.json({ ...txn, items, payments, references });
  } catch (err) {
    console.error('Transaction get error:', err);
    res.status(500).json({ error: 'Failed to fetch transaction.' });
  }
};

exports.create = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const userId = req.user?.id;
    const { transaction_type, items = [], payments = [], ...body } = req.body;

    if (!transaction_type || !DOC_TYPES.includes(transaction_type)) {
      return res.status(400).json({ error: 'Invalid or missing transaction_type.' });
    }
    if (transaction_type !== 'payment_in' && transaction_type !== 'payment_out') {
      if (!body.party_id) return res.status(400).json({ error: 'party_id is required.' });
    }

    const id = uuidv4();
    const direction = DIRECTION[transaction_type];
    const docNumber = body.document_number || await getNextNumber(tenantId, transaction_type);
    const gstType = body.gst_type || 'intra';
    const computed = items.length > 0 && ['sales_invoice', 'purchase_invoice', 'quotation', 'proforma_invoice', 'purchase_order', 'sales_return', 'purchase_return', 'credit_note', 'debit_note', 'delivery_challan'].includes(transaction_type)
      ? computeTotals(items, gstType) : {};

    const sql = `INSERT INTO hris_saas.transactions (id, tenant_id, transaction_type, direction, document_number, document_date,
      party_id, party_type, party_name, party_gstin, party_pan, party_address, party_city, party_state, party_country, party_postal_code,
      billing_address, billing_address_line2, billing_city, billing_state, billing_country, billing_postal_code,
      shipping_address, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code, same_as_billing,
      reference_number, reference_type,
      subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off, grand_total, amount_paid, balance_due,
      payment_date, payment_mode, payment_reference,
      due_date, valid_until, expected_delivery_date,
      gst_type, place_of_supply,
      payment_terms, terms_conditions, reason, notes,
      vehicle_number, transporter, challan_type,
      authorized_signatory,
      status, created_by)
      VALUES (?,?,?,?,?,?,
        ?,?,?,?,?,?,?,?,?,?,
        ?,?,?,?,?,?,
        ?,?,?,?,?,?,?,
        ?,?,
        ?,?,?,?,?,?,?,?,?,?,
        ?,?,?,
        ?,?,?,
        ?,?,
        ?,?,?,?,
        ?,?,?,
        ?,?,?)`;

    const vals = [id, tenantId, transaction_type, direction, docNumber, body.document_date || new Date(),
      body.party_id || null, PARTY_TYPES[transaction_type] || null, body.party_name || null, body.party_gstin || null, body.party_pan || null,
      body.party_address || null, body.party_city || null, body.party_state || null, body.party_country || null, body.party_postal_code || null,
      body.billing_address || null, body.billing_address_line2 || null, body.billing_city || null, body.billing_state || null, body.billing_country || null, body.billing_postal_code || null,
      body.shipping_address || null, body.shipping_address_line2 || null, body.shipping_city || null, body.shipping_state || null, body.shipping_country || null, body.shipping_postal_code || null,
      body.same_as_billing || false,
      body.reference_number || null, body.reference_type || null,
      computed.subtotal || 0, computed.discountAmount || 0, computed.taxableAmount || 0, computed.cgstAmount || 0, computed.sgstAmount || 0, computed.igstAmount || 0, computed.roundOff || 0, computed.grandTotal || 0, 0, computed.grandTotal || 0,
      body.payment_date || null, body.payment_mode || null, body.payment_reference || null,
      body.due_date || null, body.valid_until || null, body.expected_delivery_date || null,
      gstType, body.place_of_supply || null,
      body.payment_terms || null, body.terms_conditions || null, body.reason || null, body.notes || null,
      body.vehicle_number || null, body.transporter || null, body.challan_type || null,
      body.authorized_signatory || null,
      body.status || 'draft', userId || null];

    await db.execute(sql, vals);

    if (items.length > 0) {
      const itemSql = `INSERT INTO hris_saas.transaction_items (id, transaction_id, item_name, hsn_sac, quantity, unit, rate, discount_percent, discount_amount, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const c = item.total_amount !== undefined ? item : computeItemTotals(item, gstType);
        await db.execute(itemSql, [
          uuidv4(), id, item.item_name || item.description || 'Item', item.hsn_sac || null,
          parseFloat(item.quantity || 1), item.unit || null, Math.round(item.rate || 0),
          parseFloat(item.discount_percent || 0), c.discount_amount, c.taxable_value,
          parseFloat(item.gst_rate || 0), c.cgst_amount, c.sgst_amount, c.igst_amount, c.total_amount, i,
        ]);
      }
    }

    if ((transaction_type === 'payment_in' || transaction_type === 'payment_out') && payments.length > 0) {
      const paySql = `INSERT INTO hris_saas.transaction_payments (id, tenant_id, payment_transaction_id, allocated_to_id, allocated_to_type, amount_allocated) VALUES (?,?,?,?,?,?)`;
      for (const p of payments) {
        await db.execute(paySql, [uuidv4(), tenantId, id, p.allocated_to_id, p.allocated_to_type, Math.round(p.amount_allocated || 0)]);
        await syncBalanceDue(tenantId, p.allocated_to_id);
      }
    }

    await log(req, 'created', `Created ${DOC_LABELS[transaction_type]} ${docNumber}`, 'transactions', id);
    const [result] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ?', [id]);
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Transaction create error:', err);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
};

exports.update = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const userId = req.user?.id;
    const { id } = req.params;
    const { items = [], payments = [], ...body } = req.body;

    const [existing] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Transaction not found.' });
    const txn = existing[0];

    const gstType = body.gst_type || txn.gst_type || 'intra';
    const computed = items.length > 0 ? computeTotals(items, gstType) : {};

    await db.execute(`UPDATE hris_saas.transactions SET
      document_date=?, party_id=?, party_name=?, party_gstin=?, party_pan=?,
      party_address=?, party_city=?, party_state=?, party_country=?, party_postal_code=?,
      billing_address=?, billing_address_line2=?, billing_city=?, billing_state=?, billing_country=?, billing_postal_code=?,
      shipping_address=?, shipping_address_line2=?, shipping_city=?, shipping_state=?, shipping_country=?, shipping_postal_code=?, same_as_billing=?,
      reference_number=?, reference_type=?,
      subtotal=?, discount_amount=?, taxable_amount=?, cgst_amount=?, sgst_amount=?, igst_amount=?, round_off=?, grand_total=?,
      payment_date=?, payment_mode=?, payment_reference=?,
      due_date=?, valid_until=?, expected_delivery_date=?,
      gst_type=?, place_of_supply=?,
      payment_terms=?, terms_conditions=?, reason=?, notes=?,
      vehicle_number=?, transporter=?, challan_type=?,
      authorized_signatory=?, status=?, updated_by=?, updated_at=NOW()
      WHERE id=? AND tenant_id=?`,
      [body.document_date || txn.document_date,
        body.party_id || txn.party_id, body.party_name || txn.party_name, body.party_gstin || txn.party_gstin, body.party_pan || txn.party_pan,
        body.party_address !== undefined ? body.party_address : txn.party_address, body.party_city !== undefined ? body.party_city : txn.party_city, body.party_state !== undefined ? body.party_state : txn.party_state, body.party_country !== undefined ? body.party_country : txn.party_country, body.party_postal_code !== undefined ? body.party_postal_code : txn.party_postal_code,
        body.billing_address !== undefined ? body.billing_address : txn.billing_address, body.billing_address_line2 !== undefined ? body.billing_address_line2 : txn.billing_address_line2, body.billing_city !== undefined ? body.billing_city : txn.billing_city, body.billing_state !== undefined ? body.billing_state : txn.billing_state, body.billing_country !== undefined ? body.billing_country : txn.billing_country, body.billing_postal_code !== undefined ? body.billing_postal_code : txn.billing_postal_code,
        body.shipping_address !== undefined ? body.shipping_address : txn.shipping_address, body.shipping_address_line2 !== undefined ? body.shipping_address_line2 : txn.shipping_address_line2, body.shipping_city !== undefined ? body.shipping_city : txn.shipping_city, body.shipping_state !== undefined ? body.shipping_state : txn.shipping_state, body.shipping_country !== undefined ? body.shipping_country : txn.shipping_country, body.shipping_postal_code !== undefined ? body.shipping_postal_code : txn.shipping_postal_code,
        body.same_as_billing !== undefined ? body.same_as_billing : txn.same_as_billing,
        body.reference_number !== undefined ? body.reference_number : txn.reference_number, body.reference_type !== undefined ? body.reference_type : txn.reference_type,
        computed.subtotal || txn.subtotal, computed.discountAmount || txn.discount_amount, computed.taxableAmount || txn.taxable_amount, computed.cgstAmount || txn.cgst_amount, computed.sgstAmount || txn.sgst_amount, computed.igstAmount || txn.igst_amount, computed.roundOff || txn.round_off, computed.grandTotal || txn.grand_total,
        body.payment_date !== undefined ? body.payment_date : txn.payment_date, body.payment_mode !== undefined ? body.payment_mode : txn.payment_mode, body.payment_reference !== undefined ? body.payment_reference : txn.payment_reference,
        body.due_date !== undefined ? body.due_date : txn.due_date, body.valid_until !== undefined ? body.valid_until : txn.valid_until, body.expected_delivery_date !== undefined ? body.expected_delivery_date : txn.expected_delivery_date,
        gstType, body.place_of_supply !== undefined ? body.place_of_supply : txn.place_of_supply,
        body.payment_terms !== undefined ? body.payment_terms : txn.payment_terms, body.terms_conditions !== undefined ? body.terms_conditions : txn.terms_conditions, body.reason !== undefined ? body.reason : txn.reason, body.notes !== undefined ? body.notes : txn.notes,
        body.vehicle_number !== undefined ? body.vehicle_number : txn.vehicle_number, body.transporter !== undefined ? body.transporter : txn.transporter, body.challan_type !== undefined ? body.challan_type : txn.challan_type,
        body.authorized_signatory !== undefined ? body.authorized_signatory : txn.authorized_signatory,
        body.status || txn.status, userId || null, id, tenantId]
    );

    if (items.length > 0) {
      await db.execute('DELETE FROM hris_saas.transaction_items WHERE transaction_id = ?', [id]);
      const itemSql = `INSERT INTO hris_saas.transaction_items (id, transaction_id, item_name, hsn_sac, quantity, unit, rate, discount_percent, discount_amount, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const c = computeItemTotals(item, gstType);
        await db.execute(itemSql, [
          uuidv4(), id, item.item_name || item.description || 'Item', item.hsn_sac || null,
          parseFloat(item.quantity || 1), item.unit || null, Math.round(item.rate || 0),
          parseFloat(item.discount_percent || 0), c.discount_amount, c.taxable_value,
          parseFloat(item.gst_rate || 0), c.cgst_amount, c.sgst_amount, c.igst_amount, c.total_amount, i,
        ]);
      }
    }

    await db.execute('UPDATE hris_saas.transactions SET balance_due = grand_total - COALESCE(amount_paid, 0) WHERE id = ?', [id]);
    await log(req, 'updated', `Updated ${DOC_LABELS[txn.transaction_type]} ${txn.document_number}`, 'transactions', id);
    const [result] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ?', [id]);
    const NUM = ['subtotal', 'taxable_amount', 'discount_amount', 'cgst_amount', 'sgst_amount', 'igst_amount', 'round_off', 'grand_total', 'amount_paid', 'balance_due'];
    if (result[0]) NUM.forEach(k => { if (result[0][k] !== undefined && result[0][k] !== null) result[0][k] = Number(result[0][k]); });
    res.json(result[0]);
  } catch (err) {
    console.error('Transaction update error:', err);
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const { id } = req.params;
    const { status, reason } = req.body;

    const [existing] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Transaction not found.' });
    const txn = existing[0];
    const allowedStatuses = STATUS_FLOW[txn.transaction_type] || ['draft', 'cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status "${status}" for ${txn.transaction_type}. Allowed: ${allowedStatuses.join(', ')}` });
    }

    if (status === 'cancelled') {
      await db.execute('UPDATE hris_saas.transactions SET status=?, cancelled_at=NOW(), cancelled_by=?, cancel_reason=? WHERE id=? AND tenant_id=?',
        [status, req.user?.id || null, reason || null, id, tenantId]);
    } else {
      await db.execute('UPDATE hris_saas.transactions SET status=?, updated_by=?, updated_at=NOW() WHERE id=? AND tenant_id=?',
        [status, req.user?.id || null, id, tenantId]);
    }

    await log(req, 'status_changed', `Changed ${DOC_LABELS[txn.transaction_type]} ${txn.document_number} to ${status}`, 'transactions', id);
    const [result] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ?', [id]);
    res.json(result[0]);
  } catch (err) {
    console.error('Transaction status error:', err);
    res.status(500).json({ error: 'Failed to update status.' });
  }
};

exports.convert = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const { id } = req.params;
    const { target_type } = req.body;

    const [existing] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Source transaction not found.' });
    const source = existing[0];

    if (!target_type || !DOC_TYPES.includes(target_type)) {
      return res.status(400).json({ error: 'Invalid target transaction_type.' });
    }

    const refId = uuidv4();
    const targetDocNumber = await getNextNumber(tenantId, target_type);

    const targetId = uuidv4();
    const direction = DIRECTION[target_type];
    const gstType = source.gst_type || 'intra';
    const [sourceItems] = await db.execute('SELECT * FROM hris_saas.transaction_items WHERE transaction_id = ? ORDER BY sort_order', [id]);

    const insertSQL = `INSERT INTO hris_saas.transactions (id, tenant_id, transaction_type, direction, document_number, document_date,
      party_id, party_type, party_name, party_gstin, party_pan, party_address, party_city, party_state, party_country, party_postal_code,
      billing_address, billing_address_line2, billing_city, billing_state, billing_country, billing_postal_code,
      shipping_address, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code, same_as_billing,
      reference_number, reference_type,
      subtotal, discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off, grand_total, amount_paid, balance_due,
      due_date, gst_type, place_of_supply, payment_terms, terms_conditions, notes,
      status, created_by)
    VALUES (?,?,?,?,?,?,
      ?,?,?,?,?,?,?,?,?,?,
      ?,?,?,?,?,?,
      ?,?,?,?,?,?,
      ?,?,
      ?,?,?,?,?,?,?,?,?,?,
      ?,?,?,?,?,?,?,
      ?,?)`;

    const vals = [targetId, tenantId, target_type, direction, targetDocNumber, source.document_date || new Date(),
      source.party_id, source.party_type, source.party_name, source.party_gstin, source.party_pan,
      source.party_address, source.party_city, source.party_state, source.party_country, source.party_postal_code,
      source.billing_address, source.billing_address_line2, source.billing_city, source.billing_state, source.billing_country, source.billing_postal_code,
      source.shipping_address, source.shipping_address_line2, source.shipping_city, source.shipping_state, source.shipping_country, source.shipping_postal_code, source.same_as_billing,
      source.document_number, source.transaction_type,
      source.subtotal, source.discount_amount, source.taxable_amount, source.cgst_amount, source.sgst_amount, source.igst_amount, source.round_off, source.grand_total, 0, source.grand_total,
      source.due_date, gstType, source.place_of_supply, source.payment_terms, source.terms_conditions, source.notes,
      'draft', req.user?.id || null];
    await db.execute(insertSQL, vals);

    if (sourceItems.length > 0) {
      const itemSql = `INSERT INTO hris_saas.transaction_items (id, transaction_id, item_name, hsn_sac, quantity, unit, rate, discount_percent, discount_amount, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
      for (let i = 0; i < sourceItems.length; i++) {
        const si = sourceItems[i];
        await db.execute(itemSql, [
          uuidv4(), targetId, si.item_name, si.hsn_sac, si.quantity, si.unit, si.rate,
          si.discount_percent, si.discount_amount, si.taxable_value, si.gst_rate,
          si.cgst_amount, si.sgst_amount, si.igst_amount, si.total_amount, i,
        ]);
      }
    }

    await db.execute(
      `INSERT INTO hris_saas.transaction_references (id, tenant_id, source_id, target_id, conversion_type) VALUES (?,?,?,?,?)`,
      [refId, tenantId, id, targetId, `${source.transaction_type}_to_${target_type}`]
    );

    if (source.transaction_type === 'quotation' || source.transaction_type === 'proforma_invoice') {
      await db.execute('UPDATE hris_saas.transactions SET status = \'converted\' WHERE id = ?', [id]);
    }

    await log(req, 'converted', `Converted ${DOC_LABELS[source.transaction_type]} ${source.document_number} to ${DOC_LABELS[target_type]} ${targetDocNumber}`, 'transactions', targetId);
    const [result] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ?', [targetId]);
    res.status(201).json(result[0]);
  } catch (err) {
    console.error('Transaction convert error:', err);
    res.status(500).json({ error: 'Failed to convert transaction.' });
  }
};

exports.cancel = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const { id } = req.params;
    const { reason } = req.body;

    const [existing] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Transaction not found.' });
    const txn = existing[0];

    if (txn.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled.' });

    await db.execute(
      'UPDATE hris_saas.transactions SET status=?, cancelled_at=NOW(), cancelled_by=?, cancel_reason=? WHERE id=? AND tenant_id=?',
      ['cancelled', req.user?.id || null, reason || null, id, tenantId]
    );
    await log(req, 'cancelled', `Cancelled ${DOC_LABELS[txn.transaction_type]} ${txn.document_number}`, 'transactions', id);
    const [result] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ?', [id]);
    res.json(result[0]);
  } catch (err) {
    console.error('Transaction cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel transaction.' });
  }
};

exports.summary = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const { direction, party_id } = req.query;
    const conditions = ['t.tenant_id = ?', "t.status != 'cancelled'", "t.status != 'draft'"];
    const params = [tenantId];

    if (direction) { conditions.push('t.direction = ?'); params.push(direction); }
    if (party_id) { conditions.push('t.party_id = ?'); params.push(party_id); }

    const where = conditions.join(' AND ');
    const [rows] = await db.execute(
      `SELECT
        COUNT(*) AS total_count,
        COALESCE(SUM(t.grand_total), 0) AS total_amount,
        COALESCE(SUM(t.amount_paid), 0) AS total_paid,
        COALESCE(SUM(t.balance_due), 0) AS total_balance,
        MAX(t.document_date) AS last_date
       FROM hris_saas.transactions t WHERE ${where}`,
      params
    );
    const r = rows[0];
    res.json({
      totalCount: parseInt(r.total_count),
      totalAmount: parseInt(r.total_amount),
      totalPaid: parseInt(r.total_paid),
      totalBalance: parseInt(r.total_balance),
      lastDate: r.last_date,
    });
  } catch (err) {
    console.error('Transaction summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary.' });
  }
};

exports.getOutstanding = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const { party_id, direction } = req.query;
    if (!party_id || !direction) return res.status(400).json({ error: 'party_id and direction are required.' });

    const docTypes = direction === 'sales' ? ['sales_invoice'] : ['purchase_invoice'];
    const placeholders = docTypes.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT id, document_number AS doc_number, document_date AS doc_date, grand_total, amount_paid, balance_due
       FROM hris_saas.transactions
       WHERE tenant_id = ? AND party_id = ? AND transaction_type IN (${placeholders})
         AND status IN ('sent','partial','overdue') AND cancelled_at IS NULL
       ORDER BY document_date ASC`,
      [tenantId, party_id, ...docTypes]
    );
    res.json(rows);
  } catch (err) {
    console.error('Outstanding error:', err);
    res.status(500).json({ error: 'Failed to fetch outstanding invoices.' });
  }
};

exports.delete = async (req, res) => {
  try {
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    const { id } = req.params;

    const [existing] = await db.execute('SELECT * FROM hris_saas.transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Transaction not found.' });
    const txn = existing[0];

    if (txn.status !== 'draft') return res.status(400).json({ error: 'Only draft transactions can be deleted.' });

    await db.execute('DELETE FROM hris_saas.transaction_items WHERE transaction_id = ?', [id]);
    await db.execute('DELETE FROM hris_saas.transaction_payments WHERE payment_transaction_id = ? OR allocated_to_id = ?', [id, id]);
    await db.execute('DELETE FROM hris_saas.transaction_references WHERE source_id = ? OR target_id = ?', [id, id]);
    await db.execute('DELETE FROM hris_saas.transactions WHERE id = ? AND tenant_id = ?', [id, tenantId]);

    await log(req, 'deleted', `Deleted draft ${DOC_LABELS[txn.transaction_type]} ${txn.document_number}`, 'transactions', id);
    res.json({ success: true });
  } catch (err) {
    console.error('Transaction delete error:', err);
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
};
