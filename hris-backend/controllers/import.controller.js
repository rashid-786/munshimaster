const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const XLSX = require('xlsx');
const { log } = require('../utils/audit');

function parseName(fullName) {
  const parts = str(fullName).trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  return { firstName, lastName };
}

function str(val) { return val == null ? '' : String(val); }

function validateRow(row, rowIndex, existingEmails, existingPhones) {
  const errors = [];
  const name = str(row['Staff Name']).trim();
  const email = str(row['Email']).trim().toLowerCase();
  const phone = str(row['Phone']).trim();
  const profession = str(row['Profession']).trim();
  const jobType = str(row['Job Type']).trim().toLowerCase();
  const salaryRaw = str(row['Salary']).trim();
  const joiningDate = str(row['Joining Date']).trim();
  const status = str(row['Status']).trim().toLowerCase();

  if (!name) errors.push('Staff Name is required');
  if (!email) errors.push('Email is required');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');

  if (!salaryRaw) errors.push('Salary is required');
  else if (isNaN(parseFloat(salaryRaw)) || parseFloat(salaryRaw) < 0) errors.push('Salary must be a positive number');

  if (!jobType) errors.push('Job Type is required');
  else if (!['permanent', 'adhoc'].includes(jobType)) errors.push('Job Type must be Permanent or Adhoc');

  if (!joiningDate) errors.push('Joining Date is required');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(joiningDate)) errors.push('Joining Date must be YYYY-MM-DD format');

  if (status && !['active', 'inactive'].includes(status)) errors.push('Status must be Active or Inactive');

  if (email && existingEmails.has(email)) errors.push('Email already exists in the system');
  if (phone && existingPhones.has(phone)) errors.push('Phone already exists in the system');

  return errors;
}

exports.previewImport = async (req, res) => {
  const tenantId = req.tenantId;

  if (!req.file) {
    return res.status(400).json({ error: 'Please upload an Excel (.xlsx) or CSV file.' });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'The uploaded file contains no data rows.' });
    }

    const [existing] = await db.execute(
      'SELECT email, phone FROM employees WHERE tenant_id = ?',
      [tenantId]
    );
    const existingEmails = new Set(existing.map(e => e.email?.toLowerCase()).filter(Boolean));
    const existingPhones = new Set(existing.map(e => e.phone).filter(Boolean));

    const rows = rawData.map((row, i) => {
      const errors = validateRow(row, i, existingEmails, existingPhones);
      const { firstName, lastName } = parseName(str(row['Staff Name']));
      const statusVal = str(row['Status']).trim().toLowerCase();
      return {
        rowNumber: i + 2,
        firstName,
        lastName,
        email: str(row['Email']).trim().toLowerCase(),
        phone: str(row['Phone']).trim(),
        profession: str(row['Profession']).trim(),
        jobType: str(row['Job Type']).trim().toLowerCase() || 'permanent',
        baseSalary: str(row['Salary']).trim(),
        joiningDate: str(row['Joining Date']).trim(),
        status: statusVal === 'inactive' ? 'deactivated' : 'active',
        valid: errors.length === 0,
        errors,
      };
    });

    const validRows = rows.filter(r => r.valid);
    const invalidRows = rows.filter(r => !r.valid);

    res.json({
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to parse the uploaded file. Ensure it is a valid .xlsx or .csv.' });
  }
};

exports.executeImport = async (req, res) => {
  const tenantId = req.tenantId;
  const { rows, duplicateAction } = req.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No valid rows to import.' });
  }

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance required.' });
  }

  try {
    const [existing] = await db.execute(
      'SELECT email, phone FROM employees WHERE tenant_id = ?',
      [tenantId]
    );
    const emailToExisting = new Map(existing.map(e => [e.email?.toLowerCase(), e]));
    const phoneToExisting = new Map(existing.map(e => [e.phone, e]));

    let created = 0;
    let skipped = 0;
    let updated = 0;
    const failed = [];

    for (const row of rows) {
      try {
        const existingByEmail = emailToExisting.get(row.email);
        const existingByPhone = row.phone ? phoneToExisting.get(row.phone) : null;
        const existingRecord = existingByEmail || existingByPhone;

        if (existingRecord && duplicateAction === 'skip') {
          skipped++;
          continue;
        }

        const salaryInCents = Math.round(parseFloat(row.baseSalary) * 100);
        const hashedPassword = await bcrypt.hash('Welcome@123', 10);

        if (existingRecord && duplicateAction === 'overwrite') {
          const updates = [];
          const params = [];
          updates.push('first_name = ?'); params.push(row.firstName);
          updates.push('last_name = ?'); params.push(row.lastName);
          updates.push('email = ?'); params.push(row.email);
          if (row.phone) { updates.push('phone = ?'); params.push(row.phone); }
          updates.push('profession = ?'); params.push(row.profession || null);
          updates.push('job_type = ?'); params.push(row.jobType);
          updates.push('base_salary = ?'); params.push(salaryInCents);
          updates.push('status = ?'); params.push(row.status);
          params.push(existingRecord.id, tenantId);
          await db.execute(
            `UPDATE employees SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
            params
          );
          updated++;
        } else if (!existingRecord) {
          const employeeId = uuidv4();
          await db.execute(
            `INSERT INTO employees (id, tenant_id, first_name, last_name, email, phone, password_hash, role, job_type, base_salary, status, profession)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'employee', ?, ?, ?, ?)`,
            [employeeId, tenantId, row.firstName, row.lastName, row.email, row.phone || null, hashedPassword,
             row.jobType, salaryInCents, row.status, row.profession || null]
          );
          created++;
        } else {
          skipped++;
        }
      } catch (err) {
        failed.push({ email: row.email, reason: err.message });
      }
    }

    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'import.executed', entityType: 'import', changes: { created, updated, skipped, failed }, req });

    res.json({
      message: `Import complete. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed.length}.`,
      created,
      updated,
      skipped,
      failed,
      total: rows.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Import execution failed.' });
  }
};

exports.downloadTemplate = async (req, res) => {
  const header = ['Staff Name', 'Email', 'Phone', 'Profession', 'Job Type', 'Salary', 'Joining Date', 'Status'];
  const example = [
    ['John Doe', 'john@example.com', '+96512345678', 'Engineer', 'Permanent', '1500', '2026-01-15', 'Active'],
    ['Jane Smith', 'jane@example.com', '+96587654321', 'Technician', 'Adhoc', '800', '2026-02-01', 'Active'],
  ];

  const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
  ws['!cols'] = header.map(() => ({ wch: 22 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Staff Import');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=staff_import_template.xlsx');
  res.send(buf);
};
