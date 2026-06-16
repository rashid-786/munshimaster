const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');

function countWeekdays(start, end) {
  let count = 0;
  const d = new Date(start);
  const endDate = new Date(end);
  while (d <= endDate) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

exports.calculatePayroll = async (req, res) => {
  const { startDate, endDate } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const workingDays = countWeekdays(startDate, endDate);
    const standardHours = workingDays * 8;

    if (standardHours === 0) {
      return res.status(400).json({ error: 'Pay period contains no working days.' });
    }

    const [employees] = await db.execute(
      'SELECT id, base_salary, first_name, last_name FROM employees WHERE tenant_id = ?',
      [tenantId]
    );

    const payrollRuns = [];

    for (const emp of employees) {
      const baseSalary = emp.base_salary;
      const hourlyRate = Math.round(baseSalary / standardHours);

      const [attendance] = await db.execute(
        `SELECT COALESCE(SUM(total_hours), 0) as total_hours
         FROM attendance
         WHERE tenant_id = ? AND employee_id = ? AND date >= ? AND date <= ? AND total_hours > 0`,
        [tenantId, emp.id, startDate, endDate]
      );
      const actualHours = parseFloat(attendance[0].total_hours) || 0;

      const [absences] = await db.execute(
        `SELECT COUNT(*) as days
         FROM attendance
         WHERE tenant_id = ? AND employee_id = ? AND date >= ? AND date <= ? AND total_hours = 0`,
        [tenantId, emp.id, startDate, endDate]
      );
      const absentDays = Number(absences[0].days) || 0;

      const [leaves] = await db.execute(
        `SELECT COALESCE(SUM(DATEDIFF(end_date, start_date) + 1), 0) as days
         FROM leaves
         WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND leave_type = 'Unpaid'
         AND start_date >= ? AND end_date <= ?`,
        [tenantId, emp.id, startDate, endDate]
      );
      const unpaidLeaveDays = Number(leaves[0].days) || 0;

      const deductionHours = (absentDays + unpaidLeaveDays) * 8;
      const grossSalary = Math.round(hourlyRate * actualHours);
      const deductions = Math.round(hourlyRate * deductionHours);
      const netSalary = Math.max(0, grossSalary - deductions);

      const payrollId = uuidv4();

      await db.execute(
        `INSERT INTO payroll (id, tenant_id, employee_id, pay_period_start, pay_period_end,
          hourly_rate, total_hours_worked, standard_hours, gross_salary, deductions, net_salary, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
         ON DUPLICATE KEY UPDATE
          hourly_rate=VALUES(hourly_rate), total_hours_worked=VALUES(total_hours_worked),
          standard_hours=VALUES(standard_hours), gross_salary=VALUES(gross_salary),
          deductions=VALUES(deductions), net_salary=VALUES(net_salary)`,
        [payrollId, tenantId, emp.id, startDate, endDate,
          hourlyRate, actualHours, standardHours, grossSalary, deductions, netSalary]
      );

      payrollRuns.push({
        employeeName: `${emp.first_name} ${emp.last_name}`,
        hourlyRate: (hourlyRate / 100).toFixed(2),
        hoursWorked: actualHours,
        standardHours,
        gross: (grossSalary / 100).toFixed(2),
        deductions: (deductions / 100).toFixed(2),
        net: (netSalary / 100).toFixed(2),
      });
    }

    res.json({
      message: `Payroll calculated for ${workingDays} working days (${standardHours} standard hours).`,
      workingDays,
      standardHours,
      runs: payrollRuns
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Payroll calculation failed.' });
  }
};

exports.getPayrollHistory = async (req, res) => {
  const tenantId = req.tenantId;
  const queryTarget = req.user.role === 'tenant_admin'
    ? 'SELECT p.*, e.first_name, e.last_name, e.email FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.tenant_id = ? ORDER BY p.created_at DESC'
    : 'SELECT p.*, e.first_name, e.last_name, e.email FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.tenant_id = ? AND p.employee_id = ? ORDER BY p.created_at DESC';

  const params = req.user.role === 'tenant_admin' ? [tenantId] : [tenantId, req.user.id];

  try {
    const [rows] = await db.execute(queryTarget, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payroll history.' });
  }
};

exports.downloadPayslip = async (req, res) => {
  const { payrollId } = req.params;
  const tenantId = req.tenantId;

  try {
    const [records] = await db.execute(
      `SELECT p.*, e.first_name, e.last_name, e.email, t.company_name
       FROM payroll p
       JOIN employees e ON p.employee_id = e.id
       JOIN tenants t ON p.tenant_id = t.id
       WHERE p.id = ? AND p.tenant_id = ?`,
      [payrollId, tenantId]
    );

    if (records.length === 0) return res.status(404).json({ error: 'Payslip not found.' });
    const data = records[0];

    if (req.user.role === 'employee' && req.user.id !== data.employee_id) {
      return res.status(403).json({ error: 'Unauthorized access.' });
    }

    const startDate = new Date(data.pay_period_start).toISOString().split('T')[0];
    const endDate = new Date(data.pay_period_end).toISOString().split('T')[0];

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip_${payrollId}.pdf`);
    doc.pipe(res);

    doc.fontSize(20).text(data.company_name.toUpperCase(), { align: 'center' });
    doc.fontSize(10).text('PAYSLIP - HOURLY BASIS', { align: 'center' }).moveDown(2);

    doc.text(`Employee: ${data.first_name} ${data.last_name}`);
    doc.text(`Email: ${data.email}`);
    doc.text(`Period: ${startDate} to ${endDate}`).moveDown(2);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(1);

    const hr = (data.hourly_rate / 100).toFixed(2);
    const stdHrs = data.standard_hours || 0;
    const wrkHrs = data.total_hours_worked || 0;

    doc.fontSize(11).text(`Hourly Rate: Rs.${hr}`);
    doc.text(`Standard Hours: ${stdHrs} hrs  (${stdHrs / 8} days × 8 hrs)`);
    doc.text(`Hours Worked: ${wrkHrs} hrs`).moveDown(1);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(1);

    doc.fontSize(14).text(`Gross Earnings (${wrkHrs} hrs × Rs.${hr}): Rs.${(data.gross_salary / 100).toFixed(2)}`);
    doc.text(`Deductions: -Rs.${(data.deductions / 100).toFixed(2)}`, { color: 'red' });
    doc.fontSize(16).text(`NET PAY: Rs.${(data.net_salary / 100).toFixed(2)}`, { underline: true });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate payslip PDF.' });
    }
  }
};
