const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { search, status, page = 1, limit = 50, lowStock, category } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE tenant_id = ?';
  const params = [tenantId];

  if (status) {
    where += ' AND product_status = ?';
    params.push(status);
  }
  if (category) {
    where += ' AND category = ?';
    params.push(category);
  }
  if (search) {
    where += ' AND (name ILIKE ? OR sku ILIKE ? OR barcode ILIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }
  if (lowStock === 'true') {
    where += ' AND stock_tracking_enabled = true AND low_stock_threshold > 0 AND current_stock <= low_stock_threshold';
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
    const product = rows[0];

    const [partyPrices] = await db.query(
      'SELECT * FROM product_party_prices WHERE product_id = ? AND tenant_id = ? ORDER BY created_at DESC',
      [product.id, req.tenantId]
    );
    product.party_prices = partyPrices;

    res.json(product);
  } catch (error) {
    console.error('product.get error:', error);
    res.status(500).json({ error: 'Failed to fetch product.' });
  }
};

const computeEffectivePrice = (price, priceType, taxRate, discountPercent) => {
  const p = parseFloat(price || 0);
  const disc = parseFloat(discountPercent || 0);
  const rate = parseFloat(taxRate || 0);
  let effective = p;
  if (disc > 0) effective = p * (1 - disc / 100);
  if (priceType === 'inclusive' && rate > 0) effective = effective / (1 + rate / 100);
  return Math.round(effective * 100) / 100;
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const {
    name, sku, description, unit, category, image_url,
    opening_stock, opening_stock_as_of, low_stock_threshold, reorder_level,
    stock_tracking_enabled, barcode,
    selling_price, sale_price_type, discount_percent, purchase_price, purchase_price_type,
    hsn_code, tax_rate, gst_rate_id, product_status
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Product name is required.' });

  try {
    const [dup] = await db.query('SELECT id FROM products WHERE name = ? AND tenant_id = ?', [name, tenantId]);
    if (dup.length > 0) return res.status(409).json({ error: 'A product with this name already exists.' });

    const id = uuidv4();
    const openingQty = parseFloat(opening_stock) || 0;
    const tax = parseFloat(tax_rate || 0);
    const salePrice = parseFloat(selling_price || 0);
    const purchasePrice = parseFloat(purchase_price || 0);
    const disc = parseFloat(discount_percent || 0);
    const saleType = sale_price_type || 'exclusive';
    const purchaseType = purchase_price_type || 'exclusive';

    const effSalePrice = computeEffectivePrice(salePrice, saleType, tax, disc);
    const effPurchasePrice = computeEffectivePrice(purchasePrice, purchaseType, tax, 0);

    await db.query(
      `INSERT INTO products (id, tenant_id, name, sku, description, unit, category, image_url,
        opening_stock, current_stock, opening_stock_as_of, low_stock_threshold, reorder_level,
        stock_tracking_enabled, barcode,
        selling_price, sale_price_type, discount_percent, effective_sale_price,
        purchase_price, purchase_price_type, effective_purchase_price,
        hsn_code, tax_rate, gst_rate_id, product_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?)`,
      [id, tenantId, name, sku || null, description || null, unit || 'pcs', category || null, image_url || null,
       openingQty, openingQty, opening_stock_as_of || null, parseFloat(low_stock_threshold) || 0, parseFloat(reorder_level) || 0,
       stock_tracking_enabled !== false, barcode || null,
       salePrice, saleType, disc, effSalePrice,
       purchasePrice, purchaseType, effPurchasePrice,
       hsn_code || null, tax, gst_rate_id || null, product_status || 'active']
    );

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
  const {
    name, sku, description, unit, category, image_url,
    low_stock_threshold, reorder_level, stock_tracking_enabled, barcode,
    selling_price, sale_price_type, discount_percent, purchase_price, purchase_price_type,
    hsn_code, tax_rate, gst_rate_id, product_status
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Product name is required.' });

  try {
    const [existing] = await db.query(
      'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
      [req.params.id, tenantId]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Product not found.' });
    const prev = existing[0];

    const [dup] = await db.query('SELECT id FROM products WHERE name = ? AND tenant_id = ? AND id != ?', [name, tenantId, req.params.id]);
    if (dup.length > 0) return res.status(409).json({ error: 'A product with this name already exists.' });

    const tax = parseFloat(tax_rate ?? prev.tax_rate);
    const salePrice = parseFloat(selling_price ?? prev.selling_price);
    const purchasePrice = parseFloat(purchase_price ?? prev.purchase_price);
    const disc = parseFloat(discount_percent ?? prev.discount_percent);
    const saleType = sale_price_type || prev.sale_price_type || 'exclusive';
    const purchaseType = purchase_price_type || prev.purchase_price_type || 'exclusive';

    const effSalePrice = computeEffectivePrice(salePrice, saleType, tax, disc);
    const effPurchasePrice = computeEffectivePrice(purchasePrice, purchaseType, tax, 0);

    await db.query(
      `UPDATE products SET name=?, sku=?, description=?, unit=?, category=?, image_url=?,
        low_stock_threshold=?, reorder_level=?, stock_tracking_enabled=?, barcode=?,
        selling_price=?, sale_price_type=?, discount_percent=?, effective_sale_price=?,
        purchase_price=?, purchase_price_type=?, effective_purchase_price=?,
        hsn_code=?, tax_rate=?, gst_rate_id=?, product_status=?, updated_at=NOW()
       WHERE id=? AND tenant_id=?`,
      [name, sku || null, description || null, unit || 'pcs', category || null, image_url || null,
       parseFloat(low_stock_threshold ?? prev.low_stock_threshold) || 0, parseFloat(reorder_level ?? prev.reorder_level) || 0,
       stock_tracking_enabled !== undefined ? stock_tracking_enabled : prev.stock_tracking_enabled, barcode ?? prev.barcode,
       salePrice, saleType, disc, effSalePrice,
       purchasePrice, purchaseType, effPurchasePrice,
       hsn_code ?? prev.hsn_code, tax, gst_rate_id ?? prev.gst_rate_id, product_status || prev.product_status || 'active',
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

// ─── Party Prices ────────────────────────────────────────────

exports.listPartyPrices = async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT ppp.*, p.name as product_name FROM product_party_prices ppp JOIN products p ON p.id = ppp.product_id WHERE ppp.product_id = ? AND ppp.tenant_id = ? ORDER BY ppp.created_at DESC',
      [req.params.productId, req.tenantId]
    );
    res.json(rows);
  } catch (error) {
    console.error('listPartyPrices error:', error);
    res.status(500).json({ error: 'Failed to fetch party prices.' });
  }
};

exports.createPartyPrice = async (req, res) => {
  const { productId } = req.params;
  const { party_type, party_id, custom_price, discount_percent, effective_price, effective_from, effective_to } = req.body;
  if (!party_type || !party_id || custom_price === undefined) {
    return res.status(400).json({ error: 'party_type, party_id, and custom_price are required.' });
  }
  try {
    const id = uuidv4();
    const disc = parseFloat(discount_percent || 0);
    const price = parseFloat(custom_price || 0);
    const effPrice = effective_price || (disc > 0 ? Math.round(price * (1 - disc / 100) * 100) / 100 : price);

    await db.query(
      'INSERT INTO product_party_prices (id, tenant_id, product_id, party_type, party_id, custom_price, discount_percent, effective_price, effective_from, effective_to) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, req.tenantId, productId, party_type, party_id, price, disc, effPrice, effective_from || null, effective_to || null]
    );
    const [row] = await db.query('SELECT * FROM product_party_prices WHERE id = ?', [id]);
    res.status(201).json(row[0]);
  } catch (error) {
    console.error('createPartyPrice error:', error);
    res.status(500).json({ error: 'Failed to create party price.' });
  }
};

exports.updatePartyPrice = async (req, res) => {
  const { id } = req.params;
  const { custom_price, discount_percent, effective_price, effective_from, effective_to, is_active } = req.body;
  try {
    const [existing] = await db.query('SELECT * FROM product_party_prices WHERE id = ? AND tenant_id = ?', [id, req.tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Party price not found.' });

    const price = parseFloat(custom_price ?? existing[0].custom_price);
    const disc = parseFloat(discount_percent ?? existing[0].discount_percent);
    const effPrice = effective_price || (disc > 0 ? Math.round(price * (1 - disc / 100) * 100) / 100 : price);

    await db.query(
      'UPDATE product_party_prices SET custom_price=?, discount_percent=?, effective_price=?, effective_from=?, effective_to=?, is_active=?, updated_at=NOW() WHERE id=?',
      [price, disc, effPrice, effective_from !== undefined ? effective_from : existing[0].effective_from, effective_to !== undefined ? effective_to : existing[0].effective_to, is_active !== undefined ? is_active : existing[0].is_active, id]
    );
    const [row] = await db.query('SELECT * FROM product_party_prices WHERE id = ?', [id]);
    res.json(row[0]);
  } catch (error) {
    console.error('updatePartyPrice error:', error);
    res.status(500).json({ error: 'Failed to update party price.' });
  }
};

exports.deletePartyPrice = async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM product_party_prices WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Party price not found.' });
    res.json({ success: true });
  } catch (error) {
    console.error('deletePartyPrice error:', error);
    res.status(500).json({ error: 'Failed to delete party price.' });
  }
};
