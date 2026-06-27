import api from './api';
import { formatPhone } from '../utils/currency';

let _defaultCountryCode = null;

export async function getDefaultCountryCode() {
  if (_defaultCountryCode) return _defaultCountryCode;
  const cached = localStorage.getItem('default_country_code');
  if (cached) { _defaultCountryCode = cached; return cached; }
  try {
    const response = await api.get('/public/settings');
    const code = response.data.defaultCountryCode || '+965';
    _defaultCountryCode = code;
    localStorage.setItem('default_country_code', code);
    return code;
  } catch {
    return '+965';
  }
}

export async function getGeoCountry() {
  try {
    const response = await api.get('/public/country');
    if (response.data?.country) {
      localStorage.setItem('preferred_country', response.data.country);
      return response.data.country;
    }
  } catch {}
  return null;
}

export const authService = {
  sendOtp: async (phone, purpose = 'registration') => {
    const response = await api.post('/auth/send-otp', { phone, purpose });
    return response.data;
  },

  verifyOtp: async (phone, otp, purpose = 'registration') => {
    const response = await api.post('/auth/verify-otp', { phone, otp, purpose });
    return response.data;
  },

  register: async (phone, referralCode) => {
    const payload = referralCode ? { phone, referralCode } : { phone };
    const response = await api.post('/auth/register', payload);
    return response.data;
  },

  login: async (email, password, subdomain) => {
    const payload = { email, password };
    if (subdomain) payload.subdomain = subdomain;

    const response = await api.post('/auth/login', payload);
    const { tenant } = response.data;
    if (tenant?.id) {
      localStorage.setItem('tenant_id', tenant.id);
    }
    return response.data;
  },

  resetPassword: async (phone, otp, newPassword) => {
    const response = await api.post('/auth/reset-password', { phone, otp, new_password: newPassword });
    return response.data;
  }
};
