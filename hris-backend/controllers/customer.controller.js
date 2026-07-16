const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { log } = require('../utils/audit');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE c.tenant_id = ?';
  const params = [tenantId];

  if (search) {
    where += ' AND (c.name LIKE ? OR c.contact_person LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.gstin LIKE ? OR c.pan LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q, q, q);
  }
  if (status) {
    where += ' AND c.status = ?';
    params.push(status);
  }

  try {
    const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM customers c ${where}`, params);
    const [rows] = await db.query(
      `SELECT * FROM customers c ${where} ORDER BY c.name ASC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch customers.' });
  }
};

exports.get = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Customer not found.' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch customer.' });
  }
};

exports.create = async (req, res) => {
  const tenantId = req.tenantId;
  const { name, contact_person, email, phone, address, city, state, pincode, gstin, pan, credit_limit, payment_terms, notes, opening_balance, opening_balance_type, credit_period, billing_address, shipping_address, billing_address_line2, billing_city, billing_state, billing_country, billing_postal_code, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code } = req.body;

  if (!name) return res.status(400).json({ error: 'Customer name is required.' });

  try {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO customers (id, tenant_id, name, contact_person, email, phone, address, city, state, pincode, gstin, pan, credit_limit, payment_terms, notes, opening_balance, opening_balance_type, credit_period, billing_address, shipping_address, billing_address_line2, billing_city, billing_state, billing_country, billing_postal_code, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, contact_person || null, email || null, phone || null, address || null,
       city || null, state || null, pincode || null, gstin || null, pan || null, Math.round(credit_limit || 0),
       payment_terms || null, notes || null, Math.round(opening_balance || 0), opening_balance_type || 'receivable',
       parseInt(credit_period || 0), billing_address || null, shipping_address || null,
       billing_address_line2 || null, billing_city || null, billing_state || null, billing_country || null, billing_postal_code || null,
       shipping_address_line2 || null, shipping_city || null, shipping_state || null, shipping_country || null, shipping_postal_code || null]
    );
    res.status(201).json({ message: 'Customer created.', id });
    log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'customer.created', entityType: 'customer', entityId: id, req });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create customer.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { name, contact_person, email, phone, address, city, state, pincode, gstin, pan, credit_limit, payment_terms, status, notes, opening_balance, opening_balance_type, credit_period, billing_address, shipping_address, billing_address_line2, billing_city, billing_state, billing_country, billing_postal_code, shipping_address_line2, shipping_city, shipping_state, shipping_country, shipping_postal_code } = req.body;

  try {
    const [existing] = await db.execute('SELECT * FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Customer not found.' });

    await db.execute(
      `UPDATE customers SET name=?, contact_person=?, email=?, phone=?, address=?, city=?, state=?, pincode=?, gstin=?, pan=?, credit_limit=?, payment_terms=?, status=?, notes=?, opening_balance=?, opening_balance_type=?, credit_period=?, billing_address=?, shipping_address=?, billing_address_line2=?, billing_city=?, billing_state=?, billing_country=?, billing_postal_code=?, shipping_address_line2=?, shipping_city=?, shipping_state=?, shipping_country=?, shipping_postal_code=?
       WHERE id=? AND tenant_id=?`,
      [name, contact_person || null, email || null, phone || null, address || null,
       city || null, state || null, pincode || null, gstin || null, pan || null,
       Math.round(credit_limit || 0), payment_terms || null, status || 'active', notes || null,
       Math.round(opening_balance || 0), opening_balance_type || 'receivable', parseInt(credit_period || 0),
       billing_address || null, shipping_address || null,
       billing_address_line2 || null, billing_city || null, billing_state || null, billing_country || null, billing_postal_code || null,
       shipping_address_line2 || null, shipping_city || null, shipping_state || null, shipping_country || null, shipping_postal_code || null,
       id, tenantId]
    );
    res.json({ message: 'Customer updated.' });
    const changes = {};
    for (const key of ['name', 'contact_person', 'email', 'phone', 'address', 'city', 'state', 'pincode', 'gstin', 'pan', 'credit_limit', 'payment_terms', 'status', 'notes', 'opening_balance', 'opening_balance_type', 'credit_period', 'billing_address', 'shipping_address', 'billing_address_line2', 'billing_city', 'billing_state', 'billing_country', 'billing_postal_code', 'shipping_address_line2', 'shipping_city', 'shipping_state', 'shipping_country', 'shipping_postal_code']) {
      if (String(existing[0][key] ?? '') !== String(req.body[key] ?? '')) {
        changes[key] = { from: existing[0][key], to: req.body[key] ?? null };
      }
    }
    if (Object.keys(changes).length) log({ tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'customer.updated', entityType: 'customer', entityId: id, changes, req });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update customer.' });
  }
};

exports.remove = async (req, res) => {
  try {
    const [result] = await db.execute('DELETE FROM customers WHERE id = ? AND tenant_id = ?', [req.params.id, req.tenantId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Customer deleted.' });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'customer.deleted', entityType: 'customer', entityId: req.params.id, req });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete customer.' });
  }
};

exports.deactivate = async (req, res) => {
  try {
    const [result] = await db.execute(
      "UPDATE customers SET status = 'inactive' WHERE id = ? AND tenant_id = ?",
      [req.params.id, req.tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Customer deactivated.' });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'customer.deactivated', entityType: 'customer', entityId: req.params.id, req });
  } catch (error) {
    res.status(500).json({ error: 'Failed to deactivate customer.' });
  }
};

exports.activate = async (req, res) => {
  try {
    const [result] = await db.execute(
      "UPDATE customers SET status = 'active' WHERE id = ? AND tenant_id = ?",
      [req.params.id, req.tenantId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Customer not found.' });
    res.json({ message: 'Customer activated.' });
    log({ tenantId: req.tenantId, actorId: req.user?.id, actorName: req.user?.name, action: 'customer.activated', entityType: 'customer', entityId: req.params.id, req });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate customer.' });
  }
};
