import { useState, useEffect } from 'react';
import api from '../../services/api';

const COUNTRY_OPTIONS = [
  { value: 'IN', label: 'India (+91)' },
  { value: 'KW', label: 'Kuwait (+965)' },
  { value: 'SA', label: 'Saudi Arabia (+966)' },
  { value: 'AE', label: 'UAE (+971)' },
  { value: 'QA', label: 'Qatar (+974)' },
  { value: 'BH', label: 'Bahrain (+973)' },
  { value: 'OM', label: 'Oman (+968)' },
  { value: 'PK', label: 'Pakistan (+92)' },
  { value: 'BD', label: 'Bangladesh (+880)' },
  { value: 'EG', label: 'Egypt (+20)' },
  { value: 'US', label: 'United States (+1)' },
  { value: 'GB', label: 'United Kingdom (+44)' },
];

const DEFAULT_CONFIG = {
  hidePayments: false,
  hideSubscription: false,
  hideUsage: false,
  hideReferEarn: false,
  hideSubscriptionLabels: false,
  defaultCountry: 'IN',
  authMode: 'mobile_otp',
  appVersions: {
    android: {
      minVersionCode: 0,
      playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bahi360.app',
    },
  },
  rateLimit: {
    enabled: true,
    windowMinutes: 15,
    generalLimit: 1000,
    authLimit: 20,
    publicLimit: 120,
    paymentLimit: 60,
    superLimit: 200,
    notificationsLimit: 60,
    exemptedRoutes: [],
  },
};

const TOGGLE_FIELDS = [
  { key: 'hidePayments', label: 'Hide Payments', desc: 'Removes Payments from the sidebar navigation.' },
  { key: 'hideSubscription', label: 'Hide Subscription', desc: 'Removes Subscription from the sidebar navigation.' },
  { key: 'hideUsage', label: 'Hide Usage', desc: 'Removes Usage from the sidebar navigation.' },
  { key: 'hideReferEarn', label: 'Hide Refer & Earn', desc: 'Removes Refer & Earn from the sidebar navigation.' },
  { key: 'hideSubscriptionLabels', label: 'Hide Subscription Labels', desc: 'Removes all plan badges, upgrade prompts, and subscription references across the app for a white-labeled experience.' },
];

export default function GlobalConfig() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [initial, setInitial] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    api.get('/super/settings')
      .then(({ data }) => {
        const gc = data.globalConfig || {};
        const merged = {
          ...DEFAULT_CONFIG,
          ...gc,
          appVersions: {
            android: {
              minVersionCode: DEFAULT_CONFIG.appVersions.android.minVersionCode,
              playStoreUrl: DEFAULT_CONFIG.appVersions.android.playStoreUrl,
              ...(gc.appVersions?.android || {}),
            },
          },
          rateLimit: {
            ...DEFAULT_CONFIG.rateLimit,
            ...(gc.rateLimit || {}),
            exemptedRoutes: Array.isArray(gc.rateLimit?.exemptedRoutes) ? gc.rateLimit.exemptedRoutes : [],
          },
        };
        setConfig(merged);
        setInitial(merged);
        // Auto-save if backend is missing defaultCountry
        if (!gc.defaultCountry) {
          localStorage.setItem('global_config', JSON.stringify(merged));
          api.put('/super/settings', { global_config: merged }).catch(() => {});
        }
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load global config.' }))
      .finally(() => setLoading(false));
  }, []);

  const changed = Object.keys(config).some(k => config[k] !== initial[k]);

  const handleToggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAndroidAppVersion = (patch) => {
    setConfig(prev => ({
      ...prev,
      appVersions: {
        ...prev.appVersions,
        android: { ...(prev.appVersions?.android || {}), ...patch },
      },
    }));
  };

  const setRateLimit = (patch) => {
    setConfig(prev => ({
      ...prev,
      rateLimit: { ...(prev.rateLimit || DEFAULT_CONFIG.rateLimit), ...patch },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/super/settings', { global_config: config });
      setInitial({ ...config });
      localStorage.setItem('global_config', JSON.stringify(config));
      window.dispatchEvent(new CustomEvent('global-config-changed', { detail: config }));
      setMessage({ type: 'success', text: 'Global configuration saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save.' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Global Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">Centrally control application-wide visibility and branding settings.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Default Country */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Default Country</p>
            <p className="text-xs text-gray-500 mt-0.5">Sets the default country for phone number fields and state/province dropdowns across all forms.</p>
          </div>
          <select value={config.defaultCountry}
            onChange={e => setConfig(prev => ({ ...prev, defaultCountry: e.target.value }))}
            className="input-field max-w-[200px] text-sm">
            {COUNTRY_OPTIONS.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Authentication Method */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Authentication Method</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Controls how users sign in on the mobile app. Applied globally without a
              redeploy. In Email mode, users receive the OTP by email instead of SMS.
            </p>
          </div>
          <select value={config.authMode || 'mobile_otp'}
            onChange={e => setConfig(prev => ({ ...prev, authMode: e.target.value }))}
            className="input-field max-w-[220px] text-sm">
            <option value="mobile_otp">Mobile Number + OTP</option>
            <option value="email_otp">Email Address + OTP</option>
          </select>
        </div>
      </div>

      {/* Force Update (Mobile App) */}
      <div className="card p-5">
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-900">Force Update — Mobile App (Android)</p>
          <p className="text-xs text-gray-500 mt-0.5">Installed app versions below the minimum version code will be forced to update on next launch. Set to 0 to disable.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Minimum Version Code</label>
            <input
              type="number"
              min="0"
              value={config.appVersions?.android?.minVersionCode ?? 0}
              onChange={e => setAndroidAppVersion({ minVersionCode: parseInt(e.target.value, 10) || 0 })}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">The current release build's version code (e.g. 2, 3, 4…).</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Play Store URL</label>
            <input
              type="text"
              value={config.appVersions?.android?.playStoreUrl || ''}
              onChange={e => setAndroidAppVersion({ playStoreUrl: e.target.value })}
              className="input-field"
              placeholder="https://play.google.com/store/apps/details?id=com.bahi360.app"
            />
          </div>
        </div>
      </div>

      {/* Rate Limiting */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Rate Limiting</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Control API rate limits centrally. Applied dynamically without a redeploy.
              Authenticated business APIs are limited per tenant, so one tenant never
              consumes another's budget.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!!config.rateLimit?.enabled}
              onChange={() => setRateLimit({ enabled: !config.rateLimit?.enabled })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Window Duration (minutes)</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.windowMinutes ?? 15}
              onChange={e => setRateLimit({ windowMinutes: parseInt(e.target.value, 10) || 15 })}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">Applies on next restart (window is static with the default store).</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">General API Limit (per tenant)</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.generalLimit ?? 1000}
              onChange={e => setRateLimit({ generalLimit: parseInt(e.target.value, 10) || 1000 })}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">Authenticated business APIs per tenant per window.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Auth API Limit (per IP)</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.authLimit ?? 20}
              onChange={e => setRateLimit({ authLimit: parseInt(e.target.value, 10) || 20 })}
              className="input-field"
            />
            <p className="text-xs text-gray-400 mt-1">Login / register / OTP per IP per window.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Public API Limit (per minute, per IP)</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.publicLimit ?? 120}
              onChange={e => setRateLimit({ publicLimit: parseInt(e.target.value, 10) || 120 })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Payment Limit (per tenant)</label>
            <input
              type="number"
              min="1"
              value={config.rateLimit?.paymentLimit ?? 60}
              onChange={e => setRateLimit({ paymentLimit: parseInt(e.target.value, 10) || 60 })}
              className="input-field"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Exempted Routes (comma-separated path prefixes)</label>
            <input
              type="text"
              value={(config.rateLimit?.exemptedRoutes || []).join(', ')}
              onChange={e => setRateLimit({ exemptedRoutes: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              className="input-field"
              placeholder="/core/subscription/webhook, /core/invoice-payments/webhook"
            />
            <p className="text-xs text-gray-400 mt-1">Requests whose path starts with any prefix bypass rate limiting.</p>
          </div>
        </div>
      </div>

      {/* Toggle fields */}
      <div className="card divide-y divide-gray-100">
        {TOGGLE_FIELDS.map(field => (
          <div key={field.key} className="p-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{field.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{field.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config[field.key]}
                onChange={() => handleToggle(field.key)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600" />
            </label>
          </div>
        ))}
      </div>

      {changed && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="btn-primary !py-2.5 px-6">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}
