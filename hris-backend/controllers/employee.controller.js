const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

exports.createEmployee = async (req, res) => {
  const { firstName, lastName, email, password, role, baseSalary, phone } = req.body;
  const tenantId = req.tenantId;

  try {
    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE email = ? AND tenant_id = ?',
      [email, tenantId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An employee with this email already exists in your company.' });
    }

    if (phone) {
      const [phoneExists] = await db.execute(
        'SELECT id FROM employees WHERE phone = ? AND tenant_id = ?',
        [phone, tenantId]
      );
      if (phoneExists.length > 0) {
        return res.status(400).json({ error: 'An employee with this phone number already exists.' });
      }
    }

    const employeeId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const salaryInCents = Math.round(parseFloat(baseSalary) * 100);

    await db.execute(
      `INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, password_hash, role, base_salary, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [employeeId, tenantId, firstName, lastName, email, phone || null, hashedPassword, role, salaryInCents]
    );

    res.status(201).json({ message: 'Employee onboarded successfully!', employeeId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to onboard employee.' });
  }
};

exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  const { firstName, lastName, email, role, baseSalary, phone } = req.body;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE id = ? AND tenant_id = ?', [id, tenantId]
    );
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Employee not found in this tenant.' });
    }

    if (phone) {
      const [phoneExists] = await db.execute(
        'SELECT id FROM employees WHERE phone = ? AND tenant_id = ? AND id != ?',
        [phone, tenantId, id]
      );
      if (phoneExists.length > 0) {
        return res.status(400).json({ error: 'Phone number already in use by another employee.' });
      }
    }

    const updates = [];
    const params = [];

    if (firstName !== undefined) { updates.push('first_name = ?'); params.push(firstName); }
    if (lastName !== undefined) { updates.push('last_name = ?'); params.push(lastName); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (baseSalary !== undefined) {
      updates.push('base_salary = ?');
      params.push(Math.round(parseFloat(baseSalary) * 100));
    }
    if (phone !== undefined) { updates.push('phone = ?'); params.push(phone || null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id, tenantId);
    await db.execute(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    res.json({ message: 'Employee updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
};

exports.getEmployees = async (req, res) => {
  const tenantId = req.tenantId;
  const { includeDeactivated } = req.query;

  try {
    let query = 'SELECT id, first_name, last_name, email, phone, role, base_salary, status, created_at FROM employees WHERE tenant_id = ?';
    const params = [tenantId];

    if (includeDeactivated !== 'true') {
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
    res.json({ message: 'Employee permanently deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete employee.' });
  }
};
