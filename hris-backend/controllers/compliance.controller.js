const db = require('../config/db');

const EXPORT_TABLES = [
  { table: 'customers', query: 'SELECT * FROM customers WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'suppliers', query: 'SELECT * FROM suppliers WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'products', query: 'SELECT * FROM products WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'stock_movements', query: 'SELECT * FROM stock_movements WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'invoices', query: 'SELECT * FROM invoices WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'invoice_items', query: `SELECT ii.* FROM invoice_items ii JOIN invoices i ON ii.invoice_id = i.id WHERE i.tenant_id = ? ORDER BY ii.id` },
  { table: 'invoice_payments', query: 'SELECT * FROM invoice_payments WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'purchase_orders', query: 'SELECT * FROM purchase_orders WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'purchase_order_items', query: `SELECT poi.* FROM purchase_order_items poi JOIN purchase_orders po ON poi.purchase_order_id = po.id WHERE po.tenant_id = ? ORDER BY poi.id` },
  { table: 'attachments', query: 'SELECT * FROM attachments WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'email_logs', query: 'SELECT * FROM email_logs WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'balance_sheet', query: 'SELECT * FROM balance_sheet WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'audit_logs', query: 'SELECT * FROM audit_logs WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'notifications', query: 'SELECT * FROM notifications WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'employees', query: 'SELECT * FROM employees WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'attendance', query: 'SELECT * FROM attendance WHERE tenant_id = ? ORDER BY date' },
  { table: 'leaves', query: 'SELECT * FROM leaves WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'payroll', query: 'SELECT * FROM payroll WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'employee_advances', query: 'SELECT * FROM employee_advances WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'staff_replacements', query: 'SELECT * FROM staff_replacements WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'kirana_parties', query: 'SELECT * FROM kirana_parties WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'kirana_transactions', query: 'SELECT * FROM kirana_transactions WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'kirana_staff', query: 'SELECT * FROM kirana_staff WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'kirana_cashbook', query: 'SELECT * FROM kirana_cashbook WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'subscriptions', query: 'SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'payments', query: 'SELECT * FROM payments WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'tenant_feature_overrides', query: 'SELECT * FROM tenant_feature_overrides WHERE tenant_id = ? ORDER BY id' },
  { table: 'referral_codes', query: 'SELECT * FROM referral_codes WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'campaign_redemptions', query: 'SELECT * FROM campaign_redemptions WHERE tenant_id = ? ORDER BY created_at' },
  { table: 'conversion_events', query: 'SELECT * FROM conversion_events WHERE tenant_id = ? ORDER BY created_at' },
];

exports.exportData = async (req, res) => {
  const tenantId = req.tenantId;
  const format = req.query.format || 'json'; // json or csv

  try {
    const [tenantRow] = await db.execute('SELECT company_name, email FROM tenants WHERE id = ?', [tenantId]);
    if (tenantRow.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
    const companyName = tenantRow[0].company_name;

    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${companyName.replace(/[^a-zA-Z0-9]/g, '_')}_data_export.zip"`);
    archive.pipe(res);

    const exports = [];
    for (const { table, query } of EXPORT_TABLES) {
      try {
        const [rows] = await db.query(query, [tenantId]);
        exports.push({ table, rows });
      } catch (err) {
        console.error(`Export error for ${table}:`, err.message);
        exports.push({ table, rows: [], error: err.message });
      }
    }

    const tenantInfo = await buildTenantInfo(tenantId);
    archive.append(JSON.stringify(tenantInfo, null, 2), { name: 'tenant_info.json' });

    if (format === 'csv') {
      for (const { table, rows } of exports) {
        if (rows.length === 0) {
          archive.append('', { name: `${table}.csv` });
          continue;
        }
        const headers = Object.keys(rows[0]);
        const lines = rows.map(row => headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
        const csv = [headers.join(','), ...lines].join('\n');
        archive.append(csv, { name: `${table}.csv` });
      }
    } else {
      for (const { table, rows } of exports) {
        archive.append(JSON.stringify(rows, null, 2), { name: `${table}.json` });
      }
    }

    archive.finalize();
  } catch (error) {
    console.error('Export error:', error);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to export data.' });
  }
};

async function buildTenantInfo(tenantId) {
  try {
    const [rows] = await db.execute('SELECT * FROM tenants WHERE id = ?', [tenantId]);
    if (rows.length === 0) return { tenantId };
    const t = rows[0];
    return {
      tenantId: t.id,
      companyName: t.company_name,
      email: t.email,
      createdAt: t.created_at,
    };
  } catch {
    return { tenantId };
  }
}

const DELETE_ORDER = [
  'stock_movements',
  'purchase_order_items',
  'invoice_items',
  'invoice_payments',
  'attachments',
  'email_logs',
  'audit_logs',
  'notifications',
  'balance_sheet',
  'kirana_cashbook',
  'kirana_staff',
  'kirana_transactions',
  'kirana_parties',
  'employee_advances',
  'payroll',
  'leaves',
  'attendance',
  'staff_replacements',
  'employees',
  'purchase_orders',
  'invoices',
  'products',
  'customers',
  'suppliers',
  'referral_codes',
  'campaign_redemptions',
  'conversion_events',
  'subscriptions',
  'payments',
  'tenant_feature_overrides',
];

exports.deleteTenantData = async (req, res) => {
  const tenantId = req.tenantId;

  try {
    await db.query('BEGIN');

    for (const table of DELETE_ORDER) {
      try {
        await db.query(`DELETE FROM ${table} WHERE tenant_id = ?`, [tenantId]);
      } catch (err) {
        console.error(`Delete error for ${table}:`, err.message);
      }
    }

    await db.query('COMMIT');
    res.json({ message: 'All tenant data has been deleted.' });
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    console.error('deleteTenantData error:', error);
    res.status(500).json({ error: 'Failed to delete tenant data.' });
  }
};
