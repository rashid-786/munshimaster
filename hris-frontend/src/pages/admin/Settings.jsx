import React, { useState, useEffect } from 'react';
import { hrService } from '../../services/hr.service';
import { applyTheme } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PLAN_RANK = { free: 0, pro: 1, enterprise: 2 };

const Settings = () => {
  const { user, tenant, updateUser } = useAuth();
  const planRank = PLAN_RANK[tenant?.subscriptionPlan] ?? 0;
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [weekendDays, setWeekendDays] = useState([0]);
  const [taxRate, setTaxRate] = useState(18);
  const [advanceDeductionPct, setAdvanceDeductionPct] = useState(10);
  const [hiddenGroups, setHiddenGroups] = useState({});
  const [message, setMessage] = useState('');
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    hrService.getTenantSettings().then(res => {
      setCompanyName(res.companyName || '');
      if (res.settings?.primaryColor) setPrimaryColor(res.settings.primaryColor);
      if (res.settings?.weekendDays) setWeekendDays(res.settings.weekendDays);
      if (res.settings?.taxRate) setTaxRate(res.settings.taxRate);
      if (res.settings?.advanceDeductionPct) setAdvanceDeductionPct(res.settings.advanceDeductionPct);
      if (res.settings?.hiddenGroups) setHiddenGroups(res.settings.hiddenGroups);
    }).catch(() => {});
  }, []);

  const toggleWeekendDay = (day) => {
    setWeekendDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.updateTenantSettings({ companyName, settings: { primaryColor, weekendDays, taxRate, advanceDeductionPct, hiddenGroups } });
      localStorage.setItem('hidden_groups', JSON.stringify(hiddenGroups));
      window.dispatchEvent(new CustomEvent('settings-saved', { detail: { hiddenGroups } }));
      if (firstName || lastName) {
        const profileRes = await hrService.updateProfile({ first_name: firstName, last_name: lastName, email, phone: user?.phone || '' });
        if (profileRes?.user) updateUser(profileRes.user);
      }
      setMessage(res.message || 'Settings saved.');
      applyTheme(primaryColor);
      localStorage.setItem('tenant_name', companyName);
    } catch (err) {
      setMessage('Failed to save settings.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      setPwMsg('Passwords do not match.');
      return;
    }
    setPwSaving(true);
    setPwMsg('');
    try {
      const res = await hrService.changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      setPwMsg(res.message);
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setPwMsg(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Branding Settings</h3>
        </div>
        {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
            <div className="flex items-center gap-4">
              <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded border border-gray-300 cursor-pointer" />
              <code className="text-sm text-gray-500">{primaryColor}</code>
            </div>
          </div>
          {planRank >= 2 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weekend Days</label>
              <div className="flex flex-wrap gap-2">
                {DAY_NAMES.map((name, idx) => (
                  <label key={idx} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                    weekendDays.includes(idx) ? 'bg-red-100 border-red-300 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                    <input type="checkbox" checked={weekendDays.includes(idx)} onChange={() => toggleWeekendDay(idx)} className="sr-only" />
                    {name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="border-b border-gray-200 pb-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Personal Info</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field" placeholder="Your Company Name" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="input-field" placeholder="First name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="input-field" placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field" placeholder="Email address" />
              </div>
            </div>
          </div>
          {planRank >= 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (GST %)</label>
              <input type="number" min="0" max="100" step="0.5" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="input-field max-w-[120px]" />
            </div>
          )}
          {planRank >= 2 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Advance Deduction (% of Net Salary)</label>
              <input type="number" min="0" max="100" step="1" value={advanceDeductionPct} onChange={e => setAdvanceDeductionPct(parseFloat(e.target.value) || 0)} className="input-field max-w-[120px]" />
              <p className="text-xs text-gray-400 mt-1">Percentage deducted per pay period from net salary to repay advances.</p>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Sidebar Sections</label>
            <p className="text-xs text-gray-400 mb-3">Hide sections from the sidebar navigation.</p>
            <div className="space-y-2">
              {planRank >= 1 && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={!!hiddenGroups['My Ledger Book']} onChange={e => setHiddenGroups({ ...hiddenGroups, 'My Ledger Book': e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">Hide My Ledger Book</span>
                </label>
              )}
              {planRank >= 2 && (
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={!!hiddenGroups['My Business']} onChange={e => setHiddenGroups({ ...hiddenGroups, 'My Business': e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className="text-sm text-gray-700">Hide My Business</span>
                </label>
              )}
            </div>
          </div>

          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
        </div>
        {pwMsg && <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${pwMsg === 'Password updated successfully.' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{pwMsg}</div>}
        <form onSubmit={handlePasswordChange} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input type="password" value={pw.current_password} onChange={e => setPw({ ...pw, current_password: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={pw.new_password} onChange={e => setPw({ ...pw, new_password: e.target.value })} className="input-field" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={pw.confirm} onChange={e => setPw({ ...pw, confirm: e.target.value })} className="input-field" required />
          </div>
          <button type="submit" disabled={pwSaving} className="btn-primary">{pwSaving ? 'Updating...' : 'Update Password'}</button>
        </form>
      </div>
    </div>
  );
};

export default Settings;
