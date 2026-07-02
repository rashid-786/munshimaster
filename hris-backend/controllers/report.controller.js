const db = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

async function fetchCustomers(tenantId, { startDate, endDate, search, sortBy, sortOrder }) {
  let query = 'SELECT id, name, email, phone, address, gstin, created_at FROM customers WHERE tenant_id = ?';
  const params = [tenantId];

  if (search) { query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (startDate) { query += ' AND created_at >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59'); }

  const allowedSort = { name: 'name', email: 'email', created_at: 'created_at' };
  const col = allowedSort[sortBy] || 'created_at';
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${col} ${dir}`;

  const [rows] = await db.execute(query, params);
  return rows;
}

async function fetchSuppliers(tenantId, { startDate, endDate, search, sortBy, sortOrder }) {
  let query = 'SELECT id, name, email, phone, address, gstin, created_at FROM suppliers WHERE tenant_id = ?';
  const params = [tenantId];

  if (search) { query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (startDate) { query += ' AND created_at >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND created_at <= ?'; params.push(endDate + ' 23:59:59'); }

  const allowedSort = { name: 'name', email: 'email', created_at: 'created_at' };
  const col = allowedSort[sortBy] || 'created_at';
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${col} ${dir}`;

  const [rows] = await db.execute(query, params);
  return rows;
}

async function fetchBalance(tenantId, { startDate, endDate, type, paymentMethod, sortBy, sortOrder }) {
  let query = `SELECT bs.*, e.first_name, e.last_name
               FROM balance_sheet bs
               LEFT JOIN employees e ON bs.created_by = e.id
               WHERE bs.tenant_id = ?`;
  const params = [tenantId];

  if (startDate) { query += ' AND bs.entry_date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND bs.entry_date <= ?'; params.push(endDate); }
  if (type) { query += ' AND bs.type = ?'; params.push(type); }
  if (paymentMethod) { query += ' AND bs.payment_method = ?'; params.push(paymentMethod); }

  const allowedSort = { entry_date: 'bs.entry_date', amount: 'bs.amount', type: 'bs.type', payment_method: 'bs.payment_method' };
  const col = allowedSort[sortBy] || 'bs.entry_date';
  const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY ${col} ${dir}`;

  const [rows] = await db.execute(query, params);
  return rows;
}

async function fetchKiranaParties(tenantId, { partyType } = {}) {
  let query = 'SELECT id, type, name, phone FROM kirana_parties WHERE tenant_id = ?';
  const params = [tenantId];
  if (partyType) { query += ' AND type = ?'; params.push(partyType); }
  query += ' ORDER BY name';
  const [parties] = await db.execute(query, params);
  const result = [];
  for (const p of parties) {
    const [txns] = await db.execute(
      "SELECT COALESCE(SUM(CASE WHEN type='received' THEN amount ELSE 0 END),0) as r, COALESCE(SUM(CASE WHEN type='given' THEN amount ELSE 0 END),0) as g FROM kirana_transactions WHERE party_id=?",
      [p.id]
    );
    result.push({ ...p, totalReceived: txns[0].r, totalGiven: txns[0].g, balance: txns[0].r - txns[0].g });
  }
  return result;
}

async function fetchKiranaCashbook(tenantId, { startDate, endDate }) {
  let query = 'SELECT * FROM kirana_cashbook WHERE tenant_id = ?';
  const params = [tenantId];
  if (startDate) { query += ' AND entry_date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND entry_date <= ?'; params.push(endDate); }
  query += ' ORDER BY entry_date DESC';
  const [rows] = await db.execute(query, params);
  return rows;
}

// =============================================
// Sales by Customer
// =============================================
async function fetchSalesByCustomer(tenantId, { startDate, endDate }) {
  let query = `SELECT c.id, c.name, c.email, c.phone,
                      COUNT(i.id) as invoice_count,
                      COALESCE(SUM(i.total_amount),0) as total_sales,
                      COALESCE(SUM(i.amount_paid),0) as total_collected,
                      COALESCE(SUM(i.total_amount - i.amount_paid),0) as balance_due
               FROM customers c
               JOIN invoices i ON c.id = i.customer_id AND i.tenant_id = c.tenant_id
               WHERE c.tenant_id = ?`;
  const params = [tenantId];
  if (startDate) { query += ' AND i.invoice_date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND i.invoice_date <= ?'; params.push(endDate); }
  query += ' GROUP BY c.id, c.name, c.email, c.phone ORDER BY total_sales DESC';
  const [rows] = await db.execute(query, params);
  return rows;
}

// =============================================
// Purchases by Supplier
// =============================================
async function fetchPurchasesBySupplier(tenantId, { startDate, endDate }) {
  let query = `SELECT s.id, s.name, s.email, s.phone,
                      COUNT(po.id) as order_count,
                      COALESCE(SUM(po.total_amount),0) as total_purchases
               FROM suppliers s
               JOIN purchase_orders po ON s.id = po.supplier_id AND po.tenant_id = s.tenant_id
               WHERE s.tenant_id = ?`;
  const params = [tenantId];
  if (startDate) { query += ' AND po.order_date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND po.order_date <= ?'; params.push(endDate); }
  query += ' GROUP BY s.id, s.name, s.email, s.phone ORDER BY total_purchases DESC';
  const [rows] = await db.execute(query, params);
  return rows;
}

// =============================================
// AR Aging (outstanding invoices)
// =============================================
async function fetchARAging(tenantId, { asOnDate }) {
  const asOn = asOnDate || new Date().toISOString().split('T')[0];
  const [rows] = await db.execute(
    `SELECT id, invoice_number, customer_id,
            (SELECT name FROM customers WHERE id = i.customer_id AND tenant_id = i.tenant_id) as customer_name,
            invoice_date, due_date, total_amount, amount_paid,
            (total_amount - amount_paid) as outstanding,
            (?::date - due_date) as days_overdue
     FROM invoices i
     WHERE i.tenant_id = ? AND i.status IN ('sent','partial','overdue') AND i.due_date < ?
     ORDER BY days_overdue DESC`,
    [asOn, tenantId, asOn]
  );
  const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
  let totalOutstanding = 0;
  rows.forEach(r => {
    const d = Number(r.days_overdue);
    const bucket = d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
    buckets[bucket].push(r);
    totalOutstanding += Number(r.outstanding);
  });
  return { buckets, totalOutstanding, asOnDate: asOn };
}

// =============================================
// AP Aging (outstanding POs / amounts owed to suppliers)
// =============================================
async function fetchAPAging(tenantId, { asOnDate }) {
  const asOn = asOnDate || new Date().toISOString().split('T')[0];
  // Outstanding POs that are approved/sent (received but not fully paid)
  const [poRows] = await db.execute(
    `SELECT po.id, po.po_number as order_number, po.supplier_id,
            (SELECT name FROM suppliers WHERE id = po.supplier_id AND tenant_id = po.tenant_id) as supplier_name,
            po.order_date, po.expected_date, po.total_amount,
            (?::date - COALESCE(po.expected_date, po.order_date)) as days_overdue
     FROM purchase_orders po
     WHERE po.tenant_id = ? AND po.status IN ('approved','sent','received')
       AND COALESCE(po.expected_date, po.order_date) < ?
     ORDER BY days_overdue DESC`,
    [asOn, tenantId, asOn]
  );
  const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
  let totalOutstanding = 0;
  poRows.forEach(r => {
    const d = Number(r.days_overdue);
    const bucket = d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
    buckets[bucket].push(r);
    totalOutstanding += Number(r.total_amount);
  });
  return { buckets, totalOutstanding, asOnDate: asOn };
}

// =============================================
// Invoice Status Summary
// =============================================
async function fetchInvoiceStatusSummary(tenantId, { startDate, endDate }) {
  let query = `SELECT status, COUNT(*) as count, COALESCE(SUM(total_amount),0) as total_amount
               FROM invoices WHERE tenant_id = ?`;
  const params = [tenantId];
  if (startDate) { query += ' AND invoice_date >= ?'; params.push(startDate); }
  if (endDate) { query += ' AND invoice_date <= ?'; params.push(endDate); }
  query += ' GROUP BY status ORDER BY status';
  const [rows] = await db.execute(query, params);
  const totalCount = rows.reduce((s, r) => s + Number(r.count), 0);
  const totalAmount = rows.reduce((s, r) => s + Number(r.total_amount), 0);
  return { rows, totalCount, totalAmount };
}

// =============================================
// Main dispatcher
// =============================================
exports.getReportData = async (req, res) => {
  const tenantId = req.tenantId;
  const { type, startDate, endDate, search, sortBy, sortOrder, paymentMethod, entryType, partyType, asOnDate } = req.query;

  try {
    let data;
    switch (type) {
      case 'customers':
        data = await fetchCustomers(tenantId, { startDate, endDate, search, sortBy, sortOrder });
        break;
      case 'suppliers':
        data = await fetchSuppliers(tenantId, { startDate, endDate, search, sortBy, sortOrder });
        break;
      case 'balance':
        data = await fetchBalance(tenantId, { startDate, endDate, type: entryType, paymentMethod, sortBy, sortOrder });
        break;
      case 'kirana_party':
        data = await fetchKiranaParties(tenantId, { partyType });
        break;
      case 'kirana_cashbook':
        data = await fetchKiranaCashbook(tenantId, { startDate, endDate });
        break;
      case 'sales_by_customer':
        data = await fetchSalesByCustomer(tenantId, { startDate, endDate });
        break;
      case 'purchases_by_supplier':
        data = await fetchPurchasesBySupplier(tenantId, { startDate, endDate });
        break;
      case 'ar_aging':
        data = await fetchARAging(tenantId, { asOnDate });
        break;
      case 'ap_aging':
        data = await fetchAPAging(tenantId, { asOnDate });
        break;
      case 'invoice_status_summary':
        data = await fetchInvoiceStatusSummary(tenantId, { startDate, endDate });
        break;
      case 'gst_summary':
        data = await fetchGSTSummary(tenantId, { startDate, endDate });
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type.' });
    }
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate report.' });
  }
};

exports.downloadPDF = async (req, res) => {
  const tenantId = req.tenantId;
  const { type, startDate, endDate, search, sortBy, sortOrder, paymentMethod, entryType, partyType, asOnDate } = req.query;

  try {
    const [tenantRow] = await db.execute('SELECT company_name FROM tenants WHERE id = ?', [tenantId]);
    const companyName = tenantRow[0]?.company_name || 'Company';

    let data, title;
    switch (type) {
      case 'customers':
        data = await fetchCustomers(tenantId, { startDate, endDate, search, sortBy, sortOrder });
        title = 'Customers Report';
        break;
      case 'suppliers':
        data = await fetchSuppliers(tenantId, { startDate, endDate, search, sortBy, sortOrder });
        title = 'Suppliers Report';
        break;
      case 'balance':
        data = await fetchBalance(tenantId, { startDate, endDate, type: entryType, paymentMethod, sortBy, sortOrder });
        title = 'Balance Sheet Report';
        break;
      case 'kirana_party':
        data = await fetchKiranaParties(tenantId, { partyType });
        title = 'Kirana Parties Report';
        break;
      case 'kirana_cashbook':
        data = await fetchKiranaCashbook(tenantId, { startDate, endDate });
        title = 'Kirana Cashbook Report';
        break;
      case 'sales_by_customer':
        data = await fetchSalesByCustomer(tenantId, { startDate, endDate });
        title = 'Sales by Customer';
        break;
      case 'purchases_by_supplier':
        data = await fetchPurchasesBySupplier(tenantId, { startDate, endDate });
        title = 'Purchases by Supplier';
        break;
      case 'ar_aging':
        data = await fetchARAging(tenantId, { asOnDate });
        title = 'AR Aging Report';
        break;
      case 'ap_aging':
        data = await fetchAPAging(tenantId, { asOnDate });
        title = 'AP Aging Report';
        break;
      case 'invoice_status_summary':
        data = await fetchInvoiceStatusSummary(tenantId, { startDate, endDate });
        title = 'Invoice Status Summary';
        break;
      case 'gst_summary':
        data = await fetchGSTSummary(tenantId, { startDate, endDate });
        title = 'GST Tax Summary';
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type.' });
    }

    const doc = new PDFDocument({ margin: 50, layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_report.pdf`);
    doc.pipe(res);

    doc.fontSize(18).text(companyName.toUpperCase(), { align: 'center' });
    doc.fontSize(12).text(title, { align: 'center' }).moveDown(1);
    if (startDate || endDate) {
      doc.fontSize(9).text(`Period: ${startDate || '...'} to ${endDate || '...'}`, { align: 'center' }).moveDown(1);
    }
    doc.moveDown(0.5);

    if (data.length === 0) {
      doc.fontSize(11).text('No data found.', { align: 'center' });
    } else {
      const columns = Object.keys(data[0]).filter(k => !['id', 'tenant_id', 'employee_id', 'created_by'].includes(k));
      const headers = columns.map(c => c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

      const tableTop = doc.y;
      const cellPadding = 4;
      const fontSize = 8;
      doc.fontSize(fontSize);

      const colWidths = columns.map(c => {
        const maxData = Math.max(...data.map(r => String(r[c] || '').length), headers[columns.indexOf(c)].length);
        return Math.min(Math.max(maxData * 6, 60), 180);
      });

      const drawTable = (startY) => {
        let y = startY;
        headers.forEach((h, i) => {
          doc.rect(50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, colWidths[i], 16).fill('#2563eb');
          doc.fill('#fff').text(h, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + cellPadding, y + cellPadding, { width: colWidths[i] - cellPadding * 2, align: 'left' });
        });
        doc.fill('#000');
        y += 16;

        for (const row of data) {
          if (y > 550) {
            doc.addPage();
            y = 50;
            headers.forEach((h, i) => {
              doc.rect(50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, colWidths[i], 16).fill('#2563eb');
              doc.fill('#fff').text(h, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + cellPadding, y + cellPadding, { width: colWidths[i] - cellPadding * 2, align: 'left' });
            });
            doc.fill('#000');
            y += 16;
          }

          let maxLines = 1;
          columns.forEach((c, i) => {
            const val = String(row[c] || '');
            const lines = Math.ceil(doc.fontSize(fontSize).widthOfString(val) / (colWidths[i] - cellPadding * 2)) || 1;
            maxLines = Math.max(maxLines, lines);
          });
          const rowHeight = Math.max(16, maxLines * 10 + cellPadding * 2);

          if (y + rowHeight > 550) {
            doc.addPage();
            y = 50;
            headers.forEach((h, i) => {
              doc.rect(50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, colWidths[i], 16).fill('#2563eb');
              doc.fill('#fff').text(h, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + cellPadding, y + cellPadding, { width: colWidths[i] - cellPadding * 2, align: 'left' });
            });
            doc.fill('#000');
            y += 16;
          }

          columns.forEach((c, i) => {
            const val = type === 'balance' && c === 'amount' ? `Rs.${(row[c] / 100).toFixed(2)}` : String(row[c] || '-');
            doc.text(val, 50 + colWidths.slice(0, i).reduce((a, b) => a + b, 0) + cellPadding, y + cellPadding, { width: colWidths[i] - cellPadding * 2, align: 'left' });
          });
          y += rowHeight;
        }
      };

      drawTable(tableTop);
    }

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF.' });
  }
};

exports.downloadExcel = async (req, res) => {
  const tenantId = req.tenantId;
  const { type, startDate, endDate, search, sortBy, sortOrder, paymentMethod, entryType, partyType, asOnDate } = req.query;

  try {
    const [tenantRow] = await db.execute('SELECT company_name FROM tenants WHERE id = ?', [tenantId]);
    const companyName = tenantRow[0]?.company_name || 'Company';

    let data, title, columns;
    switch (type) {
      case 'customers':
        data = await fetchCustomers(tenantId, { startDate, endDate, search, sortBy, sortOrder });
        title = 'Customers Report';
        columns = ['Name', 'Email', 'Phone', 'Address', 'GST', 'Created At'];
        break;
      case 'suppliers':
        data = await fetchSuppliers(tenantId, { startDate, endDate, search, sortBy, sortOrder });
        title = 'Suppliers Report';
        columns = ['Name', 'Email', 'Phone', 'Address', 'GST', 'Created At'];
        break;
      case 'balance':
        data = await fetchBalance(tenantId, { startDate, endDate, type: entryType, paymentMethod, sortBy, sortOrder });
        title = 'Balance Sheet Report';
        columns = ['Date', 'Type', 'Payment Method', 'Amount', 'Description', 'Added By'];
        break;
      case 'kirana_party':
        data = await fetchKiranaParties(tenantId, { partyType });
        title = 'Kirana Parties Report';
        columns = ['Type', 'Name', 'Phone', 'Total Received', 'Total Given', 'Balance'];
        break;
      case 'kirana_cashbook':
        data = await fetchKiranaCashbook(tenantId, { startDate, endDate });
        title = 'Kirana Cashbook Report';
        columns = ['Date', 'Type', 'Category', 'Amount', 'Note'];
        break;
      case 'sales_by_customer':
        data = await fetchSalesByCustomer(tenantId, { startDate, endDate });
        title = 'Sales by Customer';
        columns = ['Customer', 'Email', 'Phone', 'Invoice Count', 'Total Sales', 'Total Collected', 'Balance Due'];
        break;
      case 'purchases_by_supplier':
        data = await fetchPurchasesBySupplier(tenantId, { startDate, endDate });
        title = 'Purchases by Supplier';
        columns = ['Supplier', 'Email', 'Phone', 'Order Count', 'Total Purchases'];
        break;
      case 'ar_aging':
        data = await fetchARAging(tenantId, { asOnDate });
        title = 'AR Aging Report';
        columns = ['Invoice #', 'Customer', 'Invoice Date', 'Due Date', 'Total', 'Paid', 'Outstanding', 'Days Overdue', 'Bucket'];
        break;
      case 'ap_aging':
        data = await fetchAPAging(tenantId, { asOnDate });
        title = 'AP Aging Report';
        columns = ['Order #', 'Supplier', 'Order Date', 'Expected Date', 'Total', 'Days Overdue', 'Bucket'];
        break;
      case 'invoice_status_summary':
        data = await fetchInvoiceStatusSummary(tenantId, { startDate, endDate });
        title = 'Invoice Status Summary';
        columns = ['Status', 'Count', 'Total Amount'];
        break;
      case 'gst_summary':
        data = await fetchGSTSummary(tenantId, { startDate, endDate });
        title = 'GST Tax Summary';
        columns = ['Period', 'Output CGST', 'Output SGST', 'Output IGST', 'Total Output Tax', 'Input CGST', 'Input SGST', 'Input IGST', 'Total Input Tax', 'Net Payable'];
        break;
      default:
        return res.status(400).json({ error: 'Invalid report type.' });
    }

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
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Flatten data for Excel rows (handle non-array data types)
    let excelRows = data;
    if (type === 'ar_aging') {
      excelRows = [];
      Object.entries(data.buckets || {}).forEach(([bucket, items]) => {
        items.forEach(inv => {
          excelRows.push([
            inv.invoice_number || '-',
            inv.customer_name || '-',
            inv.invoice_date ? inv.invoice_date.split('T')[0] : '-',
            inv.due_date ? inv.due_date.split('T')[0] : '-',
            `Rs.${Number(inv.total_amount).toFixed(2)}`,
            `Rs.${Number(inv.amount_paid).toFixed(2)}`,
            `Rs.${Number(inv.outstanding).toFixed(2)}`,
            String(inv.days_overdue || 0),
            bucket,
          ]);
        });
      });
    } else if (type === 'ap_aging') {
      excelRows = [];
      Object.entries(data.buckets || {}).forEach(([bucket, items]) => {
        items.forEach(po => {
          excelRows.push([
            po.order_number || '-',
            po.supplier_name || '-',
            po.order_date ? po.order_date.split('T')[0] : '-',
            po.expected_date ? po.expected_date.split('T')[0] : '-',
            `Rs.${Number(po.total_amount).toFixed(2)}`,
            String(po.days_overdue || 0),
            bucket,
          ]);
        });
      });
    } else if (type === 'invoice_status_summary') {
      excelRows = (data.rows || []).map(r => [
        r.status || '-',
        String(r.count || 0),
        `Rs.${Number(r.total_amount).toFixed(2)}`,
      ]);
    } else if (type === 'gst_summary') {
      const d = data;
      excelRows = [[
        `${d.period?.startDate || ''} — ${d.period?.endDate || ''}`,
        `Rs.${(d.outputTax?.cgst || 0).toFixed(2)}`,
        `Rs.${(d.outputTax?.sgst || 0).toFixed(2)}`,
        `Rs.${(d.outputTax?.igst || 0).toFixed(2)}`,
        `Rs.${(d.outputTax?.totalOutput || 0).toFixed(2)}`,
        `Rs.${(d.inputTax?.cgst || 0).toFixed(2)}`,
        `Rs.${(d.inputTax?.sgst || 0).toFixed(2)}`,
        `Rs.${(d.inputTax?.igst || 0).toFixed(2)}`,
        `Rs.${(d.inputTax?.totalInput || 0).toFixed(2)}`,
        `Rs.${(d.netPayable || 0).toFixed(2)}`,
      ]];
    }

    for (const row of excelRows) {
      let values;
      if (type === 'balance') {
        values = [
          row.entry_date ? row.entry_date.split('T')[0] : '-',
          row.type,
          row.payment_method,
          row.amount ? `Rs.${(row.amount / 100).toFixed(2)}` : '0',
          row.description || '-',
          `${row.first_name || ''} ${row.last_name || ''}`.trim() || '-',
        ];
      } else if (type === 'kirana_party') {
        const bal = (row.balance || 0) / 100;
        values = [
          row.type || '-',
          row.name || '-',
          row.phone || '-',
          `Rs.${((row.totalReceived || 0) / 100).toFixed(2)}`,
          `Rs.${((row.totalGiven || 0) / 100).toFixed(2)}`,
          `Rs.${bal.toFixed(2)}`,
        ];
      } else if (type === 'kirana_cashbook') {
        values = [
          row.entry_date ? row.entry_date.split('T')[0] : '-',
          row.type || '-',
          row.category || '-',
          row.amount ? `Rs.${(row.amount / 100).toFixed(2)}` : '0',
          row.note || '-',
        ];
      } else if (type === 'sales_by_customer') {
        values = [
          row.name || '-',
          row.email || '-',
          row.phone || '-',
          String(row.invoice_count || 0),
          `Rs.${Number(row.total_sales).toFixed(2)}`,
          `Rs.${Number(row.total_collected).toFixed(2)}`,
          `Rs.${Number(row.balance_due).toFixed(2)}`,
        ];
      } else if (type === 'purchases_by_supplier') {
        values = [
          row.name || '-',
          row.email || '-',
          row.phone || '-',
          String(row.order_count || 0),
          `Rs.${Number(row.total_purchases).toFixed(2)}`,
        ];
      } else if (['ar_aging', 'ap_aging', 'invoice_status_summary'].includes(type)) {
        values = row;
      } else {
        values = [
          row.name || '-',
          row.email || '-',
          row.phone || '-',
          row.address || '-',
          row.gstin || '-',
          row.created_at ? row.created_at.split('T')[0] : '-',
        ];
      }
      const excelRow = sheet.addRow(values);
      excelRow.eachCell(cell => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    }

    sheet.columns = columns.map((c, i) => ({
      header: c,
      key: c,
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

// =============================================
// GST Tax Summary (input vs output tax)
// =============================================
async function fetchGSTSummary(tenantId, { startDate, endDate }) {
  const sd = startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
  const ed = endDate || new Date().toISOString().split('T')[0];

  // Output tax (sales) — from invoices with item-level rates
  const [outputTax] = await db.execute(
    `SELECT
       COALESCE(SUM(ROUND(ii.total_price * COALESCE(ii.cgst_rate, 0) / 100)), 0) as cgst,
       COALESCE(SUM(ROUND(ii.total_price * COALESCE(ii.sgst_rate, 0) / 100)), 0) as sgst,
       COALESCE(SUM(ROUND(ii.total_price * COALESCE(ii.igst_rate, 0) / 100)), 0) as igst,
       COUNT(DISTINCT i.id) as invoice_count
     FROM invoices i
     JOIN invoice_items ii ON i.id = ii.invoice_id
     WHERE i.tenant_id = ? AND i.status IN ('paid','sent','partial')
       AND i.invoice_date >= ? AND i.invoice_date <= ?`,
    [tenantId, sd, ed]
  );

  // Also get output tax from flat-rate invoices (no cgst/sgst/igst)
  const [flatOutputTax] = await db.execute(
    `SELECT COALESCE(SUM(i.tax_amount), 0) as flat_tax, COUNT(*) as flat_count
     FROM invoices i
     WHERE i.tenant_id = ? AND i.status IN ('paid','sent','partial')
       AND (i.gst_type IS NULL OR i.gst_type NOT IN ('intra','inter'))
       AND i.invoice_date >= ? AND i.invoice_date <= ?`,
    [tenantId, sd, ed]
  );

  // Input tax (purchases) — from POs with item-level rates
  const [inputTax] = await db.execute(
    `SELECT
       COALESCE(SUM(ROUND(pii.total_price * COALESCE(pii.cgst_rate, 0) / 100)), 0) as cgst,
       COALESCE(SUM(ROUND(pii.total_price * COALESCE(pii.sgst_rate, 0) / 100)), 0) as sgst,
       COALESCE(SUM(ROUND(pii.total_price * COALESCE(pii.igst_rate, 0) / 100)), 0) as igst,
       COUNT(DISTINCT po.id) as po_count
     FROM purchase_orders po
     JOIN purchase_order_items pii ON po.id = pii.purchase_order_id
     WHERE po.tenant_id = ? AND po.status IN ('received','approved','sent')
       AND po.order_date >= ? AND po.order_date <= ?`,
    [tenantId, sd, ed]
  );

  const [flatInputTax] = await db.execute(
    `SELECT COALESCE(SUM(po.tax_amount), 0) as flat_tax, COUNT(*) as flat_count
     FROM purchase_orders po
     WHERE po.tenant_id = ? AND po.status IN ('received','approved','sent')
       AND (po.gst_type IS NULL OR po.gst_type NOT IN ('intra','inter'))
       AND po.order_date >= ? AND po.order_date <= ?`,
    [tenantId, sd, ed]
  );

  const output = {
    cgst: Number(outputTax[0].cgst),
    sgst: Number(outputTax[0].sgst),
    igst: Number(outputTax[0].igst),
    totalOutput: Number(outputTax[0].cgst) + Number(outputTax[0].sgst) + Number(outputTax[0].igst) + Number(flatOutputTax[0].flat_tax),
    invoiceCount: Number(outputTax[0].invoice_count) + Number(flatOutputTax[0].flat_count),
  };
  const input = {
    cgst: Number(inputTax[0].cgst),
    sgst: Number(inputTax[0].sgst),
    igst: Number(inputTax[0].igst),
    totalInput: Number(inputTax[0].cgst) + Number(inputTax[0].sgst) + Number(inputTax[0].igst) + Number(flatInputTax[0].flat_tax),
    poCount: Number(inputTax[0].po_count) + Number(flatInputTax[0].flat_count),
  };

  return {
    period: { startDate: sd, endDate: ed },
    outputTax: output,
    inputTax: input,
    netPayable: Math.max(0, output.totalOutput - input.totalInput),
    netRefundable: Math.max(0, input.totalInput - output.totalOutput),
  };
}
exports.getPLStatement = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;

  try {
    const yearStart = new Date();
    yearStart.setMonth(0, 1);
    yearStart.setHours(0, 0, 0, 0);
    const sd = startDate || yearStart.toISOString().split('T')[0];
    const ed = endDate || new Date().toISOString().split('T')[0];

    const dateFilter = ' AND invoice_date >= ? AND invoice_date <= ?';
    const bsDateFilter = ' AND entry_date >= ? AND entry_date <= ?';
    const poDateFilter = ' AND order_date >= ? AND order_date <= ?';
    const dateParams = [sd, ed];

    // Revenue from paid invoices
    const [revenue] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM invoices WHERE tenant_id = ? AND status = 'paid'${dateFilter}`,
      [tenantId, ...dateParams]
    );

    // Other income (balance sheet IN)
    const [otherIncome] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count
       FROM balance_sheet WHERE tenant_id = ? AND type = 'IN'${bsDateFilter}`,
      [tenantId, ...dateParams]
    );

    // Cost of goods sold (received POs)
    const [cogs] = await db.execute(
      `SELECT COALESCE(SUM(total_amount),0) as total, COUNT(*) as count
       FROM purchase_orders WHERE tenant_id = ? AND status = 'received'${poDateFilter}`,
      [tenantId, ...dateParams]
    );

    // Operating expenses (balance sheet OUT)
    const [operatingExpenses] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as count
       FROM balance_sheet WHERE tenant_id = ? AND type = 'OUT'${bsDateFilter}`,
      [tenantId, ...dateParams]
    );

    const totalIncome = Number(revenue[0].total) + Number(otherIncome[0].total);
    const totalExpenses = Number(cogs[0].total) + Number(operatingExpenses[0].total);
    const netProfit = totalIncome - totalExpenses;

    // Monthly breakdown
    const [monthlyIncome] = await db.execute(
      `SELECT DATE_TRUNC('month', invoice_date) as month, SUM(total_amount) as amount
       FROM invoices WHERE tenant_id = ? AND status = 'paid' AND invoice_date >= ? AND invoice_date <= ?
       GROUP BY month ORDER BY month`,
      [tenantId, sd, ed]
    );

    const [monthlyOtherIncome] = await db.execute(
      `SELECT DATE_TRUNC('month', entry_date) as month, SUM(amount) as amount
       FROM balance_sheet WHERE tenant_id = ? AND type = 'IN' AND entry_date >= ? AND entry_date <= ?
       GROUP BY month ORDER BY month`,
      [tenantId, sd, ed]
    );

    const [monthlyCOGS] = await db.execute(
      `SELECT DATE_TRUNC('month', order_date) as month, SUM(total_amount) as amount
       FROM purchase_orders WHERE tenant_id = ? AND status = 'received' AND order_date >= ? AND order_date <= ?
       GROUP BY month ORDER BY month`,
      [tenantId, sd, ed]
    );

    const [monthlyOpExpenses] = await db.execute(
      `SELECT DATE_TRUNC('month', entry_date) as month, SUM(amount) as amount
       FROM balance_sheet WHERE tenant_id = ? AND type = 'OUT' AND entry_date >= ? AND entry_date <= ?
       GROUP BY month ORDER BY month`,
      [tenantId, sd, ed]
    );

    // Merge monthly data into a single array
    const monthMap = {};
    const addToMap = (rows, key) => {
      rows.forEach(r => {
        const m = r.month ? new Date(r.month).toISOString().slice(0, 7) : null;
        if (!m) return;
        if (!monthMap[m]) monthMap[m] = { month: m, invoiceRevenue: 0, otherIncome: 0, cogs: 0, operatingExpenses: 0 };
        monthMap[m][key] = Number(r.amount);
      });
    };
    addToMap(monthlyIncome, 'invoiceRevenue');
    addToMap(monthlyOtherIncome, 'otherIncome');
    addToMap(monthlyCOGS, 'cogs');
    addToMap(monthlyOpExpenses, 'operatingExpenses');

    const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      period: { startDate: sd, endDate: ed },
      summary: {
        revenue: Number(revenue[0].total),
        revenueCount: Number(revenue[0].count),
        otherIncome: Number(otherIncome[0].total),
        otherIncomeCount: Number(otherIncome[0].count),
        totalIncome,
        cogs: Number(cogs[0].total),
        cogsCount: Number(cogs[0].count),
        operatingExpenses: Number(operatingExpenses[0].total),
        operatingExpensesCount: Number(operatingExpenses[0].count),
        totalExpenses,
        netProfit,
      },
      monthly,
    });
  } catch (error) {
    console.error('getPLStatement error:', error);
    res.status(500).json({ error: 'Failed to generate P&L statement.' });
  }
};
