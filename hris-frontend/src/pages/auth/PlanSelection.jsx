import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';
import { getDefaultCountryCode } from '../../services/auth.service';

const PLAN_ICONS = {
  free: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  pro: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
  enterprise: <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
};

const PLAN_COLORS = {
  free: { border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700', hover: 'hover:border-gray-300', selected: 'ring-2 ring-gray-400' },
  pro: { border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-700', hover: 'hover:border-indigo-300', selected: 'ring-2 ring-indigo-500' },
  enterprise: { border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700', hover: 'hover:border-purple-300', selected: 'ring-2 ring-purple-500' },
};

const PlanSelection = () => {
  const navigate = useNavigate();
  const { user, tenant, login } = useAuth();
  const [plans, setPlans] = useState([]);
  const [countryCode, setCountryCode] = useState('+965');
  const [phone, setPhone] = useState(tenant?.phone || '');
  const [selectedPlan, setSelectedPlan] = useState(tenant?.subscriptionPlan || 'free');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getDefaultCountryCode().then(setCountryCode);
  }, []);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setLoading(true);
    hrService.getPlans()
      .then(data => setPlans(data.plans))
      .catch(() => setPlans([
        { id: 'free', name: 'Free', price: 0, features: ['My Ledger Book'] },
        { id: 'pro', name: 'Pro', price: 0, features: ['Everything in Free', 'Business Module'] },
        { id: 'enterprise', name: 'Enterprise', price: 0, features: ['Everything in Pro', 'Staff Management'] },
      ]))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) { setError('Phone number is required.'); return; }
    setSaving(true);
    setError('');
    try {
      const result = await hrService.selectPlan(selectedPlan, phone);
      const tenantData = { ...tenant, subscriptionPlan: result.plan, phone: result.phone };
      login(user, localStorage.getItem('auth_token'), tenantData);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save plan.');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-indigo-50/30 to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <img src="/icon_logo.png" alt="bahi360" className="w-16 h-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Welcome to {tenant?.company_name || 'bahi360'}</h1>
          <p className="text-gray-500 mt-1">Choose a plan to get started. You can upgrade anytime.</p>
        </div>

        <div className="card p-6 md:p-8 mb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">{countryCode}</span>
                <input
                  type="tel"
                  value={phone.replace(countryCode, '')}
                  onChange={e => {
                    const val = e.target.value.replace(/\s/g, '');
                    if (val === '' || /^\d+$/.test(val)) setPhone(countryCode + val);
                  }}
                  placeholder="5xxxxxxxx"
                  className="input-field pl-16"
                  required
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Your phone number helps us verify your account.</p>
            </div>

            {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

            {loading ? (
              <div className="text-center text-gray-400 py-8">Loading plans...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans.map(plan => {
                  const colors = PLAN_COLORS[plan.id];
                  const isSelected = selectedPlan === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`relative p-5 rounded-xl border-2 text-left transition-all duration-200 ${
                        isSelected ? colors.selected + ' shadow-md' : colors.border + ' ' + colors.hover + ' shadow-sm'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </span>
                      )}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${colors.badge}`}>
                        {PLAN_ICONS[plan.id]}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {plan.price === 0 ? 'Free' : `Rs.${plan.price}`}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}

            <button type="submit" disabled={saving || loading} className="btn-primary w-full !py-3 text-base">
              {saving ? 'Saving...' : 'Continue to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;
