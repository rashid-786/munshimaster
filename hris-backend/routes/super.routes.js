const express = require('express');
const router = express.Router();
const superController = require('../controllers/super.controller');
const dashboardController = require('../controllers/superDashboard.controller');
const featureOverrideController = require('../controllers/featureOverride.controller');
const sectionVisibilityController = require('../controllers/sectionVisibility.controller');
const campaignController = require('../controllers/campaign.controller');
const referralController = require('../controllers/referral.controller');
const analyticsController = require('../controllers/analytics.controller');
const { authenticateSuperAdmin, auditSuperAdminAction } = require('../middleware/superAdmin');

// ─── Auth (no middleware) ──────────────────────────────────────────
router.post('/auth/seed', superController.seedSuperAdmin);
router.post('/auth/login', superController.loginSuperAdmin);

// ─── Dashboard & Analytics ────────────────────────────────────────
router.get('/dashboard', authenticateSuperAdmin, superController.getDashboard);
router.get('/dashboard/summary', authenticateSuperAdmin, dashboardController.getSummary);
router.get('/dashboard/revenue', authenticateSuperAdmin, dashboardController.getRevenue);
router.get('/dashboard/conversion', authenticateSuperAdmin, dashboardController.getConversion);
router.get('/dashboard/recent-onboards', authenticateSuperAdmin, dashboardController.getRecentOnboards);
router.get('/dashboard/expiring-trials', authenticateSuperAdmin, dashboardController.getExpiringTrials);
router.get('/analytics', authenticateSuperAdmin, superController.getAnalytics);
router.get('/revenue-analytics', authenticateSuperAdmin, superController.getRevenueAnalytics);
router.get('/subscription-analytics', authenticateSuperAdmin, superController.getSubscriptionAnalytics);

// ─── Enhanced Analytics (v2) ─────────────────────────────────────
router.get('/analytics/revenue', authenticateSuperAdmin, analyticsController.getRevenueAnalytics);
router.get('/analytics/conversion', authenticateSuperAdmin, analyticsController.getConversionAnalytics);
router.get('/analytics/plan-adoption', authenticateSuperAdmin, analyticsController.getPlanAdoption);
router.get('/analytics/usage', authenticateSuperAdmin, analyticsController.getUsageAnalytics);
router.get('/analytics/expiring-trials', authenticateSuperAdmin, analyticsController.getExpiringTrials);

// ─── Plans & Features ─────────────────────────────────────────────
router.get('/plans', authenticateSuperAdmin, superController.listPlans);
router.post('/plans', authenticateSuperAdmin,
  auditSuperAdminAction('plan.created', 'plan'), superController.createPlan);
router.patch('/plans/:planId', authenticateSuperAdmin,
  auditSuperAdminAction('plan.updated', 'plan'), superController.updatePlan);
router.patch('/plans/:planId/deactivate', authenticateSuperAdmin,
  auditSuperAdminAction('plan.deactivated', 'plan'), superController.deactivatePlan);
router.get('/plans/:planId/features', authenticateSuperAdmin, superController.listPlanFeatures);
router.post('/plans/:planId/features', authenticateSuperAdmin,
  auditSuperAdminAction('plan.features_updated', 'plan_features'), superController.bulkUpdatePlanFeatures);
router.get('/plan-features', authenticateSuperAdmin, superController.listAllPlanFeatures);
router.put('/plans/:planId/features/:featureKey', authenticateSuperAdmin,
  auditSuperAdminAction('plan_feature.updated', 'plan_feature'), superController.updatePlanFeature);

// ─── Tenant Plan Change ──────────────────────────────────────────
router.post('/tenants/:tenantId/change-plan', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.plan_changed', 'tenant'), superController.changeTenantPlan);

// ─── Trial Extension & Activation ────────────────────────────────
router.post('/tenants/:tenantId/extend-trial', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.trial_extended', 'tenant'), superController.extendTrial);
router.post('/tenants/:tenantId/activate-trial', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.trial_activated', 'tenant'), superController.activateTrial);

// ─── Tenant Management ────────────────────────────────────────────
router.post('/tenants', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.created', 'tenant'), superController.createTenant);
router.get('/tenants', authenticateSuperAdmin, superController.getTenants);
router.get('/tenants/:id', authenticateSuperAdmin, superController.getTenantDetail);
router.put('/tenants/:id', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.updated', 'tenant'), superController.updateTenant);
router.put('/tenants/:id/admin', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.admin_updated', 'tenant'), superController.updateTenantAdmin);
router.delete('/tenants/:id', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.deleted', 'tenant'), superController.deleteTenant);
router.put('/tenants/:id/notes', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.notes_updated', 'tenant'), superController.updateTenantNotes);

// ─── Tenant Actions ───────────────────────────────────────────────
router.patch('/tenants/:id/status', authenticateSuperAdmin,
  auditSuperAdminAction('tenant.status_changed', 'tenant'), superController.updateTenantStatus);

// ─── Tenant Data Views ────────────────────────────────────────────
router.get('/tenants/:id/calendar', authenticateSuperAdmin, superController.getTenantCalendar);
router.get('/tenants/:id/payroll', authenticateSuperAdmin, superController.getTenantPayroll);
router.get('/tenants/:id/leaves', authenticateSuperAdmin, superController.getTenantLeaves);
router.get('/tenants/:id/audit-log', authenticateSuperAdmin, superController.getTenantAuditLog);
router.get('/tenants/:id/usage', authenticateSuperAdmin, superController.getTenantUsage);
router.get('/tenants/:id/subscription', authenticateSuperAdmin, superController.getTenantSubscription);

// ─── Section Visibility ───────────────────────────────────────────
router.get('/tenants/:id/sections', authenticateSuperAdmin, superController.getSectionVisibility);
router.put('/tenants/:id/sections', authenticateSuperAdmin,
  auditSuperAdminAction('section.visibility_updated', 'tenant'), superController.updateSectionVisibility);

// ─── Enhanced Section Visibility (v2 API) ─────────────────────────
router.get('/tenants/:tenantId/sections-v2', authenticateSuperAdmin, sectionVisibilityController.getSections);
router.post('/tenants/:tenantId/sections/visibility', authenticateSuperAdmin,
  auditSuperAdminAction('section.visibility_updated', 'section_visibility'), sectionVisibilityController.setSectionVisibility);
router.patch('/tenants/:tenantId/sections/:sectionKey', authenticateSuperAdmin,
  auditSuperAdminAction('section.visibility_updated', 'section_visibility'), sectionVisibilityController.updateSection);
router.delete('/tenants/:tenantId/sections/:sectionKey', authenticateSuperAdmin,
  auditSuperAdminAction('section.visibility_reset', 'section_visibility'), sectionVisibilityController.resetSection);
router.get('/tenants/:tenantId/sections/history', authenticateSuperAdmin, sectionVisibilityController.getSectionHistory);

// ─── Feature Overrides ────────────────────────────────────────────
router.get('/tenants/:id/overrides', authenticateSuperAdmin, superController.listOverrides);
router.post('/tenants/:id/overrides', authenticateSuperAdmin,
  auditSuperAdminAction('override.created', 'override'), superController.setOverride);
router.delete('/tenants/:id/overrides/:featureKey', authenticateSuperAdmin,
  auditSuperAdminAction('override.deleted', 'override'), superController.removeOverride);
router.get('/tenants/:id/overrides/history', authenticateSuperAdmin, superController.getOverrideHistory);
router.post('/tenants/:id/extra-quota', authenticateSuperAdmin,
  auditSuperAdminAction('quota.extra_granted', 'override'), superController.grantExtraQuota);
router.post('/tenants/:id/force-plan', authenticateSuperAdmin,
  auditSuperAdminAction('plan.force_changed', 'subscription'), superController.forcePlanChange);

// ─── Feature Override Engine ──────────────────────────────────────
router.get('/tenants/:tenantId/features', authenticateSuperAdmin, featureOverrideController.getTenantFeatures);
router.post('/tenants/:tenantId/features/override', authenticateSuperAdmin,
  auditSuperAdminAction('override.created', 'feature_override'), featureOverrideController.createFeatureOverride);
router.patch('/tenants/:tenantId/features/override/:overrideId', authenticateSuperAdmin,
  auditSuperAdminAction('override.updated', 'feature_override'), featureOverrideController.updateFeatureOverride);
router.delete('/tenants/:tenantId/features/override/:overrideId', authenticateSuperAdmin,
  auditSuperAdminAction('override.deleted', 'feature_override'), featureOverrideController.deleteFeatureOverride);
router.post('/tenants/:tenantId/features/bulk', authenticateSuperAdmin,
  auditSuperAdminAction('override.bulk_created', 'feature_override'), featureOverrideController.bulkSetFeatureOverrides);

// ─── Employees (cross-tenant) ─────────────────────────────────────
router.get('/employees', authenticateSuperAdmin, superController.getAllEmployees);
router.put('/employees/:id', authenticateSuperAdmin,
  auditSuperAdminAction('employee.updated', 'employee'), superController.updateSuperEmployee);

// ─── Custom Plans ─────────────────────────────────────────────────
router.get('/custom-plans', authenticateSuperAdmin, superController.listCustomPlans);
router.get('/custom-plans/:id', authenticateSuperAdmin, superController.getCustomPlan);
router.post('/custom-plans', authenticateSuperAdmin,
  auditSuperAdminAction('custom_plan.created', 'custom_plan'), superController.createCustomPlan);
router.put('/custom-plans/:id', authenticateSuperAdmin,
  auditSuperAdminAction('custom_plan.updated', 'custom_plan'), superController.updateCustomPlan);
router.get('/tenants/:id/custom-plan', authenticateSuperAdmin, superController.getTenantCustomPlan);
router.post('/tenants/:id/custom-plan', authenticateSuperAdmin,
  auditSuperAdminAction('custom_plan.assigned', 'custom_plan'), superController.assignCustomPlan);
router.delete('/tenants/:id/custom-plan', authenticateSuperAdmin,
  auditSuperAdminAction('custom_plan.removed', 'custom_plan'), superController.removeCustomPlan);

// ─── Branding ─────────────────────────────────────────────────────
router.get('/tenants/:id/branding', authenticateSuperAdmin, superController.getTenantBranding);
router.put('/tenants/:id/branding', authenticateSuperAdmin,
  auditSuperAdminAction('branding.updated', 'branding'), superController.updateTenantBranding);

// ─── Campaigns ────────────────────────────────────────────────────
router.get('/campaigns', authenticateSuperAdmin, campaignController.listCampaigns);
router.get('/campaigns/analytics', authenticateSuperAdmin, campaignController.getCampaignAnalytics);
router.get('/campaigns/:campaignId', authenticateSuperAdmin, campaignController.getCampaign);
router.post('/campaigns', authenticateSuperAdmin,
  auditSuperAdminAction('campaign.created', 'campaign'), campaignController.createCampaign);
router.patch('/campaigns/:campaignId', authenticateSuperAdmin,
  auditSuperAdminAction('campaign.updated', 'campaign'), campaignController.updateCampaign);
router.patch('/campaigns/:campaignId/status', authenticateSuperAdmin,
  auditSuperAdminAction('campaign.status_changed', 'campaign'), campaignController.toggleCampaignStatus);
router.delete('/campaigns/:campaignId', authenticateSuperAdmin,
  auditSuperAdminAction('campaign.deleted', 'campaign'), campaignController.deleteCampaign);

// ─── Referrals ────────────────────────────────────────────────────
router.get('/referrals', authenticateSuperAdmin, referralController.listReferrals);
router.get('/referrals/summary', authenticateSuperAdmin, referralController.getReferralSummary);
router.put('/referrals/:referralId', authenticateSuperAdmin,
  auditSuperAdminAction('referral.updated', 'referral'), referralController.updateReferralStatus);

// ─── System Settings ──────────────────────────────────────────────
router.get('/settings', authenticateSuperAdmin, superController.getSystemSettings);
router.put('/settings', authenticateSuperAdmin,
  auditSuperAdminAction('system.settings_updated', 'system'), superController.updateSystemSettings);

// ─── Super Admin Action Log ──────────────────────────────────────
router.get('/action-log', authenticateSuperAdmin, superController.getActionLog);
router.get('/action-log/types', authenticateSuperAdmin, superController.getActionLogTypes);
router.get('/action-log/actors', authenticateSuperAdmin, superController.getActionLogActors);

// ─── Bulk Operations ──────────────────────────────────────────────
router.post('/bulk/override', authenticateSuperAdmin,
  auditSuperAdminAction('admin.bulk_action', 'bulk'), superController.bulkOverride);

module.exports = router;
