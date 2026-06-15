import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('user_data');
    const tenantId = localStorage.getItem('tenant_id');

    if (token && savedUser && tenantId) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.tenantId === tenantId) {
          setUser(JSON.parse(savedUser));
        } else {
          localStorage.clear();
        }
      } catch {
        localStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    setUser(userData);
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user_data', JSON.stringify(userData));
    if (userData.tenantId) {
      localStorage.setItem('tenant_id', userData.tenantId);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.clear();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
