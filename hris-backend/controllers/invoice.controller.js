const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const { sendEmail } = require('../utils/email');
const { logEmail } = require('../utils/emailLogger');
const { log } = require('../utils/audit');
const stockCtrl = require('./stock.controller');
const { resolveInvoiceSettings, resolveLogoUrl } = require('../utils/invoiceRenderer');

// Compute per-item tax amounts from stored rates and total prices
function computeTaxSplit(items) {
  let totalCGST = 0, totalSGST = 0, totalIGST = 0;
  items.forEach(item => {
    const cgstAmt = Math.round((item.total_price || 0) * (parseFloat(item.cgst_rate) || 0) / 100);
    const sgstAmt = Math.round((item.total_price || 0) * (parseFloat(item.sgst_rate) || 0) / 100);
    const igstAmt = Math.round((item.total_price || 0) * (parseFloat(item.igst_rate) || 0) / 100);
    totalCGST += cgstAmt;
    totalSGST += sgstAmt;
    totalIGST += igstAmt;
  });
  return { totalCGST, totalSGST, totalIGST };
}

function generateInvoicePDF(doc, inv, items, invTaxRate, invoiceSettings) {
  const fmtDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';
  const taxSplit = computeTaxSplit(items);
  const hasGst = inv.gst_type === 'intra' || inv.gst_type === 'inter';
  const s = invoiceSettings || {};
  const cl = s.customLabels || {};
  const lbl = (key, fallback) => cl[key] || fallback;
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
  const sectionSpacing = s.sectionSpacing || 12;

  const headerY = s.headerHeight ? 45 + Math.max(0, (s.headerHeight - 120) / 4) : 45;
  const logoAlign = s.logoAlignment || 'left';

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

  const infoAlign = s.companyInfoPosition || 'left';
  const textStartX = margin;
  const textAvailWidth = tableWidth;

  const companyText = s.companyName || inv.company_name || '';
  doc.fontSize(titleFontSize).fillColor(primaryColor).font(fontBold);
  doc.text(companyText, textStartX, headerY, { width: textAvailWidth, align: infoAlign === 'center' ? 'center' : infoAlign });

  doc.fontSize(headingFontSize).fillColor('#374151').font(fontBold);
  doc.text(lbl('invoice', 'INVOICE'), textStartX, doc.y + 2, { width: textAvailWidth, align: infoAlign === 'center' ? 'center' : infoAlign });

  const showInvNo = s.showInvoiceNo !== false;
  const showInvDate = s.showInvoiceDate !== false;
  const showDueDate = s.showDueDate !== false;
  const showPayTerms = s.showPaymentTerms !== false;
  const showSalesPerson = s.showSalesPerson !== false;
  const customerLayout = s.customerLayout || 'left';

  function renderInvoiceInfo(yStart) {
    let y = yStart;
    doc.fontSize(baseFontSize).fillColor('#374151');
    if (showInvNo) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('invoiceNumber', 'Invoice #')}: `, margin, y, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(inv.invoice_number);
      y = doc.y + 4;
    }
    if (showInvDate) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('invoiceDate', 'Date')}: `, margin, y, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(fmtDate(inv.invoice_date));
      y = doc.y + 4;
    }
    if (showDueDate && inv.due_date) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('dueDate', 'Due Date')}: `, margin, y, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(fmtDate(inv.due_date));
      y = doc.y + 4;
    }
    if (showPayTerms && inv.payment_terms) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('paymentTerms', 'Payment Terms')}: `, margin, y, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(inv.payment_terms);
      y = doc.y + 4;
    }
    if (showSalesPerson && inv.sales_person) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('salesPerson', 'Sales Person')}: `, margin, y, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(inv.sales_person);
      y = doc.y + 4;
    }
    return doc.y;
  }

  function renderCustomerBlock(yStart) {
    let y = yStart;
    doc.fontSize(baseFontSize).font(fontBold).fillColor(primaryColor);
    doc.text(lbl('billTo', 'Bill To') + ':', margin, y);
    y = doc.y + 2;
    doc.font(fontFamily).fillColor('#374151').fontSize(baseFontSize);
    if (inv.customer_name) { doc.text(inv.customer_name, margin, y); y = doc.y + 2; }
    if (s.showCustomerAddress !== false) {
      if (inv.customer_address) { doc.text(inv.customer_address, margin, y); y = doc.y + 2; }
      if (inv.customer_city) {
        doc.text(`${inv.customer_city}${inv.customer_state ? ', ' + inv.customer_state : ''}`, margin, y);
        y = doc.y + 2;
      }
    }
    if (inv.customer_email) { doc.text(`Email: ${inv.customer_email}`, margin, y); y = doc.y + 2; }
    if (inv.customer_phone) { doc.text(`Phone: ${inv.customer_phone}`, margin, y); y = doc.y + 2; }
    if (s.showCustomerGst !== false && inv.customer_gstin) { doc.text(`GSTIN: ${inv.customer_gstin}`, margin, y); y = doc.y + 2; }
    if (inv.place_of_supply) { doc.text(`${lbl('placeOfSupply', 'Place of Supply')}: ${inv.place_of_supply}`, margin, y); y = doc.y + 2; }
    return doc.y;
  }

  let afterInfo;
  if (customerLayout === 'two_column') {
    const leftEndY = renderInvoiceInfo(doc.y);
    const rightX = margin + tableWidth / 2;
    let cy = doc.y;
    doc.fontSize(baseFontSize).font(fontBold).fillColor(primaryColor);
    doc.text(lbl('billTo', 'Bill To') + ':', rightX, cy);
    cy += 14;
    doc.font(fontFamily).fillColor('#374151').fontSize(baseFontSize);
    if (inv.customer_name) { doc.text(inv.customer_name, rightX, cy); cy += 12; }
    if (s.showCustomerAddress !== false) {
      if (inv.customer_address) { doc.text(inv.customer_address, rightX, cy); cy += 12; }
      if (inv.customer_city) { doc.text(`${inv.customer_city}${inv.customer_state ? ', ' + inv.customer_state : ''}`, rightX, cy); cy += 12; }
    }
    if (inv.customer_email) { doc.text(`Email: ${inv.customer_email}`, rightX, cy); cy += 12; }
    if (inv.customer_phone) { doc.text(`Phone: ${inv.customer_phone}`, rightX, cy); cy += 12; }
    if (s.showCustomerGst !== false && inv.customer_gstin) { doc.text(`GSTIN: ${inv.customer_gstin}`, rightX, cy); cy += 12; }
    if (inv.place_of_supply) { doc.text(`${lbl('placeOfSupply', 'Place of Supply')}: ${inv.place_of_supply}`, rightX, cy); cy += 12; }
    afterInfo = Math.max(leftEndY, cy);
  } else if (customerLayout === 'right') {
    const rightX = margin + tableWidth / 2;
    let ly = doc.y;
    doc.fontSize(baseFontSize).font(fontBold).fillColor(primaryColor);
    doc.text(lbl('billTo', 'Bill To') + ':', margin, ly);
    ly += 14;
    doc.font(fontFamily).fillColor('#374151').fontSize(baseFontSize);
    if (inv.customer_name) { doc.text(inv.customer_name, margin, ly); ly += 12; }
    if (s.showCustomerAddress !== false) {
      if (inv.customer_address) { doc.text(inv.customer_address, margin, ly); ly += 12; }
      if (inv.customer_city) { doc.text(`${inv.customer_city}${inv.customer_state ? ', ' + inv.customer_state : ''}`, margin, ly); ly += 12; }
    }
    if (inv.customer_email) { doc.text(`Email: ${inv.customer_email}`, margin, ly); ly += 12; }
    if (inv.customer_phone) { doc.text(`Phone: ${inv.customer_phone}`, margin, ly); ly += 12; }
    if (s.showCustomerGst !== false && inv.customer_gstin) { doc.text(`GSTIN: ${inv.customer_gstin}`, margin, ly); ly += 12; }
    if (inv.place_of_supply) { doc.text(`${lbl('placeOfSupply', 'Place of Supply')}: ${inv.place_of_supply}`, margin, ly); ly += 12; }
    let ry = doc.y;
    doc.fontSize(baseFontSize).fillColor('#374151');
    if (showInvNo) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('invoiceNumber', 'Invoice #')}: `, rightX, ry, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(inv.invoice_number);
      ry = doc.y + 4;
    }
    if (showInvDate) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('invoiceDate', 'Date')}: `, rightX, ry, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(fmtDate(inv.invoice_date));
      ry = doc.y + 4;
    }
    if (showDueDate && inv.due_date) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('dueDate', 'Due Date')}: `, rightX, ry, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(fmtDate(inv.due_date));
      ry = doc.y + 4;
    }
    if (showPayTerms && inv.payment_terms) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('paymentTerms', 'Payment Terms')}: `, rightX, ry, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(inv.payment_terms);
      ry = doc.y + 4;
    }
    if (showSalesPerson && inv.sales_person) {
      doc.font(fontBold).fillColor(primaryColor);
      doc.text(`${lbl('salesPerson', 'Sales Person')}: `, rightX, ry, { continued: true });
      doc.font(fontFamily).fillColor('#374151').text(inv.sales_person);
      ry = doc.y + 4;
    }
    afterInfo = Math.max(ly, ry);
  } else {
    renderCustomerBlock(doc.y);
    doc.moveDown(0.5);
    renderInvoiceInfo(doc.y);
    afterInfo = doc.y;
  }

  doc.font(fontBold).fontSize(baseFontSize + 1).fillColor(secondaryColor);
  doc.text(`${lbl('status', 'Status')}: ${inv.status.toUpperCase()}`, margin, afterInfo + 4);
  doc.fillColor('#000');
  doc.moveDown(1);

  doc.moveTo(margin, doc.y).lineTo(margin + tableWidth, doc.y).strokeColor('#e5e7eb').stroke().moveDown(1);
  doc.strokeColor('#000');

  const colDefs = s.itemColumns && s.itemColumns.length ? s.itemColumns : [
    { key: 'description', label: 'Description', visible: true },
    { key: 'hsn', label: 'HSN/SAC', visible: true },
    { key: 'quantity', label: 'Qty', visible: true },
    { key: 'rate', label: 'Rate', visible: true },
    { key: 'total', label: 'Amount', visible: true },
  ];

  const visibleCols = colDefs.filter(c => c.visible);
  const colWidths = {
    sku: 55, itemCode: 55, hsn: 60, description: 0, unit: 40,
    quantity: 42, rate: 55, discount: 50, gst: 50, total: 60,
  };
  const colAligns = {
    sku: 'center', itemCode: 'center', hsn: 'center', description: 'left', unit: 'center',
    quantity: 'right', rate: 'right', discount: 'right', gst: 'right', total: 'right',
  };

  const otherTotal = visibleCols.reduce((sum, c) => sum + (c.key === 'description' ? 0 : (colWidths[c.key] || 55)), 0);
  const descCol = visibleCols.find(c => c.key === 'description');
  const hasFlex = !!descCol;
  const descWidth = hasFlex ? Math.max(80, tableWidth - otherTotal - 25) : 0;

  let xPos = margin;
  const positions = [];
  positions.push({ key: '#', x: xPos, width: 25, align: 'center' });
  xPos += 25;
  for (const col of visibleCols) {
    const w = col.key === 'description' ? descWidth : (colWidths[col.key] || 55);
    positions.push({ key: col.key, x: xPos, width: w, align: colAligns[col.key] || 'left' });
    xPos += w;
  }

  const tableTop = doc.y;
  let y = tableTop;
  doc.rect(margin, y - 4, tableWidth, 16).fillColor(primaryColor).fill();
  doc.fillColor('#fff').font(fontBold).fontSize(7);
  for (const pos of positions) {
    const colDef = colDefs.find(c => c.key === pos.key);
    const colLabel = colDef ? (lbl(colDef.key, colDef.label)) : (pos.key === '#' ? '#' : pos.key);
    doc.text(colLabel, pos.x, y, {
      width: pos.width, align: pos.align === 'right' ? 'right' : (pos.align === 'center' ? 'center' : 'left'),
    });
  }
  doc.fillColor('#374151').fontSize(7).font(fontFamily);

  y += 18;
  const rowH = 16;
  for (const [i, item] of items.entries()) {
    if (i % 2 === 0) doc.rect(margin, y - 2, tableWidth, rowH).fillColor('#f9fafb').fill();
    doc.fillColor('#374151');
    for (const pos of positions) {
      if (pos.key === '#') {
        doc.text(String(i + 1), pos.x, y, { width: pos.width, align: 'center' });
      } else {
        let val = '';
        switch (pos.key) {
          case 'sku': val = item.sku || ''; break;
          case 'itemCode': val = item.item_code || ''; break;
          case 'hsn': val = item.hsn_code || '—'; break;
          case 'description': val = item.description || ''; break;
          case 'unit': val = item.unit || ''; break;
          case 'quantity': val = item.quantity != null ? item.quantity.toString() : ''; break;
          case 'rate': val = `Rs.${(item.unit_price / 100).toFixed(2)}`; break;
          case 'discount': val = item.discount ? `Rs.${(item.discount / 100).toFixed(2)}` : '—'; break;
          case 'gst': val = item.cgst_rate ? `${parseFloat(item.cgst_rate) + parseFloat(item.sgst_rate || 0)}%` : '—'; break;
          case 'total': val = `Rs.${(item.total_price / 100).toFixed(2)}`; break;
        }
        doc.text(val, pos.x, y, { width: pos.width, align: pos.align === 'right' ? 'right' : (pos.align === 'center' ? 'center' : 'left') });
      }
    }
    y += rowH;
  }

  doc.moveTo(margin, y).lineTo(margin + tableWidth, y).strokeColor('#d1d5db').stroke();
  y += 8;

  const showDiscountTotal = s.showDiscountTotal !== false;
  const showGstBreakdown = s.showGstBreakdown !== false;
  const showRoundOff = s.showRoundOff !== false;
  const showAmountInWords = s.showAmountInWords !== false;

  const labelX = margin + tableWidth - 200;
  const valueX = margin + tableWidth - 70;

  doc.font(fontBold).fontSize(baseFontSize);
  doc.fillColor('#374151');

  doc.text(lbl('subtotal', 'Subtotal') + ':', labelX, y, { width: 130, align: 'right' });
  doc.text(`Rs.${(inv.subtotal / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
  y += 14;

  if (showDiscountTotal && inv.discount_total) {
    doc.text(lbl('discountTotal', 'Discount') + ':', labelX, y, { width: 130, align: 'right' });
    doc.text(`-Rs.${(inv.discount_total / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
    y += 14;
  }

  if (showGstBreakdown) {
    if (hasGst && inv.gst_type === 'intra') {
      const gstAmt = taxSplit.totalCGST + taxSplit.totalSGST;
      const gstRate = gstAmt > 0 ? (gstAmt / inv.subtotal * 100).toFixed(1) : invTaxRate;
      doc.text(`GST @ ${gstRate}%:`, labelX, y, { width: 130, align: 'right' });
      doc.text(`Rs.${(gstAmt / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    } else if (hasGst && inv.gst_type === 'inter') {
      doc.text(`IGST @ ${taxSplit.totalIGST > 0 ? (taxSplit.totalIGST / inv.subtotal * 100).toFixed(1) : invTaxRate}%:`, labelX, y, { width: 130, align: 'right' });
      doc.text(`Rs.${(taxSplit.totalIGST / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    } else {
      doc.text(`${lbl('tax', 'Tax')} (${invTaxRate}%):`, labelX, y, { width: 130, align: 'right' });
      doc.text(`Rs.${(inv.tax_amount / 100).toFixed(2)}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    }
  }

  if (showRoundOff) {
    const total = (inv.total_amount || 0) / 100;
    const rounded = Math.round(total);
    const diff = (rounded - total).toFixed(2);
    if (parseFloat(diff) !== 0) {
      doc.text(lbl('roundOff', 'Round Off') + ':', labelX, y, { width: 130, align: 'right' });
      doc.text(`${parseFloat(diff) > 0 ? '+' : ''}${diff}`, valueX, y, { width: 70, align: 'right' });
      y += 14;
    }
  }

  doc.rect(margin, y - 2, tableWidth, 22).fillColor(primaryColor).fill();
  doc.fillColor('#fff').font(fontBold).fontSize(baseFontSize + 2);
  doc.text(lbl('grandTotal', 'Grand Total') + ':', labelX, y + 2, { width: 130, align: 'right' });
  doc.text(`Rs.${(inv.total_amount / 100).toFixed(2)}`, valueX, y + 2, { width: 70, align: 'right' });
  y += 28;
  doc.fillColor('#374151');

  if (showAmountInWords) {
    const totalAmt = (inv.total_amount / 100);
    const words = numberToIndianWords(totalAmt);
    if (words) {
      doc.fontSize(baseFontSize).font(fontFamily).fillColor('#374151');
      doc.text(lbl('amountInWords', 'Amount in Words') + ':', margin, y);
      y = doc.y + 2;
      doc.font(fontBold);
      doc.text(`Rupees ${words} Only`, margin, y, { width: tableWidth });
      doc.moveDown(1);
    }
  }

  if (s.showTerms !== false && inv.notes) {
    doc.fontSize(baseFontSize).font(fontBold).fillColor(primaryColor);
    doc.text(lbl('notes', 'Notes') + ':', margin, doc.y + 4);
    doc.font(fontFamily).fontSize(baseFontSize).fillColor('#374151');
    doc.text(inv.notes, margin, doc.y + 4, { width: tableWidth });
  }

  if (s.showSignature !== false) {
    const sigY = Math.max(doc.y + 20, 680);
    doc.moveTo(margin + tableWidth - 130, sigY).lineTo(margin + tableWidth, sigY).strokeColor('#9ca3af').stroke();
    doc.fontSize(baseFontSize - 1).fillColor('#6b7280').text(lbl('authorizedSignatory', 'Authorized Signatory'), margin + tableWidth - 130, sigY + 4, { width: 130, align: 'center' });
  }

  if (inv.signed_qr_code) {
    const qrImage = inv.signed_qr_code.replace(/^data:image\/png;base64,/, '');
    try {
      doc.image(Buffer.from(qrImage, 'base64'), margin, doc.y + 10, { width: 100, height: 100 });
      doc.fontSize(6).font(fontFamily).text('IRN: ' + (inv.irn || ''), margin, doc.y + 2, { width: 150, align: 'center' });
    } catch (e) { /* QR rendering failed silently */ }
  }
}

function numberToIndianWords(amount) {
  if (amount == null || isNaN(amount)) return '';
  const num = Math.round(amount * 100) / 100;
  if (num === 0) return 'Zero';

  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function toWords(n) {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + units[n % 10] : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
    return '';
  }

  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  let result = '';
  if (rupees > 0) {
    const crores = Math.floor(rupees / 10000000);
    const lakhs = Math.floor((rupees % 10000000) / 100000);
    const thousands = Math.floor((rupees % 100000) / 1000);
    const hundreds = rupees % 1000;

    if (crores > 0) result += toWords(crores) + ' Crore ';
    if (lakhs > 0) result += toWords(lakhs) + ' Lakh ';
    if (thousands > 0) result += toWords(thousands) + ' Thousand ';
    if (hundreds > 0) result += toWords(hundreds) + ' ';
  }

  result = result.trim();

  if (paise > 0) {
    result += ' and ' + toWords(paise) + ' Paise';
  }

  return result;
}

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
    const templateConfig = await resolveInvoiceSettings(req.tenantId, 'invoice');
    res.json({
      ...inv,
      items,
      payments: payments || [],
      amountPaid,
      balanceDue: Math.max(0, totalAmount - amountPaid),
      templateConfig,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch invoice.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { customer_id, invoice_date, due_date, items, notes, gst_type, place_of_supply } = req.body;

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
    const invId = uuidv4();

    await db.query(
      `INSERT INTO invoices (id, tenant_id, invoice_number, customer_id, invoice_date, due_date, status, subtotal, tax_amount, total_amount, notes, gst_type, place_of_supply)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`,
      [invId, tenantId, invNumber, customer_id, invoice_date, due_date, subtotal, totalTaxAmount, totalAmount, notes || null, gst_type || null, place_of_supply || null]
    );

    for (const item of lineItems) {
      await db.query(
        `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), invId, item.description, item.quantity, item.unit_price, item.total_price, item.hsn_code, item.cgst_rate, item.sgst_rate, item.igst_rate]
      );
    }

    res.status(201).json({ message: 'Invoice created.', id: invId, invoice_number: invNumber });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'invoice.created', entityType: 'invoice', entityId: invId, req });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const invId = req.params.id;
  const { customer_id, invoice_date, due_date, status, items, notes, gst_type, place_of_supply } = req.body;

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const s = typeof tenantRows[0]?.settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0]?.settings || {});
    const taxRate = (s.taxRate || 18) / 100;

    const [existing] = await db.query('SELECT id FROM invoices WHERE id = ? AND tenant_id = ?', [invId, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Invoice not found.' });

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
        `UPDATE invoices SET customer_id=?, invoice_date=?, due_date=?, status=?, subtotal=?, tax_amount=?, total_amount=?, notes=?, gst_type=?, place_of_supply=?
         WHERE id=? AND tenant_id=?`,
        [customer_id, invoice_date, due_date, status || 'draft', subtotal, totalTaxAmount, totalAmount, notes || null, gst_type || null, place_of_supply || null, invId, tenantId]
      );

      await db.query('DELETE FROM invoice_items WHERE invoice_id = ?', [invId]);
      for (const item of lineItems) {
        await db.query(
          `INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total_price, hsn_code, cgst_rate, sgst_rate, igst_rate)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), invId, item.description, item.quantity, item.unit_price, item.total_price, item.hsn_code, item.cgst_rate, item.sgst_rate, item.igst_rate]
        );
      }
    } else {
      await db.query(
        `UPDATE invoices SET customer_id=?, invoice_date=?, due_date=?, status=?, notes=?, gst_type=?, place_of_supply=? WHERE id=? AND tenant_id=?`,
        [customer_id, invoice_date, due_date, status || 'draft', notes || null, gst_type || null, place_of_supply || null, invId, tenantId]
      );
    }

    res.json({ message: 'Invoice updated.' });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'invoice.updated', entityType: 'invoice', entityId: invId, req });
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

    // Auto stock-out when invoice is sent or paid
    if (status === 'sent' || status === 'paid') {
      stockCtrl.stockOutFromInvoice(req.tenantId, req.params.id, req.user?.id || null).catch(err => {
        console.error('stockOutFromInvoice error:', err);
      });
    }

    res.json({ message: `Status updated to ${status}.` });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: `invoice.status_${status}`, entityType: 'invoice', entityId: req.params.id, changes: { status }, req });
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
    const [items] = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id', [req.params.id]
    );

    const invoiceSettings = await resolveInvoiceSettings(req.tenantId, 'invoice');
    const invTaxRate = invoiceSettings.taxRate || 18;

    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${inv.invoice_number}.pdf`);
    doc.pipe(res);

    generateInvoicePDF(doc, inv, items, invTaxRate, invoiceSettings);

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
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'invoice.deleted', entityType: 'invoice', entityId: req.params.id, req });
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
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'invoice.bulk_delete', entityType: 'invoice', changes: { ids, count: result.affectedRows }, req });
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
       FROM hris_saas.invoices i
       JOIN hris_saas.customers c ON i.customer_id = c.id
       JOIN hris_saas.tenants t ON i.tenant_id = t.id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (invs.length === 0) return res.status(404).json({ error: 'Invoice not found.' });
    const inv = invs[0];

    if (!inv.customer_email) {
      return res.status(400).json({ error: 'Customer has no email address.' });
    }

    const [items] = await db.query(
      'SELECT * FROM hris_saas.invoice_items WHERE invoice_id = $1 ORDER BY id', [req.params.id]
    );

    const invoiceSettings = await resolveInvoiceSettings(req.tenantId, 'invoice');
    const invTaxRate = invoiceSettings.taxRate || 18;

    const chunks = [];
    const doc = new PDFDocument({ margin: 50, bufferPages: true });
    doc.on('data', c => chunks.push(c));
    await new Promise(resolve => {
      doc.on('end', resolve);
      generateInvoicePDF(doc, inv, items, invTaxRate, invoiceSettings);
      doc.end();
    });

    const pdfBuffer = Buffer.concat(chunks);

    let paymentLinkHtml = '';
    if (inv.payment_link_url && inv.payment_link_status !== 'cancelled') {
      paymentLinkHtml = `
        <div style="text-align:center;margin:24px 0;">
          <a href="${inv.payment_link_url}"
             style="background:#2FBF71;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;display:inline-block;">
            Pay Now — Rs.${(inv.total_amount / 100).toFixed(2)}
          </a>
        </div>`;
    }

    const result = await sendEmail({
      to: inv.customer_email,
      subject: `Invoice ${inv.invoice_number} from ${inv.company_name}`,
      html: `
        <p>Dear ${inv.customer_name},</p>
        <p>Please find attached invoice <strong>${inv.invoice_number}</strong> from ${inv.company_name}.</p>
        <p>Amount: <strong>Rs.${(inv.total_amount / 100).toFixed(2)}</strong></p>
        <p>Due Date: ${fmtDate(inv.due_date) || 'N/A'}</p>
        ${paymentLinkHtml}
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
