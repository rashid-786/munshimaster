// src/services/auth.service.js
import api from './api';

export const authService = {
  // Register a brand new company environment (Tenant)
  register: async (companyData) => {
    const response = await api.post('/auth/register', companyData);
    return response.data;
  },

  // Log an employee into their respective company dashboard
  login: async (email, password, tenantId) => {
    if (!tenantId) throw new Error('Tenant ID is required.');

    localStorage.setItem('tenant_id', tenantId);

    const response = await api.post('/auth/login', { email, password });
    return response.data;
  }
};
