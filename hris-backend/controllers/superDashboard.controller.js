const db = require('../config/db');
const saService = require('../services/superAdmin.service');

/**
 * GET /api/v1/super/dashboard/summary
 * Top-level KPIs: total/active/trial tenants, plan distribution, referrals, conversion, revenue
 */
exports.getSummary = async (req, res) => {
  try {
    const [tenants] = await db.execute('SELECT COUNT(*) as c FROM hris_saas.tenants');
    const [activeTenants] = await db.execute("SELECT COUNT(*) as c FROM hris_saas.tenants WHERE status = 'active'");
    const [planCounts] = await db.execute(
      `SELECT subscription_plan, COUNT(*) as count FROM hris_saas.tenants GROUP BY subscription_plan ORDER BY count DESC`
    );
    const [trialCount] = await db.execute(
      "SELECT COUNT(*) as c FROM hris_saas.subscriptions WHERE status = 'trialing'"
    );
    const [revenueTotal] = await db.execute(
      "SELECT COALESCE(SUM(amount),0) as total FROM hris_saas.payments WHERE status IN ('captured','completed')"
    );
    const [activeSubs] = await db.execute(
      "SELECT COUNT(*) as c FROM hris_saas.subscriptions WHERE status IN ('active','trialing')"
    );
    const [churnedSubs] = await db.execute(
      "SELECT COUNT(*) as c FROM hris_saas.subscriptions WHERE status IN ('cancelled','expired')"
    );

    const totalActiveSubs = Number(activeSubs[0]?.c || 0);
    const totalChurned = Number(churnedSubs[0]?.c || 0);

    // Trial → paid conversion
    const [trialStarted] = await db.execute(
      "SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_started'"
    );
    const [trialConverted] = await db.execute(
      "SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_converted'"
    );
    const started = Number(trialStarted[0]?.c || 0);
    const converted = Number(trialConverted[0]?.c || 0);

    // Referral count
    const [referralCount] = await db.execute('SELECT COUNT(*) as c FROM referral_redemptions');

    res.json({
      totalTenants: Number(tenants[0]?.c || 0),
      activeTenants: Number(activeTenants[0]?.c || 0),
      onTrial: Number(trialCount[0]?.c || 0),
      planDistribution: planCounts || [],
      totalRevenue: Number(revenueTotal[0]?.total || 0),
      totalActiveSubs,
      totalChurned,
      churnRate: (totalActiveSubs + totalChurned) > 0
        ? Math.round((totalChurned / (totalActiveSubs + totalChurned)) * 100)
        : 0,
      trialStarted: started,
      trialConverted: converted,
      conversionRate: started > 0 ? Math.round((converted / started) * 100) : 0,
      totalReferrals: Number(referralCount[0]?.c || 0),
    });
  } catch (error) {
    console.error('[SuperDashboard] getSummary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary.' });
  }
};

/**
 * GET /api/v1/super/dashboard/revenue
 * Monthly revenue trend + MRR + by-plan breakdown
 */
exports.getRevenue = async (req, res) => {
  try {
    // Monthly revenue (last 12 months)
    const [monthlyRevenue] = await db.execute(
      `SELECT DATE_TRUNC('month', created_at) as month,
              COALESCE(SUM(amount),0) as revenue,
              COUNT(*) as payments
       FROM hris_saas.payments
       WHERE status IN ('captured','completed')
         AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY month ORDER BY month`
    );

    // Revenue by plan
    const [byPlan] = await db.execute(
      `SELECT p.plan_id, sp.name,
              COALESCE(SUM(p.amount),0) as revenue,
              COUNT(*) as payments
       FROM hris_saas.payments p
       JOIN hris_saas.subscription_plans sp ON p.plan_id = sp.id
       WHERE p.status IN ('captured','completed')
       GROUP BY p.plan_id, sp.name ORDER BY revenue DESC`
    );

    // MRR
    const [mrrResult] = await db.execute(
      `SELECT COALESCE(SUM(
         CASE
           WHEN sp.period = 'year' THEN sp.price_inr / 12
           WHEN sp.period = 'month' THEN sp.price_inr
           ELSE sp.price_inr
         END
       ), 0) as mrr
       FROM hris_saas.subscriptions s
       JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
       WHERE s.status IN ('active','trialing')`
    );

    // Current month & previous month
    const [thisMonth] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM hris_saas.payments
       WHERE status IN ('captured','completed')
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`
    );
    const [prevMonth] = await db.execute(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM hris_saas.payments
       WHERE status IN ('captured','completed')
         AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')`
    );

    res.json({
      monthlyRevenue: monthlyRevenue || [],
      byPlan: byPlan || [],
      mrr: Number(mrrResult[0]?.mrr || 0),
      thisMonth: Number(thisMonth[0]?.total || 0),
      prevMonth: Number(prevMonth[0]?.total || 0),
    });
  } catch (error) {
    console.error('[SuperDashboard] getRevenue error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data.' });
  }
};

/**
 * GET /api/v1/super/dashboard/conversion
 * Trial → paid funnel, tenant growth, plan switches
 */
exports.getConversion = async (req, res) => {
  try {
    // Tenant growth by month (last 12 months)
    const [tenantGrowth] = await db.execute(
      `SELECT DATE_TRUNC('month', created_at) as month,
              COUNT(*) as new_tenants
       FROM hris_saas.tenants
       WHERE created_at >= NOW() - INTERVAL '12 months'
       GROUP BY month ORDER BY month`
    );

    // Trial vs paid counts (all time)
    const [trialVsPaid] = await db.execute(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'trialing') as trialing,
         COUNT(*) FILTER (WHERE status = 'active') as active_paid,
         COUNT(*) FILTER (WHERE status IN ('cancelled','expired')) as churned
       FROM hris_saas.subscriptions`
    );

    // Conversion events funnel
    const [conversionFunnel] = await db.execute(
      `SELECT event, COUNT(*) as count
       FROM conversion_events
       GROUP BY event ORDER BY event`
    );

    // Plan switches (last 12 months)
    const [planSwitches] = await db.execute(
      `SELECT event_type, COUNT(*) as count
       FROM hris_saas.subscription_events
       WHERE event_type IN ('upgrade','downgrade')
         AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY event_type`
    );

    res.json({
      tenantGrowth: tenantGrowth || [],
      trialVsPaid: trialVsPaid[0] || { trialing: 0, active_paid: 0, churned: 0 },
      conversionFunnel: conversionFunnel || [],
      planSwitches: planSwitches || [],
    });
  } catch (error) {
    console.error('[SuperDashboard] getConversion error:', error);
    res.status(500).json({ error: 'Failed to fetch conversion data.' });
  }
};

/**
 * GET /api/v1/super/dashboard/recent-onboards
 * Recently onboarded tenants + trials expiring soon + recently expired
 */
exports.getRecentOnboards = async (req, res) => {
  try {
    // Recently onboarded (last 10)
    const [recentOnboards] = await db.execute(
      `SELECT id, company_name, subdomain, subscription_plan, phone, created_at
       FROM hris_saas.tenants
       ORDER BY created_at DESC LIMIT 10`
    );

    // Trials expiring in next 7 days
    const [expiringTrials] = await db.execute(
      `SELECT s.id, s.tenant_id, t.company_name, t.subdomain, t.subscription_plan,
              s.trial_ends_at, s.created_at as subscribed_at
       FROM hris_saas.subscriptions s
       JOIN hris_saas.tenants t ON s.tenant_id = t.id
       WHERE s.status = 'trialing'
         AND s.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
       ORDER BY s.trial_ends_at`
    );

    // Recently expired trials (last 7 days)
    const [expiredTrials] = await db.execute(
      `SELECT s.id, s.tenant_id, t.company_name, t.subdomain, t.subscription_plan,
              s.trial_ends_at, s.ended_at
       FROM hris_saas.subscriptions s
       JOIN hris_saas.tenants t ON s.tenant_id = t.id
       WHERE s.status IN ('expired','cancelled')
         AND s.trial_ends_at IS NOT NULL
         AND s.ended_at >= NOW() - INTERVAL '7 days'
       ORDER BY s.ended_at DESC`
    );

    // Active campaigns summary
    const [activeCampaigns] = await db.execute(
      `SELECT id, name, code, discount_pct, discount_months, redemptions, max_redemptions,
              starts_at, ends_at, is_active
       FROM campaigns
       WHERE is_active = true AND ends_at >= NOW()
       ORDER BY starts_at DESC LIMIT 5`
    );

    res.json({
      recentOnboards: recentOnboards || [],
      expiringTrials: expiringTrials || [],
      expiredTrials: expiredTrials || [],
      activeCampaigns: activeCampaigns || [],
    });
  } catch (error) {
    console.error('[SuperDashboard] getRecentOnboards error:', error);
    res.status(500).json({ error: 'Failed to fetch recent onboard data.' });
  }
};

/**
 * GET /api/v1/super/dashboard/expiring-trials
 * Dedicated endpoint for trials expiring soon
 */
exports.getExpiringTrials = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const [trials] = await db.execute(
      `SELECT s.id, s.tenant_id, t.company_name, t.subdomain, t.subscription_plan,
              s.trial_ends_at, s.created_at as subscribed_at,
              EXTRACT(DAY FROM s.trial_ends_at - NOW()) as days_remaining
       FROM hris_saas.subscriptions s
       JOIN hris_saas.tenants t ON s.tenant_id = t.id
       WHERE s.status = 'trialing'
         AND s.trial_ends_at BETWEEN NOW() AND NOW() + MAKE_INTERVAL(days => $1)
       ORDER BY s.trial_ends_at`,
      [days]
    );

    res.json({ trials: trials || [], days });
  } catch (error) {
    console.error('[SuperDashboard] getExpiringTrials error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring trials.' });
  }
};
