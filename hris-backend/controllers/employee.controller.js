const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ONBOARD NEW EMPLOYEE (Scoped to the active tenant)
exports.createEmployee = async (req, res) => {
  const { firstName, lastName, email, password, role, baseSalary } = req.body;
  const tenantId = req.tenantId; // Captured securely by middleware

  try {
    // Prevent duplicate emails within the same organization
    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE email = ? AND tenant_id = ?',
      [email, tenantId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'An employee with this email already exists in your company.' });
    }

    const employeeId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Convert display currency amount to integer cents for precision (e.g., 3000 -> 300000)
    const salaryInCents = Math.round(parseFloat(baseSalary) * 100);

    await db.execute(
      `INSERT INTO employees (id, tenant_id, first_name, last_name, email, password_hash, role, base_salary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [employeeId, tenantId, firstName, lastName, email, hashedPassword, role, salaryInCents]
    );

    res.status(201).json({ message: 'Employee onboarded successfully!', employeeId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to onboard employee.' });
  }
};

// GET ALL EMPLOYEES (Strictly isolated by Tenant ID)
exports.getEmployees = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    // We do NOT return the password hashes in the collection layout
    const [rows] = await db.execute(
      'SELECT id, first_name, last_name, email, role, base_salary, created_at FROM employees WHERE tenant_id = ?',
      [tenantId]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to retrieve employee directory.' });
  }
};
