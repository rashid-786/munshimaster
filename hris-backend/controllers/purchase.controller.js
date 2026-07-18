const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { sendEmail } = require('../utils/email');
const { logEmail } = require('../utils/emailLogger');
const { log } = require('../utils/audit');
const stockCtrl = require('./stock.controller');
const { resolveInvoiceSettings, resolveLogoUrl } = require('../utils/invoiceRenderer');

function computeTaxSplit(items) {
  let totalCGST = 0, totalSGST = 0, totalIGST = 0;
  items.forEach(item => {
    totalCGST += Math.round((item.total_price || 0) * (parseFloat(item.cgst_rate) || 0) / 100);
    totalSGST += Math.round((item.total_price || 0) * (parseFloat(item.sgst_rate) || 0) / 100);
    totalIGST += Math.round((item.total_price || 0) * (parseFloat(item.igst_rate) || 0) / 100);
  });
  return { totalCGST, totalSGST, totalIGST };
}

function generatePODoc(doc, po, items, poTaxRate, templateSettings) {
  const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
  const taxSplit = computeTaxSplit(items);
  const hasGst = po.gst_type === 'intra' || po.gst_type === 'inter';
  const hasHsn = items.some(i => i.hsn_code);
  const s = templateSettings || {};
  const primaryColor = s.primaryColor || '#0F172A';
  const secondaryColor = s.secondaryColor || '#16A34A';
  const margin = s.pageMargin || 50;
  const tableWidth = 500;
  const logoWidth = s.logoSize || 80;
  const baseFontSize = s.fontSize === 'large' ? 11 : (s.fontSize === 'medium' ? 10 : 9);
  const titleFontSize = s.fontSize === 'large' ? 20 : (s.fontSize === 'medium' ? 18 : 16);
  const headingFontSize = s.fontSize === 'large' ? 13 : (s.fontSize === 'medium' ? 12 : 11);
  const fontFamily = s.fontFamily || 'Helvetica';
  const fontBold = `${fontFamily}-Bold`;
  const logoAlign = s.logoAlignment || 'left';
  const headerY = s.headerHeight ? 45 + Math.max(0, (s.headerHeight - 120) / 4) : 45;

  if (s.logoUrl) {
    try {
      const logoPath = resolveLogoUrl(s.logoUrl);
      if (logoPath) {
        let logoX;
        if (logoAlign === 'right') {
          logoX = margin + tableWidth - logoWidth;
        } else if (logoAlign === 'center') {
          logoX = margin + (tableWidth - logoWidth) / 2;
        } else {
          logoX = margin;
        }
        doc.image(logoPath, logoX, headerY, { width: logoWidth });
      }
    } catch (e) { /* logo failed to load */ }
  }

  const companyText = s.companyName || po.company_name || '';
  const infoAlign = s.companyInfoPosition || 'left';
  doc.fontSize(titleFontSize).fillColor(primaryColor).font(fontBold);
  doc.text(companyText, margin, headerY, { width: tableWidth, align: infoAlign === 'center' ? 'center' : infoAlign });

  doc.fontSize(headingFontSize).fillColor('#374151').font(fontBold);
  doc.text('PURCHASE ORDER', margin, doc.y + 4, { width: tableWidth, align: infoAlign === 'center' ? 'center' : infoAlign });

  doc.fontSize(baseFontSize).fillColor('#374151').font(fontFamily);

  const cl = s.customLabels || {};
  const lbl = (key, fallback) => cl[key] || fallback;

  doc.font(fontBold).fillColor(primaryColor);
  doc.text(`${lbl('poNumber', 'PO #')}: `, margin, doc.y + 8, { continued: true });
  doc.font(fontFamily).fillColor('#374151').text(po.po_number);

  doc.font(fontBold).fillColor(primaryColor);
  doc.text(`${lbl('orderDate', 'Date')}: `, margin, doc.y + 2, { continued: true });
  doc.font(fontFamily).fillColor('#374151').text(fmtDate(po.order_date));
  if (po.expected_date) {
    doc.font(fontBold).fillColor(primaryColor);
    doc.text(`${lbl('expectedDate', 'Expected Delivery')}: `, margin, doc.y + 2, { continued: true });
    doc.font(fontFamily).fillColor('#374151').text(fmtDate(po.expected_date));
  }
  doc.moveDown(2);

  doc.font(fontBold).fillColor(primaryColor);
  doc.text(`${lbl('supplier', 'Supplier')}:`, { underline: true }).moveDown(0.5);
  doc.font(fontFamily).fillColor('#374151').fontSize(baseFontSize);
  doc.text(po.supplier_name);
  if (po.supplier_address) doc.text(po.supplier_address);
  if (po.supplier_city) doc.text(`${po.supplier_city}${po.supplier_state ? ', ' + po.supplier_state : ''}`);
  if (po.supplier_email) doc.text(`Email: ${po.supplier_email}`);
  if (po.supplier_phone) doc.text(`Phone: ${po.supplier_phone}`);
  if (po.supplier_gstin) doc.text(`GSTIN: ${po.supplier_gstin}`);
  if (po.place_of_supply) doc.text(`${lbl('placeOfSupply', 'Place of Supply')}: ${po.place_of_supply}`);
  doc.moveDown(2);

  doc.font(fontBold).fillColor(secondaryColor);
  doc.text(`${lbl('status', 'Status')}: ${po.status.toUpperCase()}`).moveDown(1);
  doc.fillColor('#000');
  doc.moveTo(margin, doc.y).lineTo(margin + tableWidth, doc.y).strokeColor('#e5e7eb').stroke().moveDown(1);
  doc.strokeColor('#000');

  const tableTop = doc.y;
  const colX = hasHsn ? [margin, margin + 110, margin + 260, margin + 300, margin + 350, margin + 410, margin + 460] : [margin, margin + 130, margin + 320, margin + 370, margin + 430];
  doc.rect(margin, tableTop - 4, tableWidth, 16).fillColor(primaryColor).fill();
  doc.fillColor('#fff').font(fontBold).fontSize(7);
  doc.text('#', colX[0], tableTop, { width: 25, align: 'center' });
  doc.text('Description', colX[1], tableTop, { width: hasHsn ? 150 : 190, align: 'left' });
  let nCol = 2;
  if (hasHsn) { doc.text('HSN/SAC', colX[2], tableTop, { width: 40, align: 'center' }); nCol = 3; }
  doc.text('Qty', colX[nCol], tableTop, { width: 40, align: 'right' });
  doc.text('Rate', colX[nCol + 1], tableTop, { width: 55, align: 'right' });
  doc.text('Amount', colX[nCol + 2], tableTop, { width: 65, align: 'right' });
  doc.fillColor('#374151').fontSize(7).font(fontFamily);

  let y = tableTop + 18;
  const rowH = 16;
  for (const [i, item] of items.entries()) {
    if (i % 2 === 0) doc.rect(margin, y - 2, tableWidth, rowH).fillColor('#f9fafb').fill();
    doc.fillColor('#374151');
    doc.text(String(i + 1), colX[0], y, { width: 25, align: 'center' });
    doc.text(item.description, colX[1], y, { width: hasHsn ? 150 : 190 });
    let c = 2;
    if (hasHsn) { doc.text(item.hsn_code || '—', colX[2], y, { width: 40, align: 'center' }); c = 3; }
    doc.text(item.quantity.toString(), colX[c], y, { width: 40, align: 'right' });
    doc.text(`Rs.${(item.unit_price / 100).toFixed(2)}`, colX[c + 1], y, { width: 55, align: 'right' });
    doc.text(`Rs.${(item.total_price / 100).toFixed(2)}`, colX[c + 2], y, { width: 65, align: 'right' });
    y += rowH;
  }

  doc.moveTo(margin, y).lineTo(margin + tableWidth, y).strokeColor('#d1d5db').stroke();
  y += 8;

  const labelX = margin + tableWidth - 200;
  const valueX = margin + tableWidth - 70;

  doc.font(fontBold).fontSize(baseFontSize).fillColor('#374151');
  doc.text(`${lbl('subtotal', 'Subtotal')}:`, labelX, y, { width: 130, align: 'right' });
  doc.text(`Rs.${(po.subtotal / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
  y += 14;

  if (hasGst && po.gst_type === 'intra') {
    const gstAmt = taxSplit.totalCGST + taxSplit.totalSGST;
    const gstRate = gstAmt > 0 ? (gstAmt / po.subtotal * 100).toFixed(1) : poTaxRate;
    doc.text(`GST @ ${gstRate}%:`, labelX, y, { width: 130, align: 'right' });
    doc.text(`Rs.${(gstAmt / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
    y += 14;
  } else if (hasGst && po.gst_type === 'inter') {
    doc.text(`IGST @ ${poTaxRate}%:`, labelX, y, { width: 130, align: 'right' });
    doc.text(`Rs.${(taxSplit.totalIGST / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
    y += 14;
  } else {
    doc.text(`${lbl('tax', 'Tax')} (${poTaxRate}%):`, labelX, y, { width: 130, align: 'right' });
    doc.text(`Rs.${(po.tax_amount / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
    y += 14;
  }

  doc.rect(margin, y - 2, tableWidth, 22).fillColor(primaryColor).fill();
  doc.fillColor('#fff').font(fontBold).fontSize(baseFontSize + 2);
  doc.text(`${lbl('grandTotal', 'Grand Total')}:`, labelX, y + 2, { width: 130, align: 'right' });
  doc.text(`Rs.${(po.total_amount / 100).toFixed(2)}`, valueX, y + 2, { width: 70, align: 'right' });
  y += 28;
  doc.fillColor('#374151');

  if (s.showTerms !== false && po.notes) {
    doc.fontSize(baseFontSize).font(fontBold).fillColor(primaryColor);
    doc.text(lbl('notes', 'Notes') + ':', margin, doc.y + 4);
    doc.font(fontFamily).fontSize(baseFontSize).fillColor('#374151');
    doc.text(po.notes, margin, doc.y + 4, { width: tableWidth });
  }
}

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
      `SELECT p.*, s.name as supplier_name,
       (SELECT COUNT(*) FROM attachments a WHERE a.tenant_id = p.tenant_id AND a.entity_type = 'purchase_order' AND a.entity_id = p.id) as attachment_count
       FROM purchase_orders p
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
    const templateConfig = await resolveInvoiceSettings(req.tenantId, 'purchase_order');
    res.json({ ...pos[0], items, templateConfig });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch purchase order.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { supplier_id, order_date, expected_date, items, notes, gst_type, place_of_supply } = req.body;

  if (!supplier_id || !order_date || !items?.length) {
    return res.status(400).json({ error: 'Supplier, order date, and at least one item are required.' });
  }

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [[{ next }]] = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(po_number, 4) AS INTEGER)), 0) + 1 as next
       FROM purchase_orders WHERE tenant_id = ?`, [tenantId]
    );
    const poNumber = `PO-${String(next).padStart(4, '0')}`;

    let subtotal = 0;
    let totalTaxAmount = 0;
    const useGst = gst_type === 'intra' || gst_type === 'inter';

    const lineItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = Math.round(parseFloat(item.unit_price) || 0);
      const total = Math.round(qty * price);
      subtotal += total;

      let cgstRate = 0, sgstRate = 0, igstRate = 0;
      if (useGst) {
        if (gst_type === 'intra') {
          cgstRate = parseFloat(item.cgst_rate) || (taxRate * 100) / 2;
          sgstRate = parseFloat(item.sgst_rate) || (taxRate * 100) / 2;
        } else {
          igstRate = parseFloat(item.igst_rate) || (taxRate * 100);
        }
      }

      const cgstAmt = Math.round(total * cgstRate / 100);
      const sgstAmt = Math.round(total * sgstRate / 100);
      const igstAmt = Math.round(total * igstRate / 100);
      totalTaxAmount += cgstAmt + sgstAmt + igstAmt;

      return {
        ...item,
        quantity: qty, unit_price: price, total_price: total,
        hsn_code: item.hsn_code || null,
        cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate,
      };
    });

    const totalAmount = subtotal + totalTaxAmount;
    const poId = uuidv4();

    await db.query(
      `INSERT INTO purchase_orders (id, tenant_id, po_number, supplier_id, order_date, expected_date, status, subtotal, tax_amount, total_amount, notes, gst_type, place_of_supply)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
      [poId, tenantId, poNumber, supplier_id, order_date, expected_date || null, subtotal, totalTaxAmount, totalAmount, notes || null, gst_type || null, place_of_supply || null]
    );

    for (const item of lineItems) {
      await db.query(
        `INSERT INTO purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), poId, item.description, item.quantity, item.unit_price, item.total_price, item.hsn_code, item.cgst_rate, item.sgst_rate, item.igst_rate]
      );
    }

    res.status(201).json({ message: 'Purchase order created.', id: poId, po_number: poNumber });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'purchase_order.created', entityType: 'purchase_order', entityId: poId, req });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create purchase order.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const poId = req.params.id;
  const { supplier_id, order_date, expected_date, status, items, notes, gst_type, place_of_supply } = req.body;

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [existing] = await db.query('SELECT id FROM purchase_orders WHERE id = ? AND tenant_id = ?', [poId, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Purchase order not found.' });

    let subtotal = 0;
    if (items?.length) {
      let totalTaxAmount = 0;
      const useGst = gst_type === 'intra' || gst_type === 'inter';

      const lineItems = items.map(item => {
        const qty = parseFloat(item.quantity) || 1;
        const price = Math.round(parseFloat(item.unit_price) || 0);
        const total = Math.round(qty * price);
        subtotal += total;

        let cgstRate = 0, sgstRate = 0, igstRate = 0;
        if (useGst) {
          if (gst_type === 'intra') {
            cgstRate = parseFloat(item.cgst_rate) || (taxRate * 100) / 2;
            sgstRate = parseFloat(item.sgst_rate) || (taxRate * 100) / 2;
          } else {
            igstRate = parseFloat(item.igst_rate) || (taxRate * 100);
          }
        }

        const cgstAmt = Math.round(total * cgstRate / 100);
        const sgstAmt = Math.round(total * sgstRate / 100);
        const igstAmt = Math.round(total * igstRate / 100);
        totalTaxAmount += cgstAmt + sgstAmt + igstAmt;

        return {
          ...item,
          quantity: qty, unit_price: price, total_price: total,
          hsn_code: item.hsn_code || null,
          cgst_rate: cgstRate, sgst_rate: sgstRate, igst_rate: igstRate,
        };
      });

      const totalAmount = subtotal + totalTaxAmount;

      await db.query(
        `UPDATE purchase_orders SET supplier_id=?, order_date=?, expected_date=?, status=?, subtotal=?, tax_amount=?, total_amount=?, notes=?, gst_type=?, place_of_supply=?
         WHERE id=? AND tenant_id=?`,
        [supplier_id, order_date, expected_date || null, status || 'draft', subtotal, totalTaxAmount, totalAmount, notes || null, gst_type || null, place_of_supply || null, poId, tenantId]
      );

      await db.query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [poId]);
      for (const item of lineItems) {
        await db.query(
          `INSERT INTO purchase_order_items (id, purchase_order_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), poId, item.description, item.quantity, item.unit_price, item.total_price, item.hsn_code, item.cgst_rate, item.sgst_rate, item.igst_rate]
        );
      }
    } else {
      await db.query(
        `UPDATE purchase_orders SET supplier_id=?, order_date=?, expected_date=?, status=?, notes=?, gst_type=?, place_of_supply=? WHERE id=? AND tenant_id=?`,
        [supplier_id, order_date, expected_date || null, status || 'draft', notes || null, gst_type || null, place_of_supply || null, poId, tenantId]
      );
    }

    res.json({ message: 'Purchase order updated.' });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'purchase_order.updated', entityType: 'purchase_order', entityId: poId, req });
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

    // Auto stock-in when PO is received
    if (status === 'received') {
      stockCtrl.stockInFromPO(req.tenantId, req.params.id, req.user?.id || null).catch(err => {
        console.error('stockInFromPO error:', err);
      });
    }

    res.json({ message: `Status updated to ${status}.` });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: `purchase_order.status_${status}`, entityType: 'purchase_order', entityId: req.params.id, changes: { status }, req });
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
    const [items] = await db.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id', [req.params.id]
    );

    const invoiceSettings = await resolveInvoiceSettings(req.tenantId, 'purchase_order');
    const poTaxRate = invoiceSettings.taxRate || 18;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${po.po_number}.pdf`);
    doc.pipe(res);

    generatePODoc(doc, po, items, poTaxRate, invoiceSettings);

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate PDF.' });
  }
};

exports.sendEmail = async (req, res) => {
  try {
    const [pos] = await db.query(
      `SELECT p.*, s.name as supplier_name, s.email as supplier_email,
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

    if (!po.supplier_email) {
      return res.status(400).json({ error: 'Supplier has no email address.' });
    }

    const [items] = await db.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = ? ORDER BY id', [req.params.id]
    );

    const invoiceSettings = await resolveInvoiceSettings(req.tenantId, 'purchase_order');
    const poTaxRate = invoiceSettings.taxRate || 18;

    const chunks = [];
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    doc.on('data', c => chunks.push(c));
    await new Promise(resolve => {
      doc.on('end', resolve);
      generatePODoc(doc, po, items, poTaxRate, invoiceSettings);
      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);
    const fmtEDate = po.expected_date ? new Date(po.expected_date).toISOString().split('T')[0] : '';

    const result = await sendEmail({
      to: po.supplier_email,
      subject: `Purchase Order ${po.po_number} from ${po.company_name}`,
      html: `
        <p>Dear ${po.supplier_name},</p>
        <p>Please find attached purchase order <strong>${po.po_number}</strong> from ${po.company_name}.</p>
        <p>Amount: <strong>Rs.${(po.total_amount / 100).toFixed(2)}</strong></p>
        ${fmtEDate ? `<p>Expected Delivery: ${fmtEDate}</p>` : ''}
        <br/>
        <p style="color:#6b7280;font-size:12px;">Thank you for your partnership!</p>
      `,
      attachments: [{
        filename: `${po.po_number}.pdf`,
        content: pdfBuffer,
      }],
    });

    if (result.sent) {
      await db.query(
        `UPDATE purchase_orders SET status = ? WHERE id = ? AND tenant_id = ?`,
        ['sent', req.params.id, req.tenantId]
      );
      await logEmail({
        tenantId: req.tenantId,
        entityType: 'purchase_order',
        entityId: req.params.id,
        recipient: po.supplier_email,
        subject: `Purchase Order ${po.po_number} from ${po.company_name}`,
        status: 'sent',
      });
      res.json({ message: 'Purchase order emailed successfully.', status: 'sent' });
    } else {
      await logEmail({
        tenantId: req.tenantId,
        entityType: 'purchase_order',
        entityId: req.params.id,
        recipient: po.supplier_email,
        subject: `Purchase Order ${po.po_number} from ${po.company_name}`,
        status: 'failed',
        errorMessage: result.error,
      });
      res.status(500).json({ error: 'Failed to send email. Please check SMTP configuration.' });
    }
  } catch (error) {
    console.error('sendPOEmail error:', error);
    res.status(500).json({ error: 'Failed to email purchase order.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM purchase_orders WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Purchase order not found.' });
    res.json({ message: 'Purchase order deleted.' });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'purchase_order.deleted', entityType: 'purchase_order', entityId: req.params.id, req });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete purchase order.' });
  }
};

exports.bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of purchase order IDs is required.' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await db.query(
      `DELETE FROM purchase_orders WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...ids, req.tenantId]
    );
    res.json({ message: `${result.affectedRows} purchase order(s) deleted.` });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'purchase_order.bulk_delete', entityType: 'purchase_order', changes: { ids, count: result.affectedRows }, req });
  } catch (error) {
    console.error('bulkDelete POs error:', error);
    res.status(500).json({ error: 'Failed to delete purchase orders.' });
  }
};

exports.bulkExportExcel = async (req, res) => {
  const tenantId = req.tenantId;
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of purchase order IDs is required.' });
  }
  try {
    const [tenantRow] = await db.execute('SELECT company_name FROM tenants WHERE id = ?', [tenantId]);
    const companyName = tenantRow[0]?.company_name || 'Company';

    const placeholders = ids.map(() => '?').join(',');
    const [orders] = await db.query(
      `SELECT p.po_number, p.order_date, p.expected_date, p.status, p.subtotal, p.tax_amount, p.total_amount,
              s.name as supplier_name, s.email as supplier_email, s.phone as supplier_phone
       FROM purchase_orders p JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id IN (${placeholders}) AND p.tenant_id = ?
       ORDER BY p.created_at DESC`,
      [...ids, tenantId]
    );

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('PurchaseOrders');

    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${companyName} — Purchase Order Export`;
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3C5D' } };
    titleCell.alignment = { horizontal: 'center' };
    sheet.getRow(1).height = 30;

    const headerRow = sheet.addRow(['PO #', 'Supplier', 'Email', 'Phone', 'Order Date', 'Expected Date', 'Status', 'Subtotal', 'Tax', 'Total']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3C5D' } };
      cell.alignment = { horizontal: 'center' };
    });

    orders.forEach(po => {
      sheet.addRow([
        po.po_number,
        po.supplier_name,
        po.supplier_email || '',
        po.supplier_phone || '',
        po.order_date ? new Date(po.order_date).toLocaleDateString('en-IN') : '',
        po.expected_date ? new Date(po.expected_date).toLocaleDateString('en-IN') : '',
        po.status,
        po.subtotal / 100,
        po.tax_amount / 100,
        po.total_amount / 100,
      ]);
    });

    sheet.columns = [
      { width: 14 }, { width: 22 }, { width: 25 }, { width: 16 },
      { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 },
      { width: 10 }, { width: 12 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=po_export.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('bulkExportExcel POs error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export purchase orders.' });
  }
};
