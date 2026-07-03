const express = require('express');
const router = express.Router();
const superController = require('../controllers/super.controller');
const { authenticateSuperAdmin } = require('../middleware/superAdmin');

router.post('/auth/seed', superController.seedSuperAdmin);
router.post('/auth/login', superController.loginSuperAdmin);

router.get('/dashboard', authenticateSuperAdmin, superController.getDashboard);

router.post('/tenants', authenticateSuperAdmin, superController.createTenant);
router.get('/tenants', authenticateSuperAdmin, superController.getTenants);
router.get('/tenants/:id', authenticateSuperAdmin, superController.getTenantDetail);
router.put('/tenants/:id', authenticateSuperAdmin, superController.updateTenant);
router.put('/tenants/:id/admin', authenticateSuperAdmin, superController.updateTenantAdmin);
router.delete('/tenants/:id', authenticateSuperAdmin, superController.deleteTenant);

router.get('/employees', authenticateSuperAdmin, superController.getAllEmployees);
router.put('/employees/:id', authenticateSuperAdmin, superController.updateSuperEmployee);

router.get('/tenants/:id/calendar', authenticateSuperAdmin, superController.getTenantCalendar);
router.get('/tenants/:id/payroll', authenticateSuperAdmin, superController.getTenantPayroll);
router.get('/tenants/:id/leaves', authenticateSuperAdmin, superController.getTenantLeaves);

router.get('/settings', authenticateSuperAdmin, superController.getSystemSettings);
router.put('/settings', authenticateSuperAdmin, superController.updateSystemSettings);

// Feature overrides
router.get('/tenants/:id/overrides', authenticateSuperAdmin, superController.listOverrides);
router.post('/tenants/:id/overrides', authenticateSuperAdmin, superController.setOverride);
router.delete('/tenants/:id/overrides/:featureKey', authenticateSuperAdmin, superController.removeOverride);

// Extra quota
router.post('/tenants/:id/extra-quota', authenticateSuperAdmin, superController.grantExtraQuota);

// Override history
router.get('/tenants/:id/overrides/history', authenticateSuperAdmin, superController.getOverrideHistory);

// Force plan change
router.post('/tenants/:id/force-plan', authenticateSuperAdmin, superController.forcePlanChange);

// Audit log
router.get('/tenants/:id/audit-log', authenticateSuperAdmin, superController.getTenantAuditLog);

router.get('/analytics', authenticateSuperAdmin, superController.getAnalytics);

// Custom plans
router.get('/custom-plans', authenticateSuperAdmin, superController.listCustomPlans);
router.get('/custom-plans/:id', authenticateSuperAdmin, superController.getCustomPlan);
router.post('/custom-plans', authenticateSuperAdmin, superController.createCustomPlan);
router.put('/custom-plans/:id', authenticateSuperAdmin, superController.updateCustomPlan);

// Tenant custom plan assignment
router.get('/tenants/:id/custom-plan', authenticateSuperAdmin, superController.getTenantCustomPlan);
router.post('/tenants/:id/custom-plan', authenticateSuperAdmin, superController.assignCustomPlan);
router.delete('/tenants/:id/custom-plan', authenticateSuperAdmin, superController.removeCustomPlan);

// Branding (super admin)
router.get('/tenants/:id/branding', authenticateSuperAdmin, superController.getTenantBranding);
router.put('/tenants/:id/branding', authenticateSuperAdmin, superController.updateTenantBranding);

// Subscription analytics
router.get('/subscription-analytics', authenticateSuperAdmin, superController.getSubscriptionAnalytics);

module.exports = router;
