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
  const { startDate, endDate, employeeIds, workingDays: manualDays } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const workingDays = manualDays || countWeekdays(startDate, endDate);
    const standardHours = workingDays * 8;

    if (standardHours === 0) {
      return res.status(400).json({ error: 'Pay period contains no working days.' });
    }

    let employeeQuery = 'SELECT id, base_salary, pay_per_hour, first_name, last_name FROM employees WHERE tenant_id = ?';
    const employeeParams = [tenantId];
    if (employeeIds && employeeIds.length > 0) {
      employeeQuery += ` AND id IN (${employeeIds.map(() => '?').join(',')})`;
      employeeParams.push(...employeeIds);
    }
    const [employees] = await db.execute(employeeQuery, employeeParams);

    const payrollRuns = [];

    for (const emp of employees) {
      const isPayPerHour = emp.pay_per_hour && emp.pay_per_hour > 0;

      const [attendance] = await db.execute(
        `SELECT COALESCE(SUM(total_hours), 0) as total_hours
         FROM attendance
         WHERE tenant_id = ? AND employee_id = ? AND date >= ? AND date <= ? AND total_hours > 0`,
        [tenantId, emp.id, startDate, endDate]
      );
      const actualHours = parseFloat(attendance[0].total_hours) || 0;

      let hourlyRate, grossSalary, deductions;
      let netSalary;

      if (isPayPerHour) {
        hourlyRate = emp.pay_per_hour;
        grossSalary = Math.round(hourlyRate * actualHours);
        deductions = 0;
        netSalary = grossSalary;
      } else {
        hourlyRate = Math.round(emp.base_salary / standardHours);

        const [absences] = await db.execute(
          `SELECT COUNT(*) as days
           FROM attendance
           WHERE tenant_id = ? AND employee_id = ? AND date >= ? AND date <= ? AND total_hours = 0`,
          [tenantId, emp.id, startDate, endDate]
        );
        const absentDays = Number(absences[0].days) || 0;

        const [leaves] = await db.execute(
          `SELECT COALESCE(SUM((end_date - start_date) + 1), 0) as days
           FROM leaves
           WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND leave_type = 'Unpaid'
           AND start_date >= ? AND end_date <= ?`,
          [tenantId, emp.id, startDate, endDate]
        );
        const unpaidLeaveDays = Number(leaves[0].days) || 0;

        const deductionHours = (absentDays + unpaidLeaveDays) * 8;
        grossSalary = Math.round(hourlyRate * actualHours);
        deductions = Math.round(hourlyRate * deductionHours);
        netSalary = Math.max(0, grossSalary - deductions);
      }

      let advanceDeduction = 0;

      // If recalculating an existing payroll, reverse previous advance deduction first
      const [existingPayroll] = await db.execute(
        `SELECT advance_deduction FROM payroll
         WHERE tenant_id = ? AND employee_id = ? AND pay_period_start = ? AND pay_period_end = ?`,
        [tenantId, emp.id, startDate, endDate]
      );
      if (existingPayroll.length > 0) {
        const prevAdvanceDeduction = Number(existingPayroll[0].advance_deduction) || 0;
        if (prevAdvanceDeduction > 0) {
          await db.execute(
            `UPDATE employee_advances SET remaining_balance = remaining_balance + ?
             WHERE tenant_id = ? AND employee_id = ? AND status IN ('approved', 'fully_paid')`,
            [prevAdvanceDeduction, tenantId, emp.id]
          );
          await db.execute(
            `UPDATE employee_advances SET status = 'approved'
             WHERE tenant_id = ? AND employee_id = ? AND status = 'fully_paid' AND remaining_balance > 0`,
            [tenantId, emp.id]
          );
        }
      }

      const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
      const tenantSettings = tenantRows[0]?.settings
        ? (typeof tenantRows[0].settings === 'string' ? JSON.parse(tenantRows[0].settings) : tenantRows[0].settings)
        : {};
      const advanceDeductionPct = (tenantSettings.advanceDeductionPct ?? 10) / 100;

      const [advances] = await db.execute(
        `SELECT id, remaining_balance FROM employee_advances
         WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND remaining_balance > 0
         ORDER BY created_at ASC`,
        [tenantId, emp.id]
      );

      if (advances.length > 0) {
        const totalRemaining = advances.reduce((sum, a) => sum + a.remaining_balance, 0);
        const maxAdvanceDeduction = Math.round(netSalary * advanceDeductionPct);
        let toDeduct = Math.min(totalRemaining, maxAdvanceDeduction);

        for (const adv of advances) {
          if (toDeduct <= 0) break;
          const deductFromThis = Math.min(adv.remaining_balance, toDeduct);
          await db.execute(
            'UPDATE employee_advances SET remaining_balance = remaining_balance - ? WHERE id = ?',
            [deductFromThis, adv.id]
          );
          toDeduct -= deductFromThis;
          advanceDeduction += deductFromThis;

          await db.execute(
            `UPDATE employee_advances SET status = 'fully_paid'
             WHERE id = ? AND remaining_balance <= 0`,
            [adv.id]
          );
        }

        netSalary = Math.max(0, netSalary - advanceDeduction);
      }

      const payrollId = uuidv4();

      await db.execute(
        `INSERT INTO payroll (id, tenant_id, employee_id, pay_period_start, pay_period_end,
          hourly_rate, total_hours_worked, standard_hours, gross_salary, deductions, advance_deduction, net_salary, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'due', NOW())
         ON CONFLICT (tenant_id, employee_id, pay_period_start, pay_period_end) DO UPDATE SET
          hourly_rate = EXCLUDED.hourly_rate, total_hours_worked = EXCLUDED.total_hours_worked,
          standard_hours = EXCLUDED.standard_hours, gross_salary = EXCLUDED.gross_salary,
          deductions = EXCLUDED.deductions, advance_deduction = EXCLUDED.advance_deduction,
          net_salary = EXCLUDED.net_salary, created_at = NOW()`,
        [payrollId, tenantId, emp.id, startDate, endDate,
          hourlyRate, actualHours, standardHours, grossSalary, deductions, advanceDeduction, netSalary]
      );

      payrollRuns.push({
        employeeName: `${emp.first_name} ${emp.last_name}`,
        hourlyRate: (hourlyRate / 100).toFixed(2),
        hoursWorked: actualHours,
        standardHours,
        gross: (grossSalary / 100).toFixed(2),
        deductions: (deductions / 100).toFixed(2),
        advanceDeduction: (advanceDeduction / 100).toFixed(2),
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
    ? 'SELECT p.*, e.first_name, e.last_name, e.email FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.tenant_id = ? ORDER BY COALESCE(p.created_at, p.pay_period_end) DESC'
    : 'SELECT p.*, e.first_name, e.last_name, e.email FROM payroll p JOIN employees e ON p.employee_id = e.id WHERE p.tenant_id = ? AND p.employee_id = ? ORDER BY COALESCE(p.created_at, p.pay_period_end) DESC';

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
      `SELECT p.*, e.first_name, e.last_name, e.email, e.role, e.base_salary, t.company_name
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

    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const raw = tenantRows[0]?.settings || '{}';
    const settings = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const sellerLegalName = settings.sellerLegalName || data.company_name;
    const sellerAddress = settings.sellerAddress || '';
    const sellerCity = settings.sellerCity || '';
    const sellerState = settings.sellerState || '';
    const sellerPincode = settings.sellerPincode || '';
    const sellerEmail = settings.sellerEmail || '';
    const sellerGstin = settings.sellerGstin || '';

    const startDate = new Date(data.pay_period_start).toISOString().split('T')[0];
    const endDate = new Date(data.pay_period_end).toISOString().split('T')[0];
    const fmtD = (d) => { const dt = new Date(d); return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip_${payrollId}.pdf`);
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(18).text(sellerLegalName.toUpperCase(), { align: 'center' });
    if (sellerAddress) doc.font('Helvetica').fontSize(9).text(sellerAddress, { align: 'center' });
    const cityLine = [sellerCity, sellerState].filter(Boolean).join(', ');
    const locLine = [cityLine, sellerPincode].filter(Boolean).join(' — ');
    if (locLine) doc.fontSize(9).text(locLine, { align: 'center' });
    if (sellerEmail) doc.fontSize(9).text(`Email: ${sellerEmail}`, { align: 'center' });
    if (sellerGstin) doc.fontSize(9).text(`GSTIN: ${sellerGstin}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(11).text('PAYSLIP', { align: 'center' });
    doc.moveDown(1);

    // Horizontal rule
    const hrY = doc.y;
    doc.moveTo(50, hrY).lineTo(545, hrY).stroke();
    doc.moveDown(0.5);

    // Employee info and period side-by-side
    const leftX = 50, rightX = 320;
    const infoY = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).text('EMPLOYEE DETAILS', leftX, infoY);
    doc.font('Helvetica-Bold').fontSize(10).text('PAY PERIOD', rightX, infoY);
    doc.moveDown(1.5);

    doc.font('Helvetica').fontSize(9);
    const empY = doc.y;
    doc.text(`Name: ${data.first_name} ${data.last_name}`, leftX, empY);
    doc.text(`From: ${fmtD(data.pay_period_start)}`, rightX, empY);
    doc.moveDown(0.8);
    const empY2 = doc.y;
    doc.text(`Email: ${data.email}`, leftX, empY2);
    doc.text(`To: ${fmtD(data.pay_period_end)}`, rightX, empY2);
    doc.moveDown(0.8);
    const empY3 = doc.y;
    doc.text(`Role: ${data.role || 'Employee'}`, leftX, empY3);
    doc.text(`Status: ${data.status === 'paid' ? 'Paid' : 'Due'}`, rightX, empY3, { continued: false });

    const payStatus = data.status === 'paid' ? 'Paid' : 'Due';
    const statusX = rightX + doc.widthOfString(`Status: `);
    doc.font('Helvetica-Bold').fontSize(9).text(payStatus, statusX, empY3, { continued: false });

    doc.moveDown(1.5);

    // Earnings table
    const tableY = doc.y;
    doc.moveTo(50, tableY).lineTo(545, tableY).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(10);
    const col = [50, 290, 380, 470];
    const colW = [240, 90, 90, 80];
    doc.text('Description', col[0], doc.y, { width: colW[0] });
    doc.text('Rate', col[1], doc.y, { width: colW[1], align: 'right' });
    doc.text('Qty/Hours', col[2], doc.y, { width: colW[2], align: 'right' });
    doc.text('Amount', col[3], doc.y, { width: colW[3], align: 'right' });
    doc.moveDown(0.3);
    const lineY = doc.y;
    doc.moveTo(50, lineY).lineTo(545, lineY).stroke();
    doc.moveDown(0.5);

    const hr = (data.hourly_rate / 100).toFixed(2);
    const stdHrs = data.standard_hours || 0;
    const wrkHrs = data.total_hours_worked || 0;
    const grossAmt = (data.gross_salary / 100).toFixed(2);
    const dedAmt = (data.deductions / 100).toFixed(2);
    const advDedAmt = (data.advance_deduction / 100).toFixed(2);
    const netAmt = (data.net_salary / 100).toFixed(2);

    doc.font('Helvetica').fontSize(9);
    let yPos = doc.y;

    doc.text('Gross Pay (Hours Worked)', col[0], yPos, { width: colW[0] });
    doc.text(`₹${hr}`, col[1], yPos, { width: colW[1], align: 'right' });
    doc.text(`${wrkHrs}h`, col[2], yPos, { width: colW[2], align: 'right' });
    doc.text(`₹${grossAmt}`, col[3], yPos, { width: colW[3], align: 'right' });
    yPos += 18;

    if (parseFloat(data.deductions) > 0) {
      const dc = '#dc2626';
      doc.text('Absence Deductions', col[0], yPos, { width: colW[0], color: dc });
      doc.text('-', col[1], yPos, { width: colW[1], align: 'right', color: dc });
      doc.text(`${(data.deductions / data.hourly_rate).toFixed(1)}h`, col[2], yPos, { width: colW[2], align: 'right', color: dc });
      doc.text(`-₹${dedAmt}`, col[3], yPos, { width: colW[3], align: 'right', color: dc });
      yPos += 18;
    }

    if (parseFloat(data.advance_deduction) > 0) {
      const ac = '#d97706';
      doc.text('Advance Deduction', col[0], yPos, { width: colW[0], color: ac });
      doc.text('-', col[1], yPos, { width: colW[1], align: 'right', color: ac });
      doc.text('-', col[2], yPos, { width: colW[2], align: 'right', color: ac });
      doc.text(`-₹${advDedAmt}`, col[3], yPos, { width: colW[3], align: 'right', color: ac });
      yPos += 18;
    }

    // Total line
    doc.moveTo(50, yPos).lineTo(545, yPos).stroke();
    yPos += 5;
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text('NET PAYABLE', col[0], yPos, { width: colW[0] });
    doc.text(`₹${netAmt}`, col[3], yPos, { width: colW[3], align: 'right' });
    yPos += 25;

    // Status badge
    doc.font('Helvetica').fontSize(9);
    const statusColor = data.status === 'paid' ? '#059669' : '#d97706';
    doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(10);
    doc.text(`Payment Status: ${payStatus.toUpperCase()}`, col[0], yPos);
    doc.fillColor('black');

    // Summary section at bottom
    yPos += 30;
    doc.moveTo(50, yPos).lineTo(545, yPos).stroke();
    yPos += 10;
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
    doc.text(`Standard Hours: ${stdHrs}h (${stdHrs / 8} days × 8 hrs) | Hourly Rate: ₹${hr}/hr`, col[0], yPos, { width: 495 });
    yPos += 12;
    doc.text(`Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, col[0], yPos, { width: 495 });

    doc.end();
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate payslip PDF.' });
    }
  }
};

exports.markPayrollPaid = async (req, res) => {
  const { payrollId } = req.params;
  const tenantId = req.tenantId;

  try {
    const [result] = await db.execute(
      'UPDATE payroll SET status = ? WHERE id = ? AND tenant_id = ?',
      ['paid', payrollId, tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Payroll record not found.' });
    }
    res.json({ message: 'Payroll marked as paid.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update payroll status.' });
  }
};
