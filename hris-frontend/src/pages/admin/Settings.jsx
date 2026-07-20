import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { hrService } from '../../services/hr.service';
import { applyTheme, applySidebarTheme } from '../../utils/currency';
import { useAuth } from '../../context/AuthContext';
import UpgradeModal from '../../components/UpgradeModal';
import InvoiceTemplates from './InvoiceTemplates';
import { getRank } from '../../config/subscriptionPlans';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Keep only digits and a single decimal point (mirrors the payroll decimal input UX).
function sanitizeDecimal(v) {
  let s = (v || '').replace(/[^0-9.]/g, '');
  const dot = s.indexOf('.');
  if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '');
  return s;
}

// Parse a decimal string, preserving 0 (unlike `x || fallback` which drops it).
// Falls back only when the value is empty or not a number.
function parseDecimal(v, fallback) {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = parseFloat(v);
  return Number.isNaN(n) ? fallback : n;
}

const EMPLOYEE_FIELDS = [
  { key: 'email', label: 'Work Email' },
  { key: 'role', label: 'Role' },
  { key: 'jobType', label: 'Job Type' },
  { key: 'baseSalary', label: 'Monthly Salary' },
  { key: 'payPerHour', label: 'Pay Per Hour' },
  { key: 'profession', label: 'Profession' },
  { key: 'password', label: 'Temp Password (onboarding)' },
];

const ALL_TABS = [
  { key: 'general',    label: 'General' },
  { key: 'business',   label: 'Business' },
  { key: 'sidebar',    label: 'Sidebar' },
  { key: 'einvoice',   label: 'E-Invoicing' },
  { key: 'whatsapp',   label: 'WhatsApp' },
  { key: 'invoice_templates', label: 'Invoice Templates' },
  { key: 'password',   label: 'Password' },
  { key: 'staff',      label: 'My Staff' },
];

const Settings = () => {
  const navigate = useNavigate();
  const { tab } = useParams();
  const activeTab = tab || 'general';
  const { user, tenant, updateUser } = useAuth();
  const planRank = getRank(tenant?.subscriptionPlan);
  const visibleTabs = useMemo(() => {
    if (planRank < 2) return ALL_TABS.filter(t => t.key !== 'einvoice' && t.key !== 'whatsapp' && t.key !== 'invoice_templates');
    return ALL_TABS;
  }, [planRank]);

  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [primaryColor, setPrimaryColor] = useState('#4f46e5');
  const [sidebarMode, setSidebarMode] = useState('light');
  const [sidebarColor, setSidebarColor] = useState('#0B3C5D');
  const [weekendDays, setWeekendDays] = useState([0]);
  const [advanceDeductionPct, setAdvanceDeductionPct] = useState('10');
  const [hiddenGroups, setHiddenGroups] = useState({});
  const [hiddenItems, setHiddenItems] = useState({});
  const [groupLabels, setGroupLabels] = useState({
    'Entities': 'Entities',
    'My Bahi Book': 'My Bahi Book',
    'My Business': 'My Business',
    'My Staff': 'My Staff',
    'EntityName': '',
  });
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [countryCode, setCountryCode] = useState(localStorage.getItem('default_country_code') || '+965');
  const [workHoursInDay, setWorkHoursInDay] = useState('8');
  const [hourBasedAttendance, setHourBasedAttendance] = useState(false);
  const [employeeFormFields, setEmployeeFormFields] = useState({
    email: true, role: true, jobType: true, baseSalary: true, payPerHour: true, profession: true, password: true,
  });
  const [seller, setSeller] = useState({
    sellerGstin: '', sellerLegalName: '', sellerAddress: '', sellerCity: '',
    sellerState: '', sellerPincode: '', sellerEmail: '',
    einvoiceEnabled: false, irpClientId: '', irpClientSecret: '', irpUsername: '', irpGstin: '',
  });
  const [whatsapp, setWhatsapp] = useState({ whatsappEnabled: false, whatsappPhone: '', autoSendInvoice: false, autoSendPO: false });
  const [whatsappLoaded, setWhatsappLoaded] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  useEffect(() => {
    if (planRank < 2 && (activeTab === 'einvoice' || activeTab === 'whatsapp' || activeTab === 'invoice_templates')) {
      navigate('/admin/settings/general', { replace: true });
    }
  }, [planRank, activeTab, navigate]);

  const [message, setMessage] = useState('');
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    hrService.getTenantSettings().then(res => {
      setCompanyName(res.companyName || '');
      if (res.settings?.primaryColor) setPrimaryColor(res.settings.primaryColor);
      if (res.settings?.sidebarMode) setSidebarMode(res.settings.sidebarMode);
      if (res.settings?.sidebarColor) setSidebarColor(res.settings.sidebarColor);
      if (res.settings?.weekendDays) setWeekendDays(res.settings.weekendDays);
      if (res.settings?.advanceDeductionPct !== undefined) setAdvanceDeductionPct(String(res.settings.advanceDeductionPct));
      if (res.settings?.hiddenGroups) setHiddenGroups(res.settings.hiddenGroups);
      if (res.settings?.hiddenItems) setHiddenItems(res.settings.hiddenItems);
      if (res.settings?.groupLabels) setGroupLabels(prev => ({ ...prev, ...res.settings.groupLabels }));
      if (res.settings?.currencySymbol) {
        setCurrencySymbol(res.settings.currencySymbol);
        localStorage.setItem('currency_symbol', res.settings.currencySymbol);
      }
      if (res.settings?.countryCode) {
        setCountryCode(res.settings.countryCode);
        localStorage.setItem('default_country_code', res.settings.countryCode);
      }
      if (res.settings?.workHoursInDay !== undefined) setWorkHoursInDay(String(res.settings.workHoursInDay));
      if (res.settings?.hourBasedAttendance !== undefined) setHourBasedAttendance(res.settings.hourBasedAttendance);
      if (res.settings?.employeeFormFields) {
        setEmployeeFormFields(res.settings.employeeFormFields);
      } else if (res.settings?.hideTempPassword) {
        setEmployeeFormFields(prev => ({ ...prev, password: false }));
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
        settings: { primaryColor, sidebarMode, sidebarColor, weekendDays, workHoursInDay: parseDecimal(workHoursInDay, 8), hourBasedAttendance, advanceDeductionPct: parseDecimal(advanceDeductionPct, 0), hiddenGroups, hiddenItems, groupLabels, employeeFormFields, currencySymbol, countryCode, ...seller, ...whatsapp }
      });
      localStorage.setItem('hidden_groups', JSON.stringify(hiddenGroups));
      localStorage.setItem('hidden_items', JSON.stringify(hiddenItems));
      localStorage.setItem('group_labels', JSON.stringify(groupLabels));
      localStorage.setItem('currency_symbol', currencySymbol);
      localStorage.setItem('default_country_code', countryCode);
      localStorage.setItem('employee_form_fields', JSON.stringify(employeeFormFields));
      window.dispatchEvent(new CustomEvent('settings-saved', { detail: { hiddenGroups, hiddenItems, groupLabels } }));
      if (firstName || lastName) {
        const profileRes = await hrService.updateProfile({ first_name: firstName, last_name: lastName, email, phone: user?.phone || '' });
        if (profileRes?.user) updateUser(profileRes.user);
      }
      setMessage(res.message || 'Settings saved.');
      applyTheme(primaryColor);
      applySidebarTheme(sidebarMode, sidebarColor);
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
        {visibleTabs.map(t => <TabButton key={t.key} tabKey={t.key} label={t.label} />)}
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

            <div className="border-t border-gray-100 pt-5">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Sidebar Appearance</h4>
              <div className="flex items-center gap-2 mb-4">
                {['light', 'dark', 'custom'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setSidebarMode(m); applySidebarTheme(m, sidebarColor); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium capitalize border transition-colors ${
                      sidebarMode === m
                        ? 'border-primary-600 text-white bg-primary-600'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {sidebarMode === 'custom' && (
                <div className="flex items-center gap-4">
                  <input
                    type="color"
                    value={sidebarColor}
                    onChange={e => { setSidebarColor(e.target.value); applySidebarTheme('custom', e.target.value); }}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <code className="text-sm text-gray-500">{sidebarColor}</code>
                  <span className="text-xs text-gray-400">Text color adapts automatically (light/dark) to your selection.</span>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">Applies to the left navigation panel. Saved with this form.</p>
            </div>

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
                  <label className="block text-xs text-gray-500 mb-1">Store</label>
                  <input type="text" value={groupLabels['Entities']} onChange={e => setGroupLabels({ ...groupLabels, 'Entities': e.target.value })}
                    className="input-field max-w-[240px]" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Entity Name (singular)</label>
                  <input type="text" value={groupLabels['EntityName']} onChange={e => setGroupLabels({ ...groupLabels, 'EntityName': e.target.value })}
                    className="input-field max-w-[240px]" placeholder="Store / Entity" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Bahi Book Section</label>
                  <input type="text" value={groupLabels['My Bahi Book']} onChange={e => setGroupLabels({ ...groupLabels, 'My Bahi Book': e.target.value })}
                    className="input-field max-w-[240px]" />
                </div>
                {planRank >= 2 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Business Section</label>
                    <input type="text" value={groupLabels['My Business']} onChange={e => setGroupLabels({ ...groupLabels, 'My Business': e.target.value })}
                      className="input-field max-w-[240px]" />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Staff Section</label>
                  <input type="text" value={groupLabels['My Staff']} onChange={e => setGroupLabels({ ...groupLabels, 'My Staff': e.target.value })}
                    className="input-field max-w-[240px]" />
                </div>
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
                      <span className="text-sm text-gray-700">Hide {groupLabels['My Business'] || 'Billing'}</span>
                    </label>
                  )}
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={!!hiddenItems['Replacements']} onChange={e => setHiddenItems({ ...hiddenItems, 'Replacements': e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)]" />
                    <span className="text-sm text-gray-700">Hide Replacements</span>
                  </label>
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

      {activeTab === 'invoice_templates' && planRank < 2 && (
        <div className="card p-6 text-center">
          <p className="text-gray-500 text-sm">Invoice Templates are available on the <span className="font-semibold text-indigo-600">Business</span> plan and above.</p>
          <button onClick={() => setShowUpgrade(true)} className="btn-primary mt-4">Upgrade Now</button>
        </div>
      )}
      {activeTab === 'invoice_templates' && planRank >= 2 && (
        <InvoiceTemplates />
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

      {activeTab === 'staff' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Staff Configuration</h3>
          </div>
          {message && <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm">{message}</div>}
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <p className="text-xs text-gray-400">Choose which employee fields to show. Employee Name and Phone are always visible.</p>
            <div className="space-y-3">
              {EMPLOYEE_FIELDS.map(field => (
                <label key={field.key} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={employeeFormFields[field.key]} onChange={e => setEmployeeFormFields({ ...employeeFormFields, [field.key]: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)]" />
                  <span className="text-sm text-gray-700">{field.label}</span>
                </label>
              ))}
            </div>
            <hr className="border-gray-200" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Work Hours in a Day</label>
              <input type="text" inputMode="decimal" value={workHoursInDay} onChange={e => setWorkHoursInDay(sanitizeDecimal(e.target.value))} className="input-field max-w-[120px]" />
              <p className="text-xs text-gray-400 mt-1">Used to calculate Pay Per Hour = Monthly Salary / (30 × Work Hours in a Day).</p>
            </div>
            <div className="flex items-center gap-2.5 pt-1">
              <input type="checkbox" id="hourBasedAttendance" checked={hourBasedAttendance}
                onChange={e => setHourBasedAttendance(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)]" />
              <label htmlFor="hourBasedAttendance" className="text-sm text-gray-700 cursor-pointer">Enable Hour-Based Attendance</label>
            </div>
            <p className="text-xs text-gray-400 ml-8 -mt-2">When enabled, attendance is tracked by hours worked instead of clock-in/out. Status is derived from entered hours.</p>
            <hr className="border-gray-200" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Advance Deduction (% of Net Salary)</label>
              <input type="text" inputMode="decimal" value={advanceDeductionPct} onChange={e => setAdvanceDeductionPct(sanitizeDecimal(e.target.value))} className="input-field max-w-[120px]" />
              <p className="text-xs text-gray-400 mt-1">Percentage deducted per pay period from net salary to repay advances.</p>
            </div>
            <hr className="border-gray-200" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weekend Days</label>
              <p className="text-xs text-gray-400 mb-2">Days marked as weekend in the attendance calendar.</p>
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
            <button type="submit" className="btn-primary">Save Changes</button>
          </form>
        </div>
      )}

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default Settings;
