const express = require('express');
const router = express.Router();
const superController = require('../controllers/super.controller');
const dashboardController = require('../controllers/superDashboard.controller');
const featureOverrideController = require('../controllers/featureOverride.controller');
const sectionVisibilityController = require('../controllers/sectionVisibility.controller');
const campaignController = require('../controllers/campaign.controller');
const referralController = require('../controllers/referral.controller');
const analyticsController = require('../controllers/analytics.controller');
const gstTaxController = require('../controllers/gstTax.controller');
const unitMasterController = require('../controllers/unitMaster.controller');
const legalController = require('../controllers/legalDocument.controller');
const accountDeletionController = require('../controllers/accountDeletion.controller');
const cmsController = require('../controllers/cms.controller');
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
router.delete('/plans/:planId', authenticateSuperAdmin,
  auditSuperAdminAction('plan.deleted', 'plan'), superController.deletePlan);
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
router.delete('/tenants/:tenantId/features/overrides', authenticateSuperAdmin,
  auditSuperAdminAction('override.all_revoked', 'feature_override'), featureOverrideController.revokeAllFeatureOverrides);

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
router.get('/razorpay-settings', authenticateSuperAdmin, superController.getRazorpaySettings);
router.put('/razorpay-settings', authenticateSuperAdmin,
  auditSuperAdminAction('razorpay.settings_updated', 'system'), superController.updateRazorpaySettings);

// ─── Unit Master ─────────────────────────────────────────────────
router.get('/units', authenticateSuperAdmin, unitMasterController.list);
router.post('/units', authenticateSuperAdmin,
  auditSuperAdminAction('unit.created', 'unit_master'), unitMasterController.create);
router.put('/units/:id', authenticateSuperAdmin,
  auditSuperAdminAction('unit.updated', 'unit_master'), unitMasterController.update);
router.delete('/units/:id', authenticateSuperAdmin,
  auditSuperAdminAction('unit.deleted', 'unit_master'), unitMasterController.delete);

// ─── GST Tax Rates ────────────────────────────────────────────────
router.get('/gst-tax', authenticateSuperAdmin, gstTaxController.list);
router.post('/gst-tax', authenticateSuperAdmin,
  auditSuperAdminAction('gst.created', 'gst_tax_rates'), gstTaxController.create);
router.put('/gst-tax/:id', authenticateSuperAdmin,
  auditSuperAdminAction('gst.updated', 'gst_tax_rates'), gstTaxController.update);
router.delete('/gst-tax/:id', authenticateSuperAdmin,
  auditSuperAdminAction('gst.deleted', 'gst_tax_rates'), gstTaxController.delete);

// ─── Super Admin Action Log ──────────────────────────────────────
router.get('/action-log', authenticateSuperAdmin, superController.getActionLog);
router.get('/action-log/types', authenticateSuperAdmin, superController.getActionLogTypes);
router.get('/action-log/actors', authenticateSuperAdmin, superController.getActionLogActors);

// ─── Bulk Operations ──────────────────────────────────────────────
router.post('/bulk/override', authenticateSuperAdmin,
  auditSuperAdminAction('admin.bulk_action', 'bulk'), superController.bulkOverride);

// ─── Legal Documents ─────────────────────────────────────────────
router.get('/legal', authenticateSuperAdmin, legalController.listDocuments);
router.get('/legal/:id', authenticateSuperAdmin, legalController.getDocument);
router.get('/legal/:id/acceptances', authenticateSuperAdmin, legalController.listAcceptances);
router.post('/legal', authenticateSuperAdmin,
  auditSuperAdminAction('legal_document.created', 'legal_document'), legalController.createDocument);
router.put('/legal/:id', authenticateSuperAdmin,
  auditSuperAdminAction('legal_document.updated', 'legal_document'), legalController.updateDocument);
router.post('/legal/:id/versions', authenticateSuperAdmin,
  auditSuperAdminAction('legal_document.version_created', 'legal_document'), legalController.createVersion);
router.put('/legal/:id/versions/:versionId', authenticateSuperAdmin,
  auditSuperAdminAction('legal_document.version_updated', 'legal_document'), legalController.updateDraftVersion);
router.post('/legal/:id/versions/:versionId/publish', authenticateSuperAdmin,
  auditSuperAdminAction('legal_document.version_published', 'legal_document'), legalController.publishVersion);
router.post('/legal/:id/archive', authenticateSuperAdmin,
  auditSuperAdminAction('legal_document.archived', 'legal_document'), legalController.archiveDocument);
router.delete('/legal/:id', authenticateSuperAdmin,
  auditSuperAdminAction('legal_document.deleted', 'legal_document'), legalController.deleteDocument);

// ─── Account Deletion Requests ─────────────────────────────────
router.get('/account-deletion', authenticateSuperAdmin, accountDeletionController.listRequests);
router.get('/account-deletion/:id', authenticateSuperAdmin, accountDeletionController.getRequest);
router.post('/account-deletion/:id/approve', authenticateSuperAdmin,
  auditSuperAdminAction('account_deletion.approved', 'account_deletion'), accountDeletionController.approveRequest);
router.post('/account-deletion/:id/reject', authenticateSuperAdmin,
  auditSuperAdminAction('account_deletion.rejected', 'account_deletion'), accountDeletionController.rejectRequest);

// ─── CMS ───────────────────────────────────────────────────────
router.get('/cms/pages', authenticateSuperAdmin, cmsController.listPages);
router.get('/cms/pages/:id', authenticateSuperAdmin, cmsController.getPage);
router.post('/cms/pages', authenticateSuperAdmin,
  auditSuperAdminAction('cms.page_created', 'cms_page'), cmsController.createPage);
router.put('/cms/pages/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.page_updated', 'cms_page'), cmsController.updatePage);
router.patch('/cms/pages/:id/status', authenticateSuperAdmin,
  auditSuperAdminAction('cms.page_status_changed', 'cms_page'), cmsController.setPageStatus);
router.delete('/cms/pages/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.page_deleted', 'cms_page'), cmsController.deletePage);

router.get('/cms/header-menus', authenticateSuperAdmin, cmsController.listHeaderMenus);
router.post('/cms/header-menus', authenticateSuperAdmin,
  auditSuperAdminAction('cms.header_menu_created', 'cms_header_menu'), cmsController.createHeaderMenu);
router.put('/cms/header-menus/reorder', authenticateSuperAdmin,
  auditSuperAdminAction('cms.header_menu_reordered', 'cms_header_menu'), cmsController.reorderHeaderMenus);
router.put('/cms/header-menus/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.header_menu_updated', 'cms_header_menu'), cmsController.updateHeaderMenu);
router.delete('/cms/header-menus/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.header_menu_deleted', 'cms_header_menu'), cmsController.deleteHeaderMenu);

router.get('/cms/footer', authenticateSuperAdmin, cmsController.listFooter);
router.post('/cms/footer/categories', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_category_created', 'cms_footer_category'), cmsController.createFooterCategory);
router.put('/cms/footer/categories/reorder', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_category_reordered', 'cms_footer_category'), cmsController.reorderFooterCategories);
router.put('/cms/footer/categories/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_category_updated', 'cms_footer_category'), cmsController.updateFooterCategory);
router.delete('/cms/footer/categories/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_category_deleted', 'cms_footer_category'), cmsController.deleteFooterCategory);
router.post('/cms/footer/categories/:categoryId/links', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_link_created', 'cms_footer_link'), cmsController.createFooterLink);
router.put('/cms/footer/links/reorder', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_link_reordered', 'cms_footer_link'), cmsController.reorderFooterLinks);
router.put('/cms/footer/links/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_link_updated', 'cms_footer_link'), cmsController.updateFooterLink);
router.delete('/cms/footer/links/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.footer_link_deleted', 'cms_footer_link'), cmsController.deleteFooterLink);

router.get('/cms/social', authenticateSuperAdmin, cmsController.getSocialLinks);
router.put('/cms/social/:platform', authenticateSuperAdmin,
  auditSuperAdminAction('cms.social_updated', 'cms_social'), cmsController.updateSocialLink);

router.get('/cms/settings', authenticateSuperAdmin, cmsController.getSettings);
router.put('/cms/settings', authenticateSuperAdmin,
  auditSuperAdminAction('cms.settings_updated', 'cms_settings'), cmsController.updateSettings);

// ─── CMS: Help & Support ───────────────────────────────────────
router.get('/cms/help/topics', authenticateSuperAdmin, cmsController.listHelpTopics);
router.post('/cms/help/topics', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_topic_created', 'cms_help_topic'), cmsController.createHelpTopic);
router.put('/cms/help/topics/reorder', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_topic_reordered', 'cms_help_topic'), cmsController.reorderHelpTopics);
router.put('/cms/help/topics/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_topic_updated', 'cms_help_topic'), cmsController.updateHelpTopic);
router.delete('/cms/help/topics/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_topic_deleted', 'cms_help_topic'), cmsController.deleteHelpTopic);

router.get('/cms/help/faqs', authenticateSuperAdmin, cmsController.listHelpFaqs);
router.post('/cms/help/faqs', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_faq_created', 'cms_help_faq'), cmsController.createHelpFaq);
router.put('/cms/help/faqs/reorder', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_faq_reordered', 'cms_help_faq'), cmsController.reorderHelpFaqs);
router.put('/cms/help/faqs/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_faq_updated', 'cms_help_faq'), cmsController.updateHelpFaq);
router.delete('/cms/help/faqs/:id', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_faq_deleted', 'cms_help_faq'), cmsController.deleteHelpFaq);

router.get('/cms/help/settings', authenticateSuperAdmin, cmsController.getHelpSettings);
router.put('/cms/help/settings', authenticateSuperAdmin,
  auditSuperAdminAction('cms.help_settings_updated', 'cms_help_settings'), cmsController.updateHelpSettings);

module.exports = router;
