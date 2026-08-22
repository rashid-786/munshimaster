import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

let unauthorizedHandler = null;
export const setUnauthorizedHandler = (fn) => {
  unauthorizedHandler = fn;
};

const SESSION_EXPIRED_KEY = 'session_expired_message';

function handleAuthFailure(status, error) {
  const msg =
    error?.response?.data?.error ||
    (status === 401
      ? 'Your session has expired. Please log in again.'
      : 'You do not have permission to perform this action. Please log in again.');
  sessionStorage.setItem(SESSION_EXPIRED_KEY, msg);
  if (typeof unauthorizedHandler === 'function') {
    unauthorizedHandler();
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const msg = String(error?.response?.data?.error || error?.response?.data?.message || '').toLowerCase();
    const hasToken = !!localStorage.getItem('auth_token');
    // Log out only for genuine auth failures (401, or a 403 that is clearly about the
    // token/session/authorization). Business 403s (e.g. "Store limit reached", plan
    // restrictions) must NOT clear the session — let the caller surface the message.
    const isAuthError =
      status === 401 ||
      (status === 403 && /token|login|session|expired|unauthorized|cross-tenant|forbidden/.test(msg));
    if (hasToken && isAuthError) {
      handleAuthFailure(status, error);
    }
    return Promise.reject(error);
  }
);

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
