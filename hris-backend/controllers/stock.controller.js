const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.listMovements = async (req, res) => {
  const tenantId = req.tenantId;
  const { product_id, reference_type, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE sm.tenant_id = ?';
  const params = [tenantId];

  if (product_id) {
    where += ' AND sm.product_id = ?';
    params.push(product_id);
  }
  if (reference_type) {
    where += ' AND sm.reference_type = ?';
    params.push(reference_type);
  }

  try {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM stock_movements sm ${where}`, params
    );
    const [rows] = await db.query(
      `SELECT sm.*, p.name as product_name, p.sku as product_sku
       FROM stock_movements sm JOIN products p ON sm.product_id = p.id
       ${where} ORDER BY sm.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error('listMovements error:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements.' });
  }
};

exports.recordMovement = async (req, res) => {
  const tenantId = req.tenantId;
  const { product_id, type, quantity, notes } = req.body;

  if (!product_id || !type || !quantity) {
    return res.status(400).json({ error: 'product_id, type, and quantity are required.' });
  }
  if (!['in', 'out', 'adjustment'].includes(type)) {
    return res.status(400).json({ error: 'Type must be in, out, or adjustment.' });
  }
  const qty = parseInt(quantity);
  if (qty <= 0) return res.status(400).json({ error: 'Quantity must be positive.' });

  try {
    const [product] = await db.query(
      'SELECT * FROM products WHERE id = ? AND tenant_id = ?',
      [product_id, tenantId]
    );
    if (product.length === 0) return res.status(404).json({ error: 'Product not found.' });

    const direction = type === 'out' ? -1 : 1;
    const newStock = Number(product[0].current_stock) + (direction * qty);
    if (type === 'out' && newStock < 0) {
      return res.status(400).json({ error: 'Insufficient stock. Available: ' + product[0].current_stock });
    }

    const id = uuidv4();
    await db.query(
      `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, reference_type, notes, created_by)
       VALUES (?, ?, ?, ?, ?, 'manual', ?, ?)`,
      [id, tenantId, product_id, type, qty, notes || null, req.user?.id || null]
    );

    await db.query(
      'UPDATE products SET current_stock = ?, updated_at = NOW() WHERE id = ? AND tenant_id = ?',
      [newStock, product_id, tenantId]
    );

    const movement = await db.query('SELECT * FROM stock_movements WHERE id = ?', [id]);
    res.status(201).json({
      movement: movement[0][0],
      currentStock: newStock,
      isLowStock: product[0].low_stock_threshold > 0 && newStock <= product[0].low_stock_threshold,
    });
  } catch (error) {
    console.error('recordMovement error:', error);
    res.status(500).json({ error: 'Failed to record movement.' });
  }
};

// Auto stock-in from received PO
exports.stockInFromPO = async (tenantId, poId, createdBy) => {
  const [items] = await db.query(
    'SELECT product_id, quantity FROM purchase_order_items WHERE purchase_order_id = ? AND product_id IS NOT NULL',
    [poId]
  );
  if (items.length === 0) return;

  for (const item of items) {
    const qty = parseInt(item.quantity);
    if (qty <= 0) continue;

    const movId = uuidv4();
    await db.query(
      `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, reference_type, reference_id, notes, created_by)
       VALUES (?, ?, ?, 'in', ?, 'purchase_order', ?, 'Stock received from PO', ?)`,
      [movId, tenantId, item.product_id, qty, poId, createdBy]
    );

    await db.query(
      `UPDATE products SET current_stock = current_stock + ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [qty, item.product_id, tenantId]
    );
  }
};

// Auto stock-out from sent/paid invoice
exports.stockOutFromInvoice = async (tenantId, invoiceId, createdBy) => {
  const [items] = await db.query(
    'SELECT product_id, quantity FROM invoice_items WHERE invoice_id = ? AND product_id IS NOT NULL',
    [invoiceId]
  );
  if (items.length === 0) return;

  for (const item of items) {
    const qty = parseInt(item.quantity);
    if (qty <= 0) continue;

    // Check stock sufficiency
    const [product] = await db.query(
      'SELECT current_stock, low_stock_threshold FROM products WHERE id = ? AND tenant_id = ?',
      [item.product_id, tenantId]
    );
    if (product.length === 0) continue;

    if (Number(product[0].current_stock) < qty) {
      console.warn(`Insufficient stock for product ${item.product_id}: have ${product[0].current_stock}, need ${qty}`);
      // Still proceed (partial fulfillment) — don't block invoice
    }

    const movId = uuidv4();
    await db.query(
      `INSERT INTO stock_movements (id, tenant_id, product_id, type, quantity, reference_type, reference_id, notes, created_by)
       VALUES (?, ?, ?, 'out', ?, 'invoice', ?, 'Stock dispatched via invoice', ?)`,
      [movId, tenantId, item.product_id, qty, invoiceId, createdBy]
    );

    await db.query(
      `UPDATE products SET current_stock = GREATEST(0, current_stock - ?), updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [qty, item.product_id, tenantId]
    );
  }
};

exports.getLowStockAlerts = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [rows] = await db.query(
      `SELECT * FROM products
       WHERE tenant_id = ? AND status = 'active' AND low_stock_threshold > 0 AND current_stock <= low_stock_threshold
       ORDER BY (current_stock::float / NULLIF(low_stock_threshold, 0)) ASC`,
      [tenantId]
    );
    res.json(rows || []);
  } catch (error) {
    console.error('getLowStockAlerts error:', error);
    res.status(500).json({ error: 'Failed to fetch low stock alerts.' });
  }
};

exports.getStockSummary = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [[{ totalProducts }]] = await db.query(
      "SELECT COUNT(*) as totalProducts FROM products WHERE tenant_id = ? AND status = 'active'", [tenantId]
    );
    const [[{ totalValue }]] = await db.query(
      "SELECT COALESCE(SUM(current_stock * purchase_price),0) as totalValue FROM products WHERE tenant_id = ? AND status = 'active'", [tenantId]
    );
    const [[{ lowStockCount }]] = await db.query(
      "SELECT COUNT(*) as lowStockCount FROM products WHERE tenant_id = ? AND status = 'active' AND low_stock_threshold > 0 AND current_stock <= low_stock_threshold", [tenantId]
    );
    res.json({ totalProducts: Number(totalProducts), totalValue: Number(totalValue), lowStockCount: Number(lowStockCount) });
  } catch (error) {
    console.error('getStockSummary error:', error);
    res.status(500).json({ error: 'Failed to fetch stock summary.' });
  }
};
