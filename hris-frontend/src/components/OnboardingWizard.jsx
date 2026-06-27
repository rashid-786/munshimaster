import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { subscriptionService } from '../services/subscription.service';
import api from '../services/api';
import Loading from './Loading';

const STEPS = [
  { key: 'welcome', title: 'Welcome to Bahi360' },
  { key: 'company_name', title: 'Name Your Business' },
  { key: 'add_entry', title: 'Record Your First Entry' },
  { key: 'add_customer', title: 'Add Buyers & Sellers' },
  { key: 'done', title: 'You\'re All Set!' },
];

export default function OnboardingWizard({ open, onComplete }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [onboarding, setOnboarding] = useState(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      subscriptionService.getOnboardingStatus()
        .then(data => {
          setOnboarding(data);
          setCompanyName(data.companyName || '');
          if (data.allDone) setStepIndex(STEPS.length - 1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  const finish = useCallback(async () => {
    try {
      await subscriptionService.completeOnboarding();
      onComplete?.();
    } catch {}
  }, [onComplete]);

  const handleSaveCompany = async () => {
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      await api.put('/core/tenant/settings', { companyName: companyName.trim() });
      setOnboarding(prev => ({
        ...prev,
        steps: prev.steps.map(s => s.key === 'company_name' ? { ...s, done: true } : s),
        completedCount: prev.completedCount + 1,
        companyName: companyName.trim(),
      }));
      const next = Math.min(stepIndex + 1, STEPS.length - 1);
      setStepIndex(next);
      if (STEPS[next]?.key === 'done') {
        subscriptionService.getOnboardingStatus().then(setOnboarding).catch(() => {});
      }
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  };

  const handleSkipStep = () => {
    const next = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(next);
    if (STEPS[next]?.key === 'done') {
      subscriptionService.getOnboardingStatus().then(setOnboarding).catch(() => {});
    }
  };

  const currentStep = STEPS[stepIndex];
  const step = onboarding?.steps?.find(s => s.key === currentStep?.key);
  const isLastStep = stepIndex === STEPS.length - 1;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in relative">
        {/* Close button */}
        <button
          onClick={finish}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Dismiss onboarding"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {/* Progress bar */}
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-1">
            {STEPS.slice(0, -1).map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i < stepIndex ? 'bg-indigo-600' : i === stepIndex ? 'bg-indigo-300' : 'bg-gray-200'}`} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Step {stepIndex + 1} of {STEPS.length - 1}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loading /></div>
        ) : (
          <>
            {/* Step: Welcome */}
            {currentStep?.key === 'welcome' && (
              <div className="px-6 py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">Welcome to Bahi360!</h2>
                <p className="text-gray-500 mt-2">Let's get your business set up in just a few steps. You'll be recording transactions in no time.</p>
                <div className="mt-8 space-y-3">
                  {onboarding?.steps?.map(s => (
                    <div key={s.key} className={`flex items-center gap-3 text-sm p-3 rounded-lg ${s.done ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-500'}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${s.done ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-white'}`}>
                        {s.done ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <span className="text-xs">{onboarding.steps.indexOf(s) + 1}</span>
                        )}
                      </div>
                      {s.label}
                    </div>
                  ))}
                </div>
                <button onClick={handleSkipStep} className="btn-primary w-full mt-8 !py-2.5">
                  Let's Go!
                </button>
                <button onClick={finish} className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  I'll do this later
                </button>
              </div>
            )}

            {/* Step: Company Name */}
            {currentStep?.key === 'company_name' && (
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold text-gray-900">Name Your Business</h2>
                <p className="text-sm text-gray-500 mt-1">This will appear on receipts, invoices, and reports.</p>
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    placeholder="e.g. Al-Rashid General Trading"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    onKeyDown={e => e.key === 'Enter' && handleSaveCompany()}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button onClick={handleSkipStep} className="btn-secondary flex-1">Skip</button>
                  <button onClick={handleSaveCompany} disabled={saving || !companyName.trim()} className="btn-primary flex-1 !py-2.5">
                    {saving ? 'Saving...' : 'Save & Continue'}
                  </button>
                </div>
              </div>
            )}

            {/* Step: Add Entry */}
            {currentStep?.key === 'add_entry' && (
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold text-gray-900">Record Your First Entry</h2>
                <p className="text-sm text-gray-500 mt-1">Start tracking who owes you money and who you owe. Head to the ledger to record a credit or cash transaction.</p>
                {step?.done ? (
                  <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <svg className="w-10 h-10 text-emerald-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-emerald-800 font-medium">You've already recorded entries!</p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => { navigate('/admin/ledger/sellers'); handleSkipStep(); }}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left"
                    >
                      <p className="font-semibold text-gray-900">Record a Credit Entry</p>
                      <p className="text-sm text-gray-500 mt-0.5">Track a sale or purchase on credit</p>
                    </button>
                    <button
                      onClick={() => { navigate('/admin/ledger/cashbook'); handleSkipStep(); }}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left"
                    >
                      <p className="font-semibold text-gray-900">Record a Cash Entry</p>
                      <p className="text-sm text-gray-500 mt-0.5">Track cash income or expense</p>
                    </button>
                  </div>
                )}
                <button onClick={handleSkipStep} className="btn-secondary w-full mt-6 text-sm">
                  {step?.done ? 'Continue' : 'Skip for now'}
                </button>
              </div>
            )}

            {/* Step: Add Customer */}
            {currentStep?.key === 'add_customer' && (
              <div className="px-6 py-8">
                <h2 className="text-xl font-bold text-gray-900">Add Buyers & Sellers</h2>
                <p className="text-sm text-gray-500 mt-1">Keep track of the people and businesses you deal with.</p>
                {step?.done ? (
                  <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                    <svg className="w-10 h-10 text-emerald-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-emerald-800 font-medium">You've already added contacts!</p>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    <button
                      onClick={() => { navigate('/admin/customers'); handleSkipStep(); }}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left"
                    >
                      <p className="font-semibold text-gray-900">Add a Buyer (Customer)</p>
                      <p className="text-sm text-gray-500 mt-0.5">People who buy from you</p>
                    </button>
                    <button
                      onClick={() => { navigate('/admin/suppliers'); handleSkipStep(); }}
                      className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left"
                    >
                      <p className="font-semibold text-gray-900">Add a Seller (Supplier)</p>
                      <p className="text-sm text-gray-500 mt-0.5">People you buy from</p>
                    </button>
                  </div>
                )}
                <button onClick={handleSkipStep} className="btn-secondary w-full mt-6 text-sm">
                  {step?.done ? 'Continue' : 'Skip for now'}
                </button>
              </div>
            )}

            {/* Step: Done */}
            {currentStep?.key === 'done' && (
              <div className="px-6 py-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900">You're All Set!</h2>
                <p className="text-gray-500 mt-2">
                  {onboarding?.completedCount === onboarding?.totalSteps
                    ? 'You\'ve completed all the setup steps. Start using Bahi360 to manage your business!'
                    : 'You\'ve completed the initial setup. You can always come back to Settings to finish the rest.'}
                </p>
                <div className="mt-6 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">Setup Progress</span>
                    <span className="font-semibold text-gray-900">{onboarding?.completedCount || 0}/{onboarding?.totalSteps || 4}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${onboarding?.percent || 0}%` }} />
                  </div>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    onClick={() => { navigate('/admin/ledger/buyers'); finish(); }}
                    className="btn-primary w-full !py-2.5"
                  >
                    Go to My Ledger
                  </button>
                  <button onClick={() => { navigate('/admin/settings'); finish(); }} className="btn-secondary w-full text-sm">
                    Open Settings
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
