const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// ==========================================
// ATTENDANCE ENGINE ACTIONS
// ==========================================

// Append this function to your existing controllers/time.controller.js file

exports.adminLogAttendance = async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, date, clockIn, clockOut } = req.body;

  // Secure checking: Verify user is a tenant admin
  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authority required.' });
  }

  try {
    const id = uuidv4();
    const clockInTime = new Date(`${date}T${clockIn}`);
    const clockOutTime = new Date(`${date}T${clockOut}`);

    if (clockOutTime <= clockInTime) {
      return res.status(400).json({ error: 'Clock-out time must be after clock-in time.' });
    }

    // Calculate hours dynamically on the server
    const totalHours = ((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2);

    // INSERT or UPDATE on unique constraint collision (same employee, same day)
    await db.execute(
      `INSERT INTO attendance (id, tenant_id, employee_id, date, clock_in, clock_out, total_hours)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE clock_in=VALUES(clock_in), clock_out=VALUES(clock_out), total_hours=VALUES(total_hours)`,
      [id, tenantId, employeeId, date, clockInTime, clockOutTime, totalHours]
    );

    res.status(201).json({ message: 'Employee attendance log recorded successfully!', totalHours });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to record manual attendance entry.' });
  }
};

exports.deleteAttendance = async (req, res) => {
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authority required.' });
  }

  const { employeeId, date } = req.params;

  try {
    await db.execute(
      'DELETE FROM attendance WHERE tenant_id = ? AND employee_id = ? AND date = ?',
      [tenantId, employeeId, date]
    );
    res.json({ message: 'Attendance record removed.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete attendance record.' });
  }
};

exports.adminSetStatus = async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, date, status, clockIn, clockOut } = req.body;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authority required.' });
  }

  try {
    switch (status) {
      case 'present': {
        const ci = clockIn || '09:00';
        const co = clockOut || '18:00';
        const clockInTime = new Date(`${date}T${ci}`);
        const clockOutTime = new Date(`${date}T${co}`);
        if (clockOutTime <= clockInTime) {
          return res.status(400).json({ error: 'Clock-out must be after clock-in.' });
        }
        const totalHours = ((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2);
        const id = uuidv4();
        await db.execute(
          `INSERT INTO attendance (id, tenant_id, employee_id, date, clock_in, clock_out, total_hours)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE clock_in=VALUES(clock_in), clock_out=VALUES(clock_out), total_hours=VALUES(total_hours)`,
          [id, tenantId, employeeId, date, clockInTime, clockOutTime, totalHours]
        );
        break;
      }
      case 'absent': {
        await db.execute(
          'DELETE FROM leaves WHERE tenant_id = ? AND employee_id = ? AND start_date <= ? AND end_date >= ?',
          [tenantId, employeeId, date, date]
        );
        const id = uuidv4();
        await db.execute(
          `INSERT INTO attendance (id, tenant_id, employee_id, date, clock_in, clock_out, total_hours)
           VALUES (?, ?, ?, ?, ?, ?, 0)
           ON DUPLICATE KEY UPDATE clock_in=NULL, clock_out=NULL, total_hours=0`,
          [id, tenantId, employeeId, date, new Date(`${date}T00:00`), new Date(`${date}T00:00`)]
        );
        break;
      }
      case 'sick':
      case 'annual': {
        const leaveType = status.charAt(0).toUpperCase() + status.slice(1);
        await db.execute(
          'DELETE FROM leaves WHERE tenant_id = ? AND employee_id = ? AND start_date <= ? AND end_date >= ?',
          [tenantId, employeeId, date, date]
        );
        await db.execute(
          'DELETE FROM attendance WHERE tenant_id = ? AND employee_id = ? AND date = ?',
          [tenantId, employeeId, date]
        );
        const leaveId = uuidv4();
        await db.execute(
          `INSERT INTO leaves (id, tenant_id, employee_id, leave_type, start_date, end_date, status)
           VALUES (?, ?, ?, ?, ?, ?, 'approved')`,
          [leaveId, tenantId, employeeId, leaveType, date, date]
        );
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid status value.' });
    }
    res.json({ message: 'Status updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update employee status.' });
  }
};

exports.clockIn = async (req, res) => {
  const tenantId = req.tenantId;
  const employeeId = req.user.id; // Pulled from the verified JWT payload
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const now = new Date();

  try {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO attendance (id, tenant_id, employee_id, date, clock_in)
             VALUES (?, ?, ?, ?, ?)`,
      [id, tenantId, employeeId, today, now]
    );
    res.status(201).json({ message: 'Clock-in recorded successfully!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'You have already checked in for today.' });
    }
    res.status(500).json({ error: 'Failed to record check-in.' });
  }
};

exports.clockOut = async (req, res) => {
  const tenantId = req.tenantId;
  const employeeId = req.user.id;
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  try {
    // Fetch today's clock-in entry
    const [records] = await db.execute(
      'SELECT clock_in FROM attendance WHERE tenant_id = ? AND employee_id = ? AND date = ?',
      [tenantId, employeeId, today]
    );

    if (records.length === 0) {
      return res.status(400).json({ error: 'No clock-in record found for today.' });
    }

    const clockInTime = new Date(records[0].clock_in);
    const totalHours = ((now - clockInTime) / (1000 * 60 * 60)).toFixed(2); // Convert ms to decimal hours

    await db.execute(
      `UPDATE attendance
             SET clock_out = ?, total_hours = ?
             WHERE tenant_id = ? AND employee_id = ? AND date = ? AND clock_out IS NULL`,
      [now, totalHours, tenantId, employeeId, today]
    );

    res.json({ message: 'Clock-out recorded successfully!', hoursWorked: totalHours });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record check-out.' });
  }
};

// ==========================================
// LEAVE ACTIONS
// ==========================================

exports.applyLeave = async (req, res) => {
  const { leaveType, startDate, endDate } = req.body;
  const tenantId = req.tenantId;
  const employeeId = req.user.id;

  try {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO leaves (id, tenant_id, employee_id, leave_type, start_date, end_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenantId, employeeId, leaveType, startDate, endDate]
    );
    res.status(201).json({ message: 'Leave application submitted for approval.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log leave request.' });
  }
};

exports.updateLeaveStatus = async (req, res) => {
  const { leaveId, status } = req.body; // status: 'approved' or 'rejected'
  const tenantId = req.tenantId;

  // Secure checking: Verify user is a tenant admin
  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authority required.' });
  }

  try {
    await db.execute(
      'UPDATE leaves SET status = ? WHERE id = ? AND tenant_id = ?',
      [status, leaveId, tenantId]
    );
    res.json({ message: `Leave application successfully updated to: ${status}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update leave record state.' });
  }
};

exports.getTenantLeaves = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    let where = 'WHERE l.tenant_id = ?';
    const params = [tenantId];

    if (req.user.role !== 'tenant_admin') {
      where += ' AND l.employee_id = ?';
      params.push(req.user.id);
    }

    const [rows] = await db.execute(
      `SELECT l.id, l.leave_type, l.start_date, l.end_date, l.status, e.first_name, e.last_name
             FROM leaves l
             JOIN employees e ON l.employee_id = e.id
             ${where}
             ORDER BY l.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracking rosters.' });
  }
};

// ==========================================
// EMPLOYEE CALENDAR (Admin View)
// ==========================================
exports.getEmployeeCalendar = async (req, res) => {
  const tenantId = req.tenantId;

  let { month, year, employeeId } = req.query;

  if (req.user.role !== 'tenant_admin') {
    employeeId = req.user.id;
  }
  const m = parseInt(month) || (new Date().getMonth() + 1);
  const y = parseInt(year) || new Date().getFullYear();

  const lastDate = new Date(y, m, 0);
  const pad = (n) => String(n).padStart(2, '0');
  const firstDay = `${y}-${pad(m)}-01`;
  const lastDay = `${lastDate.getFullYear()}-${pad(lastDate.getMonth() + 1)}-${pad(lastDate.getDate())}`;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  try {
    const [tenantRows] = await db.execute('SELECT settings FROM tenants WHERE id = ?', [tenantId]);
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
      employeeId ? [tenantId, firstDay, lastDay, employeeId] : [tenantId, firstDay, lastDay]
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
      employeeId ? [tenantId, lastDay, firstDay, employeeId] : [tenantId, lastDay, firstDay]
    );

    const [employees] = await db.execute(
      `SELECT id, first_name, last_name, role
       FROM employees WHERE tenant_id = ?
       ${employeeId ? 'AND id = ?' : ''}
       ORDER BY first_name`,
      employeeId ? [tenantId, employeeId] : [tenantId]
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
        clockIn: fmtTime(a.clock_in),
        clockOut: fmtTime(a.clock_out),
        totalHours: a.total_hours,
      };
    });

    const leaveMap = {};
    leaves.forEach(l => {
      if (!leaveMap[l.employee_id]) leaveMap[l.employee_id] = {};
      const start = new Date(l.start_date);
      const end = new Date(l.end_date);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        leaveMap[l.employee_id][dateStr] = l.leave_type;
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

        if (isWeekend) {
          type = 'weekend';
          label = `Weekend (${DAY_NAMES[dayOfWeek]})`;
        } else if (leave) {
          type = leave.toLowerCase();
          label = `${leave} Leave`;
        } else if (att) {
          hours = att.totalHours != null ? parseFloat(att.totalHours) : null;
          if (hours === 0) {
            type = 'absent';
            label = 'Absent';
          } else if (hours && hours > 0) {
            type = 'present';
            label = `Present (${hours}h)`;
          } else if (att.clockIn) {
            type = 'present';
            label = 'Present (no clock-out)';
          }
        }

        days.push({ date: dateStr, day: d, type, label, hours, isWeekend, clockIn: att?.clockIn || null, clockOut: att?.clockOut || null });
      }
      return { employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name, role: emp.role }, days };
    });

    res.json({ month: m, year: y, employees: result, weekendDays });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate calendar data.' });
  }
};
