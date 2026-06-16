const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

exports.list = async (req, res) => {
  const tenantId = req.tenantId;
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE c.tenant_id = ?';
  const params = [tenantId];

  if (search) {
    where += ' AND (c.name LIKE ? OR c.contact_person LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
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
  const { name, contact_person, email, phone, address, city, state, pincode, gstin, credit_limit, payment_terms, notes } = req.body;

  if (!name) return res.status(400).json({ error: 'Customer name is required.' });

  try {
    const id = uuidv4();
    await db.execute(
      `INSERT INTO customers (id, tenant_id, name, contact_person, email, phone, address, city, state, pincode, gstin, credit_limit, payment_terms, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, name, contact_person || null, email || null, phone || null, address || null,
       city || null, state || null, pincode || null, gstin || null, Math.round(credit_limit || 0),
       payment_terms || null, notes || null]
    );
    res.status(201).json({ message: 'Customer created.', id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create customer.' });
  }
};

exports.update = async (req, res) => {
  const tenantId = req.tenantId;
  const { id } = req.params;
  const { name, contact_person, email, phone, address, city, state, pincode, gstin, credit_limit, payment_terms, status, notes } = req.body;

  try {
    const [existing] = await db.execute('SELECT id FROM customers WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Customer not found.' });

    await db.execute(
      `UPDATE customers SET name=?, contact_person=?, email=?, phone=?, address=?, city=?, state=?, pincode=?, gstin=?, credit_limit=?, payment_terms=?, status=?, notes=?
       WHERE id=? AND tenant_id=?`,
      [name, contact_person || null, email || null, phone || null, address || null,
       city || null, state || null, pincode || null, gstin || null,
       Math.round(credit_limit || 0), payment_terms || null,
       status || 'active', notes || null, id, tenantId]
    );
    res.json({ message: 'Customer updated.' });
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate customer.' });
  }
};
