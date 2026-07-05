import { Outlet, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import SuperAdminSidebar from './SuperAdminSidebar';

const PAGE_TITLES = {
  '/super/dashboard': 'Dashboard',
  '/super/tenants': 'Tenants',
  '/super/plans': 'Subscription Plans',
  '/super/campaigns': 'Campaigns',
  '/super/referrals': 'Referrals',
  '/super/analytics/revenue': 'Revenue Analytics',
  '/super/analytics/conversion': 'Conversion Analytics',
  '/super/analytics/plan-adoption': 'Plan Adoption',
  '/super/analytics/usage': 'Usage Analytics',
  '/super/audit-logs': 'Audit Logs',

};

export default function SuperAdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    const now = new Date();
    setCurrentDate(now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }));
  }, []);

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const pageTitle = PAGE_TITLES[location.pathname] || 'Super Admin';
  const isAnalytics = location.pathname.startsWith('/super/analytics');

  return (
    <div className="flex h-screen bg-gray-50">
      <SuperAdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
              <p className="text-[11px] text-gray-400 hidden sm:block">{currentDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Date on mobile */}
            <span className="text-[11px] text-gray-400 sm:hidden">{currentDate}</span>

            {/* User Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-gray-100 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                  {user?.name?.[0] || 'S'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-700 leading-tight">{user?.name || user?.email || 'Super Admin'}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">Super Admin</p>
                </div>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-scale-in origin-top-right">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.name || 'Super Admin'}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Role: Super Admin</p>
                  </div>
                  <div className="pt-1">
                    <button onClick={() => { logout(); }} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
