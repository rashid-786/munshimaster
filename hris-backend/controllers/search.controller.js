const db = require('../config/db');

exports.search = async (req, res) => {
  const tenantId = req.tenantId;
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ results: [] });

  const like = `%${q}%`;

  try {
    const [customers, invoices, orders, employees, ledger] = await Promise.all([
      db.execute(
        `SELECT id, name AS label, 'customer' AS type, '/admin/customers' AS link
         FROM customers WHERE tenant_id = ? AND (name ILIKE ? OR email ILIKE ? OR phone ILIKE ?)
         LIMIT 5`,
        [tenantId, like, like, like]
      ),
      db.execute(
        `SELECT i.id, i.invoice_number AS label, 'invoice' AS type, '/admin/invoices' AS link
         FROM invoices i WHERE i.tenant_id = ? AND i.invoice_number ILIKE ?
         LIMIT 5`,
        [tenantId, like]
      ),
      db.execute(
        `SELECT p.id, p.po_number AS label, 'purchase_order' AS type, '/admin/purchase-orders' AS link
         FROM purchase_orders p WHERE p.tenant_id = ? AND p.po_number ILIKE ?
         LIMIT 5`,
        [tenantId, like]
      ),
      db.execute(
        `SELECT id, CONCAT(first_name, ' ', last_name) AS label, 'employee' AS type, '/admin/employees' AS link
         FROM employees WHERE tenant_id = ? AND (first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?)
         LIMIT 5`,
        [tenantId, like, like, like]
      ),
      db.execute(
        `SELECT id, description AS label, 'ledger' AS type, '/admin/ledger/cashbook' AS link
         FROM balance_sheet WHERE tenant_id = ? AND description ILIKE ?
         LIMIT 5`,
        [tenantId, like]
      ),
    ]);

    const results = [
      ...customers[0].map(r => ({ ...r, label: r.label || '—' })),
      ...invoices[0].map(r => ({ ...r, label: r.label || '—' })),
      ...orders[0].map(r => ({ ...r, label: r.label || '—' })),
      ...employees[0].map(r => ({ ...r, label: r.label || '—' })),
      ...ledger[0].map(r => ({ ...r, label: r.label || '—' })),
    ];

    res.json({ results });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ error: 'Search failed.' });
  }
};
