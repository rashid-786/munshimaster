const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { sendEmail } = require('../utils/email');
const { logEmail } = require('../utils/emailLogger');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Treat 'unpaid' filter as sent + overdue + partial
  let where = 'WHERE i.tenant_id = ?';
  const params = [tenantId];

  if (status) {
    if (status === 'unpaid') {
      where += " AND i.status IN ('sent','overdue','partial')";
    } else {
      where += ' AND i.status = ?';
      params.push(status);
    }
  }
  if (search) {
    where += ' AND (i.invoice_number LIKE ? OR c.name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM invoices i JOIN customers c ON i.customer_id = c.id ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT i.*, c.name as customer_name,
       (SELECT COUNT(*) FROM attachments a WHERE a.tenant_id = i.tenant_id AND a.entity_type = 'invoice' AND a.entity_id = i.id) as attachment_count
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id ${where}
       ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoices.' });
  }
};

exports.get = async (req, res) => {
  try {
    const [invs] = await db.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
              c.address as customer_address, c.city as customer_city, c.state as customer_state,
              c.gstin as customer_gstin
       FROM invoices i JOIN customers c ON i.customer_id = c.id
       WHERE i.id = ? AND i.tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (invs.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    const [items] = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [req.params.id]
    );
    const [payments] = await db.query(
      'SELECT * FROM invoice_payments WHERE invoice_id = ? AND tenant_id = ? ORDER BY payment_date DESC',
      [req.params.id, req.tenantId]
    );
    const inv = invs[0];
    const amountPaid = Number(inv.amount_paid || 0);
    const totalAmount = Number(inv.total_amount);
    res.json({
      ...inv,
      items,
      payments: payments || [],
      amountPaid,
      balanceDue: Math.max(0, totalAmount - amountPaid),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { customer_id, invoice_date, due_date, items, notes } = req.body;

  if (!customer_id || !invoice_date || !due_date || !items?.length) {
    return res.status(400).json({ error: 'Customer, dates, and at least one item are required.' });
  }

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [[{ next }]] = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number, 5) AS INTEGER)), 0) + 1 as next
       FROM invoices WHERE tenant_id = ?`, [tenantId]
    );
    const invNumber = `INV-${String(next).padStart(4, '0')}`;

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

    const invId = uuidv4();

    await db.query(
      `INSERT INTO invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [invId, tenantId, invNumber, customer_id, invoice_date, due_date, subtotal, taxAmount, totalAmount, notes || null]
    );

    for (const item of lineItems) {
      await db.query(
        `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), invId, item.description, item.quantity, item.unit_price, item.total_price]
      );
    }

    res.status(201).json({ message: 'Invoice created.', id: invId, invoice_number: invNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const invId = req.params.id;
  const { customer_id, invoice_date, due_date, status, items, notes } = req.body;

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [existing] = await db.query('SELECT id FROM invoices WHERE id = ? AND tenant_id = ?', [invId, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

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
        `UPDATE invoices SET customer_id=?, invoice_date=?, due_date=?, status=?, subtotal=?, tax_amount=?, total_amount=?, notes=?
         WHERE id=? AND tenant_id=?`,
        [customer_id, invoice_date, due_date, status || 'draft', subtotal, taxAmount, totalAmount, notes || null, invId, tenantId]
      );

      await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invId]);
      for (const item of lineItems) {
        await db.query(
          `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), invId, item.description, item.quantity, item.unit_price, item.total_price]
        );
      }
    } else {
      await db.query(
        `UPDATE invoices SET customer_id=?, invoice_date=?, due_date=?, status=?, notes=? WHERE id=? AND tenant_id=?`,
        [customer_id, invoice_date, due_date, status || 'draft', notes || null, invId, tenantId]
      );
    }

    res.json({ message: 'Invoice updated.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update invoice.' });
  }
};

exports.updateStatus = async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  try {
    // If reverting away from paid/partial, also reset amount_paid
    let extraUpdate = '';
    const params = [status, req.params.id, req.tenantId];
    if (status === 'draft' || status === 'sent' || status === 'cancelled') {
      // Only reset amount_paid if there are no recorded payments
      const [payments] = await db.query(
        'SELECT COUNT(*) as cnt FROM invoice_payments WHERE invoice_id = ? AND tenant_id = ?',
        [req.params.id, req.tenantId]
      );
      if (Number(payments[0].cnt) === 0) {
        extraUpdate = ', amount_paid = 0';
      }
    }
    const [result] = await db.query(
      `UPDATE invoices SET status = ?${extraUpdate} WHERE id = ? AND tenant_id = ?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ message: `Status updated to ${status}.` });
  } catch (error) {
    console.error('updateStatus error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
};

exports.downloadPDF = async (req, res) => {
  try {
    const [invs] = await db.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone,
              c.address as customer_address, c.city as customer_city, c.state as customer_state,
              c.gstin as customer_gstin, t.company_name, t.settings
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       JOIN tenants t ON i.tenant_id = t.id
       WHERE i.id = ? AND i.tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (invs.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    const inv = invs[0];
    const invSettings = typeof inv.settings === 'string' ? JSON.parse(inv.settings) : (inv.settings || {});
    const invTaxRate = invSettings.taxRate || 18;
    const [items] = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [req.params.id]
    );

    const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${inv.invoice_number}.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text(inv.company_name.toUpperCase(), { align: 'center' });
    doc.fontSize(12).text('INVOICE', { align: 'center' }).moveDown(2);

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text(`Invoice #: `, { continued: true }).font('Helvetica').text(inv.invoice_number);
    doc.font('Helvetica-Bold').text(`Date: `, { continued: true }).font('Helvetica').text(fmtDate(inv.invoice_date));
    if (inv.due_date) {
      doc.font('Helvetica-Bold').text(`Due Date: `, { continued: true }).font('Helvetica').text(fmtDate(inv.due_date));
    }
    doc.moveDown(2);

    doc.font('Helvetica-Bold').text('Customer:', { underline: true }).moveDown(0.5);
    doc.font('Helvetica').text(inv.customer_name);
    if (inv.customer_address) doc.text(inv.customer_address);
    if (inv.customer_city) doc.text(`${inv.customer_city}${inv.customer_state ? ', ' + inv.customer_state : ''}`);
    if (inv.customer_email) doc.text(`Email: ${inv.customer_email}`);
    if (inv.customer_phone) doc.text(`Phone: ${inv.customer_phone}`);
    if (inv.customer_gstin) doc.text(`GSTIN: ${inv.customer_gstin}`);
    doc.moveDown(2);

    doc.font('Helvetica-Bold').text(`Status: ${inv.status.toUpperCase()}`, { color: '#6366f1' }).moveDown(1);

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
    doc.text(`Rs.${(inv.subtotal / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
    y += 16;
    doc.text(`Tax (${invTaxRate}%):`, colX[3], y, { width: 60, align: 'right' });
    doc.text(`Rs.${(inv.tax_amount / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
    y += 16;
    doc.text('Total:', colX[3], y, { width: 60, align: 'right' });
    doc.text(`Rs.${(inv.total_amount / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });

    if (inv.notes) {
      y += 30;
      doc.fontSize(9).font('Helvetica-Bold').text('Notes:', 50, y);
      doc.font('Helvetica').fontSize(9).text(inv.notes, 50, doc.y + 4, { width: 500 });
    }

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM invoices WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ message: 'Invoice deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete invoice.' });
  }
};

exports.bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of invoice IDs is required.' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await db.query(
      `DELETE FROM invoices WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...ids, req.tenantId]
    );
    res.json({ message: `${result.affectedRows} invoice(s) deleted.` });
  } catch (error) {
    console.error('bulkDelete invoices error:', error);
    res.status(500).json({ error: 'Failed to delete invoices.' });
  }
};

exports.bulkExportExcel = async (req, res) => {
  const tenantId = req.tenantId;
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of invoice IDs is required.' });
  }
  try {
    const [tenantRow] = await db.execute('SELECT company_name FROM tenants WHERE id = ?', [tenantId]);
    const companyName = tenantRow[0]?.company_name || 'Company';

    const placeholders = ids.map(() => '?').join(',');
    const [invoices] = await db.query(
      `SELECT i.invoice_number, i.invoice_date, i.due_date, i.status, i.subtotal, i.tax_amount, i.total_amount, i.amount_paid,
              c.name as customer_name, c.email as customer_email, c.phone as customer_phone
       FROM invoices i JOIN customers c ON i.customer_id = c.id
       WHERE i.id IN (${placeholders}) AND i.tenant_id = ?
       ORDER BY i.created_at DESC`,
      [...ids, tenantId]
    );

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Invoices');

    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${companyName} — Invoice Export`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3C5D' } };
    titleCell.alignment = { horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headerRow = sheet.addRow(['Invoice #', 'Customer', 'Email', 'Phone', 'Date', 'Due Date', 'Status', 'Subtotal', 'Tax', 'Total', 'Paid']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3C5D' } };
      cell.alignment = { horizontal: 'center' };
    });

    invoices.forEach(inv => {
      sheet.addRow([
        inv.invoice_number,
        inv.customer_name,
        inv.customer_email || '',
        inv.customer_phone || '',
        inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-IN') : '',
        inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-IN') : '',
        inv.status,
        inv.subtotal / 100,
        inv.tax_amount / 100,
        inv.total_amount / 100,
        (inv.amount_paid || 0) / 100,
      ]);
    });

    sheet.columns = [
      { width: 16 }, { width: 22 }, { width: 25 }, { width: 16 },
      { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 },
      { width: 10 }, { width: 12 }, { width: 12 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=invoices_export.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('bulkExportExcel error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export invoices.' });
  }
};

exports.sendEmail = async (req, res) => {
  try {
    const [invs] = await db.query(
      `SELECT i.*, c.name as customer_name, c.email as customer_email,
              c.address as customer_address, c.city as customer_city, c.state as customer_state,
              c.gstin as customer_gstin, t.company_name, t.settings
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       JOIN tenants t ON i.tenant_id = t.id
       WHERE i.id = ? AND i.tenant_id = ?`,
      [req.params.id, req.tenantId]
    );
    if (invs.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    const inv = invs[0];

    if (!inv.customer_email) {
      return res.status(400).json({ error: 'Customer has no email address.' });
    }

    const invSettings = typeof inv.settings === 'string' ? JSON.parse(inv.settings) : (inv.settings || {});
    const invTaxRate = invSettings.taxRate || 18;
    const [items] = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [req.params.id]
    );

    const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

    // Generate PDF into buffer
    const chunks = [];
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    doc.on('data', c => chunks.push(c));
    await new Promise(resolve => {
      doc.on('end', resolve);
      doc.fontSize(18).text(inv.company_name.toUpperCase(), { align: 'center' });
      doc.fontSize(12).text('INVOICE', { align: 'center' }).moveDown(2);

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text(`Invoice #: `, { continued: true }).font('Helvetica').text(inv.invoice_number);
      doc.font('Helvetica-Bold').text(`Date: `, { continued: true }).font('Helvetica').text(fmtDate(inv.invoice_date));
      if (inv.due_date) {
        doc.font('Helvetica-Bold').text(`Due Date: `, { continued: true }).font('Helvetica').text(fmtDate(inv.due_date));
      }
      doc.moveDown(2);

      doc.font('Helvetica-Bold').text('Customer:', { underline: true }).moveDown(0.5);
      doc.font('Helvetica').text(inv.customer_name);
      if (inv.customer_address) doc.text(inv.customer_address);
      if (inv.customer_city) doc.text(`${inv.customer_city}${inv.customer_state ? ', ' + inv.customer_state : ''}`);
      if (inv.customer_email) doc.text(`Email: ${inv.customer_email}`);
      if (inv.customer_gstin) doc.text(`GSTIN: ${inv.customer_gstin}`);
      doc.moveDown(2);

      doc.font('Helvetica-Bold').text(`Status: ${inv.status.toUpperCase()}`).moveDown(1);
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
      doc.text(`Rs.${(inv.subtotal / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
      y += 16;
      doc.text(`Tax (${invTaxRate}%):`, colX[3], y, { width: 60, align: 'right' });
      doc.text(`Rs.${(inv.tax_amount / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
      y += 16;
      doc.text('Total:', colX[3], y, { width: 60, align: 'right' });
      doc.text(`Rs.${(inv.total_amount / 100).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });

      if (inv.notes) {
        y += 30;
        doc.fontSize(9).font('Helvetica-Bold').text('Notes:', 50, y);
        doc.font('Helvetica').fontSize(9).text(inv.notes, 50, doc.y + 4, { width: 500 });
      }

      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);

    const result = await sendEmail({
      to: inv.customer_email,
      subject: `Invoice ${inv.invoice_number} from ${inv.company_name}`,
      html: `
        <p>Dear ${inv.customer_name},</p>
        <p>Please find attached invoice <strong>${inv.invoice_number}</strong> from ${inv.company_name}.</p>
        <p>Amount: <strong>Rs.${(inv.total_amount / 100).toFixed(2)}</strong></p>
        <p>Due Date: ${fmtDate(inv.due_date) || 'N/A'}</p>
        <br/>
        <p style="color:#6b7280;font-size:12px;">Thank you for your business!</p>
      `,
      attachments: [{
        filename: `${inv.invoice_number}.pdf`,
        content: pdfBuffer,
      }],
    });

    if (result.sent) {
      await db.query(
        `UPDATE invoices SET status = ? WHERE id = ? AND tenant_id = ?`,
        ['sent', req.params.id, req.tenantId]
      );
      await logEmail({
        tenantId: req.tenantId,
        entityType: 'invoice',
        entityId: req.params.id,
        recipient: inv.customer_email,
        subject: `Invoice ${inv.invoice_number} from ${inv.company_name}`,
        status: 'sent',
      });
      res.json({ message: 'Invoice emailed successfully.', status: 'sent' });
    } else {
      await logEmail({
        tenantId: req.tenantId,
        entityType: 'invoice',
        entityId: req.params.id,
        recipient: inv.customer_email,
        subject: `Invoice ${inv.invoice_number} from ${inv.company_name}`,
        status: 'failed',
        errorMessage: result.error,
      });
      res.status(500).json({ error: 'Failed to send email. Please check SMTP configuration.' });
    }
  } catch (error) {
    console.error('sendInvoiceEmail error:', error);
    res.status(500).json({ error: 'Failed to email invoice.' });
  }
};
