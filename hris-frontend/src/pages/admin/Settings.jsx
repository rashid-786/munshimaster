import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';

const Settings = () => {
  const [companyName, setCompanyName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [message, setMessage] = useState('');

  useEffect(() => {
    hrService.getTenantSettings().then(res => {
      setCompanyName(res.companyName || '');
      if (res.settings?.primaryColor) setPrimaryColor(res.settings.primaryColor);
    }).catch(() => {});
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.updateTenantSettings({ companyName, settings: { primaryColor } });
      setMessage(res.message);
      document.documentElement.style.setProperty('--primary', primaryColor);
      localStorage.setItem('tenant_name', companyName);
      localStorage.setItem('primary_color', primaryColor);
    } catch (err) {
      setMessage('Failed to save settings.');
    }
  };

  return (
    <div className="card max-w-xl">
      <div className="card-header">
        <h3 className="text-lg font-semibold text-gray-900">Branding Settings</h3>
      </div>
      {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}

      <form onSubmit={handleSave} className="p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
          <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field" placeholder="Your Company Name" required />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
          <div className="flex items-center gap-4">
            <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded border border-gray-300 cursor-pointer" />
            <code className="text-sm text-gray-500">{primaryColor}</code>
          </div>
        </div>

        <button type="submit" className="btn-primary">Save Changes</button>
      </form>
    </div>
  );
};

export default Settings;
