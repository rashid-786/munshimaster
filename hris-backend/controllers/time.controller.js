const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');
const { create, notifyAdmins } = require('../utils/notify');

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
             ON CONFLICT (tenant_id, employee_id, date) DO UPDATE SET clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out, total_hours = EXCLUDED.total_hours`,
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
           ON CONFLICT (tenant_id, employee_id, date) DO UPDATE SET clock_in = EXCLUDED.clock_in, clock_out = EXCLUDED.clock_out, total_hours = EXCLUDED.total_hours`,
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
           ON CONFLICT (tenant_id, employee_id, date) DO UPDATE SET clock_in = NULL, clock_out = NULL, total_hours = 0`,
          [id, tenantId, employeeId, date, new Date(`${date}T00:00`), new Date(`${date}T00:00`)]
        );
        const leaveId = uuidv4();
        await db.execute(
          `INSERT INTO leaves (id, tenant_id, employee_id, leave_type, start_date, end_date, status)
           VALUES (?, ?, ?, ?, ?, ?, 'approved')`,
          [leaveId, tenantId, employeeId, 'Absent', date, date]
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

exports.adminCreateLeave = async (req, res) => {
  const { employeeId, leaveType, startDate, endDate, replacementEmployeeId } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authority required.' });
  }

  if (!employeeId || !leaveType || !startDate || !endDate) {
    return res.status(400).json({ error: 'Employee, leave type, start date, and end date are required.' });
  }

  try {
    const [emp] = await db.execute(
      'SELECT id FROM employees WHERE id = ? AND tenant_id = ?', [employeeId, tenantId]
    );
    if (emp.length === 0) {
      return res.status(404).json({ error: 'Employee not found in this tenant.' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (startDate < today || endDate < today) {
      return res.status(400).json({ error: 'Cannot create leave in the past.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date must be on or before end date.' });
    }

    const [att] = await db.execute(
      `SELECT a.date, a.total_hours FROM attendance a
       WHERE a.employee_id = ? AND a.tenant_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours > 0`,
      [employeeId, tenantId, startDate, endDate]
    );
    if (att.length > 0) {
      const days = att.map(a => `${a.date} (${a.total_hours}h)`).join(', ');
      return res.status(409).json({ error: `Employee has logged hours on: ${days}. Remove attendance first.` });
    }

    const leaveId = uuidv4();
    await db.execute(
      `INSERT INTO leaves (id, tenant_id, employee_id, leave_type, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, ?, 'approved')`,
      [leaveId, tenantId, employeeId, leaveType, startDate, endDate]
    );

    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'leave.created', entityType: 'leave', entityId: leaveId, req });

    // If replacement adhoc staff is provided, auto-create the replacement record
    if (replacementEmployeeId) {
      const [adhoc] = await db.execute(
        "SELECT id FROM employees WHERE id = ? AND tenant_id = ? AND job_type = 'adhoc' AND status = 'active'",
        [replacementEmployeeId, tenantId]
      );
      if (adhoc.length > 0) {
        const [overlap] = await db.execute(
          `SELECT id FROM staff_replacements
           WHERE tenant_id = ? AND adhoc_employee_id = ? AND status = 'active'
           AND start_date <= ? AND end_date >= ?`,
          [tenantId, replacementEmployeeId, endDate, startDate]
        );
        if (overlap.length === 0) {
          const repId = uuidv4();
          await db.execute(
            `INSERT INTO staff_replacements (id, tenant_id, permanent_employee_id, adhoc_employee_id, leave_id, start_date, end_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [repId, tenantId, employeeId, replacementEmployeeId, leaveId, startDate, endDate]
          );
        }
      }
    }

    res.status(201).json({ message: 'Leave created and approved successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create leave record.' });
  }
};

exports.applyLeave = async (req, res) => {
  const { leaveType, startDate, endDate } = req.body;
  const tenantId = req.tenantId;
  const employeeId = req.user.id;

  try {
    const today = new Date().toISOString().split('T')[0];
    if (startDate < today || endDate < today) {
      return res.status(400).json({ error: 'Cannot request leave in the past.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'Start date must be on or before end date.' });
    }
    const [att] = await db.execute(
      `SELECT a.date, a.total_hours FROM attendance a
       WHERE a.employee_id = ? AND a.tenant_id = ? AND a.date >= ? AND a.date <= ? AND a.total_hours > 0`,
      [employeeId, tenantId, startDate, endDate]
    );
    if (att.length > 0) {
      const days = att.map(a => `${a.date} (${a.total_hours}h)`).join(', ');
      return res.status(409).json({ error: `You have logged hours on: ${days}. Remove attendance first.` });
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO leaves (id, tenant_id, employee_id, leave_type, start_date, end_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenantId, employeeId, leaveType, startDate, endDate]
    );
    notifyAdmins({
      tenantId,
      title: 'Leave Application',
      message: `${req.user.name} applied for ${leaveType} leave (${startDate} - ${endDate})`,
      type: 'leave',
      actorId: employeeId,
      actorName: req.user.name,
      entityType: 'leave',
      entityId: id,
    });
    res.status(201).json({ message: 'Leave application submitted for approval.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log leave request.' });
  }
};

exports.updateLeave = async (req, res) => {
  const { id } = req.params;
  const { leaveType, startDate, endDate } = req.body;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authority required.' });
  }

  try {
    const updates = [];
    const params = [];
    if (leaveType !== undefined) { updates.push('leave_type = ?'); params.push(leaveType); }
    if (startDate !== undefined) { updates.push('start_date = ?'); params.push(startDate); }
    if (endDate !== undefined) { updates.push('end_date = ?'); params.push(endDate); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update.' });
    }

    params.push(id, tenantId);
    await db.execute(
      `UPDATE leaves SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    const changes = {};
    if (leaveType !== undefined) changes.leaveType = leaveType;
    if (startDate !== undefined) changes.startDate = startDate;
    if (endDate !== undefined) changes.endDate = endDate;

    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'leave.updated', entityType: 'leave', entityId: id, changes, req });

    res.json({ message: 'Leave updated successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update leave.' });
  }
};

exports.deleteLeave = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Access denied. Administrative authority required.' });
  }

  try {
    await db.execute(
      'DELETE FROM leaves WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'leave.deleted', entityType: 'leave', entityId: id, req });
    res.json({ message: 'Leave deleted permanently.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete leave.' });
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

    const [[leave]] = await db.execute(
      'SELECT employee_id, leave_type FROM leaves WHERE id = ? AND tenant_id = ?',
      [leaveId, tenantId]
    );
    if (leave) {
      await create({
        tenantId,
        recipientId: leave.employee_id,
        title: `Leave ${status}`,
        message: `Your ${leave.leave_type} leave request has been ${status} by ${req.user.name}`,
        type: 'leave',
        actorId: req.user.id,
        actorName: req.user.name,
        entityType: 'leave',
        entityId: leaveId,
      });
    }

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
       FROM employees WHERE tenant_id = ? AND status = 'active'
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
        } else if (att) {
          hours = att.totalHours != null ? parseFloat(att.totalHours) : null;
          if (hours === 0) {
            type = 'absent';
            label = leave ? `${leave} Leave` : 'Absent';
          } else if (hours && hours > 0) {
            type = 'present';
            label = leave ? `Present (${hours}h, ${leave} leave)` : `Present (${hours}h)`;
          } else if (att.clockIn) {
            type = 'present';
            label = leave ? `Present (no clock-out, ${leave} leave)` : 'Present (no clock-out)';
          }
        } else if (leave) {
          type = leave.toLowerCase();
          label = `${leave} Leave`;
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
