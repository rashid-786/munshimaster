const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid'); // Install using: npm install uuid

// 1. REGISTER NEW TENANT (And their initial Admin user)
exports.registerTenant = async (req, res) => {
  const { companyName, subdomain, firstName, lastName, email, password } = req.body;

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
      'INSERT INTO employees (id, tenant_id, first_name, last_name, email, password_hash, role, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, tenantId, firstName, lastName, email, hashedPassword, 'tenant_admin', 0]
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
  const { email, password } = req.body;
  const tenantId = req.headers['x-tenant-id']; // Provided by tenantResolver middleware

  try {
    // Query strictly scoped to the current tenant context
    const [users] = await db.execute(
      'SELECT * FROM employees WHERE email = ? AND tenant_id = ?',
      [email, tenantId]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];

    // Verify cryptographic hash matches
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const [tenantRows] = await db.execute(
      'SELECT company_name, settings FROM tenants WHERE id = ?',
      [user.tenant_id]
    );
    const tenantConfig = tenantRows[0] || { company_name: 'HR Platform', settings: { primaryColor: '#0052cc' } };
    const parsedSettings = typeof tenantConfig.settings === 'string'
      ? JSON.parse(tenantConfig.settings)
      : tenantConfig.settings;

    // Generate Token including tenantId context to prevent cross-tenant tampering
    const token = jwt.sign(
      { id: user.id, tenantId: user.tenant_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Authentication successful',
      token,
      user: { id: user.id, email: user.email, role: user.role, name: `${user.first_name} ${user.last_name}` },
      tenant: {
        id: user.tenant_id,
        name: tenantConfig.company_name,
        settings: parsedSettings || { primaryColor: '#0052cc' }
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server authentication process encountered an error.' });
  }
};
