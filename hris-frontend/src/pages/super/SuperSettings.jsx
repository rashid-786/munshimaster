import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';

const SuperSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState({ defaultCountryCode: '+965' });
  const [plans, setPlans] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [planChanges, setPlanChanges] = useState({});

  useEffect(() => {
    setLoading(true);
    Promise.all([
      superService.getSystemSettings().catch(() => ({ defaultCountryCode: '+965' })),
      superService.listPlans().catch(() => ({ plans: [] })),
      superService.getTenants({ limit: 100 }).catch(() => ({ tenants: [] })),
    ]).then(([s, p, t]) => {
      setSettings({ defaultCountryCode: s.defaultCountryCode || '+965' });
      setPlans(p.plans?.filter(pl => pl.is_active !== false) || []);
      setTenants(t.tenants || []);
    }).catch(() => setError('Failed to load data.'))
    .finally(() => setLoading(false));
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage(null);
    try {
      await superService.updateSystemSettings(settings.defaultCountryCode);
      setMessage('System settings saved.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings.');
    }
    setSaving(false);
  };

  const updateTenantPlan = (tenantId, plan) => {
    setPlanChanges(prev => ({ ...prev, [tenantId]: plan }));
  };

  const removePlanChange = (tenantId) => {
    setPlanChanges(prev => {
      const n = { ...prev };
      delete n[tenantId];
      return n;
    });
  };

  const handleSavePlans = async () => {
    const entries = Object.entries(planChanges);
    if (entries.length === 0) return;
    setSaving(true);
    setError('');
    setMessage(null);
    try {
      await Promise.all(
        entries.map(([tenantId, plan]) =>
          superService.updateTenant(tenantId, { subscriptionPlan: plan })
        )
      );
      setTenants(prev =>
        prev.map(t => planChanges[t.id] ? { ...t, subscription_plan: planChanges[t.id] } : t)
      );
      setPlanChanges({});
      setMessage('Tenant plans updated.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update plans.');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Loading settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">System Settings</h1>
        <p className="text-xs text-gray-400 mt-0.5">Configure global system defaults.</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-2">&times;</button>
        </div>
      )}
      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm">{message}</div>
      )}

      {/* System Settings */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Global Defaults</h3>
        <p className="text-sm text-gray-500 mb-5">These values apply to all new tenants.</p>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-600 mb-1">Default Country Code</label>
            <input
              value={settings.defaultCountryCode}
              onChange={e => setSettings(s => ({ ...s, defaultCountryCode: e.target.value }))}
              placeholder="+965"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 transition-all"
            />
          </div>
          <button type="submit" disabled={saving} className="btn-primary !py-2 !px-5 text-sm">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>

      {/* Active Plans */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Subscription Plans</h3>
        <p className="text-sm text-gray-500 mb-4">Currently available plans in the system.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map(plan => (
            <div key={plan.id} className="border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{plan.name}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${plan.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {plan.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-400">{plan.id}</p>
              <p className="text-lg font-bold text-gray-900">₹{Number(plan.price_inr || 0).toLocaleString('en-IN')}<span className="text-xs font-normal text-gray-400">/{plan.period || 'year'}</span></p>
              <p className="text-xs text-gray-500">{plan.trial_days || 0} days trial</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tenant Plan Editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Tenant Plans</h3>
        <p className="text-sm text-gray-500 mb-4">Upgrade or downgrade subscription plans for individual tenants.</p>
        {tenants.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-4">No tenants found.</div>
        ) : (
          <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
            {tenants.map(tenant => {
              const currentPlan = tenant.subscription_plan?.toLowerCase() || '';
              const selectedPlan = planChanges[tenant.id] ?? currentPlan;
              const isChanged = planChanges[tenant.id] !== undefined;
              return (
                <div key={tenant.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{tenant.company_name}</p>
                    <p className="text-xs text-gray-400">{tenant.owner_email || tenant.id.slice(0, 8) + '...'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPlan}
                      onChange={e => updateTenantPlan(tenant.id, e.target.value)}
                      className={`px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[140px] ${isChanged ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'}`}
                    >
                      {plans.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {isChanged && (
                      <button onClick={() => removePlanChange(tenant.id)}
                        className="text-xs text-gray-400 hover:text-red-500 px-1">&#10005;</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {Object.keys(planChanges).length > 0 && (
          <div className="flex justify-end mt-4 pt-4 border-t border-gray-100">
            <button onClick={handleSavePlans} disabled={saving}
              className="btn-primary !py-2 !px-5 text-sm">
              {saving ? 'Saving...' : `Update ${Object.keys(planChanges).length} Tenant${Object.keys(planChanges).length > 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperSettings;
