const db = require('../config/db');
const saService = require('../services/superAdmin.service');

exports.getReferralSummary = async (req, res) => {
  try {
    const [totalRef] = await db.execute('SELECT COUNT(*) as c FROM referral_redemptions');
    const [pendingRef] = await db.execute("SELECT COUNT(*) as c FROM referral_redemptions WHERE status = 'pending'");
    const [creditedRef] = await db.execute("SELECT COUNT(*) as c FROM referral_redemptions WHERE status = 'credited'");
    const [convertedRef] = await db.execute('SELECT COUNT(*) as c FROM referral_redemptions WHERE converted = true');
    const [totalRevenue] = await db.execute('SELECT COALESCE(SUM(revenue_generated), 0) as total FROM referral_redemptions WHERE converted = true');
    const [monthlyConversion] = await db.execute(
      `SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as referrals,
              SUM(CASE WHEN converted THEN 1 ELSE 0 END) as converted
       FROM referral_redemptions
       WHERE created_at >= NOW() - INTERVAL '12 months'
       GROUP BY month ORDER BY month`
    );
    const [topReferrers] = await db.execute(
      `SELECT rr.referrer_id, t.company_name, t.subscription_plan,
              COUNT(*) as total, SUM(CASE WHEN rr.converted THEN 1 ELSE 0 END) as converted,
              COALESCE(SUM(rr.revenue_generated), 0) as revenue
       FROM referral_redemptions rr
       JOIN hris_saas.tenants t ON rr.referrer_id = t.id
       GROUP BY rr.referrer_id, t.company_name, t.subscription_plan
       ORDER BY total DESC LIMIT 20`
    );

    const total = Number(totalRef[0]?.c || 0);

    return res.json({
      total,
      pending: Number(pendingRef[0]?.c || 0),
      credited: Number(creditedRef[0]?.c || 0),
      converted: Number(convertedRef[0]?.c || 0),
      conversionRate: total > 0 ? Math.round((Number(convertedRef[0]?.c || 0) / total) * 100) : 0,
      totalRevenue: Number(totalRevenue[0]?.total || 0),
      monthlyConversion,
      topReferrers,
    });
  } catch (err) {
    console.error('[Referral] summary error:', err);
    return res.status(500).json({ error: 'Failed to fetch referral summary.' });
  }
};

exports.listReferrals = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const search = req.query.search;

    let sql = `SELECT rr.*, rt.company_name as referrer_name, rt.subdomain as referrer_subdomain,
                      rd.company_name as referred_name, rd.subdomain as referred_subdomain
               FROM referral_redemptions rr
               LEFT JOIN hris_saas.tenants rt ON rr.referrer_id = rt.id
               LEFT JOIN hris_saas.tenants rd ON rr.referred_id = rd.id`;
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('rr.status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(rt.company_name ILIKE ? OR rd.company_name ILIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY rr.created_at DESC LIMIT ? OFFSET ?';
    params.push(String(limit), String(offset));

    const [rows] = await db.execute(sql, params);

    let countSql = 'SELECT COUNT(*) as count FROM referral_redemptions rr';
    let countParams = [];
    if (conditions.length > 0) {
      const c = conditions.map(c => c.replace(/rt\./g, 'rt.').replace(/rd\./g, 'rd.'));
      countSql += ' LEFT JOIN hris_saas.tenants rt ON rr.referrer_id = rt.id LEFT JOIN hris_saas.tenants rd ON rr.referred_id = rd.id';
      countSql += ' WHERE ' + conditions.join(' AND ');
      countParams = params.slice(0, -2);
    }
    const [countRes] = await db.execute(countSql, countParams);

    const total = Number(countRes[0]?.count || 0);
    return res.json({ referrals: rows, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[Referral] list error:', err);
    return res.status(500).json({ error: 'Failed to list referrals.' });
  }
};

exports.updateReferralStatus = async (req, res) => {
  try {
    const { status, revenueGenerated, converted } = req.body;
    const valid = ['pending', 'credited', 'expired'];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    }

    const [existing] = await db.execute('SELECT * FROM referral_redemptions WHERE id = ?', [req.params.referralId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Referral not found.' });

    const sets = ['status = ?'];
    const params = [status];

    if (status === 'credited') {
      sets.push('credited_at = NOW()');
    }
    if (revenueGenerated !== undefined) {
      sets.push('revenue_generated = ?');
      params.push(revenueGenerated);
    }
    if (converted !== undefined) {
      sets.push('converted = ?');
      params.push(converted);
      if (converted) sets.push('converted_at = NOW()');
    }

    params.push(req.params.referralId);
    await db.execute(`UPDATE referral_redemptions SET ${sets.join(', ')} WHERE id = ?`, params);

    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'referral.updated', entityType: 'referral', entityId: req.params.referralId,
      details: { status, revenueGenerated, converted }, req,
    });

    return res.json({ message: 'Referral updated.' });
  } catch (err) {
    console.error('[Referral] update error:', err);
    return res.status(500).json({ error: 'Failed to update referral.' });
  }
};
