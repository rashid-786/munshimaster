import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { hrService } from '../../services/hr.service';
import { formatINR } from '../../utils/currency';
import PhoneField from '../../components/PhoneInput';

const Workspace = () => {
  const { user, login, logout } = useAuth();
  const [message, setMessage] = useState('');
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'Annual', startDate: '', endDate: '' });
  const [profile, setProfile] = useState({ first_name: user?.firstName || '', last_name: user?.lastName || '', email: user?.email || '', phone: user?.phone || '' });
  const [profileMsg, setProfileMsg] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    hrService.getPayrollHistory().then(data => setPayslips(data)).catch(() => {});
  }, []);

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await hrService.applyLeave(leaveForm);
      setMessage(res.message);
      setLeaveForm({ leaveType: 'Annual', startDate: '', endDate: '' });
    } catch (err) { setMessage(err.response?.data?.error || 'Failed to submit leave request.'); }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');
    try {
      const res = await hrService.updateProfile(profile);
      setProfileMsg(res.message);
      login({ ...user, ...res.user }, localStorage.getItem('auth_token'), null);
    } catch (err) {
      setProfileMsg(err.response?.data?.error || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-blue-500 hover:text-blue-700">&times;</button>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">My Profile</h3>
        </div>
        {profileMsg && <div className={`mx-6 mt-4 p-3 rounded-lg text-sm ${profileMsg === 'Profile updated.' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{profileMsg}</div>}
        <form onSubmit={handleProfileUpdate} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input type="text" value={profile.first_name} onChange={e => setProfile({ ...profile, first_name: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input type="text" value={profile.last_name} onChange={e => setProfile({ ...profile, last_name: e.target.value })} className="input-field" required />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} className="input-field" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <PhoneField value={profile.phone} onChange={v => setProfile({ ...profile, phone: v || '' })} />
        </div>
          <button type="submit" disabled={profileSaving} className="btn-primary">{profileSaving ? 'Saving...' : 'Update Profile'}</button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Request Time Off</h3>
        </div>
        <form onSubmit={handleLeaveSubmit} className="p-6 space-y-4">
            <select value={leaveForm.leaveType} onChange={e => setLeaveForm({ ...leaveForm, leaveType: e.target.value })} className="input-field">
              <option value="Annual">Annual Leave</option>
              <option value="Sick">Sick Leave</option>
              <option value="Casual">Casual Leave</option>
              <option value="Unpaid">Unpaid Leave</option>
            </select>
            <div className="grid grid-cols-2 gap-4">
              <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })} required className="input-field" />
              <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })} required className="input-field" />
            </div>
            <button type="submit" className="btn-primary w-full">Submit Request</button>
          </form>
        </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
        </div>
        <ChangePasswordForm />
      </div>
    </div>
  );
};

function ChangePasswordForm() {
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) {
      setMsg('Passwords do not match.');
      return;
    }
    setSaving(true);
    setMsg('');
    try {
      const res = await hrService.changePassword({ current_password: pw.current_password, new_password: pw.new_password });
      setMsg(res.message);
      setPw({ current_password: '', new_password: '', confirm: '' });
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      {msg && <div className={`p-3 rounded-lg text-sm ${msg === 'Password updated successfully.' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{msg}</div>}
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
      <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Updating...' : 'Update Password'}</button>
    </form>
  );
}

export default Workspace;
