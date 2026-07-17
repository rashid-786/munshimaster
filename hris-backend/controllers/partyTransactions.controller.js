const db = require('../config/db');

const PARTY_TYPES = { customer: 'customer', supplier: 'supplier' };

exports.getTransactions = async (req, res) => {
  try {
    const { type, id } = req.params;
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    if (!PARTY_TYPES[type]) return res.status(400).json({ error: 'Invalid party type. Use "customer" or "supplier".' });

    const { transactionType, status, startDate, endDate, page = 1, limit = 35 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const dateFilter = (col) => {
      const clauses = [];
      const vals = [];
      if (startDate) { clauses.push(`${col} >= ?`); vals.push(startDate); }
      if (endDate) { clauses.push(`${col} <= ?`); vals.push(endDate); }
      return { clause: clauses.length ? clauses.join(' AND ') : '1=1', vals };
    };

    const statusFilter = (col, asText) => {
      if (!status || status === 'all') return { clause: '1=1', vals: [] };
      const colRef = asText ? `${col}::text` : col;
      return { clause: `${colRef} = ?`, vals: [status] };
    };

    const unionQueries = [];
    const allParams = [];

    if (type === 'customer') {
      const df = dateFilter('i.invoice_date');
      const sf = statusFilter('i.status');
      if (!transactionType || transactionType === 'all' || transactionType === 'sales_invoice') {
        unionQueries.push(`
          SELECT i.id, 'sales_invoice' AS transaction_type, 'Sales Invoice' AS type_label,
            i.invoice_number AS reference, i.invoice_date AS "date",
            i.total_amount AS amount, COALESCE(i.amount_paid, 0) AS amount_paid,
            i.status::text, i.notes AS description, i.created_at
          FROM invoices i WHERE i.customer_id = ? AND i.tenant_id = ?
            AND ${df.clause} AND ${sf.clause}`);
        allParams.push(id, tenantId, ...df.vals, ...sf.vals);
      }

      const pdf = dateFilter('ip.payment_date');
      if (!transactionType || transactionType === 'all' || transactionType === 'payment_in') {
        unionQueries.push(`
          SELECT ip.id, 'payment_in' AS transaction_type, 'Payment Received' AS type_label,
            i.invoice_number AS reference, ip.payment_date AS "date",
            ip.amount AS amount, ip.amount AS amount_paid,
            'completed' AS status, CONCAT('Payment for ', i.invoice_number) AS description, ip.created_at
          FROM invoice_payments ip
          JOIN invoices i ON i.id = ip.invoice_id
          WHERE i.customer_id = ? AND i.tenant_id = ? AND ${pdf.clause}`);
        allParams.push(id, tenantId, ...pdf.vals);
      }

      const cdf = dateFilter('cn.cn_date');
      const csf = statusFilter('cn.status');
      if (!transactionType || transactionType === 'all' || transactionType === 'credit_note') {
        unionQueries.push(`
          SELECT cn.id, 'credit_note' AS transaction_type, 'Credit Note' AS type_label,
            cn.credit_note_number AS reference, cn.cn_date AS "date",
            cn.total_amount AS amount, 0 AS amount_paid,
            cn.status::text, cn.reason AS description, cn.created_at
          FROM credit_notes cn
          JOIN invoices i ON i.id = cn.invoice_id
          WHERE i.customer_id = ? AND i.tenant_id = ? AND ${cdf.clause} AND ${csf.clause}`);
        allParams.push(id, tenantId, ...cdf.vals, ...csf.vals);
      }
    } else {
      const df = dateFilter('po.order_date');
      const sf = statusFilter('po.status', true);
      if (!transactionType || transactionType === 'all' || transactionType === 'purchase_order') {
        unionQueries.push(`
          SELECT po.id, 'purchase_order' AS transaction_type, 'Purchase Order' AS type_label,
            po.po_number AS reference, po.order_date AS "date",
            po.total_amount AS amount, 0 AS amount_paid,
            po.status::text, po.notes AS description, po.created_at
          FROM purchase_orders po WHERE po.supplier_id = ? AND po.tenant_id = ?
            AND ${df.clause} AND ${sf.clause}`);
        allParams.push(id, tenantId, ...df.vals, ...sf.vals);
      }

      const ddf = dateFilter('dn.dn_date');
      const dsf = statusFilter('dn.status', true);
      if (!transactionType || transactionType === 'all' || transactionType === 'debit_note') {
        unionQueries.push(`
          SELECT dn.id, 'debit_note' AS transaction_type, 'Debit Note' AS type_label,
            dn.debit_note_number AS reference, dn.dn_date AS "date",
            dn.total_amount AS amount, 0 AS amount_paid,
            dn.status::text, dn.reason AS description, dn.created_at
          FROM debit_notes dn
          JOIN invoices i ON i.id = dn.invoice_id
          WHERE i.customer_id = ? AND i.tenant_id = ? AND ${ddf.clause} AND ${dsf.clause}`);
        allParams.push(id, tenantId, ...ddf.vals, ...dsf.vals);
      }
    }

    if (unionQueries.length === 0) {
      return res.json({ transactions: [], summary: {}, total: 0, page: 1, limit: 35 });
    }

    const unionSQL = unionQueries.join(' UNION ALL ');
    const countSQL = `SELECT COUNT(*) AS total FROM (${unionSQL}) AS combined`;
    const dataSQL = `SELECT * FROM (${unionSQL}) AS combined ORDER BY "date" DESC, created_at DESC LIMIT ? OFFSET ?`;

    const [countRows] = await db.execute(countSQL, allParams);
    const total = countRows[0].total;
    const [transactions] = await db.execute(dataSQL, [...allParams, parseInt(limit), offset]);

    const summaryParams = [];
    if (type === 'customer') {
      const sdf = dateFilter('i2.invoice_date');
      const [invRows] = await db.execute(
        `SELECT COALESCE(SUM(i2.total_amount), 0) AS "totalSales",
                COALESCE(SUM(CASE WHEN i2.status IN ('sent','partial','overdue') THEN i2.total_amount - COALESCE(i2.amount_paid, 0) ELSE 0 END), 0) AS "outstanding",
                MAX(i2.invoice_date) AS "lastInvoiceDate"
         FROM invoices i2 WHERE i2.customer_id = ? AND i2.tenant_id = ? AND i2.status NOT IN ('draft','cancelled') AND ${sdf.clause}`,
        [id, tenantId, ...sdf.vals]
      );
      const [payRows] = await db.execute(
        `SELECT COALESCE(SUM(ip2.amount), 0) AS "totalPayments"
         FROM invoice_payments ip2 JOIN invoices i2 ON i2.id = ip2.invoice_id
         WHERE i2.customer_id = ? AND i2.tenant_id = ?`,
        [id, tenantId]
      );
      const summary = {
        totalSales: invRows[0].totalSales,
        totalPaymentsReceived: payRows[0].totalPayments,
        outstanding: invRows[0].outstanding,
        lastTransactionDate: invRows[0].lastInvoiceDate,
      };
      res.json({ transactions, summary, total, page: parseInt(page), limit: parseInt(limit) });
    } else {
      const sdf = dateFilter('po2.order_date');
      const [poRows] = await db.execute(
        `SELECT COALESCE(SUM(po2.total_amount), 0) AS "totalPurchases",
                COALESCE(SUM(CASE WHEN po2.status IN ('sent','approved','received') THEN po2.total_amount ELSE 0 END), 0) AS "outstanding",
                MAX(po2.order_date) AS "lastOrderDate"
         FROM purchase_orders po2 WHERE po2.supplier_id = ? AND po2.tenant_id = ? AND po2.status NOT IN ('draft','cancelled') AND ${sdf.clause}`,
        [id, tenantId, ...sdf.vals]
      );
      const summary = {
        totalPurchases: poRows[0].totalPurchases,
        totalPaymentsMade: 0,
        outstanding: poRows[0].outstanding,
        lastTransactionDate: poRows[0].lastOrderDate,
      };
      res.json({ transactions, summary, total, page: parseInt(page), limit: parseInt(limit) });
    }
  } catch (err) {
    console.error('Party transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
};
