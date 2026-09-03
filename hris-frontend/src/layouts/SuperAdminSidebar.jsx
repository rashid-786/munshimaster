import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { to: '/super/dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      { to: '/super/tenants', label: 'Tenants', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/super/plans', label: 'Plans', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
      { to: '/super/campaigns', label: 'Campaigns', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z' },
      { to: '/super/referrals', label: 'Referrals', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/super/analytics/revenue', label: 'Revenue', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { to: '/super/analytics/conversion', label: 'Conversion', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
      { to: '/super/analytics/plan-adoption', label: 'Plan Adoption', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { to: '/super/analytics/usage', label: 'Usage', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/super/audit-logs', label: 'Audit Logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
      { to: '/super/global-config', label: 'Global Config', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
      { to: '/super/units', label: 'Units', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
      { to: '/super/gst-tax', label: 'GST Tax', icon: 'M12 2l9 4.5v9L12 20l-9-4.5v-9L12 2zm0 2.25L5.25 7.5 12 10.75 18.75 7.5 12 4.25zM12 12.75l6.75-3.375v4.5L12 17.25l-6.75-3.375v-4.5L12 12.75z' },
      { to: '/super/razorpay-settings', label: 'Razorpay Settings', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
      { to: '/super/legal', label: 'Legal Documents', icon: 'M4 4h16v16H4V4zm2 4h12M6 12h12M6 16h7' },
      { to: '/super/account-deletion', label: 'Deletion Requests', icon: 'M6 18L18 6M6 6l12 12' },
      { to: '/super/cms', label: 'CMS', icon: 'M4 4h16v16H4V4zm2 2v6h6V6H6zm8 0v6h6V6h-6zM6 12v6h6v-6H6zm8 0v6h6v-6h-6z' },
    ],
  },
];

export default function SuperAdminSidebar({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => { logout(); navigate('/super/login'); };

  const sidebar = (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-gray-200 shrink-0">
        <span className="flex flex-col items-start justify-center leading-tight cursor-pointer" onClick={() => { navigate('/super/dashboard'); onClose?.(); }}>
          <span className="text-xl font-bold tracking-tight leading-none">
            <span style={{ color: '#0B3C5D' }}>bahi</span>
            <span style={{ color: '#2FBF71' }}>360</span>
          </span>
          <span className="text-[10px] font-medium text-indigo-600">Super Admin</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-5">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            <p className="px-3 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = location.pathname === item.to;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => onClose?.()}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'text-indigo-700 bg-indigo-50 shadow-sm border border-indigo-100'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <svg className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-gray-200 shrink-0">
        <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  if (!open) return <div className="hidden md:flex shrink-0">{sidebar}</div>;

  return (
    <div className="fixed inset-0 z-40 md:hidden animate-fade-in">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-64 z-50 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
        {sidebar}
      </div>
    </div>
  );
}
