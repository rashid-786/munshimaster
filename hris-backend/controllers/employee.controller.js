const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');
const { incrementUsage } = require('../services/usage.service');

exports.createEmployee = async (req, res) => {
const { firstName, lastName, email, password, role, baseSalary, phone, profession, otherProfession, jobType, payPerHour, salaryType, pieceWorkType, pieceUnitLabel, pieceRate, pieceRates, openingAdvance, address, notes, joiningDate } = req.body;
  const tenantId = req.tenantId;

  try {
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    if (email) {
      const [existing] = await db.execute(
        'SELECT id FROM employees WHERE email = ? AND tenant_id = ?',
        [email, tenantId]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'An employee with this email already exists in your company.' });
      }
    }

    const [phoneExists] = await db.execute(
      'SELECT id FROM employees WHERE phone = ? AND tenant_id = ?',
      [phone, tenantId]
    );
    if (phoneExists.length > 0 && (role || 'employee') !== 'employee') {
      return res.status(400).json({ error: 'Phone number already in use by another staff member.' });
    }

    const employeeId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const salaryInCents = baseSalary !== undefined && baseSalary !== '' ? parseFloat(baseSalary) : 0;
    const payPerHourCents = payPerHour !== undefined && payPerHour !== '' ? parseFloat(payPerHour) : null;
    const emailVal = email || `emp-${employeeId.slice(0,8)}@local`;

    await db.execute(
      `INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, password_hash, role, job_type, base_salary, pay_per_hour, status, profession, other_profession, salary_type, address, notes, joining_date, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, NOW())`,
      [employeeId, tenantId, firstName, lastName, emailVal, phone || null, hashedPassword, role || 'employee', jobType || 'permanent', salaryInCents, payPerHourCents, profession || null, otherProfession || null, salaryType || 'fixed', address || null, notes || null, joiningDate || null]
    );

    // Insert piece rates if provided
    if (salaryType === 'piece' && pieceRates && Array.isArray(pieceRates) && pieceRates.length > 0) {
      for (const pr of pieceRates) {
        if (!pr.workType) continue;
        const prId = uuidv4();
        await db.execute(
          'INSERT INTO employee_piece_rates (id, tenant_id, employee_id, work_type, unit_label, rate_per_piece) VALUES (?, ?, ?, ?, ?, ?)',
          [prId, tenantId, employeeId, pr.workType, pr.unitLabel || 'pcs', pr.ratePerPiece ? parseFloat(pr.ratePerPiece) : 0]
        );
      }
    }

    // Convert opening balance to an advance entry
    if (openingAdvance !== undefined && openingAdvance !== '') {
      const advanceAmount = parseFloat(openingAdvance);
      if (advanceAmount > 0) {
        const advanceId = uuidv4();
        await db.execute(
          `INSERT INTO employee_advances (id, tenant_id, employee_id, amount, remaining_balance, reason, status, approved_by, approved_at, created_at)
           VALUES (?, ?, ?, ?, ?, 'Opening Balance', 'approved', ?, NOW(), NOW())`,
          [advanceId, tenantId, employeeId, Math.round(advanceAmount * 100), Math.round(advanceAmount * 100), req.user.id]
        );
      }
    }

    incrementUsage(tenantId, 'staff_count').catch(() => {});

    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'employee.created', entityType: 'employee', entityId: employeeId, req });

    res.status(201).json({ message: 'Employee onboarded successfully!', employeeId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to onboard employee.' });
  }
};

exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  const { firstName, lastName, email, role, baseSalary, phone, profession, otherProfession, jobType, payPerHour, salaryType, pieceWorkType, pieceUnitLabel, pieceRate, pieceRates, openingAdvance, address, notes, joiningDate } = req.body;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First and last name are required.' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Employee not found in this tenant.' });
    }

    const [phoneExists] = await db.execute(
      'SELECT id FROM employees WHERE phone = ? AND tenant_id = ? AND id != ?',
      [phone, tenantId, id]
    );
    if (phoneExists.length > 0 && (role || 'employee') !== 'employee') {
      return res.status(400).json({ error: 'Phone number already in use by another staff member.' });
    }

    const updates = [];
    const params = [];

    if (firstName !== undefined) { updates.push('first_name = ?'); params.push(firstName); }
    if (lastName !== undefined) { updates.push('last_name = ?'); params.push(lastName); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (baseSalary !== undefined && baseSalary !== '') {
      updates.push('base_salary = ?');
      params.push(parseFloat(baseSalary));
    }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone || null); }
    if (profession !== undefined) { updates.push('profession = ?'); params.push(profession || null); }
    if (otherProfession !== undefined) { updates.push('other_profession = ?'); params.push(otherProfession || null); }
    if (jobType !== undefined) { updates.push('job_type = ?'); params.push(jobType); }
    if (payPerHour !== undefined) {
      updates.push('pay_per_hour = ?');
      params.push(payPerHour !== '' ? parseFloat(payPerHour) : null);
    }
    if (salaryType !== undefined) { updates.push('salary_type = ?'); params.push(salaryType); }
    if (pieceWorkType !== undefined) { updates.push('piece_work_type = ?'); params.push(pieceWorkType || null); }
    if (pieceUnitLabel !== undefined) { updates.push('piece_unit_label = ?'); params.push(pieceUnitLabel || null); }
    if (address !== undefined) { updates.push('address = ?'); params.push(address || null); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes || null); }
    if (joiningDate !== undefined) { updates.push('joining_date = ?'); params.push(joiningDate || null); }
    if (pieceRate !== undefined) {
      updates.push('piece_rate = ?');
      params.push(pieceRate !== '' ? parseFloat(pieceRate) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id, tenantId);
    await db.execute(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    // Replace piece rates if array provided
    if (pieceRates && Array.isArray(pieceRates)) {
      await db.execute('DELETE FROM employee_piece_rates WHERE tenant_id = ? AND employee_id = ?', [tenantId, id]);
      for (const pr of pieceRates) {
        if (!pr.workType) continue;
        const prId = uuidv4();
        await db.execute(
          'INSERT INTO employee_piece_rates (id, tenant_id, employee_id, work_type, unit_label, rate_per_piece) VALUES (?, ?, ?, ?, ?, ?)',
          [prId, tenantId, id, pr.workType, pr.unitLabel || 'pcs', pr.ratePerPiece ? parseFloat(pr.ratePerPiece) : 0]
        );
      }
    }

    // Convert opening advance to advance entry (single source of truth)
    if (openingAdvance !== undefined) {
      const advanceAmount = parseFloat(openingAdvance);
      if (advanceAmount > 0) {
        // Deactivate any existing "Opening Balance" advance entries
        await db.execute(
          'UPDATE employee_advances SET status = \'rejected\' WHERE tenant_id = ? AND employee_id = ? AND reason = \'Opening Balance\'',
          [tenantId, id]
        );
        // Create new advance entry
        const advanceId = uuidv4();
        await db.execute(
          `INSERT INTO employee_advances (id, tenant_id, employee_id, amount, remaining_balance, reason, status, approved_by, approved_at, created_at)
           VALUES (?, ?, ?, ?, ?, 'Opening Balance', 'approved', ?, NOW(), NOW())`,
          [advanceId, tenantId, id, Math.round(advanceAmount * 100), Math.round(advanceAmount * 100), req.user.id]
        );
      } else if (openingAdvance === '' || openingAdvance === null || openingAdvance === undefined) {
        // Zero out any existing Opening Balance advances
        await db.execute(
          'UPDATE employee_advances SET status = \'rejected\' WHERE tenant_id = ? AND employee_id = ? AND reason = \'Opening Balance\'',
          [tenantId, id]
        );
      }
    }

    const changes = {};
    if (firstName !== undefined) changes.firstName = firstName;
    if (lastName !== undefined) changes.lastName = lastName;
    if (email !== undefined) changes.email = email;
    if (role !== undefined) changes.role = role;
    if (baseSalary !== undefined) changes.baseSalary = baseSalary;
    if (phone !== undefined) changes.phone = phone;
    if (profession !== undefined) changes.profession = profession;
    if (otherProfession !== undefined) changes.otherProfession = otherProfession;
    if (jobType !== undefined) changes.jobType = jobType;

    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'employee.updated', entityType: 'employee', entityId: id, changes, req });

    res.json({ message: 'Employee updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
};

exports.getEmployees = async (req, res) => {
  const tenantId = req.tenantId;
  const { includeDeactivated, status } = req.query;

  try {
    let query = 'SELECT e.id, e.first_name, e.last_name, e.email, e.phone, e.role, e.job_type, e.base_salary, e.pay_per_hour, e.profession, e.other_profession, e.salary_type, e.piece_work_type, e.piece_unit_label, e.piece_rate, e.status, e.created_at, e.address, e.notes, e.joining_date, (SELECT COALESCE(SUM(ea.amount), 0) FROM employee_advances ea WHERE ea.employee_id = e.id AND ea.reason = \'Opening Balance\' AND ea.status IN (\'approved\', \'fully_paid\')) as opening_advance FROM employees e WHERE e.tenant_id = ? AND (e.role IS NULL OR e.role != \'tenant_admin\')';
    const params = [tenantId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    } else if (includeDeactivated !== 'true') {
      query += ' AND status = ?';
      params.push('active');
    }

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve employee directory.' });
  }
};

exports.deactivateEmployee = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [result] = await db.execute(
      "UPDATE employees SET status = 'deactivated' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employee not found in this tenant.' });
    }
    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'employee.deactivated', entityType: 'employee', entityId: id, req });
    res.json({ message: 'Employee deactivated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to deactivate employee.' });
  }
};

exports.activateEmployee = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [result] = await db.execute(
      "UPDATE employees SET status = 'active' WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employee not found in this tenant.' });
    }
    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'employee.activated', entityType: 'employee', entityId: id, req });
    res.json({ message: 'Employee activated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to activate employee.' });
  }
};

exports.deleteEmployee = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [result] = await db.execute(
      'DELETE FROM employees WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Employee not found in this tenant.' });
    }
    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'employee.deleted', entityType: 'employee', entityId: id, req });
    res.json({ message: 'Employee permanently deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete employee.' });
  }
};
