import api from './api';

export const superService = {
  login: async (email, password) => {
    const response = await api.post('/super/auth/login', { email, password });
    return response.data;
  },

  seed: async (data) => {
    const response = await api.post('/super/auth/seed', data);
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/super/dashboard');
    return response.data;
  },

  createTenant: async (data) => {
    const response = await api.post('/super/tenants', data);
    return response.data;
  },

  getTenants: async (params = {}) => {
    const response = await api.get('/super/tenants', { params });
    return response.data;
  },

  getTenantDetail: async (id) => {
    const response = await api.get(`/super/tenants/${id}`);
    return response.data;
  },

  updateTenant: async (id, data) => {
    const response = await api.put(`/super/tenants/${id}`, data);
    return response.data;
  },
  updateTenantAdmin: async (id, data) => {
    const response = await api.put(`/super/tenants/${id}/admin`, data);
    return response.data;
  },

  deleteTenant: async (id) => {
    const response = await api.delete(`/super/tenants/${id}`);
    return response.data;
  },

  getAllEmployees: async (params = {}) => {
    const response = await api.get('/super/employees', { params });
    return response.data;
  },
  updateEmployee: async (id, data) => {
    const response = await api.put(`/super/employees/${id}`, data);
    return response.data;
  },

  getTenantCalendar: async (id, params = {}) => {
    const response = await api.get(`/super/tenants/${id}/calendar`, { params });
    return response.data;
  },

  getTenantPayroll: async (id) => {
    const response = await api.get(`/super/tenants/${id}/payroll`);
    return response.data;
  },

  getTenantLeaves: async (id) => {
    const response = await api.get(`/super/tenants/${id}/leaves`);
    return response.data;
  },

  getSystemSettings: async () => {
    const response = await api.get('/super/settings');
    return response.data;
  },

  updateSystemSettings: async (default_country_code) => {
    const response = await api.put('/super/settings', { default_country_code });
    return response.data;
  },

  getAnalytics: async () => {
    const response = await api.get('/super/analytics');
    return response.data;
  },

  // ─── Feature Overrides ───────────────────────
  listOverrides: async (tenantId) => {
    const response = await api.get(`/super/tenants/${tenantId}/overrides`);
    return response.data;
  },
  setOverride: async (tenantId, data) => {
    const response = await api.post(`/super/tenants/${tenantId}/overrides`, data);
    return response.data;
  },
  removeOverride: async (tenantId, featureKey) => {
    const response = await api.delete(`/super/tenants/${tenantId}/overrides/${featureKey}`);
    return response.data;
  },
  getOverrideHistory: async (tenantId) => {
    const response = await api.get(`/super/tenants/${tenantId}/overrides/history`);
    return response.data;
  },

  // ─── Extra Quota ─────────────────────────────
  grantExtraQuota: async (tenantId, data) => {
    const response = await api.post(`/super/tenants/${tenantId}/extra-quota`, data);
    return response.data;
  },

  // ─── Force Plan ──────────────────────────────
  forcePlanChange: async (tenantId, data) => {
    const response = await api.post(`/super/tenants/${tenantId}/force-plan`, data);
    return response.data;
  },

  // ─── Audit Log ───────────────────────────────
  getTenantAuditLog: async (tenantId, params = {}) => {
    const response = await api.get(`/super/tenants/${tenantId}/audit-log`, { params });
    return response.data;
  },

  // ─── Plans & Features ─────────────────────────────
  listPlans: async () => {
    const response = await api.get('/super/plans');
    return response.data;
  },
  getPlanFeatures: async (planId) => {
    const response = await api.get(`/super/plans/${planId}/features`);
    return response.data;
  },
  getAllPlanFeatures: async () => {
    const response = await api.get('/super/plan-features');
    return response.data;
  },
  updatePlanFeature: async (planId, featureKey, data) => {
    const response = await api.put(`/super/plans/${planId}/features/${featureKey}`, data);
    return response.data;
  },

  // ─── Campaigns ────────────────────────────────────
  listCampaigns: async (params = {}) => {
    const response = await api.get('/super/campaigns', { params });
    return response.data;
  },
  getCampaign: async (id) => {
    const response = await api.get(`/super/campaigns/${id}`);
    return response.data;
  },
  getCampaignAnalytics: async () => {
    const response = await api.get('/super/campaigns/analytics');
    return response.data;
  },
  createCampaign: async (data) => {
    const response = await api.post('/super/campaigns', data);
    return response.data;
  },
  updateCampaign: async (id, data) => {
    const response = await api.patch(`/super/campaigns/${id}`, data);
    return response.data;
  },
  toggleCampaignStatus: async (id, status) => {
    const response = await api.patch(`/super/campaigns/${id}/status`, { status });
    return response.data;
  },
  deleteCampaign: async (id) => {
    const response = await api.delete(`/super/campaigns/${id}`);
    return response.data;
  },

  // ─── Referrals ────────────────────────────────────
  getReferralSummary: async () => {
    const response = await api.get('/super/referrals/summary');
    return response.data;
  },
  listReferrals: async (params = {}) => {
    const response = await api.get('/super/referrals', { params });
    return response.data;
  },
  updateReferralStatus: async (id, data) => {
    const response = await api.put(`/super/referrals/${id}`, data);
    return response.data;
  },

  // ─── Plan Management ────────────────────────────
  createPlan: async (data) => {
    const response = await api.post('/super/plans', data);
    return response.data;
  },
  updatePlan: async (planId, data) => {
    const response = await api.patch(`/super/plans/${planId}`, data);
    return response.data;
  },
  deactivatePlan: async (planId) => {
    const response = await api.patch(`/super/plans/${planId}/deactivate`);
    return response.data;
  },
  bulkUpdatePlanFeatures: async (planId, features) => {
    const response = await api.post(`/super/plans/${planId}/features`, { features });
    return response.data;
  },
  changeTenantPlan: async (tenantId, data) => {
    const response = await api.post(`/super/tenants/${tenantId}/change-plan`, data);
    return response.data;
  },

  // ─── Section Visibility ──────────────────────────
  getSectionVisibility: async (tenantId) => {
    const response = await api.get(`/super/tenants/${tenantId}/sections`);
    return response.data;
  },
  updateSectionVisibility: async (tenantId, data) => {
    const response = await api.put(`/super/tenants/${tenantId}/sections`, data);
    return response.data;
  },

  // ─── Section Visibility (v2 enhanced) ─────────────
  getSectionsV2: async (tenantId) => {
    const response = await api.get(`/super/tenants/${tenantId}/sections-v2`);
    return response.data;
  },
  setSectionVisibility: async (tenantId, data) => {
    const response = await api.post(`/super/tenants/${tenantId}/sections/visibility`, data);
    return response.data;
  },
  updateSection: async (tenantId, sectionKey, data) => {
    const response = await api.patch(`/super/tenants/${tenantId}/sections/${sectionKey}`, data);
    return response.data;
  },
  resetSection: async (tenantId, sectionKey) => {
    const response = await api.delete(`/super/tenants/${tenantId}/sections/${sectionKey}`);
    return response.data;
  },
  getSectionHistory: async (tenantId, params = {}) => {
    const response = await api.get(`/super/tenants/${tenantId}/sections/history`, { params });
    return response.data;
  },

  // ─── Revenue Analytics ────────────────────────────
  getRevenueAnalytics: async () => {
    const response = await api.get('/super/revenue-analytics');
    return response.data;
  },

  // ─── Enhanced Analytics (v2) ──────────────────
  getAnalyticsRevenue: async () => {
    const response = await api.get('/super/analytics/revenue');
    return response.data;
  },
  getAnalyticsConversion: async () => {
    const response = await api.get('/super/analytics/conversion');
    return response.data;
  },
  getAnalyticsPlanAdoption: async () => {
    const response = await api.get('/super/analytics/plan-adoption');
    return response.data;
  },
  getAnalyticsUsage: async () => {
    const response = await api.get('/super/analytics/usage');
    return response.data;
  },
  getAnalyticsExpiringTrials: async (days = 14) => {
    const response = await api.get('/super/analytics/expiring-trials', { params: { days } });
    return response.data;
  },

  // ─── Super Admin Action Log ──────────────────────
  getActionLog: async (params = {}) => {
    const response = await api.get('/super/action-log', { params });
    return response.data;
  },
  getActionLogTypes: async () => {
    const response = await api.get('/super/action-log/types');
    return response.data;
  },
  getActionLogActors: async () => {
    const response = await api.get('/super/action-log/actors');
    return response.data;
  },

  // ─── Bulk Operations ─────────────────────────────
  bulkOverride: async (data) => {
    const response = await api.post('/super/bulk/override', data);
    return response.data;
  },

  // ─── Tenant Notes ────────────────────────────────
  updateTenantNotes: async (id, data) => {
    const response = await api.put(`/super/tenants/${id}/notes`, data);
    return response.data;
  },

  // ─── Tenant Status Actions ─────────────────────
  updateTenantStatus: async (id, data) => {
    const response = await api.patch(`/super/tenants/${id}/status`, data);
    return response.data;
  },
  extendTrial: async (tenantId, data) => {
    const response = await api.post(`/super/tenants/${tenantId}/extend-trial`, data);
    return response.data;
  },
  activateTrial: async (tenantId, data = {}) => {
    const response = await api.post(`/super/tenants/${tenantId}/activate-trial`, data);
    return response.data;
  },

  // ─── Tenant Usage & Subscription ──────────────
  getTenantUsage: async (id) => {
    const response = await api.get(`/super/tenants/${id}/usage`);
    return response.data;
  },
  getTenantSubscription: async (id) => {
    const response = await api.get(`/super/tenants/${id}/subscription`);
    return response.data;
  },

  // ─── Feature Override Engine ──────────────────
  getTenantFeatures: async (tenantId) => {
    const response = await api.get(`/super/tenants/${tenantId}/features`);
    return response.data;
  },
  createFeatureOverride: async (tenantId, data) => {
    const response = await api.post(`/super/tenants/${tenantId}/features/override`, data);
    return response.data;
  },
  updateFeatureOverride: async (tenantId, overrideId, data) => {
    const response = await api.patch(`/super/tenants/${tenantId}/features/override/${overrideId}`, data);
    return response.data;
  },
  deleteFeatureOverride: async (tenantId, overrideId) => {
    const response = await api.delete(`/super/tenants/${tenantId}/features/override/${overrideId}`);
    return response.data;
  },
  bulkSetFeatureOverrides: async (tenantId, overrides) => {
    const response = await api.post(`/super/tenants/${tenantId}/features/bulk`, { overrides });
    return response.data;
  },

  // ─── Dashboard APIs ──────────────────────────────
  getDashboardSummary: async () => {
    const response = await api.get('/super/dashboard/summary');
    return response.data;
  },
  getDashboardRevenue: async () => {
    const response = await api.get('/super/dashboard/revenue');
    return response.data;
  },
  getDashboardConversion: async () => {
    const response = await api.get('/super/dashboard/conversion');
    return response.data;
  },
  getDashboardRecentOnboards: async () => {
    const response = await api.get('/super/dashboard/recent-onboards');
    return response.data;
  },
  getDashboardExpiringTrials: async (days = 7) => {
    const response = await api.get('/super/dashboard/expiring-trials', { params: { days } });
    return response.data;
  },
};
