const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');

// 1. RUN AND GENERATE PAYROLL DRAFTS
exports.calculatePayroll = async (req, res) => {
  const { startDate, endDate, totalWorkingDays } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    // Fetch all active employees under this tenant
    const [employees] = await db.execute(
      'SELECT id, base_salary, first_name, last_name FROM employees WHERE tenant_id = ?',
      [tenantId]
    );

    const payrollRuns = [];

    for (let emp of employees) {
      // Find total approved Unpaid leaves within this date window
      const [leaves] = await db.execute(
        `SELECT SUM(DATEDIFF(end_date, start_date) + 1) as days
                 FROM leaves
                 WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND leave_type = 'Unpaid'
                 AND start_date >= ? AND end_date <= ?`,
        [tenantId, emp.id, startDate, endDate]
      );

      const unpaidDays = leaves[0].days || 0;
      const baseSalary = emp.base_salary;

      // Strict integer currency operations (cents precision)
      const dailyRate = baseSalary / totalWorkingDays;
      const deductions = Math.round(dailyRate * unpaidDays);
      const netSalary = baseSalary - deductions;

      const payrollId = uuidv4();

      // Insert or replace on duplicate configuration tracking
      await db.execute(
        `INSERT INTO payroll (id, tenant_id, employee_id, pay_period_start, pay_period_end, gross_salary, deductions, net_salary, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
                 ON DUPLICATE KEY UPDATE gross_salary=VALUES(gross_salary), deductions=VALUES(deductions), net_salary=VALUES(net_salary)`,
        [payrollId, tenantId, emp.id, startDate, endDate, baseSalary, deductions, netSalary]
      );

      payrollRuns.push({
        employeeName: `${emp.first_name} ${emp.last_name}`,
        gross: (baseSalary / 100).toFixed(2),
        deductions: (deductions / 100).toFixed(2),
        net: (netSalary / 100).toFixed(2)
      });
    }

    res.json({ message: 'Payroll system calculation pass completed.', runs: payrollRuns });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Payroll calculation sweep encountered an exception.' });
  }
};

// 2. GET TENANT PAYROLL RECORDS
exports.getPayrollHistory = async (req, res) => {
  const tenantId = req.tenantId;
  const queryTarget = req.user.role === 'tenant_admin'
    ? 'SELECT p.*, e.first_name, e.last_name, e.email FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.tenant_id = ?'
    : 'SELECT p.*, e.first_name, e.last_name, e.email FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.tenant_id = ? AND p.employee_id = ?';

  const params = req.user.role === 'tenant_admin' ? [tenantId] : [tenantId, req.user.id];

  try {
    const [rows] = await db.execute(queryTarget, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to query historical ledger logs.' });
  }
};

// 3. STREAM DOWNLOADABLE PAYSLIP PDF
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

    if (records.length === 0) return res.status(404).json({ error: 'Payslip record context not found.' });
    const data = records[0];

    // Security check: Standard employees can only view their own slips
    if (req.user.role === 'employee' && req.user.id !== data.employee_id) {
      return res.status(403).json({ error: 'Unauthorized access allocation denied.' });
    }

    const doc = new PDFDocument({ margin: 50 });

    // Direct buffer streaming architecture header settings
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip_${payrollId}.pdf`);
    doc.pipe(res);

    // PDF Styling Generation Pass
    doc.fontSize(20).text(data.company_name.toUpperCase(), { align: 'center' });
    doc.fontSize(10).text('OFFICIAL WORKSPACE EARNINGS STATEMENT', { align: 'center' }).moveDown(2);

    doc.text(`Employee Name: ${data.first_name} ${data.last_name}`);
    doc.text(`Email Address: ${data.email}`);
    doc.text(`Pay Cycle Window: ${data.pay_period_start} to ${data.pay_period_end}`).moveDown(2);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(1);

    doc.fontSize(14).text(`Gross Base Earnings: $${(data.gross_salary / 100).toFixed(2)}`);
    doc.text(`Absence Deductions: -$${(data.deductions / 100).toFixed(2)}`, { color: 'red' });
    doc.fontSize(16).text(`NET AMOUNT DISTRIBUTED: $${(data.net_salary / 100).toFixed(2)}`, { underline: true });

    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'PDF layout pipeline compiler fault.' });
  }
};
