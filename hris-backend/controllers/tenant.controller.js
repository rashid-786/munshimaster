const db = require('../config/db');
const { log } = require('../utils/audit');

exports.getTenantSettings = async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const [rows] = await db.execute('SELECT company_name, subscription_plan, settings FROM tenants WHERE id = ?', [tenantId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Tenant context target not found.' });

    const tenant = rows[0];
    const settings = typeof tenant.settings === 'string' ? JSON.parse(tenant.settings) : tenant.settings;

    res.json({ companyName: tenant.company_name, subscriptionPlan: tenant.subscription_plan || 'free', settings: settings || { primaryColor: '#0052cc', weekendDays: [0], taxRate: 18 } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to extract organization identity frames.' });
  }
};

exports.updateTenantSettings = async (req, res) => {
  const tenantId = req.tenantId;
  const { companyName, settings } = req.body; // settings structure target: { primaryColor: '#XXXXXX' }

  try {
    const existingSettings = settings ? JSON.stringify(settings) : undefined;
    if (existingSettings) {
      await db.execute(
        'UPDATE tenants SET company_name = COALESCE(?, company_name), settings = ? WHERE id = ?',
        [companyName, existingSettings, tenantId]
      );
    } else {
      await db.execute(
        'UPDATE tenants SET company_name = COALESCE(?, company_name) WHERE id = ?',
        [companyName, tenantId]
      );
    }
    await log({ tenantId, actorId: req.user.id, actorName: req.user.name, action: 'settings.updated', entityType: 'settings', entityId: tenantId, changes: { companyName, settings }, req });
    res.json({ message: 'Workspace personalization properties updated successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rewrite system runtime properties configuration.' });
  }
};
