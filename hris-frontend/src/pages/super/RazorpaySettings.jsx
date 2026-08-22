import { useState, useEffect } from 'react';
import api from '../../services/api';

const MASK_PREFIX = '\u2022\u2022\u2022\u2022';

function maskValue(v) {
  return v && !String(v).startsWith(MASK_PREFIX) ? `${MASK_PREFIX}${String(v).slice(-4)}` : v || '';
}

export default function RazorpaySettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [environment, setEnvironment] = useState('test');
  const [test, setTest] = useState({ mid: '', apiKey: '', secret: '' });
  const [production, setProduction] = useState({ mid: '', apiKey: '', secret: '' });
  const [reveal, setReveal] = useState({ apiKey: false, secret: false });

  useEffect(() => {
    api.get('/super/razorpay-settings')
      .then(({ data }) => {
        setEnvironment(data.environment || 'test');
        setTest({ mid: data.test?.mid || '', apiKey: maskValue(data.test?.apiKey), secret: maskValue(data.test?.secret) });
        setProduction({ mid: data.production?.mid || '', apiKey: maskValue(data.production?.apiKey), secret: maskValue(data.production?.secret) });
      })
      .catch(() => setMessage({ type: 'error', text: 'Failed to load Razorpay settings.' }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.put('/super/razorpay-settings', { environment, test, production });
      setMessage({ type: 'success', text: 'Razorpay settings saved.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save.' });
    }
    setSaving(false);
  };

  const active = environment === 'production' ? production : test;
  const setActive = (patch) => {
    const updater = (prev) => ({ ...prev, ...patch });
    if (environment === 'production') setProduction(updater);
    else setTest(updater);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const fields = [
    { key: 'mid', label: 'MID', placeholder: 'Merchant ID', type: 'text' },
    { key: 'apiKey', label: 'API Key', placeholder: 'rzp_test_xxxx / rzp_live_xxxx', type: reveal.apiKey ? 'text' : 'password' },
    { key: 'secret', label: 'Secret Key', placeholder: 'Secret', type: reveal.secret ? 'text' : 'password' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Razorpay Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Centrally manage payment gateway credentials. Values are stored securely and masked for display.
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Environment switch */}
      <div className="card p-5">
        <p className="text-sm font-medium text-gray-900 mb-3">Environment</p>
        <div className="flex items-center gap-2">
          {['test', 'production'].map((env) => {
            const activeEnv = environment === env;
            return (
              <button
                key={env}
                onClick={() => setEnvironment(env)}
                className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                  activeEnv ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {env === 'test' ? 'Test' : 'Production'}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          {environment === 'production'
            ? 'Production credentials are used for real payments.'
            : 'Test credentials are used with Razorpay test keys.'}
        </p>
      </div>

      {/* Credentials */}
      <div className="card divide-y divide-gray-100">
        <div className="p-5 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-900 capitalize">{environment} credentials</p>
        </div>
        {fields.map((field) => (
          <div key={field.key} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{field.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {field.key === 'secret' ? 'Masked — enter a new value to replace it.' : 'Configured for this environment.'}
                </p>
              </div>
              <input
                type={field.type}
                value={active[field.key]}
                onChange={(e) => setActive({ [field.key]: e.target.value })}
                placeholder={field.placeholder}
                autoComplete="off"
                className="input-field max-w-[260px] text-sm"
              />
            </div>
            {(field.key === 'apiKey' || field.key === 'secret') && (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setReveal(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {reveal[field.key] ? 'Hide' : 'Show'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn-primary !py-2.5 px-6">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
