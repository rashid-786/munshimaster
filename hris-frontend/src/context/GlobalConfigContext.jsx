import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const GlobalConfigContext = createContext({ globalConfig: {}, loading: true });

export function GlobalConfigProvider({ children }) {
  const [globalConfig, setGlobalConfig] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem('global_config');
    if (cached) {
      try { setGlobalConfig(JSON.parse(cached)); } catch {}
    }
    api.get('/public/global-config')
      .then(({ data }) => {
        const config = data.globalConfig || {};
        // Ensure defaultCountry is always present
        if (!config.defaultCountry) {
          config.defaultCountry = 'IN';
        }
        setGlobalConfig(config);
        localStorage.setItem('global_config', JSON.stringify(config));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <GlobalConfigContext.Provider value={{ globalConfig, loading }}>
      {children}
    </GlobalConfigContext.Provider>
  );
}

export const useGlobalConfig = () => useContext(GlobalConfigContext);
