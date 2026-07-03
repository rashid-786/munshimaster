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
};
