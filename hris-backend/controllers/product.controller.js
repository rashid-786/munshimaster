const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { search, status, page = 1, limit = 50, lowStock } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (search) {
    where += ' AND (name LIKE ? OR sku LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }
  if (lowStock === 'true') {
    where += ' AND low_stock_threshold > 0 AND current_stock <= low_stock_threshold';
  }

  try {
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM products ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM products ${where} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('product.list error:', error);
    res.status(500).json({ error: 'Failed to fetch products.' });
  }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('product.get error:', error);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { name, sku, description, unit, opening_stock, low_stock_threshold, selling_price, purchase_price, hsn_code, tax_rate } = req.body;

  if (!name) return res.status(400).json({ error: 'Product name is required.' });

  try {
    const id = uuidv4();
    const openingQty = parseInt(opening_stock) || 0;
    await db.query(
      `INSERT INTO products (id, tenant_id, name, sku, description, unit, opening_stock, current_stock, low_stock_threshold, selling_price, purchase_price, hsn_code, tax_rate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, sku || null, description || null, unit || 'pcs',
       openingQty, openingQty, parseInt(low_stock_threshold) || 0,
       parseFloat(selling_price || 0), parseFloat(purchase_price || 0),
       hsn_code || null, parseFloat(tax_rate || 0)]
    );

    // Record opening balance movement
    if (openingQty > 0) {
      const movId = uuidv4();
      await db.query(
        `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, reference_type, notes, created_by)
         VALUES (?, ?, ?, 'opening', ?, 'opening', 'Opening balance', ?)`,
        [movId, tenantId, id, openingQty, req.user?.id || null]
      );
    }

    const [product] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.status(201).json(product[0]);
  } catch (error) {
    console.error('product.create error:', error);
    if (error.code === 'ER_DUP_ENTRY' || error.constraint?.includes('sku')) {
      return res.status(409).json({ error: 'A product with this SKU already exists.' });
    }
    res.status(500).json({ error: 'Failed to create product.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const { name, sku, description, unit, low_stock_threshold, selling_price, purchase_price, hsn_code, tax_rate, status } = req.body;

  if (!name) return res.status(400).json({ error: 'Product name is required.' });

  try {
    const [existing] = await db.query(
      'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Product not found.' });

    await db.query(
      `UPDATE products SET name = ?, sku = ?, description = ?, unit = ?,
          low_stock_threshold = ?, selling_price = ?, purchase_price = ?,
          hsn_code = ?, tax_rate = ?, status = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [name, sku || null, description || null, unit || 'pcs',
       parseInt(low_stock_threshold) || 0, parseFloat(selling_price || 0),
       parseFloat(purchase_price || 0), hsn_code || null,
       parseFloat(tax_rate || 0), status || existing[0].status,
       req.params.id, tenantId]
    );

    const [product] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    res.json(product[0]);
  } catch (error) {
    console.error('product.update error:', error);
    if (error.code === 'ER_DUP_ENTRY' || error.constraint?.includes('sku')) {
      return res.status(409).json({ error: 'A product with this SKU already exists.' });
    }
    res.status(500).json({ error: 'Failed to update product.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.query(
      'DELETE FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Product deleted.' });
  } catch (error) {
    console.error('product.remove error:', error);
    res.status(500).json({ error: 'Failed to delete product.' });
  }
};

exports.bulkDelete = async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Array of product IDs is required.' });
  }
  try {
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await db.query(
      `DELETE FROM products WHERE id IN (${placeholders}) AND tenant_id = ?`,
      [...ids, req.tenantId]
    );
    res.json({ message: `${result.affectedRows} product(s) deleted.` });
  } catch (error) {
    console.error('product.bulkDelete error:', error);
    res.status(500).json({ error: 'Failed to delete products.' });
  }
};
