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
      db.query("SELECT COALESCE(SUM(amount),0) as t FROM hris_saas.kirana_cashbook WHERE tenant_id = ? AND type = ?", [tenantId, 'IN']),
      db.query("SELECT COALESCE(SUM(amount),0) as t FROM hris_saas.kirana_cashbook WHERE tenant_id = ? AND type = ?", [tenantId, 'OUT']),
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

exports.getBusinessDashboard = async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { period = 'year' } = req.query;

    // Determine date ranges
    const now = new Date();
    let fromDate, prevFromDate;
    if (period === 'today') {
      fromDate = now.toISOString().slice(0, 10);
      prevFromDate = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      fromDate = weekAgo.toISOString().slice(0, 10);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
      prevFromDate = twoWeeksAgo.toISOString().slice(0, 10);
    } else if (period === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      fromDate = monthAgo.toISOString().slice(0, 10);
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
      prevFromDate = twoMonthsAgo.toISOString().slice(0, 10);
    } else if (period === 'quarter') {
      const quarterAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      fromDate = quarterAgo.toISOString().slice(0, 10);
      const twoQuartersAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      prevFromDate = twoQuartersAgo.toISOString().slice(0, 10);
    } else {
      // year (default)
      fromDate = `${now.getFullYear()}-01-01`;
      prevFromDate = `${now.getFullYear() - 1}-01-01`;
    }
    const toDate = now.toISOString().slice(0, 10);

    const [
      [revenueRes],
      [prevRevenueRes],
      [expenseRes],
      [prevExpenseRes],
      [paidInvoices],
      [pendingInvoices],
      [overdueInvoices],
      [receivablesRes],
      [payablesRes],
      [customerCount],
      [prevCustomerCount],
      [supplierCount],
      [invoiceStatusCounts],
      [monthlyRevenue],
      [monthlyExpenses],
      [topCustomers],
      [topSuppliers],
      [recentInvoices],
      [pendingPOs],
      [recentTransactions],
      [cashFlowIn],
      [cashFlowOut],
      [subscriptionRes],
    ] = await Promise.all([
      // Current period revenue (paid invoices)
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as t, COUNT(*) as c
         FROM hris_saas.invoices WHERE tenant_id = ? AND status = 'paid'
         AND updated_at BETWEEN ? AND ?`,
        [tenantId, fromDate, toDate + 'T23:59:59Z']
      ),
      // Previous period revenue
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as t
         FROM hris_saas.invoices WHERE tenant_id = ? AND status = 'paid'
         AND updated_at BETWEEN ? AND ?`,
        [tenantId, prevFromDate, fromDate]
      ),
      // Current period expenses (balance sheet OUT + pending PO totals)
      db.query(
        `SELECT COALESCE(SUM(amount),0) as t
         FROM hris_saas.balance_sheet WHERE tenant_id = ? AND type = 'OUT'
         AND entry_date BETWEEN ? AND ?`,
        [tenantId, fromDate, toDate + 'T23:59:59Z']
      ),
      // Previous period expenses
      db.query(
        `SELECT COALESCE(SUM(amount),0) as t
         FROM hris_saas.balance_sheet WHERE tenant_id = ? AND type = 'OUT'
         AND entry_date BETWEEN ? AND ?`,
        [tenantId, prevFromDate, fromDate]
      ),
      // Paid invoice total (all time)
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as t, COUNT(*) as c
         FROM hris_saas.invoices WHERE tenant_id = ? AND status = 'paid'`,
        [tenantId]
      ),
      // Pending invoices (sent/overdue/partial)
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as t, COUNT(*) as c
         FROM hris_saas.invoices WHERE tenant_id = ? AND status IN ('sent','overdue','partial')`,
        [tenantId]
      ),
      // Overdue invoices
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as t, COUNT(*) as c
         FROM hris_saas.invoices WHERE tenant_id = ? AND status = 'overdue'`,
        [tenantId]
      ),
      // Outstanding receivables (unpaid invoices)
      db.query(
        `SELECT COALESCE(SUM(total_amount - COALESCE(paid_amount,0)),0) as t
         FROM hris_saas.invoices WHERE tenant_id = ? AND status IN ('sent','overdue','partial')`,
        [tenantId]
      ),
      // Outstanding payables (pending PO totals)
      db.query(
        `SELECT COALESCE(SUM(total_amount),0) as t
         FROM hris_saas.purchase_orders WHERE tenant_id = ? AND status IN ('draft','sent','approved')`,
        [tenantId]
      ),
      // Total active customers
      db.query(
        `SELECT COUNT(*) as c FROM hris_saas.customers WHERE tenant_id = ? AND status = 'active'`,
        [tenantId]
      ),
      // New customers this period
      db.query(
        `SELECT COUNT(*) as c FROM hris_saas.customers
         WHERE tenant_id = ? AND status = 'active' AND created_at >= ?`,
        [tenantId, fromDate]
      ),
      // Total active suppliers
      db.query(
        `SELECT COUNT(*) as c FROM hris_saas.suppliers WHERE tenant_id = ? AND status = 'active'`,
        [tenantId]
      ),
      // Invoice status breakdown
      db.query(
        `SELECT status, COUNT(*) as c, COALESCE(SUM(total_amount),0) as t
         FROM hris_saas.invoices WHERE tenant_id = ? GROUP BY status`,
        [tenantId]
      ),
      // Monthly revenue trend (12 months)
      db.query(
        `SELECT DATE_TRUNC('month', updated_at) as month, COALESCE(SUM(total_amount),0) as revenue
         FROM hris_saas.invoices WHERE tenant_id = ? AND status = 'paid' AND updated_at IS NOT NULL
         AND updated_at >= ?
         GROUP BY DATE_TRUNC('month', updated_at) ORDER BY month`,
        [tenantId, `${now.getFullYear() - 1}-01-01`]
      ),
      // Monthly expense trend (12 months)
      db.query(
        `SELECT DATE_TRUNC('month', entry_date) as month, COALESCE(SUM(amount),0) as expenses
         FROM hris_saas.balance_sheet WHERE tenant_id = ? AND type = 'OUT'
         AND entry_date >= ?
         GROUP BY DATE_TRUNC('month', entry_date) ORDER BY month`,
        [tenantId, `${now.getFullYear() - 1}-01-01`]
      ),
      // Top 5 customers by revenue
      db.query(
        `SELECT c.name, c.id, SUM(i.total_amount) as revenue, COUNT(i.id) as invoice_count
         FROM hris_saas.invoices i JOIN hris_saas.customers c ON i.customer_id = c.id
         WHERE i.tenant_id = ? AND i.status = 'paid'
         GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 5`,
        [tenantId]
      ),
      // Top 5 suppliers by PO amount
      db.query(
        `SELECT s.name, s.id, SUM(po.total_amount) as amount, COUNT(po.id) as po_count
         FROM hris_saas.purchase_orders po JOIN hris_saas.suppliers s ON po.supplier_id = s.id
         WHERE po.tenant_id = ? AND po.status IN ('approved','received')
         GROUP BY s.id, s.name ORDER BY amount DESC LIMIT 5`,
        [tenantId]
      ),
      // Recent invoices
      db.query(
        `SELECT i.id, i.invoice_number, i.total_amount, i.status, i.created_at,
                c.name as customer_name
         FROM hris_saas.invoices i LEFT JOIN hris_saas.customers c ON i.customer_id = c.id
         WHERE i.tenant_id = ?
         ORDER BY i.created_at DESC LIMIT 5`,
        [tenantId]
      ),
      // Pending Purchase Orders
      db.query(
        `SELECT id, po_number, total_amount, status, created_at
         FROM hris_saas.purchase_orders
         WHERE tenant_id = ? AND status NOT IN ('received','cancelled')
         ORDER BY created_at DESC LIMIT 5`,
        [tenantId]
      ),
      // Recent kirana transactions
      db.query(
        `SELECT t.id, t.type, t.amount, t.note, t.entry_date, p.name as party_name
         FROM hris_saas.kirana_transactions t
         LEFT JOIN hris_saas.kirana_parties p ON p.id = t.party_id
         WHERE t.tenant_id = ?
         ORDER BY t.created_at DESC LIMIT 5`,
        [tenantId]
      ),
      // Cash flow in (invoice payments)
      db.query(
        `SELECT COALESCE(SUM(ip.amount),0) as t
         FROM hris_saas.invoice_payments ip
         JOIN hris_saas.invoices i ON ip.invoice_id = i.id
         WHERE i.tenant_id = ? AND ip.payment_date BETWEEN ? AND ?`,
        [tenantId, fromDate, toDate + 'T23:59:59Z']
      ),
      // Cash flow out (balance sheet expenses)
      db.query(
        `SELECT COALESCE(SUM(amount),0) as t
         FROM hris_saas.balance_sheet WHERE tenant_id = ? AND type = 'OUT'
         AND entry_date BETWEEN ? AND ?`,
        [tenantId, fromDate, toDate + 'T23:59:59Z']
      ),
      // Subscription info
      db.query(
        `SELECT subscription_plan as plan, status FROM hris_saas.tenants WHERE id = ?`,
        [tenantId]
      ),
    ]);

    // Compute derived metrics
    const totalRevenue = Number(revenueRes[0]?.t || 0);
    const prevRevenue = Number(prevRevenueRes[0]?.t || 0);
    const totalExpenses = Number(expenseRes[0]?.t || 0);
    const prevExpenses = Number(prevExpenseRes[0]?.t || 0);
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;
    const revenueGrowth = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;
    const expenseGrowth = prevExpenses > 0 ? (((totalExpenses - prevExpenses) / prevExpenses) * 100) : 0;

    const paidTotal = Number(paidInvoices[0]?.t || 0);
    const paidCount = Number(paidInvoices[0]?.c || 0);
    const pendingTotal = Number(pendingInvoices[0]?.t || 0);
    const pendingCount = Number(pendingInvoices[0]?.c || 0);
    const overdueTotal = Number(overdueInvoices[0]?.t || 0);
    const overdueCount = Number(overdueInvoices[0]?.c || 0);
    const totalInvoiceValue = paidTotal + pendingTotal + overdueTotal;
    const collectionEfficiency = totalInvoiceValue > 0 ? ((paidTotal / totalInvoiceValue) * 100) : 0;

    const cashIn = Number(cashFlowIn[0]?.t || 0);
    const cashOut = Number(cashFlowOut[0]?.t || 0);

    const outstandingReceivables = Number(receivablesRes[0]?.t || 0);
    const outstandingPayables = Number(payablesRes[0]?.t || 0);
    const activeCustomers = Number(customerCount[0]?.c || 0);
    const newCustomers = Number(prevCustomerCount[0]?.c || 0);
    const activeSuppliers = Number(supplierCount[0]?.c || 0);
    const acquisitionRate = (activeCustomers - newCustomers) > 0
      ? ((newCustomers / (activeCustomers - newCustomers)) * 100) : 0;

    // Business health score (0-100 composite)
    const profitScore = Math.min(30, Math.max(0, (profitMargin / 50) * 30));
    const collectionScore = Math.min(25, Math.max(0, (collectionEfficiency / 100) * 25));
    const growthScore = Math.min(20, Math.max(0, (revenueGrowth / 100) * 20));
    const cashScore = Math.min(15, Math.max(0, cashIn > cashOut ? 15 : (cashIn / Math.max(cashOut, 1)) * 15));
    const customerScore = Math.min(10, Math.max(0, Math.min(10, activeCustomers * 2)));
    const healthScore = Math.round(profitScore + collectionScore + growthScore + cashScore + customerScore);

    // Build monthly trend
    const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthMap = {};
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowYear, nowMonth - i, 1);
      const key = monthKey(d);
      monthMap[key] = { month: key, revenue: 0, expenses: 0, profit: 0 };
    }
    for (const row of monthlyRevenue) {
      const d = new Date(row.month);
      const key = monthKey(d);
      if (monthMap[key]) monthMap[key].revenue = Math.round(row.revenue / 100);
    }
    for (const row of monthlyExpenses) {
      const d = new Date(row.month);
      const key = monthKey(d);
      if (monthMap[key]) monthMap[key].expenses = Math.round(row.expenses / 100);
    }
    for (const key of Object.keys(monthMap)) {
      monthMap[key].profit = monthMap[key].revenue - monthMap[key].expenses;
    }

    // Invoice status breakdown
    const statusBreakdown = { draft: 0, sent: 0, paid: 0, overdue: 0, partial: 0, cancelled: 0 };
    for (const row of invoiceStatusCounts) {
      statusBreakdown[row.status] = Number(row.c || 0);
    }

    // Alerts
    const alerts = [];
    if (overdueCount > 0) alerts.push({ type: 'critical', message: `${overdueCount} invoices overdue (${(overdueTotal / 100).toLocaleString()} INR)`, actionUrl: '/admin/invoices?status=overdue' });
    if (pendingCount > 0) alerts.push({ type: 'warning', message: `${pendingCount} invoices pending worth ${(pendingTotal / 100).toLocaleString()} INR`, actionUrl: '/admin/invoices' });
    if (outstandingPayables > 0) alerts.push({ type: 'info', message: `Outstanding payables of ${(outstandingPayables / 100).toLocaleString()} INR`, actionUrl: '/admin/suppliers' });
    if (profitMargin < 10) alerts.push({ type: 'warning', message: `Profit margin at ${profitMargin.toFixed(1)}% — below 10% threshold`, actionUrl: '/admin/reports' });
    if (collectionEfficiency < 60) alerts.push({ type: 'warning', message: `Collection efficiency at ${collectionEfficiency.toFixed(1)}% — needs attention`, actionUrl: '/admin/invoices' });
    if (revenueGrowth < 0) alerts.push({ type: 'info', message: `Revenue declined ${Math.abs(revenueGrowth).toFixed(1)}% vs previous period`, actionUrl: '/admin/reports' });

    res.json({
      summary: {
        totalRevenue: Math.round(totalRevenue / 100),
        totalExpenses: Math.round(totalExpenses / 100),
        netProfit: Math.round(netProfit / 100),
        profitMargin: Math.round(profitMargin * 10) / 10,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        expenseGrowth: Math.round(expenseGrowth * 10) / 10,
        outstandingReceivables: Math.round(outstandingReceivables / 100),
        outstandingPayables: Math.round(outstandingPayables / 100),
        cashFlow: {
          in: Math.round(cashIn / 100),
          out: Math.round(cashOut / 100),
          net: Math.round((cashIn - cashOut) / 100),
        },
        collectionEfficiency: Math.round(collectionEfficiency * 10) / 10,
        businessHealthScore: healthScore,
        invoiceCounts: {
          paid: paidCount,
          pending: pendingCount,
          overdue: overdueCount,
          total: paidCount + pendingCount + overdueCount + Number(statusBreakdown.draft || 0) + Number(statusBreakdown.cancelled || 0),
        },
        customers: { total: activeCustomers, new: newCustomers },
        suppliers: { total: activeSuppliers },
        acquisitionRate: Math.round(acquisitionRate * 10) / 10,
        period,
      },
      subscription: {
        plan: subscriptionRes[0]?.plan || 'FREE',
        status: subscriptionRes[0]?.status || 'active',
      },
      monthlyTrend: Object.values(monthMap),
      topCustomers: topCustomers.map(c => ({
        name: c.name, id: c.id,
        revenue: Math.round(Number(c.revenue) / 100),
        invoiceCount: Number(c.invoice_count),
      })),
      topSuppliers: topSuppliers.map(s => ({
        name: s.name, id: s.id,
        amount: Math.round(Number(s.amount) / 100),
        poCount: Number(s.po_count),
      })),
      recentInvoices: recentInvoices.map(i => ({
        id: i.id, invoiceNumber: i.invoice_number,
        totalAmount: Math.round(Number(i.total_amount) / 100),
        status: i.status, createdAt: i.created_at,
        customerName: i.customer_name,
      })),
      pendingPOs: pendingPOs.map(p => ({
        id: p.id, poNumber: p.po_number,
        totalAmount: Math.round(Number(p.total_amount) / 100),
        status: p.status, createdAt: p.created_at,
      })),
      recentTransactions: recentTransactions.map(t => ({
        id: t.id, type: t.type, amount: Math.round(Number(t.amount) / 100),
        note: t.note, entryDate: t.entry_date,
        partyName: t.party_name,
      })),
      statusBreakdown,
      alerts,
    });
  } catch (error) {
    console.error('getBusinessDashboard error:', error);
    res.status(500).json({ error: 'Failed to load business dashboard.' });
  }
};
