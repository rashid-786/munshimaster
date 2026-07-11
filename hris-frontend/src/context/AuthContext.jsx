import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshTenant = async () => {
    try {
      const { data } = await api.get('/core/tenant/settings');
      const current = JSON.parse(localStorage.getItem('tenant_data') || '{}');
      const updated = { ...current, name: data.companyName, subscriptionPlan: data.subscriptionPlan, settings: data.settings };
      setTenant(updated);
      localStorage.setItem('tenant_data', JSON.stringify(updated));
      if (data.settings?.currencySymbol) localStorage.setItem('currency_symbol', data.settings.currencySymbol);
      if (data.settings?.countryCode) localStorage.setItem('default_country_code', data.settings.countryCode);
    } catch {
      // silent — retry on next page visit
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user_data');
    const savedTenant = localStorage.getItem('tenant_data');

    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === 'super_admin') {
          setUser(parsed);
        } else {
          const tenantId = localStorage.getItem('tenant_id');
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.tenantId === tenantId) {
            setUser(parsed);
            if (savedTenant) setTenant(JSON.parse(savedTenant));
          } else {
            localStorage.clear();
          }
        }
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      refreshTenant();
    }
  }, [user]);

  const login = (userData, token, tenantData) => {
    setUser(userData);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(userData));
    if (tenantData?.id) {
      localStorage.setItem('tenant_id', tenantData.id);
    }
    if (tenantData) {
      setTenant(tenantData);
      localStorage.setItem('tenant_data', JSON.stringify(tenantData));
    }
  };

  const updateUser = (updates) => {
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem('user_data', JSON.stringify(updated));
  };

  const updateTenantPlan = (plan) => {
    const current = JSON.parse(localStorage.getItem('tenant_data') || '{}');
    const updated = { ...current, subscriptionPlan: plan };
    setTenant(updated);
    localStorage.setItem('tenant_data', JSON.stringify(updated));
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    localStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, tenant, login, updateUser, updateTenantPlan, logout, loading, refreshTenant }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
