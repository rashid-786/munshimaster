const jwt = require('jsonwebtoken');
const saService = require('../services/superAdmin.service');

const authenticateSuperAdmin = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token missing' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });

    if (user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Unauthorized: Super admin access required.' });
    }

    req.user = user;
    req.superAdmin = user; // backward compat for controllers using req.superAdmin
    next();
  });
};

/**
 * Middleware to log all super admin write operations automatically.
 * Must be used AFTER authenticateSuperAdmin.
 * Supports enhanced fields: oldValue, newValue, reason extracted from body/params.
 */
const auditSuperAdminAction = (actionType, entityType) => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      if (res.statusCode >= 200 && res.statusCode < 300 && !body?.error) {
        const tenantId = req.params?.id || req.params?.tenantId || req.body?.tenantId || null;
        const entityId = req.params?.id || req.params?.tenantId || req.params?.featureKey
          || req.params?.campaignId || req.params?.planId || req.params?.overrideId
          || req.params?.sectionKey || req.params?.referralId || null;

        const details = {
          method: req.method,
          path: req.originalUrl,
          body: sanitizeBody(req.body),
          responseSummary: body?.message || null,
        };

        saService.logAction({
          adminId: req.user?.id,
          adminName: req.user?.name || 'Super Admin',
          actorRole: 'super_admin',
          action: actionType,
          entityType: entityType,
          entityId: entityId,
          tenantId: tenantId,
          oldValue: req.body?.oldValue || req.body?.old_value || undefined,
          newValue: req.body?.newValue || req.body?.new_value || undefined,
          reason: req.body?.reason || undefined,
          details,
          req,
        }).catch(err => console.error('[AuditMiddleware] Log error:', err));
      }

      return originalJson(body);
    };

    next();
  };
};

function sanitizeBody(body) {
  if (!body) return {};
  const sanitized = { ...body };
  delete sanitized.password;
  delete sanitized.current_password;
  delete sanitized.new_password;
  delete sanitized.confirm;
  delete sanitized.password_hash;
  delete sanitized.oldValue;
  delete sanitized.old_value;
  delete sanitized.newValue;
  delete sanitized.new_value;
  return sanitized;
}

module.exports = { authenticateSuperAdmin, auditSuperAdminAction };
