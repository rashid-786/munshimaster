const db = require('../config/db');

const PARTY_TYPES = { customer: 'customer', supplier: 'supplier' };

const DIRECTION = { sales_invoice: 'sales', payment_in: 'sales', sales_return: 'sales', credit_note: 'sales', delivery_challan: 'sales', quotation: 'sales', proforma_invoice: 'sales', purchase_invoice: 'purchase', payment_out: 'purchase', purchase_return: 'purchase', debit_note: 'purchase', purchase_order: 'purchase' };

const DOC_LABELS = { sales_invoice: 'Sales Invoice', payment_in: 'Payment Received', sales_return: 'Sales Return', credit_note: 'Credit Note', delivery_challan: 'Delivery Challan', quotation: 'Quotation', proforma_invoice: 'Proforma Invoice', purchase_invoice: 'Purchase Invoice', payment_out: 'Payment Made', purchase_return: 'Purchase Return', debit_note: 'Debit Note', purchase_order: 'Purchase Order' };

const CUSTOMER_TYPES = ['sales_invoice', 'payment_in', 'sales_return', 'credit_note', 'delivery_challan', 'quotation', 'proforma_invoice'];
const SUPPLIER_TYPES = ['purchase_invoice', 'payment_out', 'purchase_return', 'debit_note', 'purchase_order'];

exports.getTransactions = async (req, res) => {
  try {
    const { type, id } = req.params;
    const tenantId = req.tenant?.id || req.headers['x-tenant-id'];
    if (!PARTY_TYPES[type]) return res.status(400).json({ error: 'Invalid party type. Use "customer" or "supplier".' });

    const { transactionType, status, startDate, endDate, page = 1, limit = 35 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const direction = type === 'customer' ? 'sales' : 'purchase';

    const conditions = ['t.party_id = ?', 't.tenant_id = ?'];
    const params = [id, tenantId];

    if (transactionType && transactionType !== 'all') {
      conditions.push('t.transaction_type = ?');
      params.push(transactionType);
    }
    if (status && status !== 'all') {
      conditions.push('t.status = ?');
      params.push(status);
    }
    if (startDate) {
      conditions.push('t.document_date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('t.document_date <= ?');
      params.push(endDate);
    }

    const whereClause = conditions.join(' AND ');

    const countSQL = `SELECT COUNT(*) AS total FROM hris_saas.transactions t WHERE ${whereClause}`;
    const dataSQL = `SELECT t.* FROM hris_saas.transactions t WHERE ${whereClause} ORDER BY t.document_date DESC, t.created_at DESC LIMIT ? OFFSET ?`;

    const [countRows] = await db.execute(countSQL, params);
    const total = countRows[0].total;
    const [transactions] = await db.execute(dataSQL, [...params, parseInt(limit), offset]);

    const mapped = transactions.map(t => ({
      id: t.id,
      transaction_type: t.transaction_type,
      type_label: DOC_LABELS[t.transaction_type] || t.transaction_type,
      reference: t.document_number,
      date: t.document_date,
      amount: Number(t.grand_total || 0),
      amount_paid: Number(t.amount_paid || 0),
      balance_due: Number(t.balance_due || 0),
      status: t.status,
      description: t.notes || t.reason || '',
      created_at: t.created_at,
    }));

    let summary = {};
    if (type === 'customer') {
      const saleTypes = ['sales_invoice', 'sales_return', 'delivery_challan', 'quotation', 'proforma_invoice'];
      const salePl = saleTypes.map(() => '?').join(',');
      const [invRows] = await db.execute(
        `SELECT COALESCE(SUM(t.grand_total), 0) AS "totalSales",
                COALESCE(SUM(CASE WHEN t.status NOT IN ('draft','cancelled') THEN t.balance_due ELSE 0 END), 0) AS "outstanding",
                MAX(t.document_date) AS "lastInvoiceDate"
         FROM hris_saas.transactions t
         WHERE t.party_id = ? AND t.tenant_id = ? AND t.direction = 'sales'
           AND t.transaction_type IN (${salePl})`,
        [id, tenantId, ...saleTypes]
      );
      const [payRows] = await db.execute(
        `SELECT COALESCE(SUM(t.grand_total), 0) AS "totalPayments"
         FROM hris_saas.transactions t
         WHERE t.party_id = ? AND t.tenant_id = ? AND t.direction = 'sales'
           AND t.transaction_type = 'payment_in'`,
        [id, tenantId]
      );
      summary = {
        totalSales: Number(invRows[0].totalSales),
        totalPaymentsReceived: Number(payRows[0].totalPayments),
        outstanding: Number(invRows[0].outstanding),
        lastTransactionDate: invRows[0].lastInvoiceDate,
      };
    } else {
      const purchaseTypes = ['purchase_invoice', 'purchase_order', 'purchase_return', 'debit_note'];
      const purchPl = purchaseTypes.map(() => '?').join(',');
      const [poRows] = await db.execute(
        `SELECT COALESCE(SUM(t.grand_total), 0) AS "totalPurchases",
                COALESCE(SUM(CASE WHEN t.status NOT IN ('draft','cancelled') THEN t.balance_due ELSE 0 END), 0) AS "outstanding",
                MAX(t.document_date) AS "lastOrderDate"
         FROM hris_saas.transactions t
         WHERE t.party_id = ? AND t.tenant_id = ? AND t.direction = 'purchase'
           AND t.transaction_type IN (${purchPl})`,
        [id, tenantId, ...purchaseTypes]
      );
      const [payRows] = await db.execute(
        `SELECT COALESCE(SUM(t.grand_total), 0) AS "totalPayments"
         FROM hris_saas.transactions t
         WHERE t.party_id = ? AND t.tenant_id = ? AND t.direction = 'purchase'
           AND t.transaction_type = 'payment_out'`,
        [id, tenantId]
      );
      summary = {
        totalPurchases: Number(poRows[0].totalPurchases),
        totalPaymentsMade: Number(payRows[0].totalPayments),
        outstanding: Number(poRows[0].outstanding),
        lastTransactionDate: poRows[0].lastOrderDate,
      };
    }

    res.json({ transactions: mapped, summary, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Party transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
};
