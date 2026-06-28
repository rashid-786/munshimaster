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

exports.getReportData = async (req, res) => {
  const tenantId = req.tenantId;
  const { type, startDate, endDate, search, sortBy, sortOrder, paymentMethod, entryType, partyType } = req.query;

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
  const { type, startDate, endDate, search, sortBy, sortOrder, paymentMethod, entryType, partyType } = req.query;

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
  const { type, startDate, endDate, search, sortBy, sortOrder, paymentMethod, entryType, partyType } = req.query;

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

    for (const row of data) {
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
// Profit & Loss Statement
// =============================================
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
