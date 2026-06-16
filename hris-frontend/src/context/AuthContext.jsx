import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const logout = () => {
    setUser(null);
    setTenant(null);
    localStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, tenant, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
