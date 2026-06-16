const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Install using: npm install uuid

// 1. REGISTER NEW TENANT (And their initial Admin user)
exports.registerTenant = async (req, res) => {
  const { companyName, subdomain, firstName, lastName, email, phone, password } = req.body;

  try {
    // Check if subdomain already exists
    const [existingTenant] = await db.execute('SELECT id FROM tenants WHERE subdomain = ?', [subdomain]);
    if (existingTenant.length > 0) {
      return res.status(400).json({ error: 'This subdomain is already taken.' });
    }

    const tenantId = uuidv4();
    const employeeId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    // Use a transaction to guarantee both tenant and admin employee are created together
    await db.query('START TRANSACTION');

    // Insert Company Context
    await db.execute(
      'INSERT INTO tenants (id, company_name, subdomain) VALUES (?, ?, ?)',
      [tenantId, companyName, subdomain]
    );

    // Insert Initial Tenant Admin Employee (Base salary initialized to 0 for setup)
    await db.execute(
      'INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, password_hash, role, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, tenantId, firstName, lastName, email, phone || null, hashedPassword, 'tenant_admin', 0]
    );

    await db.query('COMMIT');
    res.status(201).json({ message: 'SaaS Tenant environment provisioned successfully!', tenantId });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Database failure during tenant provisioning.' });
  }
};

// 2. LOGIN EMPLOYEE
exports.loginEmployee = async (req, res) => {
  const { email, password, subdomain } = req.body;

  if (!subdomain) {
    return res.status(400).json({ error: 'Subdomain is required.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email or phone is required.' });
  }

  try {
    const [tenantRows] = await db.execute(
      'SELECT id, company_name, settings FROM tenants WHERE subdomain = ?',
      [subdomain]
    );

    if (tenantRows.length === 0) {
      return res.status(401).json({ error: 'Invalid company ID or password.' });
    }

    const tenant = tenantRows[0];
    const tenantId = tenant.id;

    const isEmail = email.includes('@');
    const [users] = await db.execute(
      isEmail
        ? 'SELECT * FROM employees WHERE email = ? AND tenant_id = ?'
        : 'SELECT * FROM employees WHERE phone = ? AND tenant_id = ?',
      [email, tenantId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email/phone or password.' });
    }

    const user = users[0];

    if (user.status === 'deactivated') {
      return res.status(403).json({ error: 'Your account has been deactivated. Contact your administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email/phone or password.' });
    }

    const parsedSettings = typeof tenant.settings === 'string'
      ? JSON.parse(tenant.settings)
      : (tenant.settings || {});

    const token = jwt.sign(
      { id: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        name: `${user.first_name} ${user.last_name}`,
        firstName: user.first_name,
        lastName: user.last_name,
      },
      tenant: {
        id: user.tenant_id,
        name: tenant.company_name,
        settings: parsedSettings || { primaryColor: '#0052cc' }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server authentication process encountered an error.' });
  }
};

// 3. CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const employeeId = req.user.id;
  const tenantId = req.user.tenantId;

  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  try {
    const [users] = await db.execute(
      'SELECT password_hash FROM employees WHERE id = ? AND tenant_id = ?',
      [employeeId, tenantId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(current_password, users[0].password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    await db.execute(
      'UPDATE employees SET password_hash = ? WHERE id = ?',
      [hashedPassword, employeeId]
    );

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update password.' });
  }
};

// 4. UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  const { first_name, last_name, email, phone } = req.body;
  const employeeId = req.user.id;
  const tenantId = req.user.tenantId;

  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'First name, last name, and email are required.' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT id FROM employees WHERE email = ? AND tenant_id = ? AND id != ?',
      [email, tenantId, employeeId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already in use by another employee.' });
    }

    if (phone) {
      const [phoneExists] = await db.execute(
        'SELECT id FROM employees WHERE phone = ? AND tenant_id = ? AND id != ?',
        [phone, tenantId, employeeId]
      );
      if (phoneExists.length > 0) {
        return res.status(400).json({ error: 'Phone already in use by another employee.' });
      }
    }

    await db.execute(
      'UPDATE employees SET first_name = ?, last_name = ?, email = ?, phone = ? WHERE id = ? AND tenant_id = ?',
      [first_name, last_name, email, phone || null, employeeId, tenantId]
    );

    res.json({
      message: 'Profile updated.',
      user: { firstName: first_name, lastName: last_name, email, phone, name: `${first_name} ${last_name}` },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
};
