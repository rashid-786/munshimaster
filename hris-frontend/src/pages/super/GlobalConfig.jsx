import { useState, useEffect } from 'react';
import api from '../../services/api';

const DEFAULT_CONFIG = {
  hidePayments: false,
  hideSubscription: false,
  hideUsage: false,
  hideReferEarn: false,
  hideSubscriptionLabels: false,
};

const FIELDS = [
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
        const merged = { ...DEFAULT_CONFIG, ...gc };
        setConfig(merged);
        setInitial(merged);
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load global config.' }))
      .finally(() => setLoading(false));
  }, []);

  const changed = Object.keys(config).some(k => config[k] !== initial[k]);

  const handleToggle = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
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

      <div className="card divide-y divide-gray-100">
        {FIELDS.map(field => (
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
