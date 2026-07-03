const db = require('../config/db');

async function attachTenant(req, res, next) {
  const tenantId = req.tenantId;
  if (!tenantId) {
    return res.status(400).json({ error: 'Tenant context missing.' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT id, subscription_plan, subscription_status, status FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found.' });
    }

    const tenant = rows[0];

    if (tenant.status === 'inactive') {
      return res.status(403).json({ error: 'Tenant account is inactive.' });
    }

    if (tenant.subscription_status === 'expired' || tenant.subscription_status === 'past_due' || tenant.subscription_status === 'grace_period') {
      return res.status(403).json({
        error: 'Subscription expired.',
        message: 'Your subscription has expired. Please renew to continue using the service.',
        subscription_status: tenant.subscription_status,
      });
    }

    if (tenant.subscription_status === 'cancelled') {
      return res.status(403).json({
        error: 'Subscription cancelled.',
        message: 'Your subscription has been cancelled. Please contact support to reactivate.',
        subscription_status: tenant.subscription_status,
      });
    }

    if (tenant.subscription_status === 'suspended') {
      return res.status(403).json({
        error: 'Subscription suspended.',
        message: 'Your subscription has been suspended due to payment issues. Please contact support to reactivate.',
        subscription_status: tenant.subscription_status,
      });
    }

    req.tenant = {
      id: tenant.id,
      subscription_plan: tenant.subscription_plan || 'FREE',
      status: tenant.subscription_status,
    };

    next();
  } catch (error) {
    console.error('Attach tenant error:', error);
    res.status(500).json({ error: 'Failed to load tenant context.' });
  }
}

module.exports = { attachTenant };
