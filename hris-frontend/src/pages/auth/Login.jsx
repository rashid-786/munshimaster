import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { hrService } from '../../services/hr.service';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ tenantId: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('tenant_id');
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.tenantId || !formData.email || !formData.password) {
      setLoading(false);
      return setError('Please fill in all mandatory fields.');
    }

    try {
      const data = await authService.login(formData.email, formData.password, formData.tenantId);
      login(data.user, data.token);

      if (data.user.role === 'tenant_admin') {
        try {
          const settings = await hrService.getTenantSettings();
          const primaryColor = settings?.settings?.primaryColor || '#4f46e5';
          localStorage.setItem('primary_color', primaryColor);
          document.documentElement.style.setProperty('--primary', primaryColor);
        } catch (_) {}
        navigate('/admin/dashboard');
      } else {
        navigate('/employee/profile');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Company ID (Tenant UUID)</label>
          <input type="text" name="tenantId" value={formData.tenantId} onChange={handleChange}
            className="input-field" placeholder="Enter your organization's unique ID" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Work Email</label>
          <input type="email" name="email" value={formData.email} onChange={handleChange}
            className="input-field" placeholder="name@company.com" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" name="password" value={formData.password} onChange={handleChange}
            className="input-field" placeholder="Enter your password" />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full !py-2.5">
          {loading ? 'Verifying...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        New organization?{' '}
        <a href="/register" className="text-indigo-600 hover:text-indigo-500 font-medium">
          Register here
        </a>
      </p>
    </div>
  );
};

export default Login;
