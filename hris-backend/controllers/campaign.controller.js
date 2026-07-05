const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const saService = require('../services/superAdmin.service');

exports.listCampaigns = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let sql = `SELECT c.*,
                      (SELECT COUNT(*) FROM campaign_redemptions cr WHERE cr.campaign_id = c.id) as total_redemptions,
                      (SELECT COUNT(DISTINCT cr.tenant_id) FROM campaign_redemptions cr WHERE cr.campaign_id = c.id) as unique_tenants
               FROM campaigns c`;
    const params = [];

    if (status) {
      sql += ' WHERE c.status = ?';
      params.push(status);
    }

    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(String(limit), String(offset));

    const [rows] = await db.execute(sql, params);
    const [countRes] = await db.execute('SELECT COUNT(*) as count FROM campaigns', []);
    const total = Number(countRes[0]?.count || 0);

    return res.json({ campaigns: rows, total, page: Number(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[Campaign] list error:', err);
    return res.status(500).json({ error: 'Failed to list campaigns.' });
  }
};

exports.getCampaign = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT c.*,
              (SELECT json_agg(json_build_object('tenant_id', cr.tenant_id, 'applied_at', cr.applied_at, 'discount_amount', cr.discount_amount))
               FROM campaign_redemptions cr WHERE cr.campaign_id = c.id) as redemptions_detail
       FROM campaigns c WHERE c.id = ?`,
      [req.params.campaignId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Campaign not found.' });
    return res.json({ campaign: rows[0] });
  } catch (err) {
    console.error('[Campaign] get error:', err);
    return res.status(500).json({ error: 'Failed to get campaign.' });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const { name, code, description, discountType, discountValue, applicablePlanIds, startDate, endDate, status } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: 'name, startDate, and endDate are required.' });
    }

    if (code) {
      const [dup] = await db.execute('SELECT id FROM campaigns WHERE LOWER(code) = ?', [code.toLowerCase()]);
      if (dup.length > 0) return res.status(400).json({ error: 'Campaign code already exists.' });
    }

    const id = uuidv4();
    await db.execute(
      `INSERT INTO campaigns (id, name, code, description, discount_type, discount_value, applicable_plan_ids, starts_at, ends_at, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id, name, code || null, description || null,
        discountType || 'percentage', discountValue || null,
        applicablePlanIds ? JSON.stringify(applicablePlanIds) : '[]',
        startDate, endDate, status || 'active',
      ]
    );

    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'campaign.created', entityType: 'campaign', entityId: id,
      details: { name, code, discountType, discountValue, startDate, endDate },
      req,
    });

    const [campaign] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [id]);
    return res.status(201).json({ campaign: campaign[0] });
  } catch (err) {
    console.error('[Campaign] create error:', err);
    return res.status(500).json({ error: 'Failed to create campaign.' });
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const { name, code, description, discountType, discountValue, applicablePlanIds, startDate, endDate } = req.body;
    const [existing] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.campaignId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Campaign not found.' });

    if (code) {
      const [dup] = await db.execute(
        'SELECT id FROM campaigns WHERE LOWER(code) = ? AND id != ?',
        [code.toLowerCase(), req.params.campaignId]
      );
      if (dup.length > 0) return res.status(400).json({ error: 'Campaign code already exists.' });
    }

    const sets = [];
    const params = [];

    if (name !== undefined) { sets.push('name = ?'); params.push(name); }
    if (code !== undefined) { sets.push('code = ?'); params.push(code); }
    if (description !== undefined) { sets.push('description = ?'); params.push(description); }
    if (discountType !== undefined) { sets.push('discount_type = ?'); params.push(discountType); }
    if (discountValue !== undefined) { sets.push('discount_value = ?'); params.push(discountValue); }
    if (applicablePlanIds !== undefined) { sets.push('applicable_plan_ids = ?'); params.push(JSON.stringify(applicablePlanIds)); }
    if (startDate !== undefined) { sets.push('starts_at = ?'); params.push(startDate); }
    if (endDate !== undefined) { sets.push('ends_at = ?'); params.push(endDate); }
    sets.push('updated_at = NOW()');
    params.push(req.params.campaignId);

    await db.execute(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`, params);

    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'campaign.updated', entityType: 'campaign', entityId: req.params.campaignId,
      details: req.body, req,
    });

    const [campaign] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.campaignId]);
    return res.json({ campaign: campaign[0] });
  } catch (err) {
    console.error('[Campaign] update error:', err);
    return res.status(500).json({ error: 'Failed to update campaign.' });
  }
};

exports.toggleCampaignStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['active', 'inactive', 'expired'];
    if (!status || !valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(', ')}` });
    }

    const [existing] = await db.execute('SELECT * FROM campaigns WHERE id = ?', [req.params.campaignId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Campaign not found.' });

    await db.execute('UPDATE campaigns SET status = ?, updated_at = NOW() WHERE id = ?', [status, req.params.campaignId]);

    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'campaign.status_changed', entityType: 'campaign', entityId: req.params.campaignId,
      details: { from: existing[0].status, to: status }, req,
    });

    return res.json({ message: `Campaign ${status}.`, id: req.params.campaignId, status });
  } catch (err) {
    console.error('[Campaign] status toggle error:', err);
    return res.status(500).json({ error: 'Failed to update campaign status.' });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const [existing] = await db.execute('SELECT id FROM campaigns WHERE id = ?', [req.params.campaignId]);
    if (existing.length === 0) return res.status(404).json({ error: 'Campaign not found.' });

    await db.execute('DELETE FROM campaign_redemptions WHERE campaign_id = ?', [req.params.campaignId]);
    await db.execute('DELETE FROM campaigns WHERE id = ?', [req.params.campaignId]);

    await saService.logAction({
      adminId: req.user?.id, adminName: req.user?.name,
      action: 'campaign.deleted', entityType: 'campaign', entityId: req.params.campaignId,
      details: {}, req,
    });

    return res.json({ message: 'Campaign deleted.' });
  } catch (err) {
    console.error('[Campaign] delete error:', err);
    return res.status(500).json({ error: 'Failed to delete campaign.' });
  }
};

exports.getCampaignAnalytics = async (req, res) => {
  try {
    const [activeCount] = await db.execute("SELECT COUNT(*) as c FROM campaigns WHERE status = 'active' AND starts_at <= NOW() AND ends_at > NOW()");
    const [totalCount] = await db.execute('SELECT COUNT(*) as c FROM campaigns');
    const [totalRedemptions] = await db.execute('SELECT COUNT(*) as c FROM campaign_redemptions');
    const [redemptionsByCampaign] = await db.execute(
      `SELECT c.name, c.code, COUNT(cr.id) as redemptions, COALESCE(SUM(cr.discount_amount), 0) as revenue_impact
       FROM campaigns c LEFT JOIN campaign_redemptions cr ON cr.campaign_id = c.id
       GROUP BY c.id, c.name, c.code ORDER BY redemptions DESC`
    );

    return res.json({
      activeCampaigns: Number(activeCount[0]?.c || 0),
      totalCampaigns: Number(totalCount[0]?.c || 0),
      totalRedemptions: Number(totalRedemptions[0]?.c || 0),
      redemptionsByCampaign,
    });
  } catch (err) {
    console.error('[Campaign] analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch campaign analytics.' });
  }
};
