const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { parseFile } = require('../utils/bulkImport');

exports.preview = async (req, res) => {
  const tenantId = req.tenantId;
  const { entityType } = req.params;

  if (!['customer', 'supplier', 'product'].includes(entityType)) {
    return res.status(400).json({ error: 'entityType must be customer, supplier, or product.' });
  }

  if (!req.file) return res.status(400).json({ error: 'File is required.' });

  try {
    const result = parseFile(req.file.buffer, entityType);
    if (result.errors.length > 0) {
      return res.json({ rows: result.rows, errors: result.errors.slice(0, 20), mapping: result.mapping });
    }
    res.json({ rows: result.rows, errors: [], mapping: result.mapping, total: result.rows.length });
  } catch (error) {
    console.error('Bulk import preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse file.' });
  }
};

exports.confirm = async (req, res) => {
  const tenantId = req.tenantId;
  const { entityType } = req.params;
  const { rows } = req.body;

  if (!['customer', 'supplier', 'product'].includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entity type.' });
  }
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows to import.' });
  }

  try {
    let imported = 0, skipped = 0, errors = [];

    for (const row of rows) {
      try {
        if (entityType === 'customer') {
          if (!row.name) { skipped++; continue; }
          const existing = await db.query(
            `SELECT id FROM hris_saas.customers WHERE tenant_id = $1 AND name = $2`,
            [tenantId, row.name]
          );
          if (existing[0].length > 0) { skipped++; continue; }

          await db.query(
            `INSERT INTO hris_saas.customers (id, tenant_id, name, email, phone, address, city, state, pincode, gstin, contact_person, credit_limit, payment_terms, notes, status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'active',NOW())`,
            [uuidv4(), tenantId, row.name, row.email, row.phone, row.address, row.city, row.state,
             row.pincode, row.gstin || null, row.contact_person, row.credit_limit || 0, row.payment_terms, row.notes]
          );
          imported++;
        } else if (entityType === 'supplier') {
          if (!row.name) { skipped++; continue; }
          const existing = await db.query(
            `SELECT id FROM hris_saas.suppliers WHERE tenant_id = $1 AND name = $2`,
            [tenantId, row.name]
          );
          if (existing[0].length > 0) { skipped++; continue; }

          await db.query(
            `INSERT INTO hris_saas.suppliers (id, tenant_id, name, email, phone, address, city, state, pincode, gstin, contact_person, payment_terms, notes, status, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',NOW())`,
            [uuidv4(), tenantId, row.name, row.email, row.phone, row.address, row.city, row.state,
             row.pincode, row.gstin || null, row.contact_person, row.payment_terms, row.notes]
          );
          imported++;
        } else if (entityType === 'product') {
          if (!row.name) { skipped++; continue; }
          const existing = await db.query(
            `SELECT id FROM hris_saas.products WHERE tenant_id = $1 AND name = $2`,
            [tenantId, row.name]
          );
          if (existing[0].length > 0) { skipped++; continue; }

          const productId = uuidv4();
          await db.query(
            `INSERT INTO hris_saas.products (id, tenant_id, name, hsn_code, selling_price, purchase_price, tax_rate, unit, stock, notes, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
            [productId, tenantId, row.name, row.hsn_code,
             parseFloat(row.selling_price || 0), parseFloat(row.purchase_price || 0),
             parseFloat(row.tax_rate || 0), row.unit || 'Nos', parseInt(row.stock || 0), row.notes]
          );

          if (parseFloat(row.stock) > 0) {
            await db.query(
              `INSERT INTO hris_saas.stock_movements (id, tenant_id, product_id, type, quantity, reference_type, notes, created_at)
               VALUES ($1,$2,$3,'in',$4,'opening_balance','Opening balance from import',NOW())`,
              [uuidv4(), tenantId, productId, parseInt(row.stock)]
            );
          }
          imported++;
        }
      } catch (rowErr) {
        errors.push(`Row ${row._row || '?'}: ${rowErr.message}`);
        skipped++;
      }
    }

    res.json({ message: `Imported ${imported} rows. ${skipped} skipped.`, imported, skipped, errors: errors.slice(0, 10) });
  } catch (error) {
    console.error('Bulk import confirm error:', error);
    res.status(500).json({ error: error.message || 'Import failed.' });
  }
};
