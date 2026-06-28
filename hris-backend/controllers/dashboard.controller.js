const db = require('../config/db');

exports.getDashboard = async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const [
      [customers],
      [suppliers],
      [invoices],
      [paid],
      [pending],
      [income],
      [expense],
      [transactions],
      [pos],
    ] = await Promise.all([
      db.query('SELECT COUNT(*) as c FROM hris_saas.customers WHERE tenant_id = ? AND status = ?', [tenantId, 'active']),
      db.query('SELECT COUNT(*) as c FROM hris_saas.suppliers WHERE tenant_id = ? AND status = ?', [tenantId, 'active']),
      db.query('SELECT COUNT(*) as c FROM hris_saas.invoices WHERE tenant_id = ?', [tenantId]),
      db.query("SELECT COALESCE(SUM(total_amount),0) as t FROM hris_saas.invoices WHERE tenant_id = ? AND status = ?", [tenantId, 'paid']),
      db.query("SELECT COALESCE(SUM(total_amount),0) as t, COUNT(*) as c FROM hris_saas.invoices WHERE tenant_id = ? AND status NOT IN (?, ?, ?)", [tenantId, 'paid', 'cancelled', 'draft']),
      db.query("SELECT COALESCE(SUM(amount),0) as t FROM hris_saas.balance_sheet WHERE tenant_id = ? AND type = ?", [tenantId, 'IN']),
      db.query("SELECT COALESCE(SUM(amount),0) as t FROM hris_saas.balance_sheet WHERE tenant_id = ? AND type = ?", [tenantId, 'OUT']),
      db.query(
        `SELECT t.id, t.type, t.amount, t.note, t.entry_date, p.name as party_name
         FROM hris_saas.kirana_transactions t
         LEFT JOIN hris_saas.kirana_parties p ON p.id = t.party_id
         WHERE t.tenant_id = ?
         ORDER BY t.created_at DESC LIMIT 10`,
        [tenantId]
      ),
      db.query(
        `SELECT id, po_number, total_amount, status, created_at
         FROM hris_saas.purchase_orders
         WHERE tenant_id = ? AND status NOT IN (?, ?)
         ORDER BY created_at DESC LIMIT 10`,
        [tenantId, 'received', 'cancelled']
      ),
    ]);

    res.json({
      totalCustomers: Number(customers[0]?.c || 0),
      totalSuppliers: Number(suppliers[0]?.c || 0),
      totalInvoices: Number(invoices[0]?.c || 0),
      revenue: Number(paid[0]?.t || 0),
      expense: Number(expense[0]?.t || 0),
      income: Number(income[0]?.t || 0),
      pendingInvoicesCount: Number(pending[0]?.c || 0),
      pendingInvoicesAmount: Number(pending[0]?.t || 0),
      recentTransactions: transactions || [],
      pendingPOs: pos || [],
    });
  } catch (error) {
    console.error('getDashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
};
