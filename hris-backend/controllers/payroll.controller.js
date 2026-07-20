const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Excludes attendance days already covered by a paid payroll record for the same employee,
// so already-paid hours are never counted again in future payroll runs. Only records that
// actually have hours (>0) are considered, so a broken/empty paid record can't block recomputation.
function paidExclusionClause() {
  return ` AND NOT EXISTS (
    SELECT 1 FROM payroll p
    WHERE p.tenant_id = a.tenant_id AND p.employee_id = a.employee_id
      AND p.status = 'paid' AND p.total_hours_worked > 0
      AND a.date >= p.pay_period_start AND a.date <= p.pay_period_end
  )`;
}

exports.calculatePayroll = async (req, res) => {
  const { startDate, endDate, employeeIds, workingDays: manualDays, advanceDeductions } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    if (endDate > today) {
      return res.status(400).json({ error: 'Pay period end date cannot be in the future.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date must be on or before end date.' });
    }

    const workingDays = manualDays || countWeekdays(startDate, endDate);
    const standardHours = workingDays * 8;

    if (standardHours === 0) {
      return res.status(400).json({ error: 'Pay period contains no working days.' });
    }

    let employeeQuery = `SELECT id, base_salary, pay_per_hour, first_name, last_name FROM employees WHERE tenant_id = ? AND status = 'active'`;
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
        `SELECT COALESCE(SUM(a.total_hours), 0) as total_hours
         FROM attendance a
         WHERE a.tenant_id = ? AND a.employee_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours > 0
         ${paidExclusionClause()}`,
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
           FROM attendance a
           WHERE a.tenant_id = ? AND a.employee_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours = 0
           ${paidExclusionClause()}`,
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
        const override = advanceDeductions && advanceDeductions[emp.id];
        let toDeduct;
        if (override !== undefined && override !== null && Number(override) > 0) {
          toDeduct = Math.min(Math.round(Number(override)), netSalary, totalRemaining);
        } else {
          const maxAdvanceDeduction = Math.round(netSalary * advanceDeductionPct);
          toDeduct = Math.min(totalRemaining, maxAdvanceDeduction);
        }

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
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'paid', NOW())
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

exports.previewPayroll = async (req, res) => {
  const { startDate, endDate, employeeIds } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Start date and end date are required.' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    if (endDate > today) {
      return res.status(400).json({ error: 'Pay period end date cannot be in the future.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date must be on or before end date.' });
    }

    const workingDays = countWeekdays(startDate, endDate);
    const standardHours = workingDays * 8;
    if (standardHours === 0) {
      return res.status(400).json({ error: 'Pay period contains no working days.' });
    }

    let employeeQuery = `SELECT id, base_salary, pay_per_hour, first_name, last_name FROM employees WHERE tenant_id = ? AND status = 'active'`;
    const employeeParams = [tenantId];
    if (employeeIds && employeeIds.length > 0) {
      employeeQuery += ` AND id IN (${employeeIds.map(() => '?').join(',')})`;
      employeeParams.push(...employeeIds);
    }
    const [employees] = await db.execute(employeeQuery, employeeParams);

    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const tenantSettings = tenantRows[0]?.settings
      ? (typeof tenantRows[0].settings === 'string' ? JSON.parse(tenantRows[0].settings) : tenantRows[0].settings)
      : {};
    const advanceDeductionPct = (tenantSettings.advanceDeductionPct ?? 10) / 100;

    const runs = [];

    for (const emp of employees) {
      const isPayPerHour = emp.pay_per_hour && emp.pay_per_hour > 0;

      const [attendance] = await db.execute(
        `SELECT COALESCE(SUM(a.total_hours), 0) as total_hours
         FROM attendance a
         WHERE a.tenant_id = ? AND a.employee_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours > 0
         ${paidExclusionClause()}`,
        [tenantId, emp.id, startDate, endDate]
      );
      const actualHours = parseFloat(attendance[0].total_hours) || 0;

      let hourlyRate, grossSalary, deductions;

      if (isPayPerHour) {
        hourlyRate = emp.pay_per_hour;
        grossSalary = Math.round(hourlyRate * actualHours);
        deductions = 0;
      } else {
        hourlyRate = Math.round(emp.base_salary / standardHours);
        const [absences] = await db.execute(
          `SELECT COUNT(*) as days
           FROM attendance a
           WHERE a.tenant_id = ? AND a.employee_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours = 0
           ${paidExclusionClause()}`,
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
      }

      const netBeforeAdvance = Math.max(0, grossSalary - deductions);

      const [advances] = await db.execute(
        `SELECT COALESCE(SUM(remaining_balance), 0) as total_remaining
         FROM employee_advances
         WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND remaining_balance > 0`,
        [tenantId, emp.id]
      );
      const outstandingAdvance = Math.round(Number(advances[0]?.total_remaining) || 0);
      const suggestedAdvanceDeduction = Math.min(outstandingAdvance, Math.round(netBeforeAdvance * advanceDeductionPct));
      const netSalary = Math.max(0, netBeforeAdvance - suggestedAdvanceDeduction);

      runs.push({
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        actualHours,
        standardHours,
        hourlyRate,
        grossSalary,
        deductions,
        dueAmount: netBeforeAdvance,
        outstandingAdvance,
        suggestedAdvanceDeduction,
        advanceDeduction: suggestedAdvanceDeduction,
        netSalary,
      });
    }

    res.json({
      workingDays,
      standardHours,
      runs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Payroll preview failed.' });
  }
};

exports.getPayrollHistory = async (req, res) => {
  const tenantId = req.tenantId;
  const COLS = `p.id, p.tenant_id, p.employee_id,
    to_char(p.pay_period_start, 'YYYY-MM-DD') as pay_period_start,
    to_char(p.pay_period_end, 'YYYY-MM-DD') as pay_period_end,
    p.hourly_rate, p.total_hours_worked, p.standard_hours,
    p.gross_salary, p.deductions, p.advance_deduction, p.net_salary,
    p.status, p.created_at`;
  const queryTarget = req.user.role === 'tenant_admin'
    ? `SELECT ${COLS}, e.first_name, e.last_name, e.email,
       (SELECT COALESCE(SUM(ea.remaining_balance), 0) FROM employee_advances ea
        WHERE ea.tenant_id = p.tenant_id AND ea.employee_id = p.employee_id
        AND ea.status = 'approved' AND ea.remaining_balance > 0) as outstanding_advance
       FROM payroll p JOIN employees e ON p.employee_id = e.id
       WHERE p.tenant_id = ? AND e.status = 'active' ORDER BY COALESCE(p.created_at, p.pay_period_end) DESC`
    : `SELECT ${COLS}, e.first_name, e.last_name, e.email,
       (SELECT COALESCE(SUM(ea.remaining_balance), 0) FROM employee_advances ea
        WHERE ea.tenant_id = p.tenant_id AND ea.employee_id = p.employee_id
        AND ea.status = 'approved' AND ea.remaining_balance > 0) as outstanding_advance
       FROM payroll p JOIN employees e ON p.employee_id = e.id
       WHERE p.tenant_id = ? AND p.employee_id = ? AND e.status = 'active' ORDER BY COALESCE(p.created_at, p.pay_period_end) DESC`;

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

    // Register font with ₹ support (fall back to Helvetica if unavailable)
    const fontDir = path.join(__dirname, '..', 'fonts');
    const fontRegular = path.join(fontDir, 'NotoSans-Regular.ttf');
    const fontBold = path.join(fontDir, 'NotoSans-Bold.ttf');
    const hasFont = fs.existsSync(fontRegular);
    if (hasFont) {
      doc.registerFont('Custom', fontRegular);
      doc.registerFont('Custom-Bold', fontBold);
    }
    const RF = (bold) => hasFont ? (bold ? 'Custom-Bold' : 'Custom') : (bold ? 'Helvetica-Bold' : 'Helvetica');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payslip_${payrollId}.pdf`);
    doc.pipe(res);

    doc.font(RF(true)).fontSize(18).text(sellerLegalName.toUpperCase(), { align: 'center' });
    if (sellerAddress) doc.font(RF(false)).fontSize(9).text(sellerAddress, { align: 'center' });
    const cityLine = [sellerCity, sellerState].filter(Boolean).join(', ');
    const locLine = [cityLine, sellerPincode].filter(Boolean).join(' — ');
    if (locLine) doc.fontSize(9).text(locLine, { align: 'center' });
    if (sellerEmail) doc.fontSize(9).text(`Email: ${sellerEmail}`, { align: 'center' });
    if (sellerGstin) doc.fontSize(9).text(`GSTIN: ${sellerGstin}`, { align: 'center' });
    doc.moveDown(0.5);
    doc.font(RF(true)).fontSize(11).text('PAYSLIP', { align: 'center' });
    doc.moveDown(1);

    // Horizontal rule
    const hrY = doc.y;
    doc.moveTo(50, hrY).lineTo(545, hrY).stroke();
    doc.moveDown(0.5);

    // Employee info and period side-by-side
    const leftX = 50, rightX = 320;
    const infoY = doc.y;
    doc.font(RF(true)).fontSize(10).text('EMPLOYEE DETAILS', leftX, infoY);
    doc.font(RF(true)).fontSize(10).text('PAY PERIOD', rightX, infoY);
    doc.moveDown(1.5);

    doc.font(RF(false)).fontSize(9);
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
    doc.font(RF(true)).fontSize(9).text(payStatus, statusX, empY3, { continued: false });

    doc.moveDown(1.5);

    // Earnings table
    const tableY = doc.y;
    doc.moveTo(50, tableY).lineTo(545, tableY).stroke();
    doc.moveDown(0.3);

    doc.font(RF(true)).fontSize(10);
    const col = [50, 290, 380, 470];
    const colW = [240, 90, 90, 80];
    const headerY = doc.y;
    doc.text('Description', col[0], headerY, { width: colW[0] });
    doc.text('Rate', col[1], headerY, { width: colW[1], align: 'right' });
    doc.text('Qty/Hours', col[2], headerY, { width: colW[2], align: 'right' });
    doc.text('Amount', col[3], headerY, { width: colW[3], align: 'right' });
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

    doc.font(RF(false)).fontSize(9);
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
    doc.font(RF(true)).fontSize(11);
    doc.text('NET PAYABLE', col[0], yPos, { width: colW[0] });
    doc.text(`₹${netAmt}`, col[3], yPos, { width: colW[3], align: 'right' });
    yPos += 25;

    // Status badge
    doc.font(RF(false)).fontSize(9);
    const statusColor = data.status === 'paid' ? '#059669' : '#d97706';
    doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(10);
    doc.text(`Payment Status: ${payStatus.toUpperCase()}`, col[0], yPos);
    doc.fillColor('black');

    // Summary section at bottom
    yPos += 30;
    doc.moveTo(50, yPos).lineTo(545, yPos).stroke();
    yPos += 10;
    doc.font(RF(false)).fontSize(8).fillColor('#6b7280');
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

exports.deletePayrollHistory = async (req, res) => {
  const tenantId = req.tenantId;
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No payroll IDs provided.' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    // Reverse any advance deductions so the employee's outstanding balance is restored
    // and the hours become unpaid (due) again — keeps due/paid consistent.
    const [records] = await db.execute(
      `SELECT id, employee_id, advance_deduction FROM payroll
       WHERE tenant_id = ? AND id IN (${placeholders})`,
      [tenantId, ...ids]
    );
    for (const rec of records) {
      const amt = Number(rec.advance_deduction) || 0;
      if (amt > 0) {
        await db.execute(
          `UPDATE employee_advances SET remaining_balance = remaining_balance + ?
           WHERE tenant_id = ? AND employee_id = ? AND status IN ('approved', 'fully_paid')`,
          [amt, tenantId, rec.employee_id]
        );
        await db.execute(
          `UPDATE employee_advances SET status = 'approved'
           WHERE tenant_id = ? AND employee_id = ? AND status = 'fully_paid' AND remaining_balance > 0`,
          [tenantId, rec.employee_id]
        );
      }
    }
    const [result] = await db.execute(
      `DELETE FROM payroll WHERE tenant_id = ? AND id IN (${placeholders})`,
      [tenantId, ...ids]
    );
    res.json({ message: `${result.rowCount} payroll record(s) deleted.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete payroll records.' });
  }
};

exports.updateManualAdvanceDeduction = async (req, res) => {
  const { payrollId } = req.params;
  const { advanceDeduction } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const deductionAmount = Math.round(Number(advanceDeduction));
    if (isNaN(deductionAmount) || deductionAmount < 0) {
      return res.status(400).json({ error: 'Advance deduction must be a non-negative number.' });
    }

    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
    const tenantSettings = tenantRows[0]?.settings
      ? (typeof tenantRows[0].settings === 'string' ? JSON.parse(tenantRows[0].settings) : tenantRows[0].settings)
      : {};
    const advanceDeductionPct = tenantSettings.advanceDeductionPct ?? 10;

    if (advanceDeductionPct > 0) {
      return res.status(400).json({
        error: 'Manual advance deduction is only available when Advance Deduction % is set to 0 in Settings.'
      });
    }

    const [payrollRows] = await db.execute(
      'SELECT * FROM payroll WHERE id = ? AND tenant_id = ?',
      [payrollId, tenantId]
    );
    if (payrollRows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found.' });
    }
    const payroll = payrollRows[0];

    if (payroll.status !== 'due') {
      return res.status(400).json({ error: 'Advance deduction can only be modified for payroll records with Due status.' });
    }

    const [advances] = await db.execute(
      `SELECT COALESCE(SUM(remaining_balance), 0) as total_outstanding
       FROM employee_advances
       WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND remaining_balance > 0`,
      [tenantId, payroll.employee_id]
    );
    const outstandingBalance = Number(advances[0].total_outstanding) || 0;

    if (deductionAmount > 0 && deductionAmount > outstandingBalance) {
      return res.status(400).json({
        error: `Advance deduction cannot exceed the employee's outstanding advance balance (₹${(outstandingBalance / 100).toFixed(2)}).`
      });
    }

    // Reverse any previous advance deduction on this payroll record
    const prevAdvanceDeduction = Number(payroll.advance_deduction) || 0;
    if (prevAdvanceDeduction > 0) {
      await db.execute(
        `UPDATE employee_advances SET remaining_balance = remaining_balance + ?
         WHERE tenant_id = ? AND employee_id = ? AND status IN ('approved', 'fully_paid')`,
        [prevAdvanceDeduction, tenantId, payroll.employee_id]
      );
      await db.execute(
        `UPDATE employee_advances SET status = 'approved'
         WHERE tenant_id = ? AND employee_id = ? AND status = 'fully_paid' AND remaining_balance > 0`,
        [tenantId, payroll.employee_id]
      );
    }

    // Apply the new deduction across advances (FIFO)
    if (deductionAmount > 0) {
      const [advanceRows] = await db.execute(
        `SELECT id, remaining_balance FROM employee_advances
         WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND remaining_balance > 0
         ORDER BY created_at ASC`,
        [tenantId, payroll.employee_id]
      );

      let toDeduct = deductionAmount;
      for (const adv of advanceRows) {
        if (toDeduct <= 0) break;
        const deductFromThis = Math.min(adv.remaining_balance, toDeduct);
        await db.execute(
          'UPDATE employee_advances SET remaining_balance = remaining_balance - ? WHERE id = ?',
          [deductFromThis, adv.id]
        );
        toDeduct -= deductFromThis;
        await db.execute(
          `UPDATE employee_advances SET status = 'fully_paid'
           WHERE id = ? AND remaining_balance <= 0`,
          [adv.id]
        );
      }
    }

    const newNetSalary = Math.max(0, payroll.net_salary + prevAdvanceDeduction - deductionAmount);
    await db.execute(
      'UPDATE payroll SET advance_deduction = ?, net_salary = ? WHERE id = ? AND tenant_id = ?',
      [deductionAmount, newNetSalary, payrollId, tenantId]
    );

    res.json({
      message: deductionAmount > 0
        ? `Advance deduction of ₹${(deductionAmount / 100).toFixed(2)} applied.`
        : 'Advance deduction cleared.',
      advanceDeduction: (deductionAmount / 100).toFixed(2),
      netSalary: (newNetSalary / 100).toFixed(2),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update advance deduction.' });
  }
};

// Total amount still owed for worked hours that have NOT yet been paid.
// Mirrors calculatePayroll: active employees, unpaid attendance hours (paid periods excluded),
// salary employees deduct absences/unpaid leave. This is the system-wide "due" figure.
exports.getDueSummary = async (req, res) => {
  const tenantId = req.tenantId;
  const { start, end } = req.query;
  const today = new Date();
  const rangeStart = start || fmtDate(new Date(today.getFullYear(), today.getMonth(), 1));
  const rangeEnd = end || fmtDate(today);

  try {
    const [employees] = await db.execute(
      `SELECT id, base_salary, pay_per_hour FROM employees WHERE tenant_id = ? AND status = 'active'`,
      [tenantId]
    );
    const standardHours = countWeekdays(rangeStart, rangeEnd) * 8;

    let dueAmount = 0;
    let dueHours = 0;

    for (const emp of employees) {
      const isPayPerHour = emp.pay_per_hour && emp.pay_per_hour > 0;

      const [attendance] = await db.execute(
        `SELECT COALESCE(SUM(a.total_hours), 0) as total_hours
         FROM attendance a
         WHERE a.tenant_id = ? AND a.employee_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours > 0
         ${paidExclusionClause()}`,
        [tenantId, emp.id, rangeStart, rangeEnd]
      );
      const actualHours = parseFloat(attendance[0].total_hours) || 0;
      if (actualHours === 0) continue;

      let netSalary;
      if (isPayPerHour) {
        netSalary = Math.round(emp.pay_per_hour * actualHours);
      } else {
        if (standardHours === 0) continue;
        const hourlyRate = Math.round(emp.base_salary / standardHours);
        const [absences] = await db.execute(
          `SELECT COUNT(*) as days
           FROM attendance a
           WHERE a.tenant_id = ? AND a.employee_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours = 0
           ${paidExclusionClause()}`,
          [tenantId, emp.id, rangeStart, rangeEnd]
        );
        const absentDays = Number(absences[0].days) || 0;
        const [leaves] = await db.execute(
          `SELECT COALESCE(SUM((end_date - start_date) + 1), 0) as days
           FROM leaves
           WHERE tenant_id = ? AND employee_id = ? AND status = 'approved' AND leave_type = 'Unpaid'
           AND start_date >= ? AND end_date <= ?`,
          [tenantId, emp.id, rangeStart, rangeEnd]
        );
        const unpaidLeaveDays = Number(leaves[0].days) || 0;
        const deductionHours = (absentDays + unpaidLeaveDays) * 8;
        const gross = Math.round(hourlyRate * actualHours);
        const deductions = Math.round(hourlyRate * deductionHours);
        netSalary = Math.max(0, gross - deductions);
      }

      dueAmount += netSalary;
      dueHours += actualHours;
    }

    res.json({ dueAmount, dueHours, employees: employees.length, start: rangeStart, end: rangeEnd });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to compute due summary.' });
  }
};
