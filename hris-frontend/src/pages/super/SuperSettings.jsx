import React, { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';

const SuperSettings = () => {
  const [countryCode, setCountryCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    superService.getSystemSettings()
      .then(data => setCountryCode(data.defaultCountryCode))
      .catch(() => setError('Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!countryCode.trim()) { setError('Country code is required.'); return; }
    setSaving(true);
    setError('');
    setMessage(null);
    try {
      await superService.updateSystemSettings(countryCode.trim());
      setMessage('Settings updated successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save settings.');
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="text-center text-gray-400 py-12">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
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

      <div className="card p-6">
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

        <form onSubmit={handleSubmit} className="space-y-6">
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

          <div className="pt-2">
            <button type="submit" disabled={saving} className="btn-primary !py-2.5">
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SuperSettings;
