const db = require('../config/db');

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

  if (req.user.role !== 'tenant_admin') {
    return res.status(403).json({ error: 'Administrative clearance access required.' });
  }

  try {
    const settingsString = JSON.stringify(settings);
    await db.execute(
      'UPDATE tenants SET company_name = ?, settings = ? WHERE id = ?',
      [companyName, settingsString, tenantId]
    );
    res.json({ message: 'Workspace personalization properties updated successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rewrite system runtime properties configuration.' });
  }
};
