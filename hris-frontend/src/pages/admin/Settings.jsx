import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { applyTheme } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import UpgradeModal from '../../components/UpgradeModal';
import { getRank } from '../../config/subscriptionPlans';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TABS = [
  { key: 'general',    label: 'General' },
  { key: 'business',   label: 'Business' },
  { key: 'sidebar',    label: 'Sidebar' },
  { key: 'einvoice',   label: 'E-Invoicing' },
  { key: 'whatsapp',   label: 'WhatsApp' },
  { key: 'password',   label: 'Password' },
];

const Settings = () => {
  const navigate = useNavigate();
  const { tab } = useParams();
  const activeTab = tab || 'general';
  const { user, tenant, updateUser } = useAuth();
  const planRank = getRank(tenant?.subscriptionPlan);

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [weekendDays, setWeekendDays] = useState([0]);
  const [taxRate, setTaxRate] = useState(18);
  const [advanceDeductionPct, setAdvanceDeductionPct] = useState(10);
  const [hiddenGroups, setHiddenGroups] = useState({});
  const [groupLabels, setGroupLabels] = useState({
    'Entities': 'Entities',
    'My Bahi Book': 'My Bahi Book',
    'My Business': 'My Business',
    'My Staff': 'My Staff',
  });
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [countryCode, setCountryCode] = useState(localStorage.getItem('default_country_code') || '+965');
  const [hideTempPassword, setHideTempPassword] = useState(false);
  const [seller, setSeller] = useState({
    sellerGstin: '', sellerLegalName: '', sellerAddress: '', sellerCity: '',
    sellerState: '', sellerPincode: '', sellerEmail: '',
    einvoiceEnabled: false, irpClientId: '', irpClientSecret: '', irpUsername: '', irpGstin: '',
  });
  const [whatsapp, setWhatsapp] = useState({ whatsappEnabled: false, whatsappPhone: '', autoSendInvoice: false, autoSendPO: false });
  const [whatsappLoaded, setWhatsappLoaded] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
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
      if (res.settings?.groupLabels) setGroupLabels(prev => ({ ...prev, ...res.settings.groupLabels }));
      if (res.settings?.currencySymbol) {
        setCurrencySymbol(res.settings.currencySymbol);
        localStorage.setItem('currency_symbol', res.settings.currencySymbol);
      }
      if (res.settings?.countryCode) {
        setCountryCode(res.settings.countryCode);
        localStorage.setItem('default_country_code', res.settings.countryCode);
      }
      if (res.settings?.hideTempPassword !== undefined) {
        setHideTempPassword(res.settings.hideTempPassword);
        localStorage.setItem('hide_temp_password', res.settings.hideTempPassword ? 'true' : 'false');
      }
      if (res.settings?.sellerGstin) setSeller(s => ({ ...s, sellerGstin: res.settings.sellerGstin }));
      if (res.settings?.sellerLegalName) setSeller(s => ({ ...s, sellerLegalName: res.settings.sellerLegalName }));
      if (res.settings?.sellerAddress) setSeller(s => ({ ...s, sellerAddress: res.settings.sellerAddress }));
      if (res.settings?.sellerCity) setSeller(s => ({ ...s, sellerCity: res.settings.sellerCity }));
      if (res.settings?.sellerState) setSeller(s => ({ ...s, sellerState: res.settings.sellerState }));
      if (res.settings?.sellerPincode) setSeller(s => ({ ...s, sellerPincode: res.settings.sellerPincode }));
      if (res.settings?.sellerEmail) setSeller(s => ({ ...s, sellerEmail: res.settings.sellerEmail }));
      if (res.settings?.einvoiceEnabled !== undefined) setSeller(s => ({ ...s, einvoiceEnabled: res.settings.einvoiceEnabled }));
      if (res.settings?.irpClientId) setSeller(s => ({ ...s, irpClientId: res.settings.irpClientId }));
      if (res.settings?.irpClientSecret) setSeller(s => ({ ...s, irpClientSecret: res.settings.irpClientSecret }));
      if (res.settings?.irpUsername) setSeller(s => ({ ...s, irpUsername: res.settings.irpUsername }));
      if (res.settings?.irpGstin) setSeller(s => ({ ...s, irpGstin: res.settings.irpGstin }));
    }).catch(() => {});

    if (planRank >= 2) {
      hrService.whatsappGetSettings().then(setWhatsapp).catch(() => {}).finally(() => setWhatsappLoaded(true));
    }
  }, []);

  const toggleWeekendDay = (day) => {
    setWeekendDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.updateTenantSettings({
        companyName,
        settings: { primaryColor, weekendDays, taxRate, advanceDeductionPct, hiddenGroups, groupLabels, currencySymbol, countryCode, hideTempPassword, ...seller, ...whatsapp }
      });
      localStorage.setItem('hidden_groups', JSON.stringify(hiddenGroups));
      localStorage.setItem('group_labels', JSON.stringify(groupLabels));
      localStorage.setItem('currency_symbol', currencySymbol);
      localStorage.setItem('default_country_code', countryCode);
      localStorage.setItem('hide_temp_password', hideTempPassword ? 'true' : 'false');
      window.dispatchEvent(new CustomEvent('settings-saved', { detail: { hiddenGroups, groupLabels } }));
      if (firstName || lastName) {
        const profileRes = await hrService.updateProfile({ first_name: firstName, last_name: lastName, email, phone: user?.phone || '' });
        if (profileRes?.user) updateUser(profileRes.user);
      }
      setMessage(res.message || 'Settings saved.');
      applyTheme(primaryColor);
      localStorage.setItem('tenant_name', companyName);
      window.dispatchEvent(new CustomEvent('currency-changed'));
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

  const TabButton = ({ tabKey, label }) => (
    <button
      onClick={() => navigate(`/admin/settings${tabKey === 'general' ? '' : `/${tabKey}`}`)}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
        activeTab === tabKey ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => <TabButton key={t.key} tabKey={t.key} label={t.label} />)}
      </div>

      {activeTab === 'general' && (
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
            {planRank >= 3 && (
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
            <button type="submit" className="btn-primary">Save Changes</button>
          </form>
        </div>
      )}

      {activeTab === 'business' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Business Settings</h3>
          </div>
          {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
          <form onSubmit={handleSave} className="p-6 space-y-6">
            {planRank >= 2 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (GST %)</label>
                <input type="number" min="0" max="100" step="0.5" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className="input-field max-w-[120px]" />
              </div>
            )}
            {planRank >= 3 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Deduction (% of Net Salary)</label>
                <input type="number" min="0" max="100" step="1" value={advanceDeductionPct} onChange={e => setAdvanceDeductionPct(parseFloat(e.target.value) || 0)} className="input-field max-w-[120px]" />
                <p className="text-xs text-gray-400 mt-1">Percentage deducted per pay period from net salary to repay advances.</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
              <input type="text" value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)} className="input-field max-w-[100px]" placeholder="₹" />
              <p className="text-xs text-gray-400 mt-1">Used for all displays.</p>
            </div>
            {planRank >= 2 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Country Code</label>
                <input type="text" value={countryCode} onChange={e => setCountryCode(e.target.value)} className="input-field max-w-[120px]" placeholder="+965" />
                <p className="text-xs text-gray-400 mt-1">Pre-filled in phone number fields.</p>
              </div>
            )}
            {planRank >= 3 && (
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={hideTempPassword} onChange={e => setHideTempPassword(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">Hide Temp Password field on onboarding</span>
              </label>
            )}
            <button type="submit" className="btn-primary">Save Changes</button>
          </form>
        </div>
      )}

      {activeTab === 'sidebar' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Sidebar Customization</h3>
          </div>
          {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sidebar Labels</label>
              <p className="text-xs text-gray-400 mb-3">Customize the names of sidebar sections.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{planRank <= 1 ? 'My Stores' : 'Entities'}</label>
                  <input type="text" value={groupLabels['Entities']} onChange={e => setGroupLabels({ ...groupLabels, 'Entities': e.target.value })}
                    className="input-field max-w-[240px]" />
                </div>
                {planRank < 1 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Bahi Book Section</label>
                    <input type="text" value={groupLabels['My Bahi Book']} onChange={e => setGroupLabels({ ...groupLabels, 'My Bahi Book': e.target.value })}
                      className="input-field max-w-[240px]" />
                  </div>
                )}
                {planRank >= 2 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Business Section</label>
                    <input type="text" value={groupLabels['My Business']} onChange={e => setGroupLabels({ ...groupLabels, 'My Business': e.target.value })}
                      className="input-field max-w-[240px]" />
                  </div>
                )}
                {planRank >= 3 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Staff Section</label>
                    <input type="text" value={groupLabels['My Staff']} onChange={e => setGroupLabels({ ...groupLabels, 'My Staff': e.target.value })}
                      className="input-field max-w-[240px]" />
                  </div>
                )}
              </div>
            </div>
            {planRank < 2 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hide Sections</label>
                <p className="text-xs text-gray-400 mb-3">Hide sections from the sidebar navigation.</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!hiddenGroups['My Bahi Book']} onChange={e => setHiddenGroups({ ...hiddenGroups, 'My Bahi Book': e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)]" />
                    <span className="text-sm text-gray-700">Hide {groupLabels['My Bahi Book']}</span>
                  </label>
                  {planRank >= 3 && (
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={!!hiddenGroups['My Business']} onChange={e => setHiddenGroups({ ...hiddenGroups, 'My Business': e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)]" />
                      <span className="text-sm text-gray-700">Hide {groupLabels['My Business']}</span>
                    </label>
                  )}
                </div>
              </div>
            )}
            <button type="submit" className="btn-primary">Save Changes</button>
          </form>
        </div>
      )}

      {activeTab === 'einvoice' && planRank < 2 && (
        <div className="card p-6 text-center">
          <p className="text-gray-500 text-sm">E-Invoicing is available on the <span className="font-semibold text-indigo-600">Business</span> plan and above.</p>
          <button onClick={() => setShowUpgrade(true)} className="btn-primary mt-4">Upgrade Now</button>
        </div>
      )}
      {activeTab === 'einvoice' && planRank >= 2 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">E-Invoicing (GST)</h3>
          </div>
          {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
          <div className="p-6 space-y-4">
            <p className="text-xs text-gray-400">Configure your business details for e-invoice generation (IRN) via NIC IRP. Mandatory for businesses with ₹5Cr+ turnover.</p>
            <form onSubmit={handleSave} className="space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={seller.einvoiceEnabled} onChange={e => setSeller({ ...seller, einvoiceEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">Enable e-invoicing (generate IRN for B2B invoices)</span>
              </label>
              {seller.einvoiceEnabled && (
                <div className="space-y-4 pl-6 border-l-2 border-indigo-200">
                  <h4 className="text-sm font-semibold text-gray-800">Seller Business Details</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GSTIN</label>
                    <input type="text" value={seller.sellerGstin} onChange={e => setSeller({ ...seller, sellerGstin: e.target.value })}
                      className="input-field" placeholder="29AAAAA0000A1Z5" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name (as per GST)</label>
                    <input type="text" value={seller.sellerLegalName} onChange={e => setSeller({ ...seller, sellerLegalName: e.target.value })}
                      className="input-field" placeholder="ABC Pvt Ltd" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Registered Address</label>
                    <input type="text" value={seller.sellerAddress} onChange={e => setSeller({ ...seller, sellerAddress: e.target.value })}
                      className="input-field" placeholder="123, Main Street" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                      <input type="text" value={seller.sellerCity} onChange={e => setSeller({ ...seller, sellerCity: e.target.value })}
                        className="input-field" placeholder="Bengaluru" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                      <input type="text" value={seller.sellerState} onChange={e => setSeller({ ...seller, sellerState: e.target.value })}
                        className="input-field" placeholder="Karnataka" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                      <input type="text" value={seller.sellerPincode} onChange={e => setSeller({ ...seller, sellerPincode: e.target.value })}
                        className="input-field" placeholder="560001" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email (for IRP communication)</label>
                    <input type="email" value={seller.sellerEmail} onChange={e => setSeller({ ...seller, sellerEmail: e.target.value })}
                      className="input-field" placeholder="admin@example.com" />
                  </div>
                  <hr className="border-gray-200" />
                  <h4 className="text-sm font-semibold text-gray-800">IRP API Credentials</h4>
                  <p className="text-xs text-gray-400">Leave blank to use simulation mode (mock IRN for testing).</p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IRP Client ID</label>
                    <input type="text" value={seller.irpClientId} onChange={e => setSeller({ ...seller, irpClientId: e.target.value })}
                      className="input-field" placeholder="From NIC registration" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IRP Client Secret</label>
                    <input type="password" value={seller.irpClientSecret} onChange={e => setSeller({ ...seller, irpClientSecret: e.target.value })}
                      className="input-field" placeholder="••••••••" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IRP Username</label>
                    <input type="text" value={seller.irpUsername} onChange={e => setSeller({ ...seller, irpUsername: e.target.value })}
                      className="input-field" placeholder="e-invoice portal username" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IRP GSTIN (if different)</label>
                    <input type="text" value={seller.irpGstin} onChange={e => setSeller({ ...seller, irpGstin: e.target.value })}
                      className="input-field" placeholder="Leave blank to use seller GSTIN" />
                  </div>
                </div>
              )}
              <button type="submit" className="btn-primary">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'whatsapp' && planRank < 2 && (
        <div className="card p-6 text-center">
          <p className="text-gray-500 text-sm">WhatsApp notifications are available on the <span className="font-semibold text-indigo-600">Business</span> plan and above.</p>
          <button onClick={() => setShowUpgrade(true)} className="btn-primary mt-4">Upgrade Now</button>
        </div>
      )}
      {activeTab === 'whatsapp' && planRank >= 2 && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">WhatsApp Notifications</h3>
          </div>
          {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
          <div className="p-6 space-y-4">
            <p className="text-xs text-gray-400">Send invoice/PO notifications via WhatsApp using Twilio.</p>
            <form onSubmit={handleSave} className="space-y-4">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={whatsapp.whatsappEnabled} onChange={e => setWhatsapp({ ...whatsapp, whatsappEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">Enable WhatsApp notifications</span>
              </label>
              {whatsapp.whatsappEnabled && (
                <div className="space-y-4 pl-6 border-l-2 border-indigo-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your WhatsApp Number</label>
                    <input type="text" value={whatsapp.whatsappPhone} onChange={e => setWhatsapp({ ...whatsapp, whatsappPhone: e.target.value })}
                      className="input-field max-w-[200px]" placeholder="+919999999999" />
                    <p className="text-xs text-gray-400 mt-1">The business WhatsApp number (must be opted in with Twilio).</p>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={whatsapp.autoSendInvoice} onChange={e => setWhatsapp({ ...whatsapp, autoSendInvoice: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Auto-send WhatsApp when creating invoices</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={whatsapp.autoSendPO} onChange={e => setWhatsapp({ ...whatsapp, autoSendPO: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Auto-send WhatsApp when creating purchase orders</span>
                  </label>
                </div>
              )}
              <button type="submit" className="btn-primary">Save Changes</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'password' && (
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
      )}

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default Settings;
