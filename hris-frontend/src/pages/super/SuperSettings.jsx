import React, { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';

const PLANS = [
  { value: 'free', label: 'Free (Ledger)' },
  { value: 'pro', label: 'Pro (+ Business)' },
  { value: 'enterprise', label: 'Enterprise (+ HR)' },
];

const SuperSettings = () => {
  const [countryCode, setCountryCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [planChanges, setPlanChanges] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      superService.getSystemSettings(),
      superService.getTenants({ limit: 100 }),
    ])
      .then(([settings, tenantData]) => {
        setCountryCode(settings.defaultCountryCode);
        setTenants(tenantData.tenants);
      })
      .catch(() => setError('Failed to load data.'))
      .finally(() => setLoading(false));
  }, []);

  const handlePlanChange = (tenantId, plan) => {
    setPlanChanges(prev => ({ ...prev, [tenantId]: plan }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!countryCode.trim()) { setError('Country code is required.'); return; }
    setSaving(true);
    setError('');
    setMessage(null);

    try {
      await superService.updateSystemSettings(countryCode.trim());

      const changeEntries = Object.entries(planChanges);
      if (changeEntries.length > 0) {
        await Promise.all(
          changeEntries.map(([tenantId, plan]) =>
            superService.updateTenant(tenantId, { subscriptionPlan: plan })
          )
        );
        setTenants(prev =>
          prev.map(t =>
            planChanges[t.id] !== undefined
              ? { ...t, subscription_plan: planChanges[t.id] }
              : t
          )
        );
        setPlanChanges({});
      }

      setMessage('Settings saved successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings.');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
          <p className="text-sm text-gray-500">Configure global platform settings.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-2">&times;</button>
        </div>
      )}
      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card p-6 mb-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Country Code</label>
              <input
                type="text"
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                placeholder="+965"
                className="input-field max-w-xs"
              />
              <p className="text-xs text-gray-400 mt-1">
                This country code will be pre-filled in all phone number fields across the platform (e.g., +965 for Kuwait).
              </p>
            </div>

            <hr className="border-gray-200" />

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Tenant Plans</h3>
              <p className="text-sm text-gray-500 mb-4">Upgrade or downgrade subscription plans for tenants.</p>
              {tenants.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-4">No tenants found.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {tenants.map(tenant => (
                    <div key={tenant.id} className="py-3 flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{tenant.company_name}</p>
                        <p className="text-xs text-gray-400">ID: {tenant.id.slice(0, 8)}&hellip;</p>
                      </div>
                      <select
                        value={planChanges[tenant.id] ?? tenant.subscription_plan ?? 'free'}
                        onChange={e => handlePlanChange(tenant.id, e.target.value)}
                        className="input-field !py-1.5 text-sm min-w-[160px] shrink-0"
                      >
                        {PLANS.map(p => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary !py-2.5">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SuperSettings;
