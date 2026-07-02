const db = require('../config/db');

async function safeQuery(sql, params) {
  try {
    const [rows] = await db.query(sql, params);
    return rows;
  } catch {
    return [{ total: 0 }];
  }
}

async function getCashFlow(tenantId, fromDate, toDate) {
  // Collections from customers (invoice payments)
  const [collections] = await db.query(`
    SELECT COALESCE(SUM(ip.amount), 0) as total
    FROM hris_saas.invoice_payments ip
    JOIN hris_saas.invoices i ON ip.invoice_id = i.id
    WHERE i.tenant_id = $1 AND ip.payment_date BETWEEN $2 AND $3
      AND ip.payment_date IS NOT NULL`,
    [tenantId, fromDate, toDate]
  );

  // Balance sheet income entries (cash in)
  const [cashIn] = await db.query(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM hris_saas.balance_sheet
    WHERE tenant_id = $1 AND type = 'IN'
      AND entry_date BETWEEN $2 AND $3`,
    [tenantId, fromDate, toDate]
  );

  // Balance sheet expense entries (cash out)
  const [cashOut] = await db.query(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM hris_saas.balance_sheet
    WHERE tenant_id = $1 AND type = 'OUT'
      AND entry_date BETWEEN $2 AND $3`,
    [tenantId, fromDate, toDate]
  );

  // Bank transactions (table may not exist)
  const bankCredit = await safeQuery(`
    SELECT COALESCE(SUM(credit_amount), 0) as total
    FROM public.bank_transactions
    WHERE tenant_id = $1 AND entry_date BETWEEN $2 AND $3`,
    [tenantId, fromDate, toDate]
  );

  const bankDebit = await safeQuery(`
    SELECT COALESCE(SUM(debit_amount), 0) as total
    FROM public.bank_transactions
    WHERE tenant_id = $1 AND entry_date BETWEEN $2 AND $3`,
    [tenantId, fromDate, toDate]
  );

  // Subscription payments (table may not exist)
  const subscriptions = await safeQuery(`
    SELECT COALESCE(SUM(p.amount), 0) as total
    FROM hris_saas.payments p
    WHERE p.tenant_id = $1 AND p.status = 'completed'
      AND p.created_at BETWEEN $2::timestamptz AND $3::timestamptz + interval '1 day'`,
    [tenantId, fromDate, toDate]
  );

  // Monthly breakdown for trend
  const [monthly] = await db.query(`
    SELECT DATE_TRUNC('month', entry_date) as month,
           SUM(CASE WHEN type = 'IN' THEN amount ELSE 0 END) as cash_in,
           SUM(CASE WHEN type = 'OUT' THEN amount ELSE 0 END) as cash_out
    FROM hris_saas.balance_sheet
    WHERE tenant_id = $1 AND entry_date BETWEEN $2 AND $3
    GROUP BY DATE_TRUNC('month', entry_date)
    ORDER BY month`,
    [tenantId, fromDate, toDate]
  );

  const [monthlyPayments] = await db.query(`
    SELECT DATE_TRUNC('month', ip.payment_date) as month,
           SUM(ip.amount) as collections
    FROM hris_saas.invoice_payments ip
    JOIN hris_saas.invoices i ON ip.invoice_id = i.id
    WHERE i.tenant_id = $1 AND ip.payment_date BETWEEN $2 AND $3
      AND ip.payment_date IS NOT NULL
    GROUP BY DATE_TRUNC('month', ip.payment_date)
    ORDER BY month`,
    [tenantId, fromDate, toDate]
  );

  // Compute totals
  const collectionsTotal = parseInt(collections[0]?.total || 0) / 100;
  const cashInTotal = parseInt(cashIn[0]?.total || 0) / 100;
  const cashOutTotal = parseInt(cashOut[0]?.total || 0) / 100;
  const bankCreditTotal = parseInt(bankCredit[0]?.total || 0) / 100;
  const bankDebitTotal = parseInt(bankDebit[0]?.total || 0) / 100;
  const subscriptionTotal = parseInt(subscriptions[0]?.total || 0) / 100;

  // Net cash flow
  const operatingIn = collectionsTotal + (cashInTotal - collectionsTotal > 0 ? cashInTotal - collectionsTotal : 0);
  const operatingOut = cashOutTotal;
  const operatingNet = operatingIn - operatingOut;
  const financingNet = subscriptionTotal;
  const netCashFlow = operatingNet + financingNet;

  // Merge monthly data
  const monthlyMap = {};
  for (const row of monthly) {
    const m = row.month.toISOString().slice(0, 7);
    monthlyMap[m] = { month: m, cashIn: parseInt(row.cash_in || 0) / 100, cashOut: parseInt(row.cash_out || 0) / 100, collections: 0 };
  }
  for (const row of monthlyPayments) {
    const m = row.month.toISOString().slice(0, 7);
    if (!monthlyMap[m]) monthlyMap[m] = { month: m, cashIn: 0, cashOut: 0, collections: 0 };
    monthlyMap[m].collections = parseInt(row.collections || 0) / 100;
  }

  return {
    period: { from: fromDate, to: toDate },
    summary: {
      collectionsFromCustomers: Math.round(collectionsTotal * 100) / 100,
      otherIncome: Math.round(Math.max(0, cashInTotal - collectionsTotal) * 100) / 100,
      totalCashIn: Math.round(Math.max(operatingIn, cashInTotal) * 100) / 100,
      paymentsToSuppliers: Math.round(operatingOut * 100) / 100,
      totalCashOut: Math.round(operatingOut * 100) / 100,
      operatingNet: Math.round(operatingNet * 100) / 100,
      financingNet: Math.round(financingNet * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
    },
    bankSummary: {
      totalCredits: Math.round(bankCreditTotal * 100) / 100,
      totalDebits: Math.round(bankDebitTotal * 100) / 100,
    },
    monthlyTrend: Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

module.exports = { getCashFlow };
