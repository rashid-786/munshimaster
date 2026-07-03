const db = require('../config/db');

/**
 * Subscription Analytics Service
 *
 * Provides subscription-specific business metrics:
 *   - Active subscribers by plan
 *   - Plan distribution
 *   - MRR / ARR
 *   - Revenue projections
 *   - Churn rate
 *   - Historical trends
 */

/**
 * Get current subscription distribution.
 */
async function getPlanDistribution() {
  const [rows] = await db.execute(
    `SELECT
       s.plan_id,
       COUNT(*) as total,
       COUNT(*) FILTER (WHERE s.status = 'active') as active,
       COUNT(*) FILTER (WHERE s.status = 'trialing') as trialing,
       COUNT(*) FILTER (WHERE s.status = 'grace_period') as grace_period,
       COUNT(*) FILTER (WHERE s.status = 'suspended') as suspended,
       COUNT(*) FILTER (WHERE s.status = 'cancelled') as cancelled
     FROM hris_saas.subscriptions s
     WHERE s.plan_id != 'free'
     GROUP BY s.plan_id
     ORDER BY total DESC`
  );
  return rows.map(r => ({
    plan: r.plan_id,
    total: parseInt(r.total, 10),
    active: parseInt(r.active, 10),
    trialing: parseInt(r.trialing, 10),
    gracePeriod: parseInt(r.grace_period, 10),
    suspended: parseInt(r.suspended, 10),
    cancelled: parseInt(r.cancelled, 10),
  }));
}

/**
 * Get total active subscriber counts (including free).
 */
async function getActiveSubscribers() {
  const [rows] = await db.execute(
    `SELECT
       COUNT(*) as total
     FROM hris_saas.subscriptions
     WHERE status IN ('active', 'trialing')`
  );
  const [paid] = await db.execute(
    `SELECT COUNT(*) as total
     FROM hris_saas.subscriptions
     WHERE status IN ('active', 'trialing') AND plan_id != 'free'`
  );
  const [free] = await db.execute(
    `SELECT COUNT(*) as total
     FROM hris_saas.subscriptions
     WHERE status IN ('active', 'trialing') AND plan_id = 'free'`
  );
  return {
    total: parseInt(rows[0]?.total || 0, 10),
    paid: parseInt(paid[0]?.total || 0, 10),
    free: parseInt(free[0]?.total || 0, 10),
  };
}

/**
 * Calculate Monthly Recurring Revenue (MRR).
 * Sums all active paid subscription prices, normalized to monthly.
 */
async function getMRR() {
  const [rows] = await db.execute(
    `SELECT
       s.plan_id,
       sp.price_inr,
       sp.period,
       COUNT(*) as subscriber_count
     FROM hris_saas.subscriptions s
     JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
     WHERE s.status IN ('active', 'trialing') AND s.plan_id != 'free'
     GROUP BY s.plan_id, sp.price_inr, sp.period`
  );

  let totalMRR = 0;
  const breakdown = [];

  for (const row of rows) {
    const price = parseFloat(row.price_inr) || 0;
    const count = parseInt(row.subscriber_count, 10) || 0;
    // Normalize to monthly
    const monthlyPrice = row.period === 'year' ? price / 12 : price;
    const mrr = monthlyPrice * count;
    totalMRR += mrr;
    breakdown.push({
      plan: row.plan_id,
      subscribers: count,
      unitPrice: price,
      normalizedMonthly: Math.round(monthlyPrice * 100) / 100,
      mrr: Math.round(mrr * 100) / 100,
    });
  }

  return {
    totalMRR: Math.round(totalMRR * 100) / 100,
    breakdown,
    currency: 'INR',
  };
}

/**
 * Calculate Annual Run Rate (ARR = MRR * 12).
 */
async function getARR() {
  const mrr = await getMRR();
  return {
    totalARR: Math.round(mrr.totalMRR * 12 * 100) / 100,
    baseMRR: mrr.totalMRR,
    currency: 'INR',
  };
}

/**
 * Get revenue by month for the last N months.
 */
async function getRevenueHistory(months = 12) {
  const [rows] = await db.execute(
    `SELECT
       DATE_TRUNC('month', p.created_at)::date as month,
       COUNT(*) as transaction_count,
       SUM(p.amount) as revenue
     FROM hris_saas.payments p
     WHERE p.status = 'captured'
       AND p.created_at >= NOW() - INTERVAL '?' MONTH
     GROUP BY month
     ORDER BY month ASC`,
    [months]
  );
  return rows.map(r => ({
    month: r.month,
    transactions: parseInt(r.transaction_count, 10),
    revenue: parseFloat(r.revenue) || 0,
  }));
}

/**
 * Calculate churn rate for a given period.
 * Churn = cancelled subs / total subs at start of period.
 */
async function getChurnRate(months = 3) {
  const [ended] = await db.execute(
    `SELECT COUNT(*) as total
     FROM hris_saas.subscriptions
     WHERE status IN ('cancelled', 'expired')
       AND (ended_at IS NOT NULL AND ended_at >= NOW() - INTERVAL '?' MONTH)
       AND plan_id != 'free'`,
    [months]
  );
  const [active] = await db.execute(
    `SELECT COUNT(*) as total
     FROM hris_saas.subscriptions
     WHERE status IN ('active', 'trialing') AND plan_id != 'free'`
  );
  const churned = parseInt(ended[0]?.total || 0, 10);
  const current = parseInt(active[0]?.total || 0, 10);
  const total = churned + current;

  return {
    periodMonths: months,
    churned,
    currentActive: current,
    churnRate: total > 0 ? Math.round((churned / total) * 10000) / 100 : 0,
  };
}

/**
 * Revenue projection: forecast next N months based on current MRR
 * and historical churn rate.
 */
async function getRevenueProjections(months = 12) {
  const mrr = await getMRR();
  const churn = await getChurnRate(3);
  const monthlyChurnRate = churn.churnRate / 100; // decimal

  const projections = [];
  let projectedMRR = mrr.totalMRR;

  for (let i = 1; i <= months; i++) {
    // Apply churn: each month we lose some MRR, but assume flat new sales
    projectedMRR = projectedMRR * (1 - monthlyChurnRate);
    projections.push({
      month: i,
      projectedMRR: Math.round(projectedMRR * 100) / 100,
      projectedARR: Math.round(projectedMRR * 12 * 100) / 100,
    });
  }

  return {
    currentMRR: mrr.totalMRR,
    currentARR: Math.round(mrr.totalMRR * 12 * 100) / 100,
    monthlyChurnRate: Math.round(monthlyChurnRate * 10000) / 100,
    projections,
  };
}

/**
 * Get subscriber trends (daily new signups for last N days).
 */
async function getSubscriberTrends(days = 30) {
  const [rows] = await db.execute(
    `SELECT
       DATE(s.created_at) as date,
       COUNT(*) as new_subscribers,
       COUNT(*) FILTER (WHERE s.plan_id != 'free') as new_paid
     FROM hris_saas.subscriptions s
     WHERE s.created_at >= NOW() - INTERVAL '?' DAY
     GROUP BY DATE(s.created_at)
     ORDER BY date ASC`,
    [days]
  );
  return rows.map(r => ({
    date: r.date,
    newSubscribers: parseInt(r.new_subscribers, 10),
    newPaid: parseInt(r.new_paid, 10),
  }));
}

/**
 * Get aggregated subscription analytics (single call for dashboards).
 */
async function getAnalyticsDashboard() {
  const [distribution, activeSubscribers, mrr, arr, churn, revenue, trends, projections] =
    await Promise.all([
      getPlanDistribution(),
      getActiveSubscribers(),
      getMRR(),
      getARR(),
      getChurnRate(3),
      getRevenueHistory(12),
      getSubscriberTrends(30),
      getRevenueProjections(12),
    ]);

  return {
    distribution,
    activeSubscribers,
    mrr,
    arr,
    churn,
    revenueHistory: revenue,
    subscriberTrends: trends,
    revenueProjections: projections,
  };
}

module.exports = {
  getPlanDistribution,
  getActiveSubscribers,
  getMRR,
  getARR,
  getRevenueHistory,
  getChurnRate,
  getRevenueProjections,
  getSubscriberTrends,
  getAnalyticsDashboard,
};
