import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService, getDefaultCountryCode } from '../../services/auth.service';
import { applyTheme } from '../../utils/currency';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ phone: '', password: '' });
  const [countryCode, setCountryCode] = useState('+965');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState('phone'); // phone, otp, reset, done
  const [forgotCountdown, setForgotCountdown] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('tenant_id');
    getDefaultCountryCode().then(setCountryCode);
  }, []);

  useEffect(() => {
    if (location.state?.autoFill && location.state?.phone) {
      setFormData(prev => ({ ...prev, phone: location.state.phone }));
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const startCountdown = () => {
    setForgotCountdown(30);
    const timer = setInterval(() => {
      setForgotCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.phone || !formData.password) {
      setLoading(false);
      return setError('Please enter your phone number and password.');
    }

    try {
      const data = await authService.login(formData.phone, formData.password);
      login(data.user, data.token, data.tenant);

      applyTheme(data.tenant?.settings?.primaryColor || '#4f46e5');

      if (data.user.role === 'tenant_admin') {
        if (!data.tenant?.phone) {
          navigate('/select-plan');
        } else if (data.tenant?.subscriptionPlan === 'enterprise') {
          navigate('/admin/dashboard');
        } else {
          navigate('/admin/customers');
        }
      } else {
        navigate('/employee/profile');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials.');
    }
    setLoading(false);
  };

  const handleSendForgotOtp = async () => {
    if (!forgotPhone) { setError('Enter your phone number.'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.sendOtp(forgotPhone, 'password_reset');
      setForgotStep('otp');
      startCountdown();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP.');
    }
    setLoading(false);
  };

  const handleVerifyForgotOtp = async () => {
    if (!forgotOtp || forgotOtp.length !== 6) { setError('Enter the 6-digit OTP.'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.verifyOtp(forgotPhone, forgotOtp, 'password_reset');
      setForgotStep('reset');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP.');
    }
    setLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(forgotPhone, forgotOtp, newPassword);
      setForgotStep('done');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    }
    setLoading(false);
  };

  if (showForgot) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-br from-indigo-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">H</div>
            <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
            <p className="text-gray-500 mt-1">We'll send a code to verify your number.</p>
          </div>
          <div className="card p-6 md:p-8">
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

              {forgotStep === 'phone' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">{countryCode}</span>
                      <input type="tel" value={forgotPhone} onChange={e => {
                        const val = e.target.value.replace(/\s/g, '');
                        if (val === '' || /^\d+$/.test(val)) setForgotPhone(val);
                      }}
                        className="input-field pl-16" placeholder="5xxxxxxxx" autoFocus />
                    </div>
                  </div>
                  <button onClick={handleSendForgotOtp} disabled={loading} className="btn-primary w-full !py-2.5">
                    {loading ? 'Sending...' : 'Send OTP'}
                  </button>
                </div>
              )}

            {forgotStep === 'otp' && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Enter the code sent to</p>
                  <p className="text-sm font-semibold text-gray-900">{forgotPhone}</p>
                </div>
                <div>
                  <input type="text" maxLength={6} value={forgotOtp} onChange={e => setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input-field text-center text-lg tracking-widest" placeholder="000000" autoFocus />
                </div>
                <div className="text-center">
                  {forgotCountdown > 0 ? (
                    <p className="text-xs text-gray-400">Resend in {forgotCountdown}s</p>
                  ) : (
                    <button type="button" onClick={handleSendForgotOtp} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">Resend code</button>
                  )}
                </div>
                <button onClick={handleVerifyForgotOtp} disabled={loading || forgotOtp.length !== 6} className="btn-primary w-full !py-2.5">
                  {loading ? 'Verifying...' : 'Verify OTP'}
                </button>
              </div>
            )}

            {forgotStep === 'reset' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="input-field" placeholder="At least 6 characters" autoFocus />
                </div>
                <button onClick={handleResetPassword} disabled={loading} className="btn-primary w-full !py-2.5">
                  {loading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            )}

            {forgotStep === 'done' && (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Password Reset!</h3>
                <p className="text-sm text-gray-500">You can now sign in with your new password.</p>
                <button onClick={() => { setShowForgot(false); setForgotStep('phone'); setForgotOtp(''); setForgotPhone(''); setNewPassword(''); }}
                  className="btn-primary w-full !py-2.5">Back to Sign In</button>
              </div>
            )}

            <button onClick={() => { setShowForgot(false); setError(''); }} className="mt-4 w-full text-center text-sm text-gray-500 hover:text-gray-700">
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-gradient-to-br from-indigo-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-3">H</div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-1">Sign in to your account</p>
        </div>
        <div className="card p-6 md:p-8">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium pointer-events-none">{countryCode}</span>
                <input type="tel" name="phone" value={formData.phone} onChange={e => {
                  const val = e.target.value.replace(/\s/g, '');
                  if (val === '' || /^\d+$/.test(val)) setFormData(prev => ({ ...prev, phone: val }));
                }}
                  className="input-field pl-16" placeholder="5xxxxxxxx" autoFocus />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange}
                className="input-field" placeholder="Enter your password" />
              <div className="text-right mt-1">
                <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-indigo-600 hover:text-indigo-500">
                  Forgot password?
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            New here?{' '}
            <Link to="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
