const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { sendEmail, trialWarningHtml, referralHtml } = require('../utils/email');
const { getSubscriptionStatus } = require('../utils/subscription');

// =============================================
// REFERRAL: Get or create referral code
// =============================================
exports.getOrCreateReferralCode = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT code FROM referral_codes WHERE tenant_id = ?', [req.tenantId]
    );

    if (rows.length > 0) {
      return res.json({ code: rows[0].code });
    }

    // Generate a unique 8-char code
    const code = generateReferralCode();
    const id = uuidv4();
    await db.execute(
      'INSERT INTO referral_codes (id, tenant_id, code) VALUES (?, ?, ?)',
      [id, req.tenantId, code]
    );

    res.json({ code });
  } catch (error) {
    console.error('getOrCreateReferralCode error:', error);
    res.status(500).json({ error: 'Failed to get referral code.' });
  }
};

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// =============================================
// REFERRAL: Redeem a referral code (on signup)
// =============================================
exports.redeemReferral = async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Referral code required.' });

  try {
    const [rows] = await db.execute(
      'SELECT id, tenant_id FROM referral_codes WHERE code = ?', [code]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid referral code.' });
    }

    // Cannot refer yourself
    if (rows[0].tenant_id === req.tenantId) {
      return res.status(400).json({ error: 'Cannot use your own referral code.' });
    }

    // Check if already referred
    const [existing] = await db.execute(
      'SELECT id FROM referral_redemptions WHERE referred_id = ?',
      [req.tenantId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Referral already redeemed.' });
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO referral_redemptions (id, referrer_id, referred_id, reward_months, status)
       VALUES (?, ?, ?, 1, 'pending')`,
      [id, rows[0].tenant_id, req.tenantId]
    );

    // Log analytics event
    await logConversionEvent({
      tenantId: req.tenantId,
      event: 'subscribed',
      planTo: req.body.plan || 'free',
      source: 'referral',
      metadata: { referrerId: rows[0].tenant_id },
    });

    res.json({ message: 'Referral applied! You both get 1 month free on next upgrade.' });
  } catch (error) {
    console.error('redeemReferral error:', error);
    res.status(500).json({ error: 'Failed to redeem referral.' });
  }
};

// =============================================
// REFERRAL: Stats (how many referred, rewards)
// =============================================
exports.getReferralStats = async (req, res) => {
  try {
    const [redeemed] = await db.execute(
      `SELECT COUNT(*) as total FROM referral_redemptions
       WHERE referrer_id = ? AND status = 'credited'`,
      [req.tenantId]
    );
    const [pending] = await db.execute(
      `SELECT COUNT(*) as total FROM referral_redemptions
       WHERE referrer_id = ? AND status = 'pending'`,
      [req.tenantId]
    );

    res.json({
      totalCredited: Number(redeemed[0]?.total || 0),
      totalPending: Number(pending[0]?.total || 0),
    });
  } catch (error) {
    console.error('getReferralStats error:', error);
    res.status(500).json({ error: 'Failed to get referral stats.' });
  }
};

// =============================================
// CAMPAIGN: List active campaigns
// =============================================
exports.getActiveCampaigns = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT id, name, description, discount_pct, discount_months, code,
              applies_to, max_redemptions, redemptions, ends_at
       FROM campaigns
       WHERE is_active = true AND starts_at <= NOW() AND ends_at > NOW()
         AND (max_redemptions = 0 OR redemptions < max_redemptions)
       ORDER BY ends_at ASC`
    );
    res.json({ campaigns: rows });
  } catch (error) {
    console.error('getActiveCampaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns.' });
  }
};

// =============================================
// CAMPAIGN: Validate & apply a promo code
// =============================================
exports.applyPromoCode = async (req, res) => {
  const { code, planId } = req.body;
  if (!code) return res.status(400).json({ error: 'Promo code required.' });

  try {
    const [rows] = await db.execute(
      `SELECT id, name, discount_pct, discount_months, applies_to, max_redemptions, redemptions, ends_at
       FROM campaigns
       WHERE code = ? AND is_active = true AND starts_at <= NOW() AND ends_at > NOW()
         AND (max_redemptions = 0 OR redemptions < max_redemptions)`,
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired promo code.' });
    }

    const campaign = rows[0];

    // Check if tenant already used this campaign
    const [used] = await db.execute(
      'SELECT id FROM campaign_redemptions WHERE campaign_id = ? AND tenant_id = ?',
      [campaign.id, req.tenantId]
    );
    if (used.length > 0) {
      return res.status(400).json({ error: 'Promo code already used by your account.' });
    }

    // Check applies_to
    if (campaign.applies_to === 'new') {
      // Check if tenant has any paid plan history
      const [paidHistory] = await db.execute(
        `SELECT id FROM payments WHERE tenant_id = ? AND status = 'captured'`,
        [req.tenantId]
      );
      if (paidHistory.length > 0) {
        return res.status(400).json({ error: 'This promo is for new customers only.' });
      }
    }

    res.json({
      campaignId: campaign.id,
      name: campaign.name,
      discountPct: campaign.discount_pct,
      discountMonths: campaign.discount_months,
    });
  } catch (error) {
    console.error('applyPromoCode error:', error);
    res.status(500).json({ error: 'Failed to validate promo code.' });
  }
};

// =============================================
// CAMPAIGN: Mark promo code as redeemed (after payment)
// =============================================
exports.redeemPromoCode = async (req, res) => {
  const { campaignId } = req.body;
  if (!campaignId) return res.status(400).json({ error: 'Campaign ID required.' });

  try {
    const [used] = await db.execute(
      'SELECT id FROM campaign_redemptions WHERE campaign_id = ? AND tenant_id = ?',
      [campaignId, req.tenantId]
    );
    if (used.length > 0) {
      return res.status(400).json({ error: 'Already redeemed.' });
    }

    const id = uuidv4();
    await db.execute(
      'INSERT INTO campaign_redemptions (id, campaign_id, tenant_id) VALUES (?, ?, ?)',
      [id, campaignId, req.tenantId]
    );

    await db.execute(
      'UPDATE campaigns SET redemptions = redemptions + 1 WHERE id = ?',
      [campaignId]
    );

    res.json({ message: 'Promo applied successfully.' });
  } catch (error) {
    console.error('redeemPromoCode error:', error);
    res.status(500).json({ error: 'Failed to apply promo.' });
  }
};

// =============================================
// ANALYTICS: Log a conversion event
// =============================================
exports.logEvent = async (req, res) => {
  const { event, planFrom, planTo, source, metadata } = req.body;
  if (!event) return res.status(400).json({ error: 'Event name required.' });

  try {
    await logConversionEvent({
      tenantId: req.tenantId,
      event,
      planFrom,
      planTo,
      source,
      metadata,
    });
    res.json({ message: 'Event logged.' });
  } catch (error) {
    console.error('logEvent error:', error);
    res.status(500).json({ error: 'Failed to log event.' });
  }
};

// =============================================
// ANALYTICS: Dashboard (for super admin)
// =============================================
exports.getAnalytics = async (req, res) => {
  try {
    // Trial → paid conversion rate
    const [trialStarted] = await db.execute(
      `SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_started'`
    );
    const [trialConverted] = await db.execute(
      `SELECT COUNT(*) as c FROM conversion_events WHERE event = 'trial_converted'`
    );

    const started = Number(trialStarted[0]?.c || 0);
    const converted = Number(trialConverted[0]?.c || 0);
    const conversionRate = started > 0 ? Math.round((converted / started) * 100) : 0;

    // Revenue by month (from payments)
    const [revenueByMonth] = await db.execute(
      `SELECT DATE_TRUNC('month', created_at) as month, SUM(amount) as revenue
       FROM payments WHERE status = 'captured'
       GROUP BY month ORDER BY month DESC LIMIT 12`
    );

    // Referral stats
    const [referralCount] = await db.execute(
      'SELECT COUNT(*) as c FROM referral_redemptions'
    );

    // Campaign performance
    const [campaigns] = await db.execute(
      `SELECT c.name, c.code, c.redemptions, c.max_redemptions, c.ends_at
       FROM campaigns c WHERE c.is_active = true
       ORDER BY c.redemptions DESC`
    );

    // Churn rate (downgraded/cancelled vs active)
    const [totalSubs] = await db.execute(
      "SELECT COUNT(*) as c FROM subscriptions WHERE status IN ('active','trialing')"
    );
    const [churnedSubs] = await db.execute(
      "SELECT COUNT(*) as c FROM subscriptions WHERE status IN ('cancelled','expired')"
    );

    res.json({
      conversionRate,
      trialStarted: started,
      trialConverted: converted,
      totalReferrals: Number(referralCount[0]?.c || 0),
      revenueByMonth: revenueByMonth || [],
      campaigns,
      churnRate: totalSubs[0]?.c > 0
        ? Math.round((churnedSubs[0]?.c / (totalSubs[0]?.c + churnedSubs[0]?.c)) * 100)
        : 0,
    });
  } catch (error) {
    console.error('getAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics.' });
  }
};

// =============================================
// ONBOARDING STATUS — check setup progress
// =============================================
exports.getOnboardingStatus = async (req, res) => {
  try {
    const [tenant] = await db.execute(
      'SELECT company_name, onboarding_dismissed FROM tenants WHERE id = ?', [req.tenantId]
    );
    const [empRows] = await db.execute(
      'SELECT first_name, last_name FROM employees WHERE id = ? AND tenant_id = ?',
      [req.user.id, req.tenantId]
    );

    const companyName = tenant[0]?.company_name || '';
    const emp = empRows[0] || {};
    const onboardingDismissed = tenant[0]?.onboarding_dismissed ?? false;
    const hasCompanyName = !!companyName;
    const hasFirstName = !!emp.first_name;
    const hasLastName = !!emp.last_name;

    const steps = [
      { key: 'profile', label: 'Complete your profile', done: hasFirstName && hasLastName && hasCompanyName },
    ];

    const completedCount = steps.filter(s => s.done).length;
    const totalSteps = steps.length;
    const percent = Math.round((completedCount / totalSteps) * 100);
    const allDone = completedCount === totalSteps;

    res.json({
      percent,
      completedCount,
      totalSteps,
      allDone: allDone || onboardingDismissed,
      onboardingDismissed,
      steps,
      companyName,
    });
  } catch (error) {
    console.error('getOnboardingStatus error:', error);
    res.status(500).json({ error: 'Failed to check onboarding status.' });
  }
};

// =============================================
// ONBOARDING — complete (dismiss wizard permanently)
// =============================================
exports.completeOnboarding = async (req, res) => {
  try {
    await db.execute(
      'UPDATE hris_saas.tenants SET onboarding_dismissed = true WHERE id = ?',
      [req.tenantId]
    );
    res.json({ message: 'Onboarding dismissed.' });
  } catch (error) {
    console.error('completeOnboarding error:', error);
    res.status(500).json({ error: 'Failed to dismiss onboarding.' });
  }
};

// =============================================
// Helper: log conversion event
// =============================================
async function logConversionEvent({ tenantId, event, planFrom, planTo, source, metadata }) {
  const id = uuidv4();
  await db.execute(
    `INSERT INTO conversion_events (id, tenant_id, event, plan_from, plan_to, source, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, tenantId, event, planFrom || null, planTo || null, source || 'direct', metadata ? JSON.stringify(metadata) : null]
  );
}

// =============================================
// Notify tenant about upcoming trial expiry
// =============================================
exports.sendTrialExpiryNotifications = async (req, res) => {
  try {
    const results = await notifyExpiringTrials();
    res.json(results);
  } catch (error) {
    console.error('sendTrialExpiryNotifications error:', error);
    res.status(500).json({ error: 'Failed to send notifications.' });
  }
};

async function notifyExpiringTrials() {
  const now = new Date();
  const results = { notified: 0, errors: 0, skipped: 0 };

  // Find admins of tenants whose trial ends in 7, 3, or 1 days
  const [expiring] = await db.execute(
    `SELECT s.tenant_id, s.plan_id, s.trial_ends_at, p.name as plan_name,
            t.company_name, e.email as admin_email, e.first_name
     FROM subscriptions s
     JOIN subscription_plans p ON s.plan_id = p.id
     JOIN tenants t ON s.tenant_id = t.id
     JOIN employees e ON e.tenant_id = t.id AND e.role = 'tenant_admin'
     WHERE s.status = 'trialing'
       AND s.trial_ends_at BETWEEN ? AND ?
       AND s.trial_ends_at > NOW()`,
    [new Date(now.getTime() + 1 * 86400000), new Date(now.getTime() + 7 * 86400000)]
  );

  const emailLog = {};

  for (const row of expiring) {
    const daysLeft = Math.ceil((new Date(row.trial_ends_at) - now) / 86400000);
    // Only notify at 7, 3, 1 intervals
    if (![7, 3, 1].includes(daysLeft)) {
      results.skipped++;
      continue;
    }
    // Don't re-notify within 24 hours
    if (emailLog[row.tenant_id] && emailLog[row.tenant_id] === daysLeft) {
      results.skipped++;
      continue;
    }
    emailLog[row.tenant_id] = daysLeft;

    const html = trialWarningHtml({
      companyName: row.company_name,
      daysLeft,
      planName: row.plan_name,
    });

    const { sent } = await sendEmail({
      to: row.admin_email,
      subject: `Your ${row.plan_name} trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      html,
    });

    if (sent) results.notified++;
    else results.errors++;
  }

  return results;
}

module.exports = {
  getOrCreateReferralCode: exports.getOrCreateReferralCode,
  redeemReferral: exports.redeemReferral,
  getReferralStats: exports.getReferralStats,
  getActiveCampaigns: exports.getActiveCampaigns,
  applyPromoCode: exports.applyPromoCode,
  redeemPromoCode: exports.redeemPromoCode,
  logEvent: exports.logEvent,
  getAnalytics: exports.getAnalytics,
  sendTrialExpiryNotifications: exports.sendTrialExpiryNotifications,
  notifyExpiringTrials,
  logConversionEvent,
  getOnboardingStatus: exports.getOnboardingStatus,
  completeOnboarding: exports.completeOnboarding,
};
