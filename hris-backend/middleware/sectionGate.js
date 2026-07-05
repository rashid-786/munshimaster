const { canTenantPerformAction } = require('../utils/sectionAccess');

/**
 * Section Gate Middleware
 *
 * Protects routes by checking if the tenant can perform an action
 * on a given section. Use after authenticate middleware so req.tenantId
 * is available.
 *
 * Usage:
 *   router.get('/buyers', sectionGate('buyers', 'view'), buyerController.list);
 *   router.post('/buyers', sectionGate('buyers', 'create'), buyerController.create);
 */
function sectionGate(sectionKey, action = 'view') {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenant?.id || req.tenantId;
      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not identified.' });
      }

      const allowed = await canTenantPerformAction(tenantId, sectionKey, action);
      if (!allowed) {
        const messages = {
          view: 'This section is not accessible for your account.',
          create: 'This section is read-only. Creation is not allowed.',
          edit: 'This section is read-only. Editing is not allowed.',
          delete: 'This section is read-only. Deletion is not allowed.',
        };
        return res.status(403).json({
          error: messages[action] || 'Action not allowed on this section.',
          sectionKey,
          action,
        });
      }

      next();
    } catch (err) {
      console.error('[SectionGate] Error:', err.message);
      return res.status(500).json({ error: 'Access check failed.' });
    }
  };
}

module.exports = { sectionGate };
