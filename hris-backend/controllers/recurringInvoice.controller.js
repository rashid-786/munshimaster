const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { status } = req.query;
  let where = 'WHERE r.tenant_id = ?';
  const params = [tenantId];
  if (status === 'active') { where += ' AND r.is_active = true'; }
  else if (status === 'inactive') { where += ' AND r.is_active = false'; }
  try {
    const [rows] = await db.query(
      `SELECT r.*, c.name as customer_name
       FROM recurring_invoice_templates r
       JOIN customers c ON r.customer_id = c.id
       ${where}
       ORDER BY r.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch recurring templates.' });
  }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.*, c.name as customer_name
       FROM recurring_invoice_templates r
       JOIN customers c ON r.customer_id = c.id
       WHERE r.id = ? AND r.tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found.' });
    const [items] = await db.query(
      'SELECT * FROM recurring_invoice_items WHERE template_id = ? ORDER BY sort_order',
      [req.params.id]
    );
    res.json({ ...rows[0], items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { customer_id, template_name, frequency, interval_count, day_of_week, day_of_month, next_generation_date, due_date_offset, notes, gst_type, place_of_supply, items } = req.body;

  if (!customer_id || !items?.length) {
    return res.status(400).json({ error: 'Customer and at least one item are required.' });
  }

  try {
    const id = uuidv4();
    await db.query(
      `INSERT INTO recurring_invoice_templates (id, tenant_id, customer_id, template_name, frequency, interval_count, day_of_week, day_of_month, next_generation_date, due_date_offset, notes, gst_type, place_of_supply)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, customer_id, template_name || null, frequency || 'monthly', interval_count || 1,
       day_of_week || null, day_of_month || null, next_generation_date, due_date_offset || 15,
       notes || null, gst_type || null, place_of_supply || null]
    );

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await db.query(
        `INSERT INTO recurring_invoice_items (id, template_id, description, quantity, unit_price, hsn_code, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), id, item.description, parseFloat(item.quantity) || 1,
         Math.round(parseFloat(item.unit_price) || 0), item.hsn_code || null, i]
      );
    }

    res.status(201).json({ message: 'Recurring template created.', id });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'recurring_invoice.created', entityType: 'recurring_invoice', entityId: id, req });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create template.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id;
  const { customer_id, template_name, frequency, interval_count, day_of_week, day_of_month, next_generation_date, due_date_offset, notes, gst_type, place_of_supply, items } = req.body;

  try {
    const [existing] = await db.query('SELECT id FROM recurring_invoice_templates WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Template not found.' });

    await db.query(
      `UPDATE recurring_invoice_templates SET customer_id=?, template_name=?, frequency=?, interval_count=?, day_of_week=?, day_of_month=?, next_generation_date=?, due_date_offset=?, notes=?, gst_type=?, place_of_supply=?
       WHERE id=? AND tenant_id=?`,
      [customer_id, template_name || null, frequency || 'monthly', interval_count || 1,
       day_of_week || null, day_of_month || null, next_generation_date, due_date_offset || 15,
       notes || null, gst_type || null, place_of_supply || null, id, tenantId]
    );

    if (items?.length) {
      await db.query('DELETE FROM recurring_invoice_items WHERE template_id = ?', [id]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await db.query(
          `INSERT INTO recurring_invoice_items (id, template_id, description, quantity, unit_price, hsn_code, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, item.description, parseFloat(item.quantity) || 1,
           Math.round(parseFloat(item.unit_price) || 0), item.hsn_code || null, i]
        );
      }
    }

    res.json({ message: 'Template updated.' });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'recurring_invoice.updated', entityType: 'recurring_invoice', entityId: id, req });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update template.' });
  }
};

exports.toggle = async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id;
  const { is_active } = req.body;
  try {
    const [result] = await db.query(
      'UPDATE recurring_invoice_templates SET is_active = ? WHERE id = ? AND tenant_id = ?',
      [is_active, id, tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Template not found.' });
    res.json({ message: is_active ? 'Template activated.' : 'Template deactivated.' });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: is_active ? 'recurring_invoice.activated' : 'recurring_invoice.deactivated', entityType: 'recurring_invoice', entityId: id, req });
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle template.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM recurring_invoice_templates WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Template not found.' });
    res.json({ message: 'Template deleted.' });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'recurring_invoice.deleted', entityType: 'recurring_invoice', entityId: req.params.id, req });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template.' });
  }
};

exports.generate = async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id;
  try {
    const [rows] = await db.query(
      'SELECT * FROM recurring_invoice_templates WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found.' });
    const template = rows[0];
    const [items] = await db.query(
      'SELECT * FROM recurring_invoice_items WHERE template_id = ? ORDER BY sort_order',
      [id]
    );
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [[{ next }]] = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number, 5) AS INTEGER)), 0) + 1 as next
       FROM invoices WHERE tenant_id = ?`, [tenantId]
    );
    const invNumber = `INV-${String(next).padStart(4, '0')}`;

    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (template.due_date_offset || 15));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    let subtotal = 0;
    let totalTaxAmount = 0;
    const useGst = template.gst_type === 'intra' || template.gst_type === 'inter';

    const lineItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = Math.round(parseFloat(item.unit_price) || 0);
      const total = Math.round(qty * price);
      subtotal += total;

      let cgstRate = 0, sgstRate = 0, igstRate = 0;
      if (useGst) {
        if (template.gst_type === 'intra') {
          cgstRate = (taxRate * 100) / 2;
          sgstRate = (taxRate * 100) / 2;
        } else {
          igstRate = (taxRate * 100);
        }
      }

      const cgstAmt = Math.round(total * cgstRate / 100);
      const sgstAmt = Math.round(total * sgstRate / 100);
      const igstAmt = Math.round(total * igstRate / 100);
      totalTaxAmount += cgstAmt + sgstAmt + igstAmt;

      return {
        description: item.description,
        quantity: qty, unit_price: price, total_price: total,
        hsn_code: item.hsn_code || null,
        cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate,
      };
    });

    const totalAmount = subtotal + totalTaxAmount;
    const invId = uuidv4();

    await db.query(
      `INSERT INTO invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, notes, gst_type, place_of_supply)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
      [invId, tenantId, invNumber, template.customer_id, invoiceDate, dueDateStr, subtotal, totalTaxAmount, totalAmount, template.notes || null, template.gst_type || null, template.place_of_supply || null]
    );

    for (const item of lineItems) {
      await db.query(
        `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), invId, item.description, item.quantity, item.unit_price, item.total_price, item.hsn_code, item.cgst_rate, item.sgst_rate, item.igst_rate]
      );
    }

    res.json({ message: 'Invoice generated.', id: invId, invoice_number: invNumber });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'invoice.created_from_recurring', entityType: 'invoice', entityId: invId, req });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate invoice.' });
  }
};
