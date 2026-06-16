// src/services/auth.service.js
import api from './api';

export const authService = {
  // Register a brand new company environment (Tenant)
  register: async (companyData) => {
    const response = await api.post('/auth/register', companyData);
    return response.data;
  },

  login: async (email, password, subdomain) => {
    if (!subdomain) throw new Error('Company ID is required.');

    const response = await api.post('/auth/login', { email, password, subdomain });
    const { tenant } = response.data;
    if (tenant?.id) {
      localStorage.setItem('tenant_id', tenant.id);
    }
    return response.data;
  }
};
