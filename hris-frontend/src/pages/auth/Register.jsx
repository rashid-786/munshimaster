import React, { useState, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from '../../services/auth.service';
import PhoneField, { isValidPhoneNumber } from '../../components/PhoneInput';

const STEPS = { PHONE: 0, OTP: 1, CREDENTIALS: 2 };

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref') || '';
  const [step, setStep] = useState(STEPS.PHONE);
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState('');
  const [otpInput, setOtpInput] = useState(['', '', '', '', '', '']);
  const [credentials, setCredentials] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpFromServer, setOtpFromServer] = useState('');
  const otpRefs = useRef([]);

  const startCountdown = () => {
    setCountdown(30);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async (e) => {
    e?.preventDefault();
    setPhoneErr('');
    if (!phone) { setPhoneErr('Please enter your phone number.'); return; }
    if (!isValidPhoneNumber(phone)) { setPhoneErr('Please enter a valid phone number.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await authService.sendOtp(phone, 'registration');
      if (res.otp) setOtpFromServer(res.otp);
      setStep(STEPS.OTP);
      startCountdown();
      otpRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP.');
    }
    setLoading(false);
  };

  const handleOtpChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;
    const newOtp = [...otpInput];
    newOtp[index] = value;
    setOtpInput(newOtp);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpInput[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otp = otpInput.join('');
    if (otp.length !== 6) { setError('Please enter the full 6-digit OTP.'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.verifyOtp(phone, otp, 'registration');
      const result = await authService.register(phone, referralCode);
      setCredentials(result.credentials);
      setStep(STEPS.CREDENTIALS);
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed.');
    }
    setLoading(false);
  };

  const handleResendOtp = () => {
    if (countdown > 0) return;
    handleSendOtp();
  };

  const handleContinue = () => {
    navigate('/login', { state: { phone: credentials.phone, autoFill: true } });
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-brand-soft flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/icon_logo.png" alt="bahi360" className="w-20 h-auto mx-auto mb-1" />
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1">Start managing your business in minutes</p>
        </div>

        <div className="card p-6 md:p-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {[0, 1, 2].map(i => (
              <React.Fragment key={i}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step >= i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > i ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : i + 1}
                </div>
                {i < 2 && <div className={`w-12 h-0.5 rounded ${step > i ? 'bg-indigo-600' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 ml-2">&times;</button>
            </div>
          )}

          {/* Step 1: Phone */}
          {step === STEPS.PHONE && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                <PhoneField
                  value={phone}
                  onChange={v => { setPhone(v); setPhoneErr(''); }}
                  error={phoneErr}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">We'll send a one-time code to verify your number.</p>
              </div>
              {referralCode && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-sm text-indigo-700">
                  Referral code <strong>{referralCode}</strong> will be applied automatically.
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5 text-base">
                {loading ? 'Sending code...' : 'Send Verification Code'}
              </button>
            </form>
          )}

          {/* Step 2: OTP */}
          {step === STEPS.OTP && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Enter the code sent to</p>
                <p className="text-sm font-semibold text-gray-900">{phone}</p>
              </div>
              {otpFromServer && (
                <div className="text-center">
                  <span className="inline-block px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm font-mono tracking-widest rounded">{otpFromServer}</span>
                  <p className="text-xs text-yellow-600 mt-1">Dev mode — use this OTP</p>
                </div>
              )}
              <div className="flex justify-center gap-2">
                {otpInput.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-11 h-12 text-center text-lg font-semibold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  />
                ))}
              </div>
              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-xs text-gray-400">Resend code in {countdown}s</p>
                ) : (
                  <button type="button" onClick={handleResendOtp} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Resend code</button>
                )}
              </div>
              <button type="submit" disabled={loading || otpInput.join('').length !== 6} className="btn-primary w-full !py-2.5 text-base">
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
            </form>
          )}

          {/* Step 3: Credentials */}
          {step === STEPS.CREDENTIALS && credentials && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-2">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-emerald-800">Account Created!</h3>
                <p className="text-sm text-emerald-600 mt-1">Save your credentials below.</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</label>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{credentials.phone}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Password</label>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-sm font-mono font-semibold text-gray-900 flex-1 break-all">{credentials.password}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(credentials.password); }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium shrink-0"
                      title="Copy password"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
                Please save this password. You'll need it to sign in. You can change it later in settings.
              </p>

              <button onClick={handleContinue} className="btn-primary w-full !py-2.5 text-base">
                Continue to Sign In &rarr;
              </button>
            </div>
          )}

          {step < 2 && (
            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">Sign in</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Register;
