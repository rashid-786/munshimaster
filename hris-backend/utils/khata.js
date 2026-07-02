const db = require('../config/db');
const crypto = require('crypto');

function generatePortalToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function getKhataSummary(tenantId) {
  const [rows] = await db.query(`
    SELECT
      COUNT(DISTINCT c.id) FILTER (WHERE i.status NOT IN ('draft','cancelled','paid') AND (i.total_amount - COALESCE(i.amount_paid, 0)) > 0) as customers_with_outstanding,
      COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid, 0)) FILTER (WHERE i.status NOT IN ('draft','cancelled','paid')), 0) as total_outstanding,
      COALESCE(SUM(i.total_amount) FILTER (WHERE i.status NOT IN ('draft','cancelled')), 0) as total_invoiced,
      COALESCE(SUM(ip.amount) FILTER (WHERE i.status NOT IN ('draft','cancelled')), 0) as total_collected,
      COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid, 0)) FILTER (WHERE i.status NOT IN ('draft','cancelled','paid')
        AND (i.due_date < CURRENT_DATE - INTERVAL '90 days')), 0) as aging_90_plus,
      COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid, 0)) FILTER (WHERE i.status NOT IN ('draft','cancelled','paid')
        AND i.due_date BETWEEN CURRENT_DATE - INTERVAL '90 days' AND CURRENT_DATE - INTERVAL '61 days'), 0) as aging_61_90,
      COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid, 0)) FILTER (WHERE i.status NOT IN ('draft','cancelled','paid')
        AND i.due_date BETWEEN CURRENT_DATE - INTERVAL '60 days' AND CURRENT_DATE - INTERVAL '31 days'), 0) as aging_31_60,
      COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid, 0)) FILTER (WHERE i.status NOT IN ('draft','cancelled','paid')
        AND i.due_date BETWEEN CURRENT_DATE - INTERVAL '30 days' AND CURRENT_DATE), 0) as aging_1_30,
      COALESCE(SUM(i.total_amount - COALESCE(i.amount_paid, 0)) FILTER (WHERE i.status NOT IN ('draft','cancelled','paid')
        AND i.due_date > CURRENT_DATE), 0) as aging_current
    FROM hris_saas.customers c
    LEFT JOIN hris_saas.invoices i ON c.id = i.customer_id AND i.tenant_id = c.tenant_id
    LEFT JOIN hris_saas.invoice_payments ip ON i.id = ip.invoice_id
    WHERE c.tenant_id = $1`, [tenantId]
  );

  return rows[0] || {};
}

async function getKhataCustomers(tenantId, search) {
  let where = 'c.tenant_id = $1';
  const params = [tenantId];
  if (search) { where += ` AND (c.name ILIKE $2 OR c.phone ILIKE $2 OR c.gstin ILIKE $2)`; params.push(`%${search}%`); }

  const [rows] = await db.query(`
    SELECT c.id, c.name, c.phone, c.email, c.gstin, c.portal_token, c.city,
      COUNT(i.id) FILTER (WHERE i.status NOT IN ('draft','cancelled')) as total_invoices,
      COALESCE(SUM(i.total_amount) FILTER (WHERE i.status NOT IN ('draft','cancelled')), 0) as total_billed,
      COALESCE(SUM(COALESCE(i.amount_paid, 0)) FILTER (WHERE i.status NOT IN ('draft','cancelled')), 0) as total_paid,
      MAX(i.invoice_date) FILTER (WHERE i.status NOT IN ('draft','cancelled')) as last_invoice_date,
      MAX(ip.payment_date) as last_payment_date
    FROM hris_saas.customers c
    LEFT JOIN hris_saas.invoices i ON c.id = i.customer_id AND i.tenant_id = c.tenant_id
    LEFT JOIN hris_saas.invoice_payments ip ON i.id = ip.invoice_id AND ip.tenant_id = c.tenant_id
    WHERE ${where}
    GROUP BY c.id
    ORDER BY total_billed DESC`, params
  );

  return rows.map(r => ({
    ...r,
    outstanding: parseInt(r.total_billed || 0) - parseInt(r.total_paid || 0),
    total_billed: parseInt(r.total_billed || 0),
    total_paid: parseInt(r.total_paid || 0),
  }));
}

async function getKhataCustomerDetail(tenantId, customerId) {
  const [cust] = await db.query(
    `SELECT * FROM hris_saas.customers WHERE id = $1 AND tenant_id = $2`,
    [customerId, tenantId]
  );
  if (cust.length === 0) return null;

  const [invoices] = await db.query(`
    SELECT i.*,
      COALESCE(SUM(ip.amount), 0) as collected,
      COUNT(ip.id) as payment_count
    FROM hris_saas.invoices i
    LEFT JOIN hris_saas.invoice_payments ip ON i.id = ip.invoice_id
    WHERE i.customer_id = $1 AND i.tenant_id = $2
    GROUP BY i.id
    ORDER BY i.invoice_date DESC`, [customerId, tenantId]
  );

  const [payments] = await db.query(`
    SELECT ip.*, i.invoice_number
    FROM hris_saas.invoice_payments ip
    JOIN hris_saas.invoices i ON ip.invoice_id = i.id
    WHERE i.customer_id = $1 AND i.tenant_id = $2
    ORDER BY ip.payment_date DESC LIMIT 20`, [customerId, tenantId]
  );

  return {
    customer: cust[0],
    invoices: invoices.map(i => ({
      ...i,
      outstanding: parseInt(i.total_amount || 0) - parseInt(i.collected || 0),
    })),
    recentPayments: payments,
  };
}

async function getOrCreatePortalToken(tenantId, customerId) {
  const [cust] = await db.query(
    `SELECT portal_token FROM hris_saas.customers WHERE id = $1 AND tenant_id = $2`,
    [customerId, tenantId]
  );
  if (cust.length === 0) return null;

  if (cust[0].portal_token) return cust[0].portal_token;

  const token = generatePortalToken();
  await db.query(
    `UPDATE hris_saas.customers SET portal_token = $1 WHERE id = $2`,
    [token, customerId]
  );
  return token;
}

async function getCustomerByToken(token) {
  const [cust] = await db.query(
    `SELECT id, tenant_id, name, email, phone, gstin, city FROM hris_saas.customers WHERE portal_token = $1`,
    [token]
  );
  if (cust.length === 0) return null;
  return cust[0];
}

async function getCustomerPortalInvoices(tenantId, customerId) {
  const [invoices] = await db.query(`
    SELECT i.id, i.invoice_number, i.invoice_date, i.due_date, i.status, i.total_amount,
           i.amount_paid, i.irn, i.payment_link_url,
           COALESCE(SUM(ip.amount), 0) as collected
    FROM hris_saas.invoices i
    LEFT JOIN hris_saas.invoice_payments ip ON i.id = ip.invoice_id
    WHERE i.customer_id = $1 AND i.tenant_id = $2 AND i.status NOT IN ('draft')
    GROUP BY i.id
    ORDER BY i.invoice_date DESC`, [customerId, tenantId]
  );

  return invoices.map(i => ({
    ...i,
    outstanding: parseInt(i.total_amount || 0) - Math.max(parseInt(i.collected || 0), parseInt(i.amount_paid || 0)),
  }));
}

module.exports = {
  getKhataSummary, getKhataCustomers, getKhataCustomerDetail,
  getOrCreatePortalToken, getCustomerByToken, getCustomerPortalInvoices,
  generatePortalToken,
};
