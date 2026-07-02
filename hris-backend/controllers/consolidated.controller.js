const db = require('../config/db');

exports.consolidatedPL = async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = req.query;

  try {
    const [tenant] = await db.query(
      `SELECT organization_id, company_name FROM hris_saas.tenants WHERE id = $1`, [tenantId]
    );
    if (tenant.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

    const orgId = tenant[0].organization_id;

    const [entities] = await db.query(
      `SELECT id, company_name, branch_name FROM hris_saas.tenants
       WHERE organization_id = $1 AND status = 'active' ORDER BY entity_type DESC`,
      [orgId]
    );

    if (entities.length <= 1) {
      return res.status(400).json({ error: 'Only one entity exists. Add more entities first.' });
    }

    const entityIds = entities.map(e => e.id);

    const dateFilter = (from && to) ? `AND i.invoice_date >= $2::date AND i.invoice_date <= $3::date` : '';
    const dateParams = (from && to) ? [entityIds, from, to] : [entityIds];

    const [incomeData] = await db.query(`
      SELECT i.tenant_id, COALESCE(SUM(i.total_amount), 0) as income
      FROM hris_saas.invoices i
      WHERE i.tenant_id = ANY($1::varchar[])
        AND i.status = 'paid'
        ${dateFilter}
      GROUP BY i.tenant_id`,
      dateParams
    );

    const [expenseData] = await db.query(`
      SELECT po.tenant_id, COALESCE(SUM(po.total_amount), 0) as expenses
      FROM hris_saas.purchase_orders po
      WHERE po.tenant_id = ANY($1::varchar[])
        AND po.status IN ('received', 'approved')
        ${dateFilter.replace(/i\.invoice_date/g, 'po.order_date')}
      GROUP BY po.tenant_id`,
      dateParams
    );

    const [collectionData] = await db.query(`
      SELECT ip.tenant_id, COALESCE(SUM(ip.amount), 0) as collections
      FROM hris_saas.invoice_payments ip
      WHERE ip.tenant_id = ANY($1::varchar[])
        ${from && to ? `AND ip.payment_date >= $2::date AND ip.payment_date <= $3::date` : ''}
      GROUP BY ip.tenant_id`,
      dateParams
    );

    const entityMap = {};
    for (const e of entities) {
      entityMap[e.id] = { companyName: e.company_name, branchName: e.branch_name, income: 0, expenses: 0, collections: 0, netProfit: 0 };
    }
    for (const row of incomeData) {
      if (entityMap[row.tenant_id]) {
        entityMap[row.tenant_id].income = parseInt(row.income || 0) / 100;
      }
    }
    for (const row of expenseData) {
      if (entityMap[row.tenant_id]) {
        entityMap[row.tenant_id].expenses = parseInt(row.expenses || 0) / 100;
      }
    }
    for (const row of collectionData) {
      if (entityMap[row.tenant_id]) {
        entityMap[row.tenant_id].collections = parseInt(row.collections || 0) / 100;
      }
    }

    const entityBreakdown = Object.values(entityMap).map(e => ({
      ...e,
      netProfit: Math.round((e.income - e.expenses) * 100) / 100,
    }));

    const consolidated = {
      totalIncome: Math.round(entityBreakdown.reduce((s, e) => s + e.income, 0) * 100) / 100,
      totalExpenses: Math.round(entityBreakdown.reduce((s, e) => s + e.expenses, 0) * 100) / 100,
      totalCollections: Math.round(entityBreakdown.reduce((s, e) => s + e.collections, 0) * 100) / 100,
      netProfit: Math.round(entityBreakdown.reduce((s, e) => s + e.netProfit, 0) * 100) / 100,
    };

    res.json({
      period: { from: from || 'all', to: to || 'all' },
      primaryEntity: tenant[0].company_name,
      entityCount: entities.length,
      consolidated,
      entityBreakdown,
    });
  } catch (error) {
    console.error('Consolidated report error:', error);
    res.status(500).json({ error: 'Failed to generate consolidated report.' });
  }
};