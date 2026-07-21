import React, { useState, useEffect, useMemo, useRef } from 'react';
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

const TAB_ICONS = {
  general: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  business: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  sidebar: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>,
  einvoice: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  whatsapp: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  invoice_templates: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  password: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  staff: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m1-7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
};

const ALL_TABS = [
  { key: 'general',    label: 'General' },
  { key: 'business',   label: 'Business' },
  { key: 'sidebar',    label: 'Sidebar' },
  { key: 'einvoice',   label: 'E-Invoicing' },
  { key: 'whatsapp',   label: 'WhatsApp' },
  { key: 'invoice_templates', label: 'Templates' },
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

  const msgRef = useRef(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (message) {
      setTimeout(() => msgRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    }
  }, [message]);
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
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
        activeTab === tabKey
          ? 'border-[var(--primary-600)] text-[var(--primary-600)]'
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
    >
      {TAB_ICONS[tabKey]}
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200 flex gap-2 overflow-x-auto -mx-6 px-6">
        {visibleTabs.map(t => <TabButton key={t.key} tabKey={t.key} label={t.label} />)}
      </div>

      {activeTab === 'general' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
            <p className="text-xs text-gray-400 mt-0.5">Branding, appearance, and your profile</p>
          </div>
          {message && (() => {
  const isErr = message.includes('Failed');
  return <div ref={msgRef} className={`mx-6 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${isErr ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
    {isErr ? (
      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) : (
      <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
    )}
    <span className="flex-1">{message}</span>
    <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>;
})()}
          <form onSubmit={handleSave} className="p-6 space-y-7">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 112.828 2.828l-8.486 8.485H7v-2.343l8.486-8.486z" /></svg>
                <span className="text-sm font-semibold text-gray-900">Branding</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
                <div className="flex items-center gap-4">
                  <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-12 h-10 rounded border border-gray-300 cursor-pointer" />
                  <code className="text-sm text-gray-500">{primaryColor}</code>
                </div>
                <p className="text-xs text-gray-400 mt-1">Used for primary buttons, active states, and accent elements.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
                <span className="text-sm font-semibold text-gray-900">Sidebar</span>
              </div>
              <div className="flex items-center gap-2">
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
                  <span className="text-xs text-gray-400 ml-1">Text color adapts automatically.</span>
                </div>
              )}
              <p className="text-xs text-gray-400">Left navigation panel theme. Saved with this form.</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="text-sm font-semibold text-gray-900">Profile</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                  <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="input-field" placeholder="Your Company Name" required />
                </div>
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
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field max-w-md" placeholder="Email address" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-5 flex justify-end">
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'business' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Business Settings</h3>
            <p className="text-xs text-gray-400 mt-0.5">Localization and regional preferences</p>
          </div>
          {message && (() => {
  const isErr = message.includes('Failed');
  return <div ref={msgRef} className={`mx-6 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${isErr ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
    {isErr ? (
      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) : (
      <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
    )}
    <span className="flex-1">{message}</span>
    <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>;
})()}
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              <span className="text-sm font-semibold text-gray-900">Currency & Region</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
                <input type="text" value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)} className="input-field" placeholder="₹" />
                <p className="text-xs text-gray-400 mt-1">Displayed across all financial screens.</p>
              </div>
              {planRank >= 2 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Country Code</label>
                  <input type="text" value={countryCode} onChange={e => setCountryCode(e.target.value)} className="input-field" placeholder="+965" />
                  <p className="text-xs text-gray-400 mt-1">Pre-filled in phone number fields.</p>
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-5 flex justify-end">
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'sidebar' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Sidebar Customization</h3>
            <p className="text-xs text-gray-400 mt-0.5">Rename sections and control visibility in the navigation</p>
          </div>
          {message && (() => {
  const isErr = message.includes('Failed');
  return <div ref={msgRef} className={`mx-6 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${isErr ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
    {isErr ? (
      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) : (
      <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
    )}
    <span className="flex-1">{message}</span>
    <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>;
})()}
          <form onSubmit={handleSave} className="p-6 space-y-7">
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                <span className="text-sm font-semibold text-gray-900">Sidebar Labels</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 max-w-xl">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Store / Multi-Entity</label>
                  <input type="text" value={groupLabels['Entities']} onChange={e => setGroupLabels({ ...groupLabels, 'Entities': e.target.value })}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Entity Name (singular)</label>
                  <input type="text" value={groupLabels['EntityName']} onChange={e => setGroupLabels({ ...groupLabels, 'EntityName': e.target.value })}
                    className="input-field" placeholder="Store / Entity" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Ledger / Bahi Book Section</label>
                  <input type="text" value={groupLabels['My Bahi Book']} onChange={e => setGroupLabels({ ...groupLabels, 'My Bahi Book': e.target.value })}
                    className="input-field" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Staff Section</label>
                  <input type="text" value={groupLabels['My Staff']} onChange={e => setGroupLabels({ ...groupLabels, 'My Staff': e.target.value })}
                    className="input-field" />
                </div>
                {planRank >= 2 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Business Section</label>
                    <input type="text" value={groupLabels['My Business']} onChange={e => setGroupLabels({ ...groupLabels, 'My Business': e.target.value })}
                      className="input-field" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59" /></svg>
                <span className="text-sm font-semibold text-gray-900">Visibility</span>
              </div>
              {planRank < 2 ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">Hide sections from the sidebar navigation.</p>
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
              ) : (
                <p className="text-xs text-gray-400">Visibility controls available on lower plans. Edit now applies on save.</p>
              )}
            </div>
            <div className="border-t border-gray-100 pt-5 flex justify-end">
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
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
            <p className="text-xs text-gray-400 mt-0.5">Generate IRN for B2B invoices via NIC IRP</p>
          </div>
          {message && (() => {
  const isErr = message.includes('Failed');
  return <div ref={msgRef} className={`mx-6 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${isErr ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
    {isErr ? (
      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) : (
      <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
    )}
    <span className="flex-1">{message}</span>
    <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>;
})()}
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="text-sm font-semibold text-gray-900">Configuration</span>
            </div>
            <p className="text-xs text-gray-400">Configure your business details for e-invoice generation. Mandatory for businesses with ₹5Cr+ turnover.</p>
            <form onSubmit={handleSave} className="space-y-5">
              <label className="flex items-center gap-2.5 cursor-pointer pb-2">
                <input type="checkbox" checked={seller.einvoiceEnabled} onChange={e => setSeller({ ...seller, einvoiceEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700 font-medium">Enable e-invoicing</span>
              </label>
              {seller.einvoiceEnabled && (
                <div className="space-y-5 pl-6 border-l-2 border-indigo-200">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Seller Business Details</h4>
                    <div className="space-y-4">
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
                    </div>
                  </div>
                  <hr className="border-gray-200" />
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 mb-3">IRP API Credentials</h4>
                    <p className="text-xs text-gray-400 mb-4">Leave blank to use simulation mode (mock IRN for testing).</p>
                    <div className="space-y-4">
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
                  </div>
                </div>
              )}
              <div className="border-t border-gray-100 pt-5 flex justify-end">
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
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
            <p className="text-xs text-gray-400 mt-0.5">Send invoice and PO notifications via Twilio</p>
          </div>
          {message && (() => {
  const isErr = message.includes('Failed');
  return <div ref={msgRef} className={`mx-6 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${isErr ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
    {isErr ? (
      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) : (
      <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
    )}
    <span className="flex-1">{message}</span>
    <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>;
})()}
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              <span className="text-sm font-semibold text-gray-900">Configuration</span>
            </div>
            <form onSubmit={handleSave} className="space-y-5">
              <label className="flex items-center gap-2.5 cursor-pointer pb-1">
                <input type="checkbox" checked={whatsapp.whatsappEnabled} onChange={e => setWhatsapp({ ...whatsapp, whatsappEnabled: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm text-gray-700 font-medium">Enable WhatsApp notifications</span>
              </label>
              {whatsapp.whatsappEnabled && (
                <div className="space-y-4 pl-6 border-l-2 border-indigo-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Your WhatsApp Number</label>
                    <input type="text" value={whatsapp.whatsappPhone} onChange={e => setWhatsapp({ ...whatsapp, whatsappPhone: e.target.value })}
                      className="input-field max-w-[240px]" placeholder="+919999999999" />
                    <p className="text-xs text-gray-400 mt-1">The business WhatsApp number (must be opted in with Twilio).</p>
                  </div>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={whatsapp.autoSendInvoice} onChange={e => setWhatsapp({ ...whatsapp, autoSendInvoice: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Auto-send on invoice creation</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" checked={whatsapp.autoSendPO} onChange={e => setWhatsapp({ ...whatsapp, autoSendPO: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className="text-sm text-gray-700">Auto-send on purchase order creation</span>
                  </label>
                </div>
              )}
              <div className="border-t border-gray-100 pt-5 flex justify-end">
                <button type="submit" className="btn-primary">Save Changes</button>
              </div>
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
            <p className="text-xs text-gray-400 mt-0.5">Update your account password</p>
          </div>
          {pwMsg && <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${pwMsg === 'Password updated successfully.' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{pwMsg}</div>}
          <form onSubmit={handlePasswordChange} className="p-6 space-y-5 max-w-md">
            <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              <span className="text-sm font-semibold text-gray-900">Credentials</span>
            </div>
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
            <div className="pt-2">
              <button type="submit" disabled={pwSaving} className="btn-primary">{pwSaving ? 'Updating...' : 'Update Password'}</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-gray-900">Staff Configuration</h3>
            <p className="text-xs text-gray-400 mt-0.5">Employee fields, attendance, and payroll settings</p>
          </div>
          {message && (() => {
  const isErr = message.includes('Failed');
  return <div ref={msgRef} className={`mx-6 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${isErr ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
    {isErr ? (
      <svg className="w-4 h-4 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) : (
      <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
    )}
    <span className="flex-1">{message}</span>
    <button type="button" onClick={() => setMessage('')} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  </div>;
})()}
          <form onSubmit={handleSave} className="p-6 space-y-7">

            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <span className="text-sm font-semibold text-gray-900">Employee Form Fields</span>
              </div>
              <p className="text-xs text-gray-400">Choose which fields appear in employee forms. Name and Phone are always visible.</p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {EMPLOYEE_FIELDS.map(field => (
                  <label key={field.key} className="flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                    <input type="checkbox" checked={employeeFormFields[field.key]} onChange={e => setEmployeeFormFields({ ...employeeFormFields, [field.key]: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)]" />
                    <span className="text-sm text-gray-700">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-sm font-semibold text-gray-900">Attendance Settings</span>
              </div>
              <div className="flex items-center gap-2.5">
                <input type="checkbox" id="hourBasedAttendance" checked={hourBasedAttendance}
                  onChange={e => setHourBasedAttendance(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[var(--primary-600)] focus:ring-[var(--primary-500)] shrink-0" />
                <label htmlFor="hourBasedAttendance" className="text-sm text-gray-700 cursor-pointer font-medium whitespace-nowrap">Hour-Based Attendance</label>
                <span className="text-xs text-gray-400 leading-snug"> (When enabled, attendance is tracked by hours worked. Status is derived from the entered hours.)</span>
              </div>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
                <div className="w-full sm:w-auto sm:min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Work Hours in a Day</label>
                  <input type="text" inputMode="decimal" value={workHoursInDay} onChange={e => setWorkHoursInDay(sanitizeDecimal(e.target.value))} disabled={!hourBasedAttendance} className={`input-field transition-opacity ${!hourBasedAttendance ? 'opacity-50 cursor-not-allowed' : ''}`} />
                </div>
              </div>
              <p className="text-xs text-gray-400">Used to calculate Pay Per Hour. Formula: Monthly Salary / (30 × Work Hours).</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                <span className="text-sm font-semibold text-gray-900">Payroll Defaults</span>
              </div>
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 mb-1">Advance Deduction (% of Net Salary)</label>
                <input type="text" inputMode="decimal" value={advanceDeductionPct} onChange={e => setAdvanceDeductionPct(sanitizeDecimal(e.target.value))} className="input-field" />
                <p className="text-xs text-gray-400 mt-1">Percentage deducted per pay period from net salary to repay advances.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2.5 pb-1.5 border-b border-gray-100">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <span className="text-sm font-semibold text-gray-900">Weekend Days</span>
              </div>
              <p className="text-xs text-gray-400">Days marked as weekends in the attendance calendar.</p>
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

            <div className="border-t border-gray-100 pt-5 flex justify-end">
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </div>
  );
};

export default Settings;
