const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const overrideService = require('../services/override.service');
const customPlanService = require('../services/customPlan.service');
const whiteLabelService = require('../services/whiteLabel.service');
const analyticsService = require('../services/subscriptionAnalytics.service');
const audit = require('../services/audit.service');
const saService = require('../services/superAdmin.service');

exports.seedSuperAdmin = async (req, res) => {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('edge')) {
    return res.status(403).json({ error: 'This endpoint is not accessible from a browser. Use curl or Postman.' });
  }
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
      'INSERT INTO tenants (id, company_name, subdomain, settings, created_at) VALUES (?, ?, ?, ?, NOW())',
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
  const { search, page = 1, limit = 20, status, subscriptionPlan, dateFrom, dateTo } = req.query;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    const params = [];

    if (search) {
      conditions.push(`(t.company_name ILIKE ? OR t.subdomain ILIKE ? OR e.first_name ILIKE ? OR e.last_name ILIKE ? OR e.email ILIKE ? OR e.phone ILIKE ?)`);
      const p = `%${search}%`;
      params.push(p, p, p, p, p, p);
    }

    // Filter by subscription status (active, trial, paid, expired, suspended)
    if (status) {
      switch (status) {
        case 'active':
          conditions.push(`t.status != 'inactive' AND t.subscription_status NOT IN ('suspended','expired','trialing')`);
          break;
        case 'trial': {
          conditions.push(`t.status != 'inactive'`);
          const trialSql = `(SELECT s.status FROM hris_saas.subscriptions s WHERE s.tenant_id = t.id ORDER BY s.created_at DESC LIMIT 1) = 'trialing'`;
          conditions.push(trialSql);
          break;
        }
        case 'paid':
          conditions.push(`t.subscription_status = 'active'`);
          break;
        case 'expired':
          conditions.push(`(t.subscription_status = 'expired' OR (SELECT s.status FROM hris_saas.subscriptions s WHERE s.tenant_id = t.id ORDER BY s.created_at DESC LIMIT 1) = 'expired')`);
          break;
        case 'suspended':
          conditions.push(`(t.status = 'inactive' OR t.subscription_status = 'suspended')`);
          break;
      }
    }

    // Filter by subscription plan
    if (subscriptionPlan) {
      conditions.push(`UPPER(t.subscription_plan) = UPPER(?)`);
      params.push(subscriptionPlan);
    }

    // Filter by created date range
    if (dateFrom) {
      conditions.push(`t.created_at >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`t.created_at <= ?`);
      params.push(dateTo + ' 23:59:59');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let query = `
      SELECT t.id, t.company_name, t.subdomain, t.subscription_plan, t.subscription_status,
             t.status, t.settings, t.created_at, t.notes, t.tags,
             e.first_name as owner_first_name, e.last_name as owner_last_name,
             e.email as owner_email, e.phone as owner_phone,
             (SELECT COUNT(*) FROM hris_saas.employees emp WHERE emp.tenant_id = t.id) as employee_count,
             (SELECT COUNT(*) FROM hris_saas.subscriptions s WHERE s.tenant_id = t.id AND s.status = 'active') as active_subscription_count,
             (SELECT s.status FROM hris_saas.subscriptions s WHERE s.tenant_id = t.id ORDER BY s.created_at DESC LIMIT 1) as latest_subscription_status,
             (SELECT s.trial_ends_at FROM hris_saas.subscriptions s WHERE s.tenant_id = t.id ORDER BY s.created_at DESC LIMIT 1) as trial_ends_at,
             (SELECT MAX(s.updated_at) FROM hris_saas.subscriptions s WHERE s.tenant_id = t.id) as last_activity_at
      FROM hris_saas.tenants t
      LEFT JOIN hris_saas.employees e ON e.tenant_id = t.id AND e.role = 'tenant_admin'
    `;
    let countQuery = `SELECT COUNT(DISTINCT t.id) as count FROM hris_saas.tenants t
      LEFT JOIN hris_saas.employees e ON e.tenant_id = t.id AND e.role = 'tenant_admin'`;

    query += ` ${whereClause}`;
    countQuery += ` ${whereClause}`;

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    const [rows] = await db.execute(query, [...params, String(limit), String(offset)]);
    const [countResult] = await db.execute(countQuery, params);

    const tenants = rows.map(t => ({
      ...t,
      settings: typeof t.settings === 'string' ? JSON.parse(t.settings) : (t.settings || {}),
      tags: typeof t.tags === 'string' ? JSON.parse(t.tags) : (t.tags || []),
    }));

    res.json({
      tenants,
      total: Number(countResult[0]?.count || 0),
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
      `SELECT id, first_name, last_name, email, role, job_type, base_salary, profession, other_profession, created_at
       FROM employees WHERE tenant_id = ? ORDER BY created_at DESC`,
      [id]
    );

    const [admin] = await db.execute(
      `SELECT id, first_name, last_name, email, phone, role
       FROM employees WHERE tenant_id = ? AND role = 'tenant_admin' LIMIT 1`,
      [id]
    );

    const adminData = admin[0] ? {
      ...admin[0],
      name: [admin[0].first_name, admin[0].last_name].filter(Boolean).join(' ') || admin[0].email,
    } : null;

    res.json({ tenant, employees, admin: adminData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tenant details.' });
  }
};

exports.updateTenant = async (req, res) => {
  const { id } = req.params;
  const { companyName, subscriptionPlan, settings, isActive } = req.body;

  try {
    const updates = [];
    const params = [];

    if (companyName !== undefined) {
      updates.push('company_name = ?');
      params.push(companyName);
    }
    if (subscriptionPlan !== undefined) {
      updates.push('subscription_plan = ?');
      params.push(subscriptionPlan);
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
    // Delete from all child tables referencing tenants.id
    await db.execute('DELETE FROM referral_redemptions WHERE referrer_id = ? OR referred_id = ?', [id, id]);
    await db.execute('DELETE FROM referral_codes WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM campaign_redemptions WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM conversion_events WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM subscription_events WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM tenant_section_visibility WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM tenant_feature_overrides WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM tenant_custom_plans WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM tenant_branding WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM tenant_usage WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM payments WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM subscriptions WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM email_logs WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM attachments WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM invoices WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM purchase_orders WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM suppliers WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM customers WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM staff_replacements WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM payroll WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM leaves WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM attendance WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM employees WHERE tenant_id = ?', [id]);
    await db.execute('DELETE FROM tenants WHERE id = ?', [id]);
    await db.query('COMMIT');

    res.json({ message: 'Tenant and all associated data deleted permanently.' });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('deleteTenant error:', error);
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
  const { firstName, lastName, email, role, baseSalary, tenantId, reason } = req.body;

  try {
    const [existing] = await db.execute('SELECT * FROM employees WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const emp = existing[0];
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

    await saService.logAction({
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      action: saService.SA_ACTIONS.EMPLOYEE_UPDATED,
      entityType: 'employee',
      entityId: id,
      tenantId: tenantId || emp.tenant_id,
      oldValue: { firstName: emp.first_name, lastName: emp.last_name, email: emp.email, role: emp.role },
      newValue: { firstName, lastName, email, role, baseSalary, tenantId },
      reason: reason || null,
      details: { updatedFields: updates.map(u => u.split('=')[0].trim()) },
      req,
    });

    res.json({ message: 'Employee updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update employee.' });
  }
};

// ─── Activate Trial ─────────────────────────────────────────────
exports.activateTrial = async (req, res) => {
  const { tenantId } = req.params;
  const { planId, trialDays, reason } = req.body;

  try {
    const targetPlan = planId || 'manage';
    const days = trialDays || 14;
    const trialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    // Expire any existing active/trialing subscription
    await db.execute(
      `UPDATE hris_saas.subscriptions SET status = 'expired', ended_at = NOW(), updated_at = NOW()
       WHERE tenant_id = ? AND status IN ('active','trialing')`,
      [tenantId]
    );

    // Create new trial subscription
    await db.execute(
      `INSERT INTO hris_saas.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_start, current_period_end, created_at, updated_at)
       VALUES (?, ?, 'trialing', ?, NOW(), NOW() + INTERVAL '1 year', NOW(), NOW())`,
      [tenantId, targetPlan, trialEnd]
    );

    // Update tenant
    await db.execute(
      `UPDATE hris_saas.tenants SET subscription_plan = UPPER(?), subscription_status = 'trialing' WHERE id = ?`,
      [targetPlan, tenantId]
    );

    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'tenant.trial_activated',
      entityType: 'tenant', entityId: tenantId,
      details: { planId: targetPlan, trialDays: days, trialEndsAt: trialEnd, reason },
      req,
    });

    res.json({
      message: `${days}-day trial activated on ${targetPlan.toUpperCase()} plan.`,
      plan: targetPlan.toUpperCase(),
      trialEndsAt: trialEnd,
    });
  } catch (error) {
    console.error('activateTrial error:', error);
    res.status(500).json({ error: 'Failed to activate trial.' });
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

// =============================================
// TENANT STATUS — Suspend or reactivate a tenant
// =============================================
exports.updateTenantStatus = async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!status || !['active', 'suspended'].includes(status)) {
    return res.status(400).json({ error: 'Status must be "active" or "suspended".' });
  }

  try {
    const [existing] = await db.execute('SELECT id, company_name, status, subscription_status FROM hris_saas.tenants WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const tenant = existing[0];
    const oldStatus = tenant.subscription_status || tenant.status || 'active';

    if (oldStatus === status) {
      return res.status(400).json({ error: `Tenant is already ${status}.` });
    }

    // Update tenant status and subscription_status
    const tenantStatus = status === 'suspended' ? 'inactive' : 'active';
    await db.execute(
      'UPDATE hris_saas.tenants SET status = ?, subscription_status = ? WHERE id = ?',
      [tenantStatus, status, id]
    );

    // Also update the subscriptions table if there's an active subscription
    await db.execute(
      `UPDATE hris_saas.subscriptions SET status = ?, updated_at = NOW() WHERE tenant_id = ? AND status IN ('active', 'trialing')`,
      [status, id]
    );

    // Log to super admin action log
    await saService.logAction({
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      action: status === 'suspended' ? saService.SA_ACTIONS.TENANT_SUSPENDED : saService.SA_ACTIONS.TENANT_REACTIVATED,
      entityType: 'tenant',
      entityId: id,
      tenantId: id,
      details: { oldStatus, newStatus: status, reason: reason || null, companyName: tenant.company_name },
      req,
    });

    // Log to tenant audit log
    await saService.logTenantAudit({
      tenantId: id,
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      action: status === 'suspended' ? 'super_admin.tenant_suspended' : 'super_admin.tenant_reactivated',
      entityType: 'tenant',
      entityId: id,
      changes: { oldStatus, newStatus: status, reason: reason || null },
      req,
    });

    res.json({
      message: `Tenant ${status === 'suspended' ? 'suspended' : 'reactivated'} successfully.`,
      oldStatus,
      newStatus: status,
    });
  } catch (error) {
    console.error('updateTenantStatus error:', error);
    res.status(500).json({ error: 'Failed to update tenant status.' });
  }
};

// =============================================
// TENANT USAGE — Get usage analytics for a tenant
// =============================================
exports.getTenantUsage = async (req, res) => {
  const { id } = req.params;

  try {
    // Check tenant exists
    const [tenantRows] = await db.execute('SELECT id, company_name, subscription_plan FROM hris_saas.tenants WHERE id = ?', [id]);
    if (tenantRows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    // Usage from tenant_usage table (current & historical)
    const [usageRecords] = await db.execute(
      `SELECT tu.*,
              (SELECT COUNT(*) FROM hris_saas.employees e WHERE e.tenant_id = tu.tenant_id
               AND (e.created_at IS NULL OR e.created_at <= (tu.usage_month + INTERVAL '1 month - 1 day'))) as employee_count,
              (SELECT COUNT(*) FROM hris_saas.attendance a WHERE a.tenant_id = tu.tenant_id
               AND a.date >= tu.usage_month AND a.date < tu.usage_month + INTERVAL '1 month') as attendance_count,
              (SELECT COUNT(*) FROM hris_saas.leaves l WHERE l.tenant_id = tu.tenant_id
               AND l.created_at >= tu.usage_month AND l.created_at < tu.usage_month + INTERVAL '1 month') as leave_count,
              (SELECT COUNT(*) FROM hris_saas.payroll p WHERE p.tenant_id = tu.tenant_id
               AND p.created_at >= tu.usage_month AND p.created_at < tu.usage_month + INTERVAL '1 month') as payroll_count,
              (SELECT COUNT(*) FROM hris_saas.kirana_parties kp WHERE kp.tenant_id = tu.tenant_id
               AND kp.type = 'buyer' AND kp.created_at <= (tu.usage_month + INTERVAL '1 month - 1 day')) as buyer_count,
              (SELECT COUNT(*) FROM hris_saas.kirana_parties kp WHERE kp.tenant_id = tu.tenant_id
               AND kp.type = 'seller' AND kp.created_at <= (tu.usage_month + INTERVAL '1 month - 1 day')) as seller_count,
              (SELECT COUNT(*) FROM hris_saas.kirana_transactions kt WHERE kt.tenant_id = tu.tenant_id
               AND kt.created_at >= tu.usage_month AND kt.created_at < tu.usage_month + INTERVAL '1 month') as txn_count,
              (SELECT COUNT(*) FROM hris_saas.kirana_cashbook kc WHERE kc.tenant_id = tu.tenant_id
               AND kc.created_at >= tu.usage_month AND kc.created_at < tu.usage_month + INTERVAL '1 month') as cashbook_count
       FROM hris_saas.tenant_usage tu
       WHERE tu.tenant_id = ?
       ORDER BY tu.usage_month DESC LIMIT 12`,
      [id]
    );

    // Current usage counts from live tables
    const [employeeCount] = await db.execute('SELECT COUNT(*) as c FROM hris_saas.employees WHERE tenant_id = ?', [id]);
    const [attendanceCount] = await db.execute('SELECT COUNT(*) as c FROM hris_saas.attendance WHERE tenant_id = ?', [id]);
    const [leaveCount] = await db.execute('SELECT COUNT(*) as c FROM hris_saas.leaves WHERE tenant_id = ?', [id]);
    const [payrollCount] = await db.execute('SELECT COUNT(*) as c FROM hris_saas.payroll WHERE tenant_id = ?', [id]);
    const [buyerCount] = await db.execute("SELECT COUNT(*) as c FROM hris_saas.kirana_parties WHERE tenant_id = ? AND type = 'buyer'", [id]);
    const [sellerCount] = await db.execute("SELECT COUNT(*) as c FROM hris_saas.kirana_parties WHERE tenant_id = ? AND type = 'seller'", [id]);
    const [txnCount] = await db.execute(
      `SELECT COALESCE((
        SELECT COUNT(*) FROM hris_saas.kirana_transactions kt
        WHERE kt.tenant_id = ?
          AND kt.created_at >= (SELECT MAX(tu2.usage_month) FROM hris_saas.tenant_usage tu2 WHERE tu2.tenant_id = ?)
          AND kt.created_at < (SELECT MAX(tu2.usage_month) FROM hris_saas.tenant_usage tu2 WHERE tu2.tenant_id = ?) + INTERVAL '1 month'
      ), 0) as c`,
      [id, id, id]
    );
    const [cashbookCount] = await db.execute(
      `SELECT COALESCE((
        SELECT COUNT(*) FROM hris_saas.kirana_cashbook kc
        WHERE kc.tenant_id = ?
          AND kc.created_at >= (SELECT MAX(tu2.usage_month) FROM hris_saas.tenant_usage tu2 WHERE tu2.tenant_id = ?)
          AND kc.created_at < (SELECT MAX(tu2.usage_month) FROM hris_saas.tenant_usage tu2 WHERE tu2.tenant_id = ?) + INTERVAL '1 month'
      ), 0) as c`,
      [id, id, id]
    );

    // Subscription info
    const [subscriptions] = await db.execute(
      `SELECT s.*, sp.name as plan_name, sp.price_inr, sp.period
       FROM hris_saas.subscriptions s
       JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
       WHERE s.tenant_id = ?
       ORDER BY s.created_at DESC`,
      [id]
    );

    // Payment history
    const [payments] = await db.execute(
      `SELECT p.*, sp.name as plan_name
       FROM hris_saas.payments p
       LEFT JOIN hris_saas.subscription_plans sp ON p.plan_id = sp.id
       WHERE p.tenant_id = ?
       ORDER BY p.created_at DESC LIMIT 10`,
      [id]
    );

    res.json({
      tenant: { id: tenantRows[0].id, companyName: tenantRows[0].company_name, subscription_plan: tenantRows[0].subscription_plan },
      liveCounts: {
        employees: Number(employeeCount[0]?.c || 0),
        attendance: Number(attendanceCount[0]?.c || 0),
        leaves: Number(leaveCount[0]?.c || 0),
        payroll: Number(payrollCount[0]?.c || 0),
        buyers: Number(buyerCount[0]?.c || 0),
        sellers: Number(sellerCount[0]?.c || 0),
        total_txns: Number(txnCount[0]?.c || 0),
        cashbook_entries: Number(cashbookCount[0]?.c || 0),
      },
      usageHistory: usageRecords,
      subscription: subscriptions[0] || null,
      recentPayments: payments,
    });
  } catch (error) {
    console.error('getTenantUsage error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant usage.' });
  }
};

// =============================================
// TENANT SUBSCRIPTION — Get detailed subscription info
// =============================================
exports.getTenantSubscription = async (req, res) => {
  const { id } = req.params;

  try {
    const [tenantRows] = await db.execute('SELECT id, company_name, subscription_plan, subscription_status FROM hris_saas.tenants WHERE id = ?', [id]);
    if (tenantRows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const historyLimit = parseInt(req.query.historyLimit) || 10;
    const historyOffset = parseInt(req.query.historyOffset) || 0;

    const [subscriptions] = await db.execute(
      `SELECT s.*, sp.name as plan_name, sp.price_inr, sp.period, sp.features
       FROM hris_saas.subscriptions s
       JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
       WHERE s.tenant_id = ?
       ORDER BY s.created_at DESC`,
      [id]
    );

    const [events] = await db.execute(
      `SELECT se.* FROM hris_saas.subscription_events se
       WHERE se.tenant_id = ?
       ORDER BY se.created_at DESC
       LIMIT ? OFFSET ?`,
      [id, String(historyLimit), String(historyOffset)]
    );

    const [eventCount] = await db.execute(
      `SELECT COUNT(*) as count FROM hris_saas.subscription_events WHERE tenant_id = ?`,
      [id]
    );

    const [planFeatures] = await db.execute(
      `SELECT pf.* FROM hris_saas.plan_features pf
       WHERE pf.plan_id = ?
       ORDER BY pf.feature_type, pf.feature_key`,
      [tenantRows[0].subscription_plan ? tenantRows[0].subscription_plan.toLowerCase() : 'free']
    );

    const [payments] = await db.execute(
      `SELECT COUNT(*) as total_payments, COALESCE(SUM(amount),0) as total_amount
       FROM hris_saas.payments WHERE tenant_id = ? AND status IN ('captured','completed')`,
      [id]
    );

    res.json({
      tenant: tenantRows[0],
      currentSubscription: subscriptions[0] || null,
      subscriptionHistory: events,
      subscriptionHistoryTotal: parseInt(eventCount[0]?.count || 0),
      planFeatures,
      paymentSummary: payments[0],
    });
  } catch (error) {
    console.error('getTenantSubscription error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant subscription.' });
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

// =============================================
// OVERRIDES — List all feature overrides for a tenant
// =============================================
exports.listOverrides = async (req, res) => {
  try {
    const overrides = await overrideService.listOverrides(req.params.id);
    res.json({ overrides });
  } catch (error) {
    console.error('listOverrides error:', error);
    res.status(500).json({ error: 'Failed to list overrides.' });
  }
};

// =============================================
// OVERRIDES — Create or update a feature override
// =============================================
exports.setOverride = async (req, res) => {
  try {
    const { featureKey, maxValue, expiresAt, reason } = req.body;
    const result = await overrideService.setOverride({
      tenantId: req.params.id,
      featureKey,
      maxValue: maxValue !== undefined ? maxValue : null,
      expiresAt: expiresAt || null,
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      reason: reason || 'Super admin override',
    });

    await audit.logAdminAction({
      tenantId: req.params.id,
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      action: audit.AUDIT_ACTIONS.LIMIT_OVERRIDE_CREATED,
      details: { featureKey, maxValue, expiresAt, reason },
      req,
    });

    res.json({ message: 'Override saved.', override: result });
  } catch (error) {
    console.error('setOverride error:', error);
    res.status(400).json({ error: error.message || 'Failed to set override.' });
  }
};

// =============================================
// OVERRIDES — Remove a feature override
// =============================================
exports.removeOverride = async (req, res) => {
  try {
    const { featureKey } = req.params;
    const result = await overrideService.removeOverride({
      tenantId: req.params.id,
      featureKey,
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      reason: req.body?.reason || 'Super admin removed override',
    });

    await audit.logAdminAction({
      tenantId: req.params.id,
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      action: audit.AUDIT_ACTIONS.LIMIT_OVERRIDE_DELETED,
      details: { featureKey, reason: req.body?.reason },
      req,
    });

    res.json({ message: 'Override removed.', result });
  } catch (error) {
    console.error('removeOverride error:', error);
    res.status(400).json({ error: error.message || 'Failed to remove override.' });
  }
};

// =============================================
// EXTRA QUOTA — Grant extra usage quota to a tenant
// =============================================
exports.grantExtraQuota = async (req, res) => {
  try {
    const { featureKey, extraAmount, durationDays, reason } = req.body;

    if (!featureKey || extraAmount === undefined) {
      return res.status(400).json({ error: 'featureKey and extraAmount are required.' });
    }

    const result = await overrideService.grantExtraQuota({
      tenantId: req.params.id,
      featureKey,
      extraAmount: Number(extraAmount),
      durationDays: durationDays ? Number(durationDays) : null,
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      reason: reason || `Extra quota granted by super admin`,
    });

    await audit.logAdminAction({
      tenantId: req.params.id,
      actorId: req.user?.id,
      actorName: req.user?.name || 'Super Admin',
      action: audit.AUDIT_ACTIONS.EXTRA_QUOTA_GRANTED,
      details: { featureKey, extraAmount, durationDays, reason },
      req,
    });

    res.json({ message: 'Extra quota granted.', override: result });
  } catch (error) {
    console.error('grantExtraQuota error:', error);
    res.status(400).json({ error: error.message || 'Failed to grant extra quota.' });
  }
};

// =============================================
// OVERRIDES — Get override change history
// =============================================
exports.getOverrideHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const history = await overrideService.getOverrideHistory(req.params.id, limit);
    res.json({ history });
  } catch (error) {
    console.error('getOverrideHistory error:', error);
    res.status(500).json({ error: 'Failed to fetch override history.' });
  }
};

// =============================================
// FORCE PLAN — Force-change a tenant's plan
// =============================================
exports.forcePlanChange = async (req, res) => {
  try {
    const { plan, reason } = req.body;
    if (!plan) {
      return res.status(400).json({ error: 'Plan is required.' });
    }
    const validPlans = ['FREE', 'MANAGE', 'BUSINESS', 'BUSINESS_PRO'];
    const normalizedPlan = plan.toUpperCase();
    if (!validPlans.includes(normalizedPlan)) {
      return res.status(400).json({ error: `Invalid plan: ${plan}. Valid: ${validPlans.join(', ')}` });
    }

    const result = await overrideService.forcePlanChange({
      tenantId: req.params.id,
      newPlan: normalizedPlan,
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      reason: reason || `Force changed to ${normalizedPlan} by super admin`,
    });

    res.json({
      message: `Tenant forced to ${normalizedPlan} plan.`,
      plan: normalizedPlan,
      status: result.tenant.subscriptionStatus,
    });
  } catch (error) {
    console.error('forcePlanChange error:', error);
    res.status(400).json({ error: error.message || 'Failed to force plan change.' });
  }
};

// =============================================
// AUDIT LOG — Get audit log for a tenant
// =============================================
exports.getTenantAuditLog = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action || null;
    const dateFrom = req.query.dateFrom || null;
    const dateTo = req.query.dateTo || null;

    let sql = `SELECT * FROM hris_saas.audit_logs WHERE tenant_id = ?`;
    const params = [req.params.id];

    if (action) {
      sql += ` AND action = ?`;
      params.push(action);
    }
    if (dateFrom) {
      sql += ` AND created_at >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND created_at <= ?`;
      params.push(dateTo + ' 23:59:59');
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(String(limit), String(offset));

    const [rows] = await db.execute(sql, params);

    let countSql = `SELECT COUNT(*) as count FROM hris_saas.audit_logs WHERE tenant_id = ?`;
    const countParams = [req.params.id];
    if (action) { countSql += ` AND action = ?`; countParams.push(action); }
    if (dateFrom) { countSql += ` AND created_at >= ?`; countParams.push(dateFrom); }
    if (dateTo) { countSql += ` AND created_at <= ?`; countParams.push(dateTo + ' 23:59:59'); }
    const [countResult] = await db.execute(countSql, countParams);

    res.json({
      logs: rows,
      total: parseInt(countResult[0]?.count || 0),
      limit,
      offset,
    });
  } catch (error) {
    console.error('getTenantAuditLog error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
};

// =============================================
// ANALYTICS — Retention & business metrics
// =============================================
exports.getAnalytics = async (req, res) => {
  try {
    // Trial → paid conversion
    const [trialStarted] = await db.execute(
      "SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_started'"
    );
    const [trialConverted] = await db.execute(
      "SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_converted'"
    );
    const started = Number(trialStarted[0]?.c || 0);
    const converted = Number(trialConverted[0]?.c || 0);

    // Subscription counts by plan
    const [subsByPlan] = await db.execute(
      `SELECT s.plan_id, COUNT(*) as c
       FROM subscriptions s
       WHERE s.status IN ('active','trialing')
       GROUP BY s.plan_id`
    );

    // Revenue by month from payments
    const [revenueByMonth] = await db.execute(
      `SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as revenue
       FROM payments WHERE status = 'captured'
       GROUP BY month ORDER BY month DESC LIMIT 12`
    );

    // Churn
    const [totalSubs] = await db.execute(
      "SELECT COUNT(*) as c FROM subscriptions WHERE status IN ('active','trialing')"
    );
    const [churnedSubs] = await db.execute(
      "SELECT COUNT(*) as c FROM subscriptions WHERE status IN ('cancelled','expired')"
    );
    const totalActive = Number(totalSubs[0]?.c || 0);
    const totalChurned = Number(churnedSubs[0]?.c || 0);

    // Referrals
    const [referralCount] = await db.execute(
      'SELECT COUNT(*) as c FROM referral_redemptions'
    );
    const [referralPending] = await db.execute(
      "SELECT COUNT(*) as c FROM referral_redemptions WHERE status = 'pending'"
    );

    // Campaigns
    const [campaigns] = await db.execute(
      `SELECT c.name, c.code, c.redemptions, c.max_redemptions,
              c.starts_at, c.ends_at, c.is_active
       FROM campaigns c
       ORDER BY c.created_at DESC`
    );

    // Active trials vs paid
    const [activeTrials] = await db.execute(
      "SELECT COUNT(*) as c FROM subscriptions WHERE status = 'trialing'"
    );

    res.json({
      trialStarted: started,
      trialConverted: converted,
      conversionRate: started > 0 ? Math.round((converted / started) * 100) : 0,
      subsByPlan: subsByPlan || [],
      revenueByMonth: revenueByMonth || [],
      totalActive,
      totalChurned,
      churnRate: (totalActive + totalChurned) > 0
        ? Math.round((totalChurned / (totalActive + totalChurned)) * 100)
        : 0,
      totalReferrals: Number(referralCount[0]?.c || 0),
      referralPending: Number(referralPending[0]?.c || 0),
      activeTrials: Number(activeTrials[0]?.c || 0),
      campaigns: campaigns || [],
    });
  } catch (error) {
    console.error('getAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
};

// =============================================
// CUSTOM PLANS — List all custom plans
// =============================================
exports.listCustomPlans = async (req, res) => {
  try {
    const activeOnly = req.query.active === 'true';
    const plans = await customPlanService.listPlans(activeOnly);
    res.json({ plans });
  } catch (error) {
    console.error('listCustomPlans error:', error);
    res.status(500).json({ error: 'Failed to list custom plans.' });
  }
};

// =============================================
// CUSTOM PLANS — Get single plan
// =============================================
exports.getCustomPlan = async (req, res) => {
  try {
    const plan = await customPlanService.getPlan(req.params.id);
    if (!plan) return res.status(404).json({ error: 'Custom plan not found.' });
    res.json({ plan });
  } catch (error) {
    console.error('getCustomPlan error:', error);
    res.status(500).json({ error: 'Failed to get custom plan.' });
  }
};

// =============================================
// CUSTOM PLANS — Create
// =============================================
exports.createCustomPlan = async (req, res) => {
  try {
    const plan = await customPlanService.createPlan({
      ...req.body,
      createdBy: req.user?.id,
    });
    res.status(201).json({ message: 'Custom plan created.', plan });
  } catch (error) {
    console.error('createCustomPlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to create plan.' });
  }
};

// =============================================
// CUSTOM PLANS — Update
// =============================================
exports.updateCustomPlan = async (req, res) => {
  try {
    const plan = await customPlanService.updatePlan(req.params.id, req.body);
    res.json({ message: 'Custom plan updated.', plan });
  } catch (error) {
    console.error('updateCustomPlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to update plan.' });
  }
};

// =============================================
// CUSTOM PLANS — Assign to tenant
// =============================================
exports.assignCustomPlan = async (req, res) => {
  try {
    const { customPlanId } = req.body;
    if (!customPlanId) return res.status(400).json({ error: 'customPlanId is required.' });
    const result = await customPlanService.assignToTenant(req.params.id, customPlanId, req.user?.id);
    res.json({ message: 'Custom plan assigned.', result });
  } catch (error) {
    console.error('assignCustomPlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to assign plan.' });
  }
};

// =============================================
// CUSTOM PLANS — Remove from tenant
// =============================================
exports.removeCustomPlan = async (req, res) => {
  try {
    await customPlanService.removeFromTenant(req.params.id);
    res.json({ message: 'Custom plan removed from tenant.' });
  } catch (error) {
    console.error('removeCustomPlan error:', error);
    res.status(500).json({ error: 'Failed to remove custom plan.' });
  }
};

// =============================================
// CUSTOM PLANS — Get tenant's assigned custom plan
// =============================================
exports.getTenantCustomPlan = async (req, res) => {
  try {
    const plan = await customPlanService.getTenantCustomPlan(req.params.id);
    res.json({ plan });
  } catch (error) {
    console.error('getTenantCustomPlan error:', error);
    res.status(500).json({ error: 'Failed to get tenant custom plan.' });
  }
};

// =============================================
// BRANDING — Get tenant branding
// =============================================
exports.getTenantBranding = async (req, res) => {
  try {
    const branding = await whiteLabelService.getBranding(req.params.id);
    res.json({ branding });
  } catch (error) {
    console.error('getTenantBranding error:', error);
    res.status(500).json({ error: 'Failed to get branding.' });
  }
};

// =============================================
// BRANDING — Update tenant branding
// =============================================
exports.updateTenantBranding = async (req, res) => {
  try {
    const branding = await whiteLabelService.upsertBranding(req.params.id, req.body);
    res.json({ message: 'Branding updated.', branding });
  } catch (error) {
    console.error('updateTenantBranding error:', error);
    res.status(400).json({ error: error.message || 'Failed to update branding.' });
  }
};

// =============================================
// SUBSCRIPTION ANALYTICS — Full analytics dashboard
// =============================================
exports.getSubscriptionAnalytics = async (req, res) => {
  try {
    const analytics = await analyticsService.getAnalyticsDashboard();
    res.json(analytics);
  } catch (error) {
    console.error('getSubscriptionAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription analytics.' });
  }
};

// =============================================
// CAMPAIGNS — List all campaigns
// =============================================
exports.listCampaigns = async (req, res) => {
  try {
    const campaigns = await saService.getCampaigns();
    res.json({ campaigns });
  } catch (error) {
    console.error('listCampaigns error:', error);
    res.status(500).json({ error: 'Failed to list campaigns.' });
  }
};

// =============================================
// CAMPAIGNS — Create
// =============================================
exports.createCampaign = async (req, res) => {
  try {
    const { name, description, discountPct, discountMonths, code, appliesTo, maxRedemptions, startsAt, endsAt, isActive } = req.body;
    if (!name || !startsAt || !endsAt) {
      return res.status(400).json({ error: 'name, startsAt, and endsAt are required.' });
    }
    const campaign = await saService.createCampaign(req.body);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.CAMPAIGN_CREATED,
      entityType: 'campaign', entityId: campaign.id,
      details: { name, code, discountPct, discountMonths },
      req,
    });
    res.status(201).json({ message: 'Campaign created.', campaign });
  } catch (error) {
    console.error('createCampaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign.' });
  }
};

// =============================================
// CAMPAIGNS — Update
// =============================================
exports.updateCampaign = async (req, res) => {
  try {
    const campaign = await saService.updateCampaign(req.params.id, req.body);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found.' });
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.CAMPAIGN_UPDATED,
      entityType: 'campaign', entityId: campaign.id,
      details: req.body,
      req,
    });
    res.json({ message: 'Campaign updated.', campaign });
  } catch (error) {
    console.error('updateCampaign error:', error);
    res.status(500).json({ error: 'Failed to update campaign.' });
  }
};

// =============================================
// CAMPAIGNS — Delete
// =============================================
exports.deleteCampaign = async (req, res) => {
  try {
    await saService.deleteCampaign(req.params.id);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.CAMPAIGN_DELETED,
      entityType: 'campaign', entityId: req.params.id,
      details: {},
      req,
    });
    res.json({ message: 'Campaign deleted.' });
  } catch (error) {
    console.error('deleteCampaign error:', error);
    res.status(500).json({ error: 'Failed to delete campaign.' });
  }
};

// =============================================
// REFERRALS — List with stats
// =============================================
exports.getReferralStats = async (req, res) => {
  try {
    const stats = await saService.getReferralStats();
    res.json(stats);
  } catch (error) {
    console.error('getReferralStats error:', error);
    res.status(500).json({ error: 'Failed to fetch referral stats.' });
  }
};

// =============================================
// REFERRALS — List all
// =============================================
exports.listReferrals = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = await saService.getReferrals(limit, offset);
    res.json(result);
  } catch (error) {
    console.error('listReferrals error:', error);
    res.status(500).json({ error: 'Failed to list referrals.' });
  }
};

// =============================================
// REFERRALS — Update status
// =============================================
exports.updateReferral = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required.' });
    await saService.updateReferral(req.params.id, status);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.REFERRAL_UPDATED,
      entityType: 'referral', entityId: req.params.id,
      details: { status },
      req,
    });
    res.json({ message: 'Referral updated.' });
  } catch (error) {
    console.error('updateReferral error:', error);
    res.status(400).json({ error: error.message || 'Failed to update referral.' });
  }
};

// =============================================
// SECTION VISIBILITY — Get for a tenant
// =============================================
exports.getSectionVisibility = async (req, res) => {
  try {
    const sections = await saService.getSectionVisibility(req.params.id);
    res.json({ sections });
  } catch (error) {
    console.error('getSectionVisibility error:', error);
    res.status(500).json({ error: 'Failed to fetch section visibility.' });
  }
};

// =============================================
// SECTION VISIBILITY — Update for a tenant
// =============================================
exports.updateSectionVisibility = async (req, res) => {
  try {
    const { sectionKey, visible, reason } = req.body;
    if (!sectionKey || visible === undefined) {
      return res.status(400).json({ error: 'sectionKey and visible are required.' });
    }
    await saService.updateSectionVisibility(req.params.id, sectionKey, visible, reason, req.user?.id);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.SECTION_VISIBILITY_UPDATED,
      entityType: 'tenant', entityId: req.params.id,
      tenantId: req.params.id,
      details: { sectionKey, visible, reason },
      req,
    });
    // Also log to tenant audit log
    await saService.logTenantAudit({
      tenantId: req.params.id, actorId: req.user?.id, actorName: req.user?.name,
      action: 'super_admin.section_visibility_updated',
      entityType: 'section_visibility', entityId: sectionKey,
      changes: { sectionKey, visible, reason },
      req,
    });
    res.json({ message: 'Section visibility updated.' });
  } catch (error) {
    console.error('updateSectionVisibility error:', error);
    res.status(500).json({ error: 'Failed to update section visibility.' });
  }
};

// =============================================
// PLAN FEATURES — List all (across plans)
// =============================================
exports.listAllPlanFeatures = async (req, res) => {
  try {
    const features = await saService.getAllPlanFeatures();
    res.json({ features });
  } catch (error) {
    console.error('listAllPlanFeatures error:', error);
    res.status(500).json({ error: 'Failed to list plan features.' });
  }
};

// =============================================
// PLAN FEATURES — Get for a specific plan
// =============================================
exports.listPlanFeatures = async (req, res) => {
  try {
    const features = await saService.getPlanFeatures(req.params.planId);
    res.json({ features });
  } catch (error) {
    console.error('listPlanFeatures error:', error);
    res.status(500).json({ error: 'Failed to list plan features.' });
  }
};

// =============================================
// PLAN FEATURES — Update
// =============================================
exports.updatePlanFeature = async (req, res) => {
  try {
    const { featureKey } = req.params;
    const result = await saService.updatePlanFeature(req.params.planId, featureKey, req.body);
    if (!result) return res.status(404).json({ error: 'Feature not found.' });
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'plan_feature.updated',
      entityType: 'plan_feature',
      entityId: `${req.params.planId}:${featureKey}`,
      details: { planId: req.params.planId, featureKey, updates: req.body },
      req,
    });
    res.json({ message: 'Plan feature updated.', feature: result });
  } catch (error) {
    console.error('updatePlanFeature error:', error);
    res.status(500).json({ error: 'Failed to update plan feature.' });
  }
};

// =============================================
// PLANS — Create a new subscription plan
// =============================================
exports.createPlan = async (req, res) => {
  try {
    const plan = await saService.createPlan(req.body);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.PLAN_CREATED,
      entityType: 'plan', entityId: plan.id,
      details: { name: plan.name, code: plan.id, price: plan.price_inr, period: plan.period },
      req,
    });
    res.status(201).json({ message: 'Plan created.', plan });
  } catch (error) {
    console.error('createPlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to create plan.' });
  }
};

// =============================================
// PLANS — Update a plan
// =============================================
exports.updatePlan = async (req, res) => {
  try {
    const plan = await saService.updatePlan(req.params.planId, req.body);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.PLAN_UPDATED,
      entityType: 'plan', entityId: req.params.planId,
      details: req.body,
      req,
    });
    res.json({ message: 'Plan updated.', plan });
  } catch (error) {
    console.error('updatePlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to update plan.' });
  }
};

// =============================================
// PLANS — Deactivate a plan (never delete)
// =============================================
exports.deactivatePlan = async (req, res) => {
  try {
    const result = await saService.deactivatePlan(req.params.planId);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.PLAN_DEACTIVATED,
      entityType: 'plan', entityId: req.params.planId,
      details: {},
      req,
    });
    res.json({ message: 'Plan deactivated.', plan: result });
  } catch (error) {
    console.error('deactivatePlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to deactivate plan.' });
  }
};

// =============================================
// PLANS — Delete a plan permanently
// =============================================
exports.deletePlan = async (req, res) => {
  try {
    const result = await saService.deletePlan(req.params.planId);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'plan.deleted',
      entityType: 'plan', entityId: req.params.planId,
      details: {},
      req,
    });
    res.json({ message: 'Plan deleted.', result });
  } catch (error) {
    console.error('deletePlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete plan.' });
  }
};

// =============================================
// PLAN FEATURES — Bulk update features for a plan
// =============================================
exports.bulkUpdatePlanFeatures = async (req, res) => {
  try {
    const { features } = req.body;
    if (!Array.isArray(features)) {
      return res.status(400).json({ error: 'features array is required.' });
    }
    const result = await saService.bulkUpdatePlanFeatures(req.params.planId, features);
    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'plan.features_updated',
      entityType: 'plan_features',
      entityId: `${req.params.planId}:bulk`,
      details: { planId: req.params.planId, featureCount: features.length },
      req,
    });
    res.json({ message: 'Plan features updated.', result });
  } catch (error) {
    console.error('bulkUpdatePlanFeatures error:', error);
    res.status(400).json({ error: error.message || 'Failed to update plan features.' });
  }
};

// =============================================
// TENANT PLAN — Change tenant's plan with full audit trail
// =============================================
exports.changeTenantPlan = async (req, res) => {
  try {
    const { plan: newPlan, reason, startDate, endDate, trialStartDate, trialEndDate } = req.body;
    if (!newPlan) {
      return res.status(400).json({ error: 'Plan is required.' });
    }
    const result = await saService.changeTenantPlan(req.params.tenantId, newPlan, {
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      reason: reason || `Plan changed to ${newPlan} by super admin`,
      startDate, endDate, trialStartDate, trialEndDate,
      req,
    });
    res.json({ message: `Tenant plan changed to ${newPlan}.`, result });
  } catch (error) {
    console.error('changeTenantPlan error:', error);
    res.status(400).json({ error: error.message || 'Failed to change tenant plan.' });
  }
};

// =============================================
// PLANS — List all subscription plans
// =============================================
exports.listPlans = async (req, res) => {
  try {
    const plans = await saService.getAllPlans();
    res.json({ plans });
  } catch (error) {
    console.error('listPlans error:', error);
    res.status(500).json({ error: 'Failed to list plans.' });
  }
};

// =============================================
// REVENUE ANALYTICS
// =============================================
exports.getRevenueAnalytics = async (req, res) => {
  try {
    const revenue = await saService.getRevenueAnalytics();
    const subscriptions = await saService.getSubscriptionAnalytics();
    const tenants = await saService.getTenantUsageAnalytics();
    res.json({ revenue, subscriptions, tenants });
  } catch (error) {
    console.error('getRevenueAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue analytics.' });
  }
};

// =============================================
// SUPER ADMIN ACTION LOG — List all super admin actions with full filtering
// =============================================
exports.getActionLog = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const { tenantId, action, entityType, actorId, dateFrom, dateTo, search } = req.query;

    let sql = 'SELECT * FROM hris_saas.sa_action_log WHERE 1=1';
    const params = [];
    const countParams = [];

    if (tenantId) {
      sql += ' AND tenant_id = ?';
      params.push(tenantId);
    }
    if (action) {
      sql += ' AND action = ?';
      params.push(action);
    }
    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (actorId) {
      sql += ' AND admin_id = ?';
      params.push(actorId);
    }
    if (dateFrom) {
      sql += ' AND created_at >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND created_at <= ?';
      params.push(dateTo + 'T23:59:59Z');
    }
    if (search) {
      sql += ' AND (admin_name ILIKE ? OR entity_id ILIKE ? OR reason ILIKE ? OR details::text ILIKE ?)';
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const [countResult] = await db.execute(countSql, params);
    const total = Number(countResult[0]?.count || 0);

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(String(limit), String(offset));

    const [rows] = await db.execute(sql, params);

    res.json({
      logs: rows,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('getActionLog error:', error);
    res.status(500).json({ error: 'Failed to fetch action log.' });
  }
};

/**
 * Get distinct action types from sa_action_log (for frontend filter dropdowns)
 */
exports.getActionLogTypes = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT action, COUNT(*) as count
       FROM hris_saas.sa_action_log
       GROUP BY action
       ORDER BY count DESC`
    );
    res.json({ types: rows });
  } catch (error) {
    console.error('getActionLogTypes error:', error);
    res.status(500).json({ error: 'Failed to fetch action types.' });
  }
};

/**
 * Get distinct actors from sa_action_log (for frontend filter dropdowns)
 */
exports.getActionLogActors = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT DISTINCT ON (admin_id) admin_id, admin_name
       FROM hris_saas.sa_action_log
       WHERE admin_id IS NOT NULL
       ORDER BY admin_id, admin_name`
    );
    res.json({ actors: rows });
  } catch (error) {
    console.error('getActionLogActors error:', error);
    res.status(500).json({ error: 'Failed to fetch actors.' });
  }
};

// =============================================
// BULK ACTION — Apply override to multiple tenants
// =============================================
exports.bulkOverride = async (req, res) => {
  try {
    const { tenantIds, featureKey, maxValue, expiresAt, reason } = req.body;
    if (!tenantIds || !Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: 'tenantIds array is required.' });
    }
    if (!featureKey) return res.status(400).json({ error: 'featureKey is required.' });

    const results = [];
    for (const tenantId of tenantIds) {
      try {
        const result = await overrideService.setOverride({
          tenantId,
          featureKey,
          maxValue: maxValue !== undefined ? maxValue : null,
          expiresAt: expiresAt || null,
          adminId: req.user?.id,
          adminName: req.user?.name || 'Super Admin',
          reason: reason || 'Bulk override by super admin',
        });
        results.push({ tenantId, success: true, result });
      } catch (err) {
        results.push({ tenantId, success: false, error: err.message });
      }
    }

    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: saService.SA_ACTIONS.BULK_ACTION,
      entityType: 'bulk_override',
      details: { tenantIds, featureKey, maxValue, expiresAt, reason, results },
      req,
    });

    res.json({ message: 'Bulk override completed.', results });
  } catch (error) {
    console.error('bulkOverride error:', error);
    res.status(500).json({ error: 'Failed to apply bulk override.' });
  }
};

// =============================================
// TRIAL EXTENSION — Extend tenant trial period
// =============================================
exports.extendTrial = async (req, res) => {
  try {
    const { extensionType, extensionDays, customTrialEndDate, reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required.' });
    }
    if (!extensionType && !customTrialEndDate) {
      return res.status(400).json({ error: 'extensionType or customTrialEndDate is required.' });
    }
    const result = await saService.extendTrial(req.params.tenantId, {
      extensionType,
      extensionDays: extensionDays ? Number(extensionDays) : null,
      customTrialEndDate,
      reason,
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      req,
    });
    res.json({
      message: `Trial extended to ${new Date(result.newTrialEnd).toLocaleDateString('en-IN')}.`,
      result,
    });
  } catch (error) {
    console.error('extendTrial error:', error);
    res.status(400).json({ error: error.message || 'Failed to extend trial.' });
  }
};

// =============================================
// TENANT NOTES — Update notes/tags
// =============================================
exports.updateTenantNotes = async (req, res) => {
  try {
    const { notes, tags } = req.body;
    const sets = [];
    const params = [];

    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes); }
    if (tags !== undefined) { sets.push('tags = ?'); params.push(JSON.stringify(tags)); }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    // Fetch old values for audit
    const [oldRows] = await db.execute('SELECT notes, tags FROM hris_saas.tenants WHERE id = ?', [req.params.id]);
    const oldData = oldRows[0] || {};

    params.push(req.params.id);
    await db.execute(`UPDATE hris_saas.tenants SET ${sets.join(', ')} WHERE id = ?`, params);

    await saService.logAction({
      adminId: req.user?.id,
      adminName: req.user?.name || 'Super Admin',
      action: saService.SA_ACTIONS.TENANT_NOTES_UPDATED,
      entityType: 'tenant',
      entityId: req.params.id,
      tenantId: req.params.id,
      oldValue: { notes: oldData.notes, tags: oldData.tags },
      newValue: { notes: notes !== undefined ? notes : oldData.notes, tags: tags !== undefined ? tags : oldData.tags },
      reason: req.body?.reason || null,
      details: { changed: sets.map(s => s.split('=')[0].trim()) },
      req,
    });

    res.json({ message: 'Tenant notes updated.' });
  } catch (error) {
    console.error('updateTenantNotes error:', error);
    res.status(500).json({ error: 'Failed to update tenant notes.' });
  }
};
