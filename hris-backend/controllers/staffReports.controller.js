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

// Resolves the employee-status filter for report queries.
// 'deactivated' → only deactivated staff; anything else → only active staff (default).
function empStatusValue(staffStatus) {
  return staffStatus === 'deactivated' ? 'deactivated' : 'active';
}

exports.getSummary = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, staffStatus } = req.query;
  const empStatus = empStatusValue(staffStatus);
  try {
    let searchClause = '';
    const searchParams = [];
    if (search) {
      searchClause = ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ?)`;
      searchParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    let empSearchClause = '';
    const empSearchParams = [];
    if (search) {
      empSearchClause = ` AND (first_name ILIKE ? OR last_name ILIKE ? OR CONCAT(first_name, ' ', last_name) ILIKE ?)`;
      empSearchParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [empCount] = await db.execute(`SELECT COUNT(*) as c FROM employees WHERE tenant_id = ? AND status = '${empStatus}'${empSearchClause}`, [tenantId, ...empSearchParams]);
    const totalEmployees = empCount[0].c;

    let payrollQ = 'SELECT COALESCE(SUM(net_salary), 0) as total_net, COALESCE(SUM(total_hours_worked), 0) as total_hours FROM payroll WHERE tenant_id = ?';
    const payrollP = [tenantId];
    if (startDate) { payrollQ += ' AND pay_period_end >= ?'; payrollP.push(startDate); }
    if (endDate) { payrollQ += ' AND pay_period_end <= ?'; payrollP.push(endDate); }
    const [payrollStats] = await db.execute(payrollQ, payrollP);
    const totalHoursWorked = parseFloat(payrollStats[0].total_hours) || 0;

    let paidQ = `SELECT COALESCE(SUM(p.net_salary), 0) as total FROM payroll p
                 JOIN employees e ON p.employee_id = e.id AND e.status = '${empStatus}'
                 WHERE p.tenant_id = ? AND p.status = ?`;
    const paidP = [tenantId, 'paid'];
    if (startDate) { paidQ += ' AND p.pay_period_end >= ?'; paidP.push(startDate); }
    if (endDate) { paidQ += ' AND p.pay_period_end <= ?'; paidP.push(endDate); }
    if (search) { paidQ += searchClause; paidP.push(...searchParams); }
    const [paidStats] = await db.execute(paidQ, paidP);
    const totalSalaryPaid = paidStats[0].total;

    // Salary Pending = unpaid worked hours × pay-per-hour (attendance not yet covered by a paid payroll) + unpaid piece work entries.
    const dateParams = [];
    let pendingDateClause = '';
    if (startDate) { pendingDateClause += ' AND a.date >= ?'; dateParams.push(startDate); }
    if (endDate) { pendingDateClause += ' AND a.date <= ?'; dateParams.push(endDate); }
    const [pendingEmps] = await db.execute(
      `SELECT id, pay_per_hour, salary_type FROM employees WHERE tenant_id = ? AND status = '${empStatus}'${empSearchClause}`,
      [tenantId, ...empSearchParams]
    );
    let totalSalaryPending = 0;
    for (const emp of pendingEmps) {
      if (emp.salary_type === 'piece') {
        const [p] = await db.execute(
          `SELECT COALESCE(SUM(calculated_amount), 0) as total
           FROM piece_work_entries
           WHERE tenant_id = ? AND employee_id = ? AND is_paid = 0`, [tenantId, emp.id]
        );
        totalSalaryPending += parseInt(p[0].total || 0);
        continue;
      }
      const [ph] = await db.execute(
        `SELECT COALESCE(SUM(a.total_hours), 0) as h FROM attendance a
         WHERE a.tenant_id = ? AND a.employee_id = ? AND a.total_hours > 0 ${pendingDateClause}
         AND NOT EXISTS (
           SELECT 1 FROM payroll p
           WHERE p.tenant_id = a.tenant_id AND p.employee_id = a.employee_id
             AND p.status = 'paid' AND p.total_hours_worked > 0
             AND a.date >= p.pay_period_start AND a.date <= p.pay_period_end
         )`,
        [tenantId, emp.id, ...dateParams]
      );
      totalSalaryPending += (parseFloat(ph[0].h) || 0) * (Number(emp.pay_per_hour) || 0);
    }

    let attQ = `SELECT COALESCE(SUM(a.total_hours), 0) as total_hours
                FROM attendance a
                JOIN employees e ON a.employee_id = e.id AND e.status = '${empStatus}'
                WHERE a.tenant_id = ?`;
    const attP = [tenantId];
    if (startDate) { attQ += ' AND a.date >= ?'; attP.push(startDate); }
    if (endDate) { attQ += ' AND a.date <= ?'; attP.push(endDate); }
    if (search) { attQ += searchClause; attP.push(...searchParams); }
    const [attendanceStats] = await db.execute(attQ, attP);
    const totalHoursLogged = parseFloat(attendanceStats[0].total_hours) || 0;

    let payrollHoursQ = `SELECT COALESCE(SUM(p.total_hours_worked), 0) as paid_hours
                FROM payroll p
                JOIN employees e ON p.employee_id = e.id AND e.status = '${empStatus}'
                WHERE p.tenant_id = ? AND p.status = 'paid'`;
    const payrollHoursP = [tenantId];
    if (startDate) { payrollHoursQ += ' AND p.pay_period_end >= ?'; payrollHoursP.push(startDate); }
    if (endDate) { payrollHoursQ += ' AND p.pay_period_end <= ?'; payrollHoursP.push(endDate); }
    if (search) { payrollHoursQ += searchClause; payrollHoursP.push(...searchParams); }
    const [payrollHoursStats] = await db.execute(payrollHoursQ, payrollHoursP);
    const totalPaidHours = parseFloat(payrollHoursStats[0].paid_hours) || 0;

    let leaveQ, leaveP;
    if (startDate && endDate) {
      leaveQ = `SELECT COALESCE(SUM(
        LEAST((l.end_date AT TIME ZONE 'UTC')::date, ?::date) - GREATEST((l.start_date AT TIME ZONE 'UTC')::date, ?::date) + 1
      ), 0) as total_leaves
      FROM leaves l JOIN employees e ON l.employee_id = e.id AND e.status = '${empStatus}'
      WHERE l.tenant_id = ? AND l.status = 'approved'
        AND (l.start_date AT TIME ZONE 'UTC')::date <= ? AND (l.end_date AT TIME ZONE 'UTC')::date >= ?`;
      leaveP = [endDate, startDate, tenantId, endDate, startDate];
    } else {
      leaveQ = `SELECT COUNT(*) as total_leaves FROM leaves l JOIN employees e ON l.employee_id = e.id AND e.status = '${empStatus}' WHERE l.tenant_id = ? AND l.status = 'approved'`;
      leaveP = [tenantId];
    }
    if (search) { leaveQ += searchClause; leaveP.push(...searchParams); }
    const [leaveStats] = await db.execute(leaveQ, leaveP);
    const totalLeaveDays = Number(leaveStats[0].total_leaves) || 0;

    let advQ = `SELECT COALESCE(SUM(ea.amount), 0) as total_issued, COALESCE(SUM(ea.remaining_balance), 0) as outstanding
                FROM employee_advances ea JOIN employees e ON ea.employee_id = e.id AND e.status = '${empStatus}'
                WHERE ea.tenant_id = ? AND ea.status IN ('approved', 'fully_paid')`;
    const advP = [tenantId];
    if (startDate) { advQ += ' AND ea.created_at >= ?'; advP.push(startDate); }
    if (endDate) { advQ += ' AND ea.created_at <= ?'; advP.push(endDate + ' 23:59:59'); }
    if (search) { advQ += searchClause; advP.push(...searchParams); }
    const [advanceStats] = await db.execute(advQ, advP);
    const totalAdvancesIssued = advanceStats[0].total_issued;
    const outstandingBalance = advanceStats[0].outstanding;

    const totalUnpaidHours = Math.max(0, totalHoursLogged - totalPaidHours);

    let qtyLoggedQ = `SELECT COALESCE(SUM(pwe.quantity), 0) as total FROM piece_work_entries pwe JOIN employees e ON pwe.employee_id = e.id AND e.status = '${empStatus}' WHERE pwe.tenant_id = ?`;
    const qtyLoggedP = [tenantId];
    if (startDate) { qtyLoggedQ += ' AND pwe.date >= ?'; qtyLoggedP.push(startDate); }
    if (endDate) { qtyLoggedQ += ' AND pwe.date <= ?'; qtyLoggedP.push(endDate); }
    if (search) { qtyLoggedQ += searchClause; qtyLoggedP.push(...searchParams); }
    const [qtyLoggedStats] = await db.execute(qtyLoggedQ, qtyLoggedP);
    const totalQtyLogged = parseFloat(qtyLoggedStats[0].total) || 0;

    let qtyPaidQ = `SELECT COALESCE(SUM(pwe.quantity), 0) as total FROM piece_work_entries pwe JOIN employees e ON pwe.employee_id = e.id AND e.status = '${empStatus}' WHERE pwe.tenant_id = ? AND pwe.is_paid = 1`;
    const qtyPaidP = [tenantId];
    if (startDate) { qtyPaidQ += ' AND pwe.date >= ?'; qtyPaidP.push(startDate); }
    if (endDate) { qtyPaidQ += ' AND pwe.date <= ?'; qtyPaidP.push(endDate); }
    if (search) { qtyPaidQ += searchClause; qtyPaidP.push(...searchParams); }
    const [qtyPaidStats] = await db.execute(qtyPaidQ, qtyPaidP);
    const totalQtyPaid = parseFloat(qtyPaidStats[0].total) || 0;

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
      totalQtyLogged,
      totalQtyPaid,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch summary.' });
  }
};

exports.getSalaryReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, status, staffStatus } = req.query;
  const empStatus = empStatusValue(staffStatus);
  try {
    // Pending ("due") salaries are not stored as payroll records (processing marks them paid);
    // they are the worked hours not yet covered by a paid payroll, computed from attendance.
    const buildDueRows = async () => {
      const dateParams = [];
      let dateClause = '';
      if (startDate) { dateClause += ' AND date >= ?'; dateParams.push(startDate); }
      if (endDate) { dateClause += ' AND date <= ?'; dateParams.push(endDate); }
      let searchClause = '';
      const searchParams = [];
      if (search) {
        searchClause = ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ? OR e.email ILIKE ?)`;
        searchParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }
      const [emps] = await db.execute(
        `SELECT id, first_name, last_name, email, base_salary, pay_per_hour, salary_type, piece_rate, piece_unit_label, piece_work_type
         FROM employees e WHERE e.tenant_id = ? AND e.status = '${empStatus}' ${searchClause}`,
        [tenantId, ...searchParams]
      );
      const rows = [];
      for (const emp of emps) {
        if (emp.salary_type === 'piece') {
          const [p] = await db.execute(
            `SELECT COALESCE(SUM(calculated_amount), 0) as total, COALESCE(SUM(quantity), 0) as qty
             FROM piece_work_entries
             WHERE tenant_id = ? AND employee_id = ? AND is_paid = 0 ${dateClause}`,
            [tenantId, emp.id, ...dateParams]
          );
          const total = parseInt(p[0].total || 0);
          if (total <= 0) continue;
          const qty = parseFloat(p[0].qty || 0);
          rows.push({
            id: null,
            employee_id: emp.id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            email: emp.email,
            base_salary: emp.base_salary,
            pay_per_hour: emp.pay_per_hour,
            hourly_rate: emp.piece_rate,
            total_hours_worked: qty,
            gross_salary: total,
            advance_deduction: 0,
            net_salary: total,
            status: 'due',
            pay_period_start: startDate || null,
            pay_period_end: endDate || null,
            created_at: null,
            salary_type: 'piece',
            piece_unit_label: emp.piece_unit_label,
          });
          continue;
        }
        const [ph] = await db.execute(
          `SELECT COALESCE(SUM(a.total_hours), 0) as h FROM attendance a
           WHERE a.tenant_id = ? AND a.employee_id = ? AND a.total_hours > 0 ${dateClause}
           AND NOT EXISTS (
             SELECT 1 FROM payroll p
             WHERE p.tenant_id = a.tenant_id AND p.employee_id = a.employee_id
               AND p.status = 'paid' AND p.total_hours_worked > 0
               AND a.date >= p.pay_period_start AND a.date <= p.pay_period_end
           )`,
          [tenantId, emp.id, ...dateParams]
        );
        const hours = parseFloat(ph[0].h) || 0;
        if (hours <= 0) continue;
        const due = Math.round(hours * (Number(emp.pay_per_hour) || 0));
        rows.push({
          id: null,
          employee_id: emp.id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          base_salary: emp.base_salary,
          pay_per_hour: emp.pay_per_hour,
          hourly_rate: emp.pay_per_hour,
          total_hours_worked: hours,
          gross_salary: due,
          advance_deduction: 0,
          net_salary: due,
          status: 'due',
          pay_period_start: startDate || null,
          pay_period_end: endDate || null,
          created_at: null,
        });
      }
      return rows;
    };

    if (status === 'due') {
      res.json(await buildDueRows());
      return;
    }

    let query = `SELECT p.*, e.first_name, e.last_name, e.email, e.base_salary, e.pay_per_hour, e.salary_type
                 FROM payroll p
                 JOIN employees e ON p.employee_id = e.id AND e.status = '${empStatus}'
                 WHERE p.tenant_id = ?`;
    const params = [tenantId];
    if (startDate) { query += ' AND p.pay_period_end >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND p.pay_period_end <= ?'; params.push(endDate); }
    if (search) { query += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ? OR e.email ILIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`); }
    if (status === 'paid') { query += ' AND p.status = ?'; params.push('paid'); }
    query += ' ORDER BY p.pay_period_end DESC';

    const [rows] = await db.execute(query, params);

    // "All Status" (no status filter) shows both processed payroll and pending salaries.
    if (!status) {
      rows.push(...await buildDueRows());
    }

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch salary report.' });
  }
};

exports.getWorkingHoursReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, payStatus, staffStatus } = req.query;
  const empStatus = empStatusValue(staffStatus);
  try {
    let query = `SELECT a.*, e.first_name, e.last_name, e.email,
                        CASE
                          WHEN EXISTS (SELECT 1 FROM payroll p WHERE p.employee_id = a.employee_id AND p.tenant_id = a.tenant_id AND p.status = 'paid' AND a.date BETWEEN p.pay_period_start AND p.pay_period_end) THEN 'paid'
                          WHEN EXISTS (SELECT 1 FROM payroll p2 WHERE p2.employee_id = a.employee_id AND p2.tenant_id = a.tenant_id AND p2.status IN ('due','draft') AND a.date BETWEEN p2.pay_period_start AND p2.pay_period_end) THEN 'due'
                          ELSE 'unbilled'
                        END as pay_status
                 FROM attendance a
                 JOIN employees e ON a.employee_id = e.id AND e.status = '${empStatus}'
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

exports.getPieceWorkReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, payStatus, staffStatus } = req.query;
  const empStatus = empStatusValue(staffStatus);
  try {
    let query = `SELECT pwe.*, e.first_name, e.last_name, e.email, e.salary_type,
                        CASE
                          WHEN pwe.is_paid = 1 OR EXISTS (SELECT 1 FROM payroll p WHERE p.id = pwe.payroll_id AND p.status = 'paid') THEN 'paid'
                          WHEN EXISTS (SELECT 1 FROM payroll p WHERE p.id = pwe.payroll_id AND p.status IN ('due','draft')) THEN 'due'
                          ELSE 'unbilled'
                        END as pay_status
                 FROM piece_work_entries pwe
                 JOIN employees e ON pwe.employee_id = e.id AND e.status = '${empStatus}'
                 WHERE pwe.tenant_id = ?`;
    const params = [tenantId];
    const df = buildDateFilter('pwe', startDate, endDate);
    query += df.clause; params.push(...df.params);
    if (search) { query += ` AND (e.first_name ILIKE ? OR e.last_name ILIKE ? OR CONCAT(e.first_name, ' ', e.last_name) ILIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (payStatus === 'paid') {
      query += " AND (pwe.is_paid = 1 OR EXISTS (SELECT 1 FROM payroll p WHERE p.id = pwe.payroll_id AND p.status = 'paid'))";
    } else if (payStatus === 'due') {
      query += " AND (pwe.is_paid = 0 AND EXISTS (SELECT 1 FROM payroll p WHERE p.id = pwe.payroll_id AND p.status IN ('due','draft')))";
    } else if (payStatus === 'unbilled') {
      query += " AND pwe.is_paid = 0 AND NOT EXISTS (SELECT 1 FROM payroll p WHERE p.id = pwe.payroll_id)";
    }
    query += ' ORDER BY pwe.date DESC, e.first_name';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch piece work report.' });
  }
};

exports.getLeaveReport = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, search, leaveType, status, staffStatus } = req.query;
  const empStatus = empStatusValue(staffStatus);
  try {
    let query = `SELECT l.*, e.first_name, e.last_name
                 FROM leaves l
                 JOIN employees e ON l.employee_id = e.id AND e.status = '${empStatus}'
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
  const { startDate, endDate, search, status, staffStatus } = req.query;
  const empStatus = empStatusValue(staffStatus);
  try {
    let query = `SELECT ea.*, e.first_name, e.last_name,
                        (SELECT CONCAT(ee.first_name, ' ', ee.last_name) FROM employees ee WHERE ee.id = ea.approved_by) as approver_name
                 FROM employee_advances ea
                 JOIN employees e ON ea.employee_id = e.id AND e.status = '${empStatus}'
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
  const empStatus = empStatusValue(params.staffStatus);
  switch (tab) {
    case 'salary': {
      let q = `SELECT p.*, e.first_name, e.last_name, e.email, e.base_salary, e.pay_per_hour FROM payroll p JOIN employees e ON p.employee_id = e.id AND e.status = '${empStatus}' WHERE p.tenant_id = ?`;
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
               FROM attendance a JOIN employees e ON a.employee_id = e.id AND e.status = '${empStatus}' WHERE a.tenant_id = ?`;
      const p = [tenantId];
      const df = buildDateFilter('a', params.startDate, params.endDate);
      q += df.clause; p.push(...df.params);
      q += ' ORDER BY a.date DESC';
      const [rows] = await db.execute(q, p);
      return rows;
    }
    case 'leaves': {
      let q = `SELECT l.*, e.first_name, e.last_name FROM leaves l JOIN employees e ON l.employee_id = e.id AND e.status = '${empStatus}' WHERE l.tenant_id = ?`;
      const p = [tenantId];
      if (params.startDate && params.endDate) { q += ' AND (l.start_date AT TIME ZONE \'UTC\')::date <= ? AND (l.end_date AT TIME ZONE \'UTC\')::date >= ?'; p.push(params.endDate, params.startDate); }
      else if (params.startDate) { q += ' AND l.start_date >= ?'; p.push(params.startDate); }
      else if (params.endDate) { q += ' AND l.end_date <= ?'; p.push(params.endDate); }
      q += ' ORDER BY l.created_at DESC';
      const [rows] = await db.execute(q, p);
      return rows;
    }
    case 'advances': {
      let q = `SELECT ea.*, e.first_name, e.last_name FROM employee_advances ea JOIN employees e ON ea.employee_id = e.id AND e.status = '${empStatus}' WHERE ea.tenant_id = ?`;
      const p = [tenantId];
      if (params.startDate) { q += ' AND ea.created_at >= ?'; p.push(params.startDate); }
      if (params.endDate) { q += ' AND ea.created_at <= ?'; p.push(params.endDate + ' 23:59:59'); }
      q += ' ORDER BY ea.created_at DESC';
      const [rows] = await db.execute(q, p);
      return rows;
    }
    case 'piece-work': {
      let q = `SELECT pwe.*, e.first_name, e.last_name FROM piece_work_entries pwe JOIN employees e ON pwe.employee_id = e.id AND e.status = '${empStatus}' WHERE pwe.tenant_id = ?`;
      const p = [tenantId];
      if (params.startDate) { q += ' AND pwe.date >= ?'; p.push(params.startDate); }
      if (params.endDate) { q += ' AND pwe.date <= ?'; p.push(params.endDate); }
      q += ' ORDER BY pwe.date DESC';
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
          : tab === 'piece-work' ? ['Employee', 'Date', 'Work Type', 'Qty', 'Rate', 'Amount', 'Status']
          : ['Employee', 'Amount', 'Recovered', 'Outstanding', 'Date', 'Status'];
        const aligns = tab === 'salary' ? ['left', 'center', 'center', 'right', 'right', 'right', 'center']
          : tab === 'working-hours' ? ['left', 'center', 'center', 'center']
          : tab === 'leaves' ? ['left', 'center', 'center', 'center', 'center', 'center']
          : tab === 'piece-work' ? ['left', 'center', 'center', 'center', 'center', 'right', 'center']
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
          'piece-work': [
            r => `${r.first_name} ${r.last_name}`,
            r => r.date ? new Date(r.date).toLocaleDateString('en-IN') : '—',
            r => r.work_type || '—',
            r => r.quantity ? `${r.quantity}` : '0',
            r => `₹${(r.rate_per_piece / 100).toFixed(2)}`,
            r => r.calculated_amount ? `₹${(r.calculated_amount / 100).toFixed(2)}` : '₹0.00',
            r => r.is_paid ? 'Paid' : 'Unpaid',
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
  const { staffStatus } = req.query;
  const empStatus = empStatusValue(staffStatus);
  try {
    // Trend charts always span the full history (they are "trends"), independent of the
    // selected date preset — otherwise a single-month preset yields at most one data point.
    // The employee-status toggle (active vs deactivated) still applies.
    const [salaryTrend] = await db.execute(
      `SELECT DATE_TRUNC('month', p.pay_period_end) as month, SUM(p.net_salary) as total, SUM(p.gross_salary) as gross
       FROM payroll p JOIN employees e ON p.employee_id = e.id AND e.status = '${empStatus}'
       WHERE p.tenant_id = ? GROUP BY 1 ORDER BY 1`, [tenantId]
    );

    const [attendanceTrend] = await db.execute(
      `SELECT DATE_TRUNC('month', a.date) as month, SUM(a.total_hours) as hours, COUNT(DISTINCT a.employee_id) as employees
       FROM attendance a JOIN employees e ON a.employee_id = e.id AND e.status = '${empStatus}'
       WHERE a.tenant_id = ? GROUP BY 1 ORDER BY 1`, [tenantId]
    );

    const [leaveDistribution] = await db.execute(
      `SELECT l.leave_type, COUNT(*) as count FROM leaves l JOIN employees e ON l.employee_id = e.id AND e.status = '${empStatus}' WHERE l.tenant_id = ? AND l.status = 'approved' GROUP BY l.leave_type`, [tenantId]
    );

    const [advanceTrend] = await db.execute(
      `SELECT DATE_TRUNC('month', ea.created_at) as month, SUM(ea.amount) as total FROM employee_advances ea JOIN employees e ON ea.employee_id = e.id AND e.status = '${empStatus}' WHERE ea.tenant_id = ? GROUP BY 1 ORDER BY 1`, [tenantId]
    );

    res.json({ salaryTrend, attendanceTrend, leaveDistribution, advanceTrend });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch chart data.' });
  }
};
