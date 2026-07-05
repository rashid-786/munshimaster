const db = require('../config/db');

exports.getRevenueAnalytics = async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 24;

    // Revenue by month
    const [revenueByMonth] = await db.execute(
      `SELECT DATE_TRUNC('month', created_at) as month,
              COALESCE(SUM(CASE WHEN status IN ('captured','completed') THEN amount ELSE 0 END), 0) as revenue,
              COUNT(CASE WHEN status IN ('captured','completed') THEN 1 END) as payment_count,
              COUNT(*) as total_attempts
       FROM hris_saas.payments
       WHERE created_at >= NOW() - INTERVAL '${months} months'
       GROUP BY month ORDER BY month`
    );

    // Revenue by plan
    const [revenueByPlan] = await db.execute(
      `SELECT p.plan_id, sp.name as plan_name, sp.period,
              COALESCE(SUM(CASE WHEN p.status IN ('captured','completed') THEN p.amount ELSE 0 END), 0) as revenue,
              COUNT(CASE WHEN p.status IN ('captured','completed') THEN 1 END) as payment_count
       FROM hris_saas.payments p
       JOIN hris_saas.subscription_plans sp ON p.plan_id = sp.id
       GROUP BY p.plan_id, sp.name, sp.period
       ORDER BY revenue DESC`
    );

    // Revenue by billing cycle
    const [revenueByCycle] = await db.execute(
      `SELECT sp.period,
              COALESCE(SUM(p.amount), 0) as revenue,
              COUNT(*) as count
       FROM hris_saas.payments p
       JOIN hris_saas.subscription_plans sp ON p.plan_id = sp.id
       WHERE p.status IN ('captured','completed')
       GROUP BY sp.period`
    );

    // Campaign revenue
    const [campaignRevenue] = await db.execute(
      `SELECT c.name, c.code,
              COUNT(cr.id) as redemptions,
              COALESCE(SUM(cr.discount_amount), 0) as discount_given
       FROM campaigns c
       LEFT JOIN campaign_redemptions cr ON cr.campaign_id = c.id
       GROUP BY c.id, c.name, c.code
       ORDER BY redemptions DESC`
    );

    // Totals
    const [totalRevenue] = await db.execute(
      "SELECT COALESCE(SUM(amount),0) as total FROM hris_saas.payments WHERE status IN ('captured','completed')"
    );
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
    const [mrr] = await db.execute(
      `SELECT COALESCE(SUM(
         CASE WHEN sp.period = 'year' THEN sp.price_inr / 12.0
              WHEN sp.period = 'month' THEN sp.price_inr
              ELSE sp.price_inr / 12.0 END
       ), 0) as mrr
       FROM hris_saas.subscriptions s
       JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
       WHERE s.status IN ('active', 'trialing')`
    );

    return res.json({
      totalRevenue: Number(totalRevenue[0]?.total || 0),
      thisMonthRevenue: Number(thisMonth[0]?.total || 0),
      prevMonthRevenue: Number(prevMonth[0]?.total || 0),
      mrr: Number(mrr[0]?.mrr || 0),
      arr: Math.round(Number(mrr[0]?.mrr || 0) * 12),
      revenueByMonth: revenueByMonth || [],
      revenueByPlan: revenueByPlan || [],
      revenueByCycle: revenueByCycle || [],
      campaignRevenue: campaignRevenue || [],
    });
  } catch (err) {
    console.error('[Analytics] revenue error:', err);
    return res.status(500).json({ error: 'Failed to fetch revenue analytics.' });
  }
};

exports.getConversionAnalytics = async (req, res) => {
  try {
    const [trialStarted] = await db.execute("SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_started'");
    const [trialConverted] = await db.execute("SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_converted'");
    const [trialExpired] = await db.execute("SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_expired'");

    const [activeTrials] = await db.execute("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'trialing'");
    const [activePaid] = await db.execute("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'active' AND plan_id NOT IN ('free')");
    const [expiredTrials] = await db.execute(
      `SELECT COUNT(*) as c FROM subscriptions
       WHERE status IN ('expired','cancelled') AND trial_ends_at IS NOT NULL`
    );

    // Conversion funnel
    const [funnelEvents] = await db.execute(
      `SELECT event, COUNT(*) as count
       FROM conversion_events
       GROUP BY event ORDER BY event`
    );

    const funnelMap = { trial_started: 0, trial_converted: 0, trial_expired: 0 };
    funnelEvents.forEach(r => {
      if (funnelMap.hasOwnProperty(r.event)) funnelMap[r.event] = Number(r.count);
    });

    const conversionFunnel = [
      { stage: 'Trial Started', count: funnelMap.trial_started },
      { stage: 'Trial Converted', count: funnelMap.trial_converted },
      { stage: 'Trial Expired', count: funnelMap.trial_expired },
    ];

    // Conversion by source
    const [bySource] = await db.execute(
      `SELECT
         COALESCE(source, 'direct') as source,
         COUNT(*) as trials,
         SUM(CASE WHEN event = 'trial_converted' THEN 1 ELSE 0 END) as converted
       FROM conversion_events
       GROUP BY source
       ORDER BY trials DESC`
    );

    const conversionBySource = (bySource || []).map(r => ({
      source: r.source,
      trials: Number(r.trials),
      converted: Number(r.converted),
    }));

    // Conversion by target plan
    const [byPlan] = await db.execute(
      `SELECT
         COALESCE(metadata->>'planId', 'unknown') as plan_name,
         COUNT(*) as trials,
         SUM(CASE WHEN event = 'trial_converted' THEN 1 ELSE 0 END) as converted
       FROM conversion_events
       GROUP BY plan_name
       ORDER BY trials DESC`
    );

    const conversionByPlan = (byPlan || []).map(r => ({
      plan_name: r.plan_name,
      trials: Number(r.trials),
      converted: Number(r.converted),
      conversion_rate: Number(r.trials) > 0 ? Math.round((Number(r.converted) / Number(r.trials)) * 100) : 0,
    }));

    // Conversion by period (monthly)
    const [byPeriod] = await db.execute(
      `SELECT
         DATE_TRUNC('month', created_at) as period,
         COUNT(*) as trials,
         SUM(CASE WHEN event = 'trial_converted' THEN 1 ELSE 0 END) as converted
       FROM conversion_events
       WHERE created_at >= NOW() - INTERVAL '12 months'
       GROUP BY period
       ORDER BY period`
    );

    const conversionByPeriod = (byPeriod || []).map(r => ({
      period: r.period,
      trials: Number(r.trials),
      converted: Number(r.converted),
      rate: Number(r.trials) > 0 ? Math.round((Number(r.converted) / Number(r.trials)) * 100) : 0,
    }));

    const totalTrials = Number(trialStarted[0]?.c || 0);
    const converted = Number(trialConverted[0]?.c || 0);

    // Average days to convert (from trial_start to trial_converted)
    const [avgDays] = await db.execute(
      `SELECT COALESCE(AVG(
         EXTRACT(DAY FROM ce2.created_at - ce1.created_at)
       ), 0) as avg_days
       FROM conversion_events ce1
       JOIN conversion_events ce2
         ON ce1.tenant_id = ce2.tenant_id
         AND ce1.event = 'trial_started'
         AND ce2.event = 'trial_converted'
         AND ce2.created_at > ce1.created_at`
    );

    return res.json({
      totalTrials,
      convertedCount: converted,
      trialConversionRate: totalTrials > 0 ? Math.round((converted / totalTrials) * 100) : 0,
      avgDaysToConvert: Number(avgDays[0]?.avg_days || 0),
      conversionFunnel,
      conversionBySource,
      conversionByPlan,
      conversionByPeriod,
      retentionMetrics: {
        d30: 0,
        d60: 0,
        d90: 0,
        churnRate: 0,
      },
    });
  } catch (err) {
    console.error('[Analytics] conversion error:', err);
    return res.status(500).json({ error: 'Failed to fetch conversion analytics.' });
  }
};

exports.getPlanAdoption = async (req, res) => {
  try {
    // Tenant distribution by plan
    const [tenantsByPlan] = await db.execute(
      `SELECT subscription_plan, COUNT(*) as count
       FROM hris_saas.tenants
       GROUP BY subscription_plan
       ORDER BY count DESC`
    );

    // Active subscription distribution by plan
    const [subsByPlan] = await db.execute(
      `SELECT s.plan_id, sp.name as plan_name,
              COUNT(*) as total,
              COUNT(CASE WHEN s.status = 'active' THEN 1 END) as active,
              COUNT(CASE WHEN s.status = 'trialing' THEN 1 END) as trialing
       FROM hris_saas.subscriptions s
       JOIN hris_saas.subscription_plans sp ON s.plan_id = sp.id
       WHERE s.status IN ('active','trialing')
       GROUP BY s.plan_id, sp.name
       ORDER BY total DESC`
    );

    // Plan rank distribution
    const [planRankDist] = await db.execute(
      `SELECT
         CASE
           WHEN subscription_plan IN ('free','FREE') THEN 'Free'
           WHEN subscription_plan IN ('manage','MANAGE') THEN 'Manage'
           WHEN subscription_plan IN ('business','BUSINESS') THEN 'Business'
           WHEN subscription_plan IN ('business_pro','BUSINESS_PRO','pro') THEN 'Pro'
           ELSE subscription_plan
         END as tier,
         COUNT(*) as count
       FROM hris_saas.tenants
       GROUP BY tier
       ORDER BY count DESC`
    );

    // Plan switches by month
    const [planSwitches] = await db.execute(
      `SELECT
         DATE_TRUNC('month', created_at) as period,
         COUNT(CASE WHEN event_type = 'upgrade' THEN 1 END) as upgrades,
         COUNT(CASE WHEN event_type = 'downgrade' THEN 1 END) as downgrades
       FROM hris_saas.subscription_events
       WHERE event_type IN ('upgrade','downgrade')
         AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY period
       ORDER BY period`
    );

    // Upgrade paths
    const [upgradePaths] = await db.execute(
      `SELECT
         COALESCE(old_plan, 'unknown') as from_plan,
         COALESCE(new_plan, 'unknown') as to_plan,
         COUNT(*) as count
       FROM hris_saas.subscription_events
       WHERE event_type = 'upgrade'
         AND created_at >= NOW() - INTERVAL '12 months'
       GROUP BY from_plan, to_plan
       ORDER BY count DESC
       LIMIT 10`
    );

    const totalTenants = tenantsByPlan.reduce((sum, r) => sum + Number(r.count), 0);

    const [paidCount] = await db.execute(
      "SELECT COUNT(*) as c FROM hris_saas.subscriptions WHERE status = 'active'"
    );
    const [trialCount] = await db.execute(
      "SELECT COUNT(*) as c FROM hris_saas.subscriptions WHERE status = 'trialing'"
    );
    const [freeCount] = await db.execute(
      "SELECT COUNT(*) as c FROM hris_saas.tenants WHERE subscription_plan IN ('free','FREE')"
    );

    const planDistribution = tenantsByPlan.map(r => ({
      name: r.subscription_plan,
      count: Number(r.count),
      percentage: totalTenants > 0 ? Math.round((Number(r.count) / totalTenants) * 100) : 0,
    }));

    const upgradePath = upgradePaths.map(r => ({
      from_plan: r.from_plan,
      to_plan: r.to_plan,
      count: Number(r.count),
      percentage: planSwitches.reduce((s, r) => s + Number(r.upgrades), 0) > 0
        ? Math.round((Number(r.count) / planSwitches.reduce((s, r) => s + Number(r.upgrades), 0)) * 100)
        : 0,
    }));

    return res.json({
      totalTenants,
      activeTenants: totalTenants,
      paidTenants: Number(paidCount[0]?.c || 0),
      freeTrialTenants: Number(trialCount[0]?.c || 0) + Number(freeCount[0]?.c || 0),
      planDistribution,
      planSwitches: planSwitches || [],
      upgradePath,
    });
  } catch (err) {
    console.error('[Analytics] plan-adoption error:', err);
    return res.status(500).json({ error: 'Failed to fetch plan adoption.' });
  }
};

exports.getUsageAnalytics = async (req, res) => {
  try {
    const [moduleCounts] = await db.execute(
      `SELECT
         (SELECT COUNT(*) FROM hris_saas.customers) as total_customers,
         (SELECT COUNT(DISTINCT tenant_id) FROM hris_saas.customers) as customers_tenants,
         (SELECT COUNT(*) FROM hris_saas.suppliers) as total_suppliers,
         (SELECT COUNT(DISTINCT tenant_id) FROM hris_saas.suppliers) as suppliers_tenants,
         (SELECT COUNT(*) FROM hris_saas.invoices) as total_invoices,
         (SELECT COUNT(DISTINCT tenant_id) FROM hris_saas.invoices) as invoices_tenants,
         (SELECT COUNT(*) FROM hris_saas.purchase_orders) as total_pos,
         (SELECT COUNT(DISTINCT tenant_id) FROM hris_saas.purchase_orders) as pos_tenants,
         (SELECT COUNT(*) FROM hris_saas.employees) as total_employees,
         (SELECT COUNT(DISTINCT tenant_id) FROM hris_saas.employees) as employees_tenants,
         (SELECT COUNT(*) FROM hris_saas.attendance) as total_attendance,
         (SELECT COUNT(DISTINCT tenant_id) FROM hris_saas.attendance) as attendance_tenants,
         (SELECT COUNT(*) FROM hris_saas.leaves) as total_leaves,
         (SELECT COUNT(DISTINCT tenant_id) FROM hris_saas.leaves) as leaves_tenants
       `
    );

    const mc = moduleCounts[0] || {};

    const moduleUsage = [
      { module: 'Customers', count: Number(mc.total_customers || 0), tenants: Number(mc.customers_tenants || 0) },
      { module: 'Suppliers', count: Number(mc.total_suppliers || 0), tenants: Number(mc.suppliers_tenants || 0) },
      { module: 'Invoices', count: Number(mc.total_invoices || 0), tenants: Number(mc.invoices_tenants || 0) },
      { module: 'Purchase Orders', count: Number(mc.total_pos || 0), tenants: Number(mc.pos_tenants || 0) },
      { module: 'Employees', count: Number(mc.total_employees || 0), tenants: Number(mc.employees_tenants || 0) },
      { module: 'Attendance', count: Number(mc.total_attendance || 0), tenants: Number(mc.attendance_tenants || 0) },
      { module: 'Leaves', count: Number(mc.total_leaves || 0), tenants: Number(mc.leaves_tenants || 0) },
    ];

    // Top tenants by invoice count
    const [topByInvoices] = await db.execute(
      `SELECT t.id as tenant_id, t.company_name, t.subscription_plan as plan_id,
              (SELECT COUNT(*) FROM hris_saas.invoices i WHERE i.tenant_id = t.id) as api_calls,
              (SELECT COUNT(*) FROM hris_saas.employees e WHERE e.tenant_id = t.id) as active_users,
              0 as storage_bytes
       FROM hris_saas.tenants t
       ORDER BY api_calls DESC
       LIMIT 10`
    );

    const topTenants = topByInvoices.map(r => ({
      ...r,
      api_calls: Number(r.api_calls),
      active_users: Number(r.active_users),
      storage_bytes: 0,
      plan_name: r.plan_id,
    }));

    // Monthly usage trend
    const [monthlyUsage] = await db.execute(
      `SELECT usage_month,
              COALESCE(SUM(transaction_count), 0) as transactions,
              COALESCE(SUM(cashbook_entry_count), 0) as entries
       FROM hris_saas.tenant_usage
       WHERE usage_month >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')
       GROUP BY usage_month
       ORDER BY usage_month`
    );

    const usageTrend = monthlyUsage.map(r => ({
      period: r.usage_month,
      api_calls: Number(r.transactions) + Number(r.entries),
    }));

    const totalApiCalls = moduleUsage.reduce((s, m) => s + m.count, 0);
    const tenantCount = Math.max(...moduleUsage.map(m => m.tenants), 1);

    return res.json({
      moduleUsage,
      topTenants,
      usageTrend,
      avgApiCalls: Math.round(totalApiCalls / tenantCount),
      avgStorage: 0,
      totalApiCalls,
      totalStorage: 0,
      peakApiCalls: Math.max(...usageTrend.map(u => u.api_calls), 0),
      storageByModule: moduleUsage.map(m => ({
        module: m.module,
        bytes: 0,
        percentage: 0,
      })),
    });
  } catch (err) {
    console.error('[Analytics] usage error:', err);
    return res.status(500).json({ error: 'Failed to fetch usage analytics.' });
  }
};

exports.getExpiringTrials = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 14;

    const [rows] = await db.execute(
      `SELECT t.id, t.company_name, t.subdomain, t.subscription_plan,
              e.email as owner_email, e.phone as owner_phone,
              s.id as sub_id, s.trial_ends_at, s.created_at as trial_started_at,
              EXTRACT(DAY FROM s.trial_ends_at - NOW()) as days_remaining,
              (SELECT COUNT(*) FROM hris_saas.customers c WHERE c.tenant_id = t.id) as customer_count,
              (SELECT COUNT(*) FROM hris_saas.invoices i WHERE i.tenant_id = t.id) as invoice_count,
              (SELECT COUNT(*) FROM hris_saas.employees e WHERE e.tenant_id = t.id) as employee_count,
              (SELECT COUNT(*) FROM hris_saas.payments p WHERE p.tenant_id = t.id AND p.status IN ('captured','completed')) as payment_count
       FROM hris_saas.tenants t
       JOIN hris_saas.subscriptions s ON s.tenant_id = t.id AND s.status = 'trialing'
       LEFT JOIN hris_saas.employees e ON e.tenant_id = t.id AND e.role = 'tenant_admin'
       WHERE s.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '${days} days'
       ORDER BY s.trial_ends_at ASC`
    );

    return res.json({
      total: rows.length,
      days,
      trials: rows.map(r => ({
        ...r,
        days_remaining: Math.ceil(Number(r.days_remaining) || 0),
        customer_count: Number(r.customer_count || 0),
        invoice_count: Number(r.invoice_count || 0),
        employee_count: Number(r.employee_count || 0),
        payment_count: Number(r.payment_count || 0),
      })),
    });
  } catch (err) {
    console.error('[Analytics] expiring-trials error:', err);
    return res.status(500).json({ error: 'Failed to fetch expiring trials.' });
  }
};
