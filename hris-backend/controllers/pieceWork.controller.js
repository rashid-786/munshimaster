const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.getEmployeeRates = async (req, res) => {
  const { employeeId } = req.query;
  const tenantId = req.tenantId;
  try {
    let query = 'SELECT id, work_type, unit_label, rate_per_piece FROM employee_piece_rates WHERE tenant_id = ?';
    const params = [tenantId];
    if (employeeId) { query += ' AND employee_id = ?'; params.push(employeeId); }
    query += ' ORDER BY created_at ASC';
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch piece rates.' });
  }
};

exports.createEntry = async (req, res) => {
  const { employeeId, quantity, date, ratePerPiece, workType } = req.body;
  const tenantId = req.tenantId;
  if (!employeeId || quantity === undefined || quantity === '' || !date) {
    return res.status(400).json({ error: 'employeeId, quantity, and date are required.' });
  }
  try {
    const [emp] = await db.execute(
      'SELECT id FROM employees WHERE id = ? AND tenant_id = ?',
      [employeeId, tenantId]
    );
    if (emp.length === 0) return res.status(404).json({ error: 'Employee not found.' });
    let rate = ratePerPiece !== undefined ? Math.round(parseFloat(ratePerPiece) * 100) : 0;
    if (!ratePerPiece && workType) {
      const [pr] = await db.execute(
        'SELECT rate_per_piece FROM employee_piece_rates WHERE tenant_id = ? AND employee_id = ? AND work_type = ?',
        [tenantId, employeeId, workType]
      );
      rate = pr.length > 0 ? pr[0].rate_per_piece : 0;
    }
    const qty = parseFloat(quantity) || 0;
    const amount = Math.round(qty * rate);
    const id = uuidv4();
    await db.execute(
      `INSERT INTO piece_work_entries (id, tenant_id, employee_id, quantity, date, work_type, rate_per_piece, calculated_amount)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, employeeId, qty, date, workType || null, rate, amount]
    );
    res.status(201).json({ message: 'Piece work entry created.', id, calculatedAmount: amount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create piece work entry.' });
  }
};

exports.getEntries = async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, startDate, endDate, isPaid } = req.query;
  try {
    let query = `SELECT p.*, e.first_name, e.last_name, e.piece_unit_label
                 FROM piece_work_entries p
                 JOIN employees e ON p.employee_id = e.id
                 WHERE p.tenant_id = ?`;
    const params = [tenantId];
    if (employeeId) { query += ' AND p.employee_id = ?'; params.push(employeeId); }
    if (startDate) { query += ' AND p.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND p.date <= ?'; params.push(endDate); }
    if (isPaid !== undefined) { query += ' AND p.is_paid = ?'; params.push(isPaid === 'true' ? 1 : 0); }
    query += ' ORDER BY p.date DESC, p.created_at DESC';
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch piece work entries.' });
  }
};

exports.updateEntry = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  const { quantity, date, ratePerPiece } = req.body;
  try {
    const [existing] = await db.execute(
      'SELECT * FROM piece_work_entries WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Entry not found.' });
    if (existing[0].is_paid === 1) {
      return res.status(400).json({ error: 'Cannot edit a paid entry. Reverse the payroll first.' });
    }
    const qty = quantity !== undefined ? (parseFloat(quantity) || 0) : existing[0].quantity;
    const rate = ratePerPiece !== undefined ? Math.round(parseFloat(ratePerPiece) * 100) : existing[0].rate_per_piece;
    const amount = Math.round(qty * rate);
    const dateVal = date || existing[0].date;
    await db.execute(
      'UPDATE piece_work_entries SET quantity = ?, date = ?, rate_per_piece = ?, calculated_amount = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [qty, dateVal, rate, amount, id, tenantId]
    );
    res.json({ message: 'Entry updated.', calculatedAmount: amount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update entry.' });
  }
};

exports.deleteEntry = async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenantId;
  try {
    const [existing] = await db.execute(
      'SELECT is_paid FROM piece_work_entries WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Entry not found.' });
    if (existing[0].is_paid === 1) {
      return res.status(400).json({ error: 'Cannot delete a paid entry. Reverse the payroll first.' });
    }
    await db.execute('DELETE FROM piece_work_entries WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ message: 'Entry deleted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
};

exports.getSummary = async (req, res) => {
  const tenantId = req.tenantId;
  const { startDate, endDate, employeeId } = req.query;
  try {
    let query = `SELECT p.employee_id, e.first_name, e.last_name, e.piece_unit_label,
                        SUM(p.quantity) as total_quantity, SUM(p.calculated_amount) as total_amount,
                        SUM(CASE WHEN p.is_paid = 1 THEN p.calculated_amount ELSE 0 END) as paid_amount
                 FROM piece_work_entries p
                 JOIN employees e ON p.employee_id = e.id
                 WHERE p.tenant_id = ?`;
    const params = [tenantId];
    if (employeeId) { query += ' AND p.employee_id = ?'; params.push(employeeId); }
    if (startDate) { query += ' AND p.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND p.date <= ?'; params.push(endDate); }
    query += ' GROUP BY p.employee_id, e.first_name, e.last_name, e.piece_unit_label ORDER BY e.first_name';
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch piece work summary.' });
  }
};

exports.markAsPaid = async (req, res) => {
  const { entryIds, payrollId } = req.body;
  const tenantId = req.tenantId;
  if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
    return res.status(400).json({ error: 'entryIds array is required.' });
  }
  try {
    const placeholders = entryIds.map(() => '?').join(',');
    await db.execute(
      `UPDATE piece_work_entries SET is_paid = 1, payroll_id = ? WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [payrollId, ...entryIds, tenantId]
    );
    res.json({ message: `${entryIds.length} entries marked as paid.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to mark entries as paid.' });
  }
};

exports.unmarkPaid = async (req, res) => {
  const { payrollId } = req.params;
  const tenantId = req.tenantId;
  try {
    await db.execute(
      'UPDATE piece_work_entries SET is_paid = 0, payroll_id = NULL WHERE payroll_id = ? AND tenant_id = ?',
      [payrollId, tenantId]
    );
    res.json({ message: 'Entries unmarked as paid.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to unmark entries.' });
  }
};

exports.saveDayEntries = async (req, res) => {
  const { employeeId, date, entries } = req.body;
  const tenantId = req.tenantId;
  if (!employeeId || !date || !entries || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'employeeId, date, and entries array are required.' });
  }
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    // Delete existing entries for this employee+date that are unpaid
    await client.query(
      'DELETE FROM piece_work_entries WHERE tenant_id = $1 AND employee_id = $2 AND date = $3 AND is_paid = 0',
      [tenantId, employeeId, date]
    );
    // Insert new entries
    for (const entry of entries) {
      if (!entry.workType || !entry.quantity) continue;
      const rate = entry.ratePerPiece !== undefined ? Math.round(parseFloat(entry.ratePerPiece) * 100) : 0;
      const qty = parseFloat(entry.quantity) || 0;
      const amount = Math.round(qty * rate);
      const id = uuidv4();
      await client.query(
        `INSERT INTO piece_work_entries (id, tenant_id, employee_id, quantity, date, work_type, unit_label, rate_per_piece, calculated_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, tenantId, employeeId, qty, date, entry.workType, entry.unitLabel || 'pcs', rate, amount]
      );
    }
    await client.query('COMMIT');
    res.json({ message: 'Day entries saved.', count: entries.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    res.status(500).json({ error: 'Failed to save day entries.' });
  } finally {
    client.release();
  }
};

exports.getCalendarData = async (req, res) => {
  const tenantId = req.tenantId;
  const { month, year, employeeId } = req.query;
  if (!month || !year) return res.status(400).json({ error: 'month and year are required.' });
  try {
    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    let empQuery = 'SELECT id, first_name, last_name, piece_unit_label FROM employees WHERE tenant_id = ? AND salary_type = ? AND status = ?';
    const empParams = [tenantId, 'piece', 'active'];
    if (employeeId) { empQuery += ' AND id = ?'; empParams.push(employeeId); }
    empQuery += ' ORDER BY first_name';
    const [employees] = await db.execute(empQuery, empParams);

    let entQuery = `SELECT p.employee_id, p.date, p.work_type, p.unit_label, p.quantity, p.rate_per_piece,
                           p.calculated_amount, p.is_paid, p.id as entry_id
                    FROM piece_work_entries p
                    WHERE p.tenant_id = ? AND p.date >= ? AND p.date <= ?`;
    const entParams = [tenantId, startDate, endDate];
    if (employeeId) { entQuery += ' AND p.employee_id = ?'; entParams.push(employeeId); }
    entQuery += ' ORDER BY p.date, p.work_type';
    const [allEntries] = await db.execute(entQuery, entParams);

    // Group entries by employee_id and date
    const entriesByEmpDate = {};
    const fmtLocal = (dt) => {
      if (!dt) return '';
      if (dt instanceof Date) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(dt).split('T')[0];
    };
    for (const e of allEntries) {
      const d = fmtLocal(e.date);
      const key = `${e.employee_id}|${d}`;
      if (!entriesByEmpDate[key]) entriesByEmpDate[key] = [];
      entriesByEmpDate[key].push(e);
    }

    const result = employees.map(emp => {
      const days = [];
      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayKey = `${emp.id}|${dateStr}`;
        const dayEntries = entriesByEmpDate[dayKey] || [];
        const totalQty = dayEntries.reduce((s, e) => s + parseFloat(e.quantity || 0), 0);
        const totalAmt = dayEntries.reduce((s, e) => s + parseInt(e.calculated_amount || 0), 0);
        const isPaid = dayEntries.length > 0 && dayEntries.every(e => e.is_paid === 1);
        const hasPartial = dayEntries.length > 0 && !isPaid;
        let type = 'none';
        if (dayEntries.length > 0 && isPaid) type = 'paid';
        else if (dayEntries.length > 0) type = 'unpaid';
        days.push({
          date: dateStr,
          type,
          totalQuantity: totalQty,
          totalAmount: totalAmt,
          entryCount: dayEntries.length,
          isPaid: isPaid ? 1 : 0,
          entries: dayEntries.map(e => ({
            id: e.entry_id,
            workType: e.work_type,
            unitLabel: e.unit_label,
            quantity: e.quantity,
            ratePerPiece: e.rate_per_piece,
            calculatedAmount: e.calculated_amount,
            isPaid: e.is_paid,
          })),
        });
      }
      return {
        employee: { id: emp.id, firstName: emp.first_name, lastName: emp.last_name, pieceUnitLabel: emp.piece_unit_label },
        days,
      };
    });
    res.json({ employees: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch calendar data.' });
  }
};

exports.getUnpaidEntries = async (req, res) => {
  const tenantId = req.tenantId;
  const { employeeId, startDate, endDate } = req.query;
  try {
    let query = `SELECT p.*, e.first_name, e.last_name, e.piece_unit_label
                 FROM piece_work_entries p
                 JOIN employees e ON p.employee_id = e.id
                 WHERE p.tenant_id = ? AND p.is_paid = 0`;
    const params = [tenantId];
    if (employeeId) { query += ' AND p.employee_id = ?'; params.push(employeeId); }
    if (startDate) { query += ' AND p.date >= ?'; params.push(startDate); }
    if (endDate) { query += ' AND p.date <= ?'; params.push(endDate); }
    query += ' ORDER BY p.date ASC';
    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch unpaid entries.' });
  }
};
