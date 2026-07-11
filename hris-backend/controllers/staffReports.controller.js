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

    let attQ = `SELECT COALESCE(SUM(total_hours), 0) as total_hours,
                       COALESCE(SUM(CASE WHEN total_hours > 0 THEN total_hours ELSE 0 END), 0) as paid_hours
                FROM attendance WHERE tenant_id = ?`;
    const attP = [tenantId];
    if (startDate) { attQ += ' AND date >= ?'; attP.push(startDate); }
    if (endDate) { attQ += ' AND date <= ?'; attP.push(endDate); }
    const [attendanceStats] = await db.execute(attQ, attP);
    const totalPaidHours = parseFloat(attendanceStats[0].paid_hours) || 0;
    const totalUnpaidHours = (parseFloat(attendanceStats[0].total_hours) || 0) - totalPaidHours;

    let leaveQ = "SELECT COUNT(*) as total_leaves FROM leaves WHERE tenant_id = ? AND status = 'approved'";
    const leaveP = [tenantId];
    if (startDate) { leaveQ += ' AND start_date >= ?'; leaveP.push(startDate); }
    if (endDate) { leaveQ += ' AND end_date <= ?'; leaveP.push(endDate); }
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

    res.json({
      totalEmployees,
      totalSalaryPaid,
      totalSalaryPending,
      totalHoursWorked,
      totalPaidHours,
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
  const { startDate, endDate, search, status } = req.query;
  try {
    let query = `SELECT a.*, e.first_name, e.last_name, e.email
                 FROM attendance a
                 JOIN employees e ON a.employee_id = e.id
                 WHERE a.tenant_id = ?`;
    const params = [tenantId];
    const df = buildDateFilter('a', startDate, endDate);
    query += df.clause; params.push(...df.params);
    if (search) { query += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (status) { query += ' AND a.status = ?'; params.push(status); }
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
    if (startDate) { query += ' AND l.start_date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND l.end_date <= ?'; params.push(endDate); }
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
      let q = `SELECT a.*, e.first_name, e.last_name FROM attendance a JOIN employees e ON a.employee_id = e.id WHERE a.tenant_id = ?`;
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
      if (params.startDate) { q += ' AND l.start_date >= ?'; p.push(params.startDate); }
      if (params.endDate) { q += ' AND l.end_date <= ?'; p.push(params.endDate); }
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
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${tab}_report.pdf`);
      doc.pipe(res);

      doc.fontSize(16).text(companyName.toUpperCase(), { align: 'center' });
      doc.fontSize(12).text(`${tab.charAt(0).toUpperCase() + tab.slice(1)} Report`, { align: 'center' }).moveDown(2);

      if (data.length === 0) {
        doc.fontSize(11).text('No data found for the selected period.', { align: 'center' });
      } else {
        const headers = Object.keys(data[0]).filter(k => !['tenant_id', 'id'].includes(k));
        doc.fontSize(8);
        data.slice(0, 100).forEach((row, i) => {
          headers.forEach(h => {
            doc.text(`${h}: ${row[h] ?? '—'}`, { continued: false });
          });
          doc.moveDown(0.3);
          if (i % 20 === 19) doc.addPage();
        });
      }
      doc.end();
    } else if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(tab);
      if (data.length > 0) {
        const headers = Object.keys(data[0]).filter(k => !['tenant_id', 'id'].includes(k));
        sheet.addRow(headers);
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
