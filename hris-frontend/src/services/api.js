import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const userData = localStorage.getItem('user_data');
  const isSuperAdmin = userData && JSON.parse(userData).role === 'super_admin';

  if (!isSuperAdmin) {
    const tenantId = localStorage.getItem('tenant_id');
    if (tenantId && tenantId !== 'undefined' && tenantId !== 'null') {
      config.headers['x-tenant-id'] = tenantId;
    }
  }

  return config;
});

export default api;
