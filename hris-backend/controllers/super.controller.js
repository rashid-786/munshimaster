const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

exports.seedSuperAdmin = async (req, res) => {
  const { email, password, name } = req.body;

  try {
    const [existing] = await db.execute('SELECT id FROM super_admins LIMIT 1');
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Super admin already exists. Use login instead.' });
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      'INSERT INTO super_admins (id, email, password_hash, name) VALUES (?, ?, ?, ?)',
      [id, email, hashedPassword, name]
    );

    res.status(201).json({ message: 'Super admin created successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create super admin.' });
  }
};

exports.loginSuperAdmin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const [admins] = await db.execute(
      'SELECT * FROM super_admins WHERE email = ?',
      [email]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const admin = admins[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name, role: 'super_admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      message: 'Super admin authentication successful',
      token,
      user: { id: admin.id, email: admin.email, name: admin.name, role: 'super_admin' }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server authentication error.' });
  }
};

exports.getDashboard = async (req, res) => {
  try {
    const [tenantCount] = await db.execute('SELECT COUNT(*) as count FROM tenants');
    const [employeeCount] = await db.execute('SELECT COUNT(*) as count FROM employees');
    const [adminCount] = await db.execute('SELECT COUNT(*) as count FROM super_admins');
    const [recentTenants] = await db.execute(
      'SELECT id, company_name, subdomain, created_at FROM tenants ORDER BY created_at DESC LIMIT 5'
    );
    const [roleDistribution] = await db.execute(
      `SELECT role, COUNT(*) as count FROM employees GROUP BY role`
    );
    const [pendingLeaves] = await db.execute(
      "SELECT COUNT(*) as count FROM leaves WHERE status = 'pending'"
    );

    res.json({
      totalTenants: tenantCount[0].count,
      totalEmployees: employeeCount[0].count,
      totalSuperAdmins: adminCount[0].count,
      pendingLeaves: pendingLeaves[0].count,
      recentTenants,
      roleDistribution
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
};

exports.createTenant = async (req, res) => {
  const { companyName, subdomain, firstName, lastName, email, phone, password, settings } = req.body;

  if (!companyName || !subdomain || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'All fields are required: companyName, subdomain, firstName, lastName, email, password.' });
  }

  try {
    const [existingTenant] = await db.execute('SELECT id FROM tenants WHERE subdomain = ?', [subdomain]);
    if (existingTenant.length > 0) {
      return res.status(400).json({ error: 'This subdomain is already taken.' });
    }

    const tenantId = uuidv4();
    const employeeId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    await db.query('START TRANSACTION');

    const settingsStr = settings ? JSON.stringify(settings) : JSON.stringify({ primaryColor: '#4f46e5' });
    await db.execute(
      'INSERT INTO tenants (id, company_name, subdomain, settings) VALUES (?, ?, ?, ?)',
      [tenantId, companyName, subdomain, settingsStr]
    );

    await db.execute(
      'INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, password_hash, role, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [employeeId, tenantId, firstName, lastName, email, phone || null, hashedPassword, 'tenant_admin', 0]
    );

    await db.query('COMMIT');
    res.status(201).json({ message: 'Tenant created successfully.', tenantId, adminEmployeeId: employeeId });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to create tenant.' });
  }
};

exports.getTenants = async (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT t.id, t.company_name, t.subdomain, t.settings, t.created_at,
             (SELECT COUNT(*) FROM employees e WHERE e.tenant_id = t.id) as employee_count,
             (SELECT e.email FROM employees e WHERE e.tenant_id = t.id AND e.role = 'tenant_admin' LIMIT 1) as admin_email,
             (SELECT e.id FROM employees e WHERE e.tenant_id = t.id AND e.role = 'tenant_admin' LIMIT 1) as admin_id
      FROM tenants t
    `;
    let countQuery = 'SELECT COUNT(*) as count FROM tenants t';
    const params = [];

    if (search) {
      query += ' WHERE t.company_name LIKE ? OR t.subdomain LIKE ?';
      countQuery += ' WHERE t.company_name LIKE ? OR t.subdomain LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    const [rows] = await db.execute(query, [...params, String(limit), String(offset)]);
    const [countResult] = await db.execute(countQuery, params);

    const tenants = rows.map(t => ({
      ...t,
      settings: typeof t.settings === 'string' ? JSON.parse(t.settings) : (t.settings || {})
    }));

    res.json({
      tenants,
      total: countResult[0].count,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tenants.' });
  }
};

exports.getTenantDetail = async (req, res) => {
  const { id } = req.params;

  try {
    const [tenants] = await db.execute(
      `SELECT t.*,
              (SELECT COUNT(*) FROM employees e WHERE e.tenant_id = t.id) as employee_count,
              (SELECT COUNT(*) FROM attendance a WHERE a.tenant_id = t.id) as attendance_count,
              (SELECT COUNT(*) FROM leaves l WHERE l.tenant_id = t.id) as leave_count,
              (SELECT COUNT(*) FROM payroll p WHERE p.tenant_id = t.id) as payroll_count
       FROM tenants t WHERE t.id = ?`,
      [id]
    );

    if (tenants.length === 0) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const tenant = tenants[0];
    tenant.settings = typeof tenant.settings === 'string'
      ? JSON.parse(tenant.settings) : (tenant.settings || {});

    const [employees] = await db.execute(
      `SELECT id, first_name, last_name, email, role, base_salary, created_at
       FROM employees WHERE tenant_id = ? ORDER BY created_at DESC`,
      [id]
    );

    const [admin] = await db.execute(
      `SELECT id, first_name, last_name, email, role
       FROM employees WHERE tenant_id = ? AND role = 'tenant_admin' LIMIT 1`,
      [id]
    );

    res.json({ tenant, employees, admin: admin[0] || null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tenant details.' });
  }
};

exports.updateTenant = async (req, res) => {
  const { id } = req.params;
  const { companyName, settings, isActive } = req.body;

  try {
    const updates = [];
    const params = [];

    if (companyName !== undefined) {
      updates.push('company_name = ?');
      params.push(companyName);
    }
    if (settings !== undefined) {
      updates.push('settings = ?');
      params.push(JSON.stringify(settings));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id);
    await db.execute(
      `UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    res.json({ message: 'Tenant updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update tenant.' });
  }
};

exports.deleteTenant = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query('START TRANSACTION');
    await db.execute('DELETE FROM payroll WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM leaves WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM attendance WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM employees WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM tenants WHERE id = ?', [id]);
    await db.query('COMMIT');

    res.json({ message: 'Tenant and all associated data deleted permanently.' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to delete tenant.' });
  }
};

exports.updateTenantAdmin = async (req, res) => {
  const { id } = req.params;
  const { email, password } = req.body;

  try {
    const [admin] = await db.execute(
      `SELECT id FROM employees WHERE tenant_id = ? AND role = 'tenant_admin' LIMIT 1`,
      [id]
    );

    if (admin.length === 0) {
      return res.status(404).json({ error: 'No admin found for this tenant.' });
    }

    const updates = [];
    const params = [];

    if (email !== undefined) {
      const [existing] = await db.execute(
        'SELECT id FROM employees WHERE email = ? AND id != ?', [email, admin[0].id]
      );
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Email already in use by another employee.' });
      }
      updates.push('email = ?');
      params.push(email);
    }
    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(admin[0].id);
    await db.execute(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'Tenant admin credentials updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update tenant admin.' });
  }
};

exports.getAllEmployees = async (req, res) => {
  const { search, tenantId, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT e.id, e.first_name, e.last_name, e.email, e.role, e.base_salary, e.created_at,
             t.company_name, t.id as tenant_id
      FROM employees e
      JOIN tenants t ON e.tenant_id = t.id
      WHERE 1=1
    `;
    let countQuery = `
      SELECT COUNT(*) as count FROM employees e
      JOIN tenants t ON e.tenant_id = t.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      const searchClause = ' AND (e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR t.company_name LIKE ?)';
      query += searchClause;
      countQuery += searchClause;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern, pattern);
    }
    if (tenantId) {
      query += ' AND e.tenant_id = ?';
      countQuery += ' AND e.tenant_id = ?';
      params.push(tenantId);
    }

    query += ' ORDER BY e.created_at DESC LIMIT ? OFFSET ?';
    const [rows] = await db.execute(query, [...params, String(limit), String(offset)]);
    const [countResult] = await db.execute(countQuery, params);

    res.json({
      employees: rows,
      total: countResult[0].count,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
};

exports.getTenantCalendar = async (req, res) => {
  const { id } = req.params;
  const { month, year, employeeId } = req.query;
  const m = parseInt(month) || (new Date().getMonth() + 1);
  const y = parseInt(year) || new Date().getFullYear();

  const lastDate = new Date(y, m, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const firstDay = `${y}-${pad(m)}-01`;
  const lastDay = `${lastDate.getFullYear()}-${pad(lastDate.getMonth() + 1)}-${pad(lastDate.getDate())}`;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [id]);
    let weekendDays = [0];
    if (tenantRows.length > 0) {
      const s = typeof tenantRows[0].settings === 'string' ? JSON.parse(tenantRows[0].settings) : (tenantRows[0].settings || {});
      weekendDays = s.weekendDays || [0];
    }

    const [attendance] = await db.execute(
      `SELECT a.date, a.clock_in, a.clock_out, a.total_hours, a.employee_id,
              e.first_name, e.last_name, e.role
       FROM attendance a
       JOIN employees e ON a.employee_id = e.id
       WHERE a.tenant_id = ? AND a.date >= ? AND a.date <= ?
       ${employeeId ? 'AND a.employee_id = ?' : ''}
       ORDER BY a.employee_id, a.date`,
      employeeId ? [id, firstDay, lastDay, employeeId] : [id, firstDay, lastDay]
    );

    const [leaves] = await db.execute(
      `SELECT l.leave_type, l.start_date, l.end_date, l.status, l.employee_id,
              e.first_name, e.last_name
       FROM leaves l
       JOIN employees e ON l.employee_id = e.id
       WHERE l.tenant_id = ? AND l.status = 'approved'
         AND l.start_date <= ? AND l.end_date >= ?
       ${employeeId ? 'AND l.employee_id = ?' : ''}
       ORDER BY l.employee_id, l.start_date`,
      employeeId ? [id, lastDay, firstDay, employeeId] : [id, lastDay, firstDay]
    );

    const [employees] = await db.execute(
      `SELECT id, first_name, last_name, role
       FROM employees WHERE tenant_id = ?
       ${employeeId ? 'AND id = ?' : ''}
       ORDER BY first_name`,
      employeeId ? [id, employeeId] : [id]
    );

    const daysInMonth = new Date(y, m, 0).getDate();
    const fmtDate = (d) => {
      if (!d) return '';
      if (d instanceof Date) return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return String(d).split('T')[0];
    };
    const fmtTime = (d) => {
      if (!d) return null;
      if (d instanceof Date) return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const s = String(d);
      const t = s.includes('T') ? s.split('T')[1] : (s.includes(' ') ? s.split(' ')[1] : s);
      return t?.slice(0, 5) || null;
    };

    const attendanceMap = {};
    attendance.forEach(a => {
      if (!attendanceMap[a.employee_id]) attendanceMap[a.employee_id] = {};
      attendanceMap[a.employee_id][fmtDate(a.date)] = {
        clockIn: fmtTime(a.clock_in), clockOut: fmtTime(a.clock_out), totalHours: a.total_hours,
      };
    });

    const leaveMap = {};
    leaves.forEach(l => {
      if (!leaveMap[l.employee_id]) leaveMap[l.employee_id] = {};
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        leaveMap[l.employee_id][d.toISOString().split('T')[0]] = l.leave_type;
      }
    });

    const result = employees.map(emp => {
      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayOfWeek = new Date(y, m - 1, d).getDay();
        const isWeekend = weekendDays.includes(dayOfWeek);
        const att = attendanceMap[emp.id]?.[dateStr];
        const leave = leaveMap[emp.id]?.[dateStr];
        let type = 'idle';
        let label = null;
        let hours = null;

        if (isWeekend) { type = 'weekend'; label = `Weekend (${DAY_NAMES[dayOfWeek]})`; }
        else if (leave) { type = leave.toLowerCase(); label = `${leave} Leave`; }
        else if (att) {
          hours = att.totalHours != null ? parseFloat(att.totalHours) : null;
          if (hours === 0) { type = 'absent'; label = 'Absent'; }
          else if (hours && hours > 0) { type = 'present'; label = `Present (${hours}h)`; }
          else if (att.clockIn) { type = 'present'; label = 'Present (no clock-out)'; }
        }
        days.push({ date: dateStr, day: d, type, label, hours, isWeekend, clockIn: att?.clockIn || null, clockOut: att?.clockOut || null });
      }
      return { employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name, role: emp.role }, days };
    });

    res.json({ month: m, year: y, employees: result, tenantId: id, weekendDays });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate calendar data.' });
  }
};

exports.getTenantPayroll = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT p.*, e.first_name, e.last_name, e.email
       FROM payroll p
       JOIN employees e ON p.employee_id = e.id
       WHERE p.tenant_id = ?
       ORDER BY p.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch payroll data.' });
  }
};

exports.getTenantLeaves = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.execute(
      `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.status, l.created_at,
              e.first_name, e.last_name, e.email
       FROM leaves l
       JOIN employees e ON l.employee_id = e.id
       WHERE l.tenant_id = ?
       ORDER BY l.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leave data.' });
  }
};

exports.updateSuperEmployee = async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, email, role, baseSalary, tenantId } = req.body;

  try {
    const [existing] = await db.execute('SELECT id FROM employees WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
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
    if (tenantId !== undefined) { updates.push('tenant_id = ?'); params.push(tenantId); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id);
    await db.execute(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ message: 'Employee updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
};

// System Settings
exports.getSystemSettings = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT default_country_code, updated_at FROM system_settings WHERE id = 1');
    if (rows.length === 0) {
      return res.json({ defaultCountryCode: '+965' });
    }
    res.json({
      defaultCountryCode: rows[0].default_country_code,
      updatedAt: rows[0].updated_at,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch system settings.' });
  }
};

exports.updateSystemSettings = async (req, res) => {
  const { default_country_code } = req.body;

  if (!default_country_code) {
    return res.status(400).json({ error: 'default_country_code is required.' });
  }

  try {
    await db.execute(
      'UPDATE system_settings SET default_country_code = ? WHERE id = 1',
      [default_country_code]
    );
    res.json({ message: 'System settings updated.', defaultCountryCode: default_country_code });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update system settings.' });
  }
};
