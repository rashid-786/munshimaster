const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE p.tenant_id = ?';
  const params = [tenantId];

  if (status) {
    where += ' AND p.status = ?';
    params.push(status);
  }
  if (search) {
    where += ' AND (p.po_number LIKE ? OR s.name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM purchase_orders p JOIN suppliers s ON p.supplier_id = s.id ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT p.*, s.name as supplier_name FROM purchase_orders p
       JOIN suppliers s ON p.supplier_id = s.id ${where}
       ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch purchase orders.' });
  }
};

exports.get = async (req, res) => {
  try {
    const [pos] = await db.query(
      `SELECT p.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
              s.address as supplier_address, s.city as supplier_city, s.state as supplier_state,
              s.gstin as supplier_gstin
       FROM purchase_orders p JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (pos.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });
    const [items] = await db.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id', [req.params.id]
    );
    res.json({ ...pos[0], items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch purchase order.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { supplier_id, order_date, expected_date, items, notes } = req.body;

  if (!supplier_id || !order_date || !items?.length) {
    return res.status(400).json({ error: 'Supplier, order date, and at least one item are required.' });
  }

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [[{ next }]] = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(po_number, 4) AS UNSIGNED)), 0) + 1 as next
       FROM purchase_orders WHERE tenant_id = ?`, [tenantId]
    );
    const poNumber = `PO-${String(next).padStart(4, '0')}`;

    let subtotal = 0;
    const lineItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = Math.round(parseFloat(item.unit_price) || 0);
      const total = Math.round(qty * price);
      subtotal += total;
      return { ...item, quantity: qty, unit_price: price, total_price: total };
    });
    const taxAmount = Math.round(subtotal * taxRate);
    const totalAmount = subtotal + taxAmount;

    const poId = uuidv4();

    await db.query(
      `INSERT INTO purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [poId, tenantId, poNumber, supplier_id, order_date, expected_date || null, subtotal, taxAmount, totalAmount, notes || null]
    );

    for (const item of lineItems) {
      await db.query(
        `INSERT INTO purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), poId, item.description, item.quantity, item.unit_price, item.total_price]
      );
    }

    res.status(201).json({ message: 'Purchase order created.', id: poId, po_number: poNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create purchase order.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const poId = req.params.id;
  const { supplier_id, order_date, expected_date, status, items, notes } = req.body;

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [existing] = await db.query('SELECT id FROM purchase_orders WHERE id = ? AND tenant_id = ?', [poId, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });

    let subtotal = 0;
    if (items?.length) {
      const lineItems = items.map(item => {
        const qty = parseFloat(item.quantity) || 1;
        const price = Math.round(parseFloat(item.unit_price) || 0);
        const total = Math.round(qty * price);
        subtotal += total;
        return { ...item, quantity: qty, unit_price: price, total_price: total };
      });
      const taxAmount = Math.round(subtotal * taxRate);
      const totalAmount = subtotal + taxAmount;

      await db.query(
        `UPDATE purchase_orders SET supplier_id=?, order_date=?, expected_date=?, status=?, subtotal=?, tax_amount=?, total_amount=?, notes=?
         WHERE id=? AND tenant_id=?`,
        [supplier_id, order_date, expected_date || null, status || 'draft', subtotal, taxAmount, totalAmount, notes || null, poId, tenantId]
      );

      await db.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
      for (const item of lineItems) {
        await db.query(
          `INSERT INTO purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), poId, item.description, item.quantity, item.unit_price, item.total_price]
        );
      }
    } else {
      await db.query(
        `UPDATE purchase_orders SET supplier_id=?, order_date=?, expected_date=?, status=?, notes=? WHERE id=? AND tenant_id=?`,
        [supplier_id, order_date, expected_date || null, status || 'draft', notes || null, poId, tenantId]
      );
    }

    res.json({ message: 'Purchase order updated.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update purchase order.' });
  }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'approved', 'received', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  try {
    const [result] = await db.query(
      'UPDATE purchase_orders SET status = ? WHERE id = ? AND tenant_id = ?',
      [status, req.params.id, req.tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json({ message: `Status updated to ${status}.` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status.' });
  }
};

exports.downloadPDF = async (req, res) => {
  try {
    const [pos] = await db.query(
      `SELECT p.*, s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone,
              s.address as supplier_address, s.city as supplier_city, s.state as supplier_state,
              s.gstin as supplier_gstin, t.company_name, t.settings
       FROM purchase_orders p
       JOIN suppliers s ON p.supplier_id = s.id
       JOIN tenants t ON p.tenant_id = t.id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (pos.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });
    const po = pos[0];
    const poSettings = typeof po.settings === 'string' ? JSON.parse(po.settings) : (po.settings || {});
    const poTaxRate = poSettings.taxRate || 18;
    const [items] = await db.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id', [req.params.id]
    );

    const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${po.po_number}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text(po.company_name.toUpperCase(), { align: 'center' });
    doc.fontSize(12).text('PURCHASE ORDER', { align: 'center' }).moveDown(2);

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`PO Number: `, { continued: true }).font('Helvetica').text(po.po_number);
    doc.font('Helvetica-Bold').text(`Date: `, { continued: true }).font('Helvetica').text(fmtDate(po.order_date));
    if (po.expected_date) {
      doc.font('Helvetica-Bold').text(`Expected Delivery: `, { continued: true }).font('Helvetica').text(fmtDate(po.expected_date));
    }
    doc.moveDown(2);

    doc.font('Helvetica-Bold').text('Supplier:', { underline: true }).moveDown(0.5);
    doc.font('Helvetica').text(po.supplier_name);
    if (po.supplier_address) doc.text(po.supplier_address);
    if (po.supplier_city) doc.text(`${po.supplier_city}${po.supplier_state ? ', ' + po.supplier_state : ''}`);
    if (po.supplier_email) doc.text(`Email: ${po.supplier_email}`);
    if (po.supplier_phone) doc.text(`Phone: ${po.supplier_phone}`);
    if (po.supplier_gstin) doc.text(`GSTIN: ${po.supplier_gstin}`);
    doc.moveDown(2);

    doc.font('Helvetica-Bold').text(`Status: ${po.status.toUpperCase()}`, { color: '#6366f1' }).moveDown(1);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(1);

    const tableTop = doc.y;
    const colX = [50, 190, 370, 420, 480];
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('#', colX[0], tableTop);
    doc.text('Description', colX[1], tableTop);
    doc.text('Qty', colX[2], tableTop, { width: 50, align: 'right' });
    doc.text('Rate', colX[3], tableTop, { width: 60, align: 'right' });
    doc.text('Amount', colX[4], tableTop, { width: 70, align: 'right' });

    doc.moveTo(50, doc.y + 4).lineTo(550, doc.y + 4).stroke();
    let y = doc.y + 8;
    doc.fontSize(9).font('Helvetica');

    for (const [i, item] of items.entries()) {
      doc.text(String(i + 1), colX[0], y);
      doc.text(item.description, colX[1], y, { width: 180 });
      doc.text(item.quantity.toString(), colX[2], y, { width: 50, align: 'right' });
      doc.text(`Rs.${(item.unit_price / 100).toFixed(2)}`, colX[3], y, { width: 60, align: 'right' });
      doc.text(`Rs.${(item.total_price / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
      y += 18;
    }

    doc.moveTo(50, y).lineTo(550, y).stroke();
    y += 8;

    doc.font('Helvetica-Bold');
    doc.text('Subtotal:', colX[3], y, { width: 60, align: 'right' });
    doc.text(`Rs.${(po.subtotal / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
    y += 16;
    doc.text(`Tax (${poTaxRate}%):`, colX[3], y, { width: 60, align: 'right' });
    doc.text(`Rs.${(po.tax_amount / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
    y += 16;
    doc.text('Total:', colX[3], y, { width: 60, align: 'right' });
    doc.text(`Rs.${(po.total_amount / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });

    if (po.notes) {
      y += 30;
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:', 50, y);
      doc.font('Helvetica').fontSize(9).text(po.notes, 50, doc.y + 4, { width: 500 });
    }

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM purchase_orders WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json({ message: 'Purchase order deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete purchase order.' });
  }
};
