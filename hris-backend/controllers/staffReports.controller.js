const db = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

function buildDateFilter(prefix, startDate, endDate) {
  const p = prefix ? `${prefix}.` : '';
  const clauses = [];
  const params = [];
  if (startDate) { clauses.push(`${p}date >= ?`); params.push(startDate); }
  if (endDate) { clauses.push(`${p}date <= ?`); params.push(endDate); }
  return { clause: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params };
}

exports.getSummary = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  try {
    const [empCount] = await db.execute('SELECT COUNT(*) as c FROM employees WHERE tenant_id = ? AND status = ?', [tenantId, 'active']);
    const totalEmployees = empCount[0].c;

    let payrollQ = 'SELECT COALESCE(SUM(net_salary), 0) as total_net, COALESCE(SUM(total_hours_worked), 0) as total_hours FROM payroll WHERE tenant_id = ?';
    const payrollP = [tenantId];
    if (startDate) { payrollQ += ' AND pay_period_end >= ?'; payrollP.push(startDate); }
    if (endDate) { payrollQ += ' AND pay_period_end <= ?'; payrollP.push(endDate); }
    const [payrollStats] = await db.execute(payrollQ, payrollP);
    const totalHoursWorked = parseFloat(payrollStats[0].total_hours) || 0;

    let paidQ = 'SELECT COALESCE(SUM(net_salary), 0) as total FROM payroll WHERE tenant_id = ? AND status = ?';
    const paidP = [tenantId, 'paid'];
    if (startDate) { paidQ += ' AND pay_period_end >= ?'; paidP.push(startDate); }
    if (endDate) { paidQ += ' AND pay_period_end <= ?'; paidP.push(endDate); }
    const [paidStats] = await db.execute(paidQ, paidP);
    const totalSalaryPaid = paidStats[0].total;

    let dueQ = 'SELECT COALESCE(SUM(net_salary), 0) as total FROM payroll WHERE tenant_id = ? AND status IN (?, ?)';
    const dueP = [tenantId, 'due', 'draft'];
    if (startDate) { dueQ += ' AND pay_period_end >= ?'; dueP.push(startDate); }
    if (endDate) { dueQ += ' AND pay_period_end <= ?'; dueP.push(endDate); }
    const [dueStats] = await db.execute(dueQ, dueP);
    const totalSalaryPending = dueStats[0].total;

    let attQ = `SELECT COALESCE(SUM(a.total_hours), 0) as total_hours
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id AND e.status = 'active'
                WHERE a.tenant_id = ?`;
    const attP = [tenantId];
    if (startDate) { attQ += ' AND date >= ?'; attP.push(startDate); }
    if (endDate) { attQ += ' AND date <= ?'; attP.push(endDate); }
    const [attendanceStats] = await db.execute(attQ, attP);
    const totalHoursLogged = parseFloat(attendanceStats[0].total_hours) || 0;

    let payrollHoursQ = `SELECT COALESCE(SUM(p.total_hours_worked), 0) as paid_hours
                FROM payroll p
                JOIN employees e ON p.employee_id = e.id AND e.status = 'active'
                WHERE p.tenant_id = ? AND p.status = 'paid'`;
    const payrollHoursP = [tenantId];
    if (startDate) { payrollHoursQ += ' AND pay_period_end >= ?'; payrollHoursP.push(startDate); }
    if (endDate) { payrollHoursQ += ' AND pay_period_end <= ?'; payrollHoursP.push(endDate); }
    const [payrollHoursStats] = await db.execute(payrollHoursQ, payrollHoursP);
    const totalPaidHours = parseFloat(payrollHoursStats[0].paid_hours) || 0;

    let leaveQ = `SELECT COALESCE(SUM(
      LEAST((end_date AT TIME ZONE 'UTC')::date, ?::date) - GREATEST((start_date AT TIME ZONE 'UTC')::date, ?::date) + 1
    ), 0) as total_leaves FROM leaves WHERE tenant_id = ? AND status = 'approved'
      AND (start_date AT TIME ZONE 'UTC')::date <= ? AND (end_date AT TIME ZONE 'UTC')::date >= ?`;
    const leaveP = [tenantId];
    if (startDate && endDate) {
      leaveP.unshift(endDate, startDate);
      leaveP.push(endDate, startDate);
    } else {
      leaveQ = "SELECT COUNT(*) as total_leaves FROM leaves WHERE tenant_id = ? AND status = 'approved'";
    }
    const [leaveStats] = await db.execute(leaveQ, leaveP);
    const totalLeaveDays = Number(leaveStats[0].total_leaves) || 0;

    let advQ = `SELECT COALESCE(SUM(amount), 0) as total_issued, COALESCE(SUM(remaining_balance), 0) as outstanding
                FROM employee_advances WHERE tenant_id = ? AND status IN ('approved', 'fully_paid')`;
    const advP = [tenantId];
    if (startDate) { advQ += ' AND created_at >= ?'; advP.push(startDate); }
    if (endDate) { advQ += ' AND created_at <= ?'; advP.push(endDate + ' 23:59:59'); }
    const [advanceStats] = await db.execute(advQ, advP);
    const totalAdvancesIssued = advanceStats[0].total_issued;
    const outstandingBalance = advanceStats[0].outstanding;

    const totalUnpaidHours = totalHoursLogged - totalPaidHours;

    res.json({
      totalEmployees,
      totalSalaryPaid,
      totalSalaryPending,
      totalHoursWorked: totalHoursLogged,
      totalPaidHours,
      totalHoursLogged,
      totalUnpaidHours,
      totalOvertimeHours: 0,
      totalLeaveDays,
      totalAdvancesIssued,
      outstandingBalance,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch summary.' });
  }
};

exports.getSalaryReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, status } = req.query;
  try {
    let query = `SELECT p.*, e.first_name, e.last_name, e.email, e.base_salary, e.pay_per_hour
                 FROM payroll p
                 JOIN employees e ON p.employee_id = e.id
                 WHERE p.tenant_id = ?`;
    const params = [tenantId];
    if (startDate) { query += ' AND p.pay_period_end >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND p.pay_period_end <= ?'; params.push(endDate); }
    if (search) { query += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ? OR e.email ILIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (status) { query += ' AND p.status = ?'; params.push(status); }
    query += ' ORDER BY p.pay_period_end DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch salary report.' });
  }
};

exports.getWorkingHoursReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, payStatus } = req.query;
  try {
    let query = `SELECT a.*, e.first_name, e.last_name, e.email,
                        CASE
                          WHEN EXISTS (SELECT 1 FROM payroll p WHERE p.employee_id = a.employee_id AND p.tenant_id = a.tenant_id AND p.status = 'paid' AND a.date BETWEEN p.pay_period_start AND p.pay_period_end) THEN 'paid'
                          WHEN EXISTS (SELECT 1 FROM payroll p2 WHERE p2.employee_id = a.employee_id AND p2.tenant_id = a.tenant_id AND p2.status IN ('due','draft') AND a.date BETWEEN p2.pay_period_start AND p2.pay_period_end) THEN 'due'
                          ELSE 'unbilled'
                        END as pay_status
                 FROM attendance a
                 JOIN employees e ON a.employee_id = e.id
                 WHERE a.tenant_id = ?`;
    const params = [tenantId];
    const df = buildDateFilter('a', startDate, endDate);
    query += df.clause; params.push(...df.params);
    if (search) { query += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (payStatus === 'paid') {
      query += " AND EXISTS (SELECT 1 FROM payroll p WHERE p.employee_id = a.employee_id AND p.tenant_id = a.tenant_id AND p.status = 'paid' AND a.date BETWEEN p.pay_period_start AND p.pay_period_end)";
    } else if (payStatus === 'due') {
      query += " AND EXISTS (SELECT 1 FROM payroll p WHERE p.employee_id = a.employee_id AND p.tenant_id = a.tenant_id AND p.status IN ('due','draft') AND a.date BETWEEN p.pay_period_start AND p.pay_period_end)";
    } else if (payStatus === 'unbilled') {
      query += " AND NOT EXISTS (SELECT 1 FROM payroll p WHERE p.employee_id = a.employee_id AND p.tenant_id = a.tenant_id AND a.date BETWEEN p.pay_period_start AND p.pay_period_end)";
    }
    query += ' ORDER BY a.date DESC, e.first_name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch working hours report.' });
  }
};

exports.getLeaveReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, leaveType, status } = req.query;
  try {
    let query = `SELECT l.*, e.first_name, e.last_name
                 FROM leaves l
                 JOIN employees e ON l.employee_id = e.id
                 WHERE l.tenant_id = ?`;
    const params = [tenantId];
    if (startDate && endDate) { query += ' AND (l.start_date AT TIME ZONE \'UTC\')::date <= ? AND (l.end_date AT TIME ZONE \'UTC\')::date >= ?'; params.push(endDate, startDate); }
    else if (startDate) { query += ' AND l.start_date >= ?'; params.push(startDate); }
    else if (endDate) { query += ' AND l.end_date <= ?'; params.push(endDate); }
    if (search) { query += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (leaveType) { query += ' AND l.leave_type = ?'; params.push(leaveType); }
    if (status) { query += ' AND l.status = ?'; params.push(status); }
    query += ' ORDER BY l.created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leave report.' });
  }
};

exports.getAdvanceReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, status } = req.query;
  try {
    let query = `SELECT ea.*, e.first_name, e.last_name,
                        (SELECT CONCAT(ee.first_name, ' ', ee.last_name) FROM employees ee WHERE ee.id = ea.approved_by) as approver_name
                 FROM employee_advances ea
                 JOIN employees e ON ea.employee_id = e.id
                 WHERE ea.tenant_id = ?`;
    const params = [tenantId];
    if (startDate) { query += ' AND ea.created_at >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND ea.created_at <= ?'; params.push(endDate + ' 23:59:59'); }
    if (search) { query += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (status) { query += ' AND ea.status = ?'; params.push(status); }
    query += ' ORDER BY ea.created_at DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch advance report.' });
  }
};

async function getTabData(tenantId, tab, params) {
  switch (tab) {
    case 'salary': {
      let q = `SELECT p.*, e.first_name, e.last_name, e.email, e.base_salary, e.pay_per_hour FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.tenant_id = ?`;
      const p = [tenantId];
      if (params.startDate) { q += ' AND p.pay_period_end >= ?'; p.push(params.startDate); }
      if (params.endDate) { q += ' AND p.pay_period_end <= ?'; p.push(params.endDate); }
      if (params.search) { q += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ?)`; p.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`); }
      q += ' ORDER BY p.pay_period_end DESC';
      const [rows] = await db.execute(q, p);
      return rows;
    }
    case 'working-hours': {
      let q = `SELECT a.*, e.first_name, e.last_name,
                      CASE
                        WHEN EXISTS (SELECT 1 FROM payroll p WHERE p.employee_id = a.employee_id AND p.tenant_id = a.tenant_id AND p.status = 'paid' AND a.date BETWEEN p.pay_period_start AND p.pay_period_end) THEN 'paid'
                        WHEN EXISTS (SELECT 1 FROM payroll p2 WHERE p2.employee_id = a.employee_id AND p2.tenant_id = a.tenant_id AND p2.status IN ('due','draft') AND a.date BETWEEN p2.pay_period_start AND p2.pay_period_end) THEN 'due'
                        ELSE 'unbilled'
                      END as pay_status
               FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.tenant_id = ?`;
      const p = [tenantId];
      const df = buildDateFilter('a', params.startDate, params.endDate);
      q += df.clause; p.push(...df.params);
      q += ' ORDER BY a.date DESC';
      const [rows] = await db.execute(q, p);
      return rows;
    }
    case 'leaves': {
      let q = `SELECT l.*, e.first_name, e.last_name FROM leaves l JOIN employees e ON l.employee_id = e.id WHERE l.tenant_id = ?`;
      const p = [tenantId];
      if (params.startDate && params.endDate) { q += ' AND (l.start_date AT TIME ZONE \'UTC\')::date <= ? AND (l.end_date AT TIME ZONE \'UTC\')::date >= ?'; p.push(params.endDate, params.startDate); }
      else if (params.startDate) { q += ' AND l.start_date >= ?'; p.push(params.startDate); }
      else if (params.endDate) { q += ' AND l.end_date <= ?'; p.push(params.endDate); }
      q += ' ORDER BY l.created_at DESC';
      const [rows] = await db.execute(q, p);
      return rows;
    }
    case 'advances': {
      let q = `SELECT ea.*, e.first_name, e.last_name FROM employee_advances ea JOIN employees e ON ea.employee_id = e.id WHERE ea.tenant_id = ?`;
      const p = [tenantId];
      if (params.startDate) { q += ' AND ea.created_at >= ?'; p.push(params.startDate); }
      if (params.endDate) { q += ' AND ea.created_at <= ?'; p.push(params.endDate + ' 23:59:59'); }
      q += ' ORDER BY ea.created_at DESC';
      const [rows] = await db.execute(q, p);
      return rows;
    }
    default:
      return [];
  }
}

exports.exportReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { tab, format } = req.params;
  const queryParams = req.query;

  try {
    const [tenantRow] = await db.execute('SELECT company_name FROM tenants WHERE id = ?', [tenantId]);
    const companyName = tenantRow[0]?.company_name || 'Company';
    const data = await getTabData(tenantId, tab, queryParams);

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: tab === 'working-hours' ? 'landscape' : 'portrait' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${tab}_report.pdf`);
      doc.pipe(res);

      const MARGIN = 40;
      const pageW = doc.page.width - MARGIN * 2;
      let y;
      let pageNum = 1;

      const tabLabel = tab === 'working-hours' ? 'Working Hours' : tab.charAt(0).toUpperCase() + tab.slice(1);
      const genDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const periodLabel = (queryParams.startDate || queryParams.endDate)
        ? `Period: ${queryParams.startDate || '—'} to ${queryParams.endDate || '—'}` : null;

      function writeHeader() {
        y = doc.y + 6;
        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(companyName.toUpperCase(), MARGIN, y, { align: 'center', width: pageW, lineBreak: false, ellipsis: true });
        y = doc.y + 4;
        doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(`Generated: ${genDate}`, MARGIN, y, { align: 'right', width: pageW, lineBreak: false });
        y = doc.y + 2;
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(`${tabLabel} Report`, MARGIN, y, { align: 'center', width: pageW, lineBreak: false });
        y = doc.y + 2;
        if (periodLabel) {
          doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(periodLabel, MARGIN, y, { align: 'center', width: pageW, lineBreak: false });
          y = doc.y + 2;
        }
        doc.moveTo(MARGIN, y).lineTo(MARGIN + pageW, y).strokeColor('#e2e8f0').stroke();
        y = doc.y + 6;
      }

      function writeFooter() {
        doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text(`Page ${pageNum}`, MARGIN, doc.page.height - 52, { align: 'center', width: pageW, lineBreak: false });
      }

      writeHeader();

      const tableStartX = MARGIN;
      const tableW = pageW;
      const rowH = 18;
      const headH = 20;
      const rowBottomLimit = doc.page.height - 64;

      function drawTableHead(headers, cw, al) {
        doc.roundedRect(tableStartX, y, tableW, headH, 3).fillColor('#1e293b').fill();
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold');
        let cx = tableStartX;
        headers.forEach((h, i) => {
          doc.text(h, cx + 4, y + 6, { width: cw[i] - 8, align: al[i], lineBreak: false, ellipsis: true });
          cx += cw[i];
        });
        y += headH;
      }

      function drawRow(cells, cw, al, alt) {
        if (alt) doc.rect(tableStartX, y, tableW, rowH).fillColor('#f8fafc').fill();
        doc.fillColor('#0f172a').fontSize(7).font('Helvetica');
        let cx = tableStartX;
        cells.forEach((val, i) => {
          doc.text(String(val), cx + 4, y + 5, { width: cw[i] - 8, align: al[i], lineBreak: false, ellipsis: true });
          cx += cw[i];
        });
        y += rowH;
      }

      function newPage(headers, cw, al) {
        writeFooter();
        doc.addPage();
        pageNum++;
        writeHeader();
        drawTableHead(headers, cw, al);
      }

      function makeColumns(count) {
        const ratioW = Math.floor((tableW - (count - 1)) / count);
        const rem = tableW - ratioW * count;
        return Array.from({ length: count }, (_, i) => i < rem ? ratioW + 1 : ratioW);
      }

      function tabConfig() {
        const labels = tab === 'salary' ? ['Employee', 'Pay Rate', 'Worked', 'Gross', 'Adv. Ded.', 'Net', 'Status']
          : tab === 'working-hours' ? ['Employee', 'Date', 'Hours', 'Status']
          : tab === 'leaves' ? ['Employee', 'Type', 'Start', 'End', 'Days', 'Status']
          : ['Employee', 'Amount', 'Recovered', 'Outstanding', 'Date', 'Status'];
        const aligns = tab === 'salary' ? ['left', 'center', 'center', 'right', 'right', 'right', 'center']
          : tab === 'working-hours' ? ['left', 'center', 'center', 'center']
          : tab === 'leaves' ? ['left', 'center', 'center', 'center', 'center', 'center']
          : ['left', 'right', 'right', 'right', 'center', 'center'];
        const formatters = {
          salary: [
            r => `${r.first_name} ${r.last_name}`,
            r => `₹${(r.hourly_rate / 100).toFixed(2)}/hr`,
            r => `${r.total_hours_worked}h`,
            r => `₹${(r.gross_salary / 100).toFixed(2)}`,
            r => r.advance_deduction ? `₹${(r.advance_deduction / 100).toFixed(2)}` : '—',
            r => `₹${(r.net_salary / 100).toFixed(2)}`,
            r => r.status === 'paid' ? 'Paid' : 'Due',
          ],
          'working-hours': [
            r => `${r.first_name} ${r.last_name}`,
            r => r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—',
            r => r.total_hours ? `${r.total_hours}h` : '—',
            r => r.pay_status === 'paid' ? 'Paid' : r.pay_status === 'due' ? 'Due' : 'Unbilled',
          ],
          leaves: [
            r => `${r.first_name} ${r.last_name}`,
            r => r.leave_type || '—',
            r => r.start_date ? new Date(r.start_date).toLocaleDateString('en-IN') : '—',
            r => r.end_date ? new Date(r.end_date).toLocaleDateString('en-IN') : '—',
            r => r.start_date && r.end_date ? Math.floor((new Date(r.end_date) - new Date(r.start_date)) / 86400000) + 1 : '—',
            r => r.status || '—',
          ],
          advances: [
            r => `${r.first_name} ${r.last_name}`,
            r => `₹${(r.amount / 100).toFixed(2)}`,
            r => `₹${((r.amount || 0) - (r.remaining_balance || 0)) / 100}`,
            r => `₹${(r.remaining_balance / 100).toFixed(2)}`,
            r => r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—',
            r => r.remaining_balance && r.remaining_balance > 0 ? 'Due' : 'Paid',
          ],
        };
        return { labels, aligns, formatters: formatters[tab] || [] };
      }

      if (!data.length) {
        doc.fontSize(11).font('Helvetica').fillColor('#64748b').text('No data found for the selected period.', MARGIN, y + 30, { align: 'center', width: pageW, lineBreak: false });
      } else {
        const { labels, aligns, formatters } = tabConfig();
        const cols = makeColumns(labels.length);

        drawTableHead(labels, cols, aligns);

        data.forEach((row, ri) => {
          if (y + rowH > rowBottomLimit) {
            newPage(labels, cols, aligns);
          }
          const cells = formatters.map(f => f(row));
          drawRow(cells, cols, aligns, ri % 2 === 0);
        });

        if (y + headH + 4 > rowBottomLimit) {
          newPage(labels, cols, aligns);
        }
        y += 4;
        doc.roundedRect(tableStartX, y, tableW, headH, 3).fillColor('#f1f5f9').fill();
        doc.fillColor('#0f172a').fontSize(7).font('Helvetica-Bold');
        let cx = tableStartX;
        const lastRow = data[data.length - 1];
        labels.forEach((_, i) => {
          const val = i === 0 ? `Total (${data.length} records)` : (i === labels.length - 1 ? formatters[i](lastRow) : '');
          doc.text(String(val), cx + 4, y + 6, { width: cols[i] - 8, align: aligns[i], lineBreak: false, ellipsis: true });
          cx += cols[i];
        });
        y += headH + 8;
      }

      writeFooter();
      doc.end();
    } else if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(tab);
      if (data.length > 0) {
        const rawKeys = Object.keys(data[0]).filter(k => !['tenant_id', 'id', 'employee_id', 'created_at', 'updated_at'].includes(k));
        const headerOrder = {
          'working-hours': ['first_name', 'last_name', 'total_hours', 'date', 'pay_status'],
        };
        const headers = headerOrder[tab] || rawKeys;
        sheet.addRow(headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())));
        data.forEach(row => sheet.addRow(headers.map(h => row[h] ?? '')));
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${tab}_report.xlsx`);
      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.status(400).json({ error: 'Unsupported format. Use pdf or xlsx.' });
    }
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.status(500).json({ error: 'Export failed.' });
  }
};

exports.getCharts = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate } = req.query;
  try {
    function dateWhere(col) {
      const c = []; const p = [];
      if (startDate) { c.push(`${col} >= ?`); p.push(startDate); }
      if (endDate) { c.push(`${col} <= ?`); p.push(endDate); }
      return { clause: c.length ? ` AND ${c.join(' AND ')}` : '', params: p };
    }

    const sd = dateWhere('pay_period_end');
    const [salaryTrend] = await db.execute(
      `SELECT DATE_TRUNC('month', pay_period_end) as month, SUM(net_salary) as total, SUM(gross_salary) as gross
       FROM payroll WHERE tenant_id = ?${sd.clause} GROUP BY 1 ORDER BY 1`, [tenantId, ...sd.params]
    );

    const ad = dateWhere('date');
    const [attendanceTrend] = await db.execute(
      `SELECT DATE_TRUNC('month', date) as month, SUM(total_hours) as hours, COUNT(DISTINCT employee_id) as employees
       FROM attendance WHERE tenant_id = ?${ad.clause} GROUP BY 1 ORDER BY 1`, [tenantId, ...ad.params]
    );

    const ld = dateWhere('start_date');
    const [leaveDistribution] = await db.execute(
      `SELECT leave_type, COUNT(*) as count FROM leaves WHERE tenant_id = ? AND status = 'approved'${ld.clause} GROUP BY leave_type`, [tenantId, ...ld.params]
    );

    let avdClause = ''; const avdP = [];
    if (startDate) { avdClause += ' AND created_at >= ?'; avdP.push(startDate); }
    if (endDate) { avdClause += ' AND created_at <= ?'; avdP.push(endDate + ' 23:59:59'); }
    const [advanceTrend] = await db.execute(
      `SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as total FROM employee_advances WHERE tenant_id = ?${avdClause} GROUP BY 1 ORDER BY 1`, [tenantId, ...avdP]
    );

    res.json({ salaryTrend, attendanceTrend, leaveDistribution, advanceTrend });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch chart data.' });
  }
};
