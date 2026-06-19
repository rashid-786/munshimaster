import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect, useMemo } from 'react';
import { hrService } from '../services/hr.service';

const PLAN_RANK = { free: 0, pro: 1, enterprise: 2 };

const Icons = {
  ledger: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  business: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  staff: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  settings: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  chevron: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  menu: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  logout: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  bell: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  lock: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  upgrade: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
};

const NAV_GROUPS = [
  {
    label: 'My Ledger Book',
    icon: Icons.ledger,
    requiredPlan: 'free',
    items: [
      { to: '/admin/ledger/buyers', label: 'Buyers' },
      { to: '/admin/ledger/sellers', label: 'Sellers' },
      { to: '/admin/ledger/staff', label: 'Staff' },
      { to: '/admin/ledger/cashbook', label: 'Cashbook' },
      { to: '/admin/ledger/reports', label: 'Reports' },
    ],
  },
  {
    label: 'My Business',
    icon: Icons.business,
    requiredPlan: 'pro',
    items: [
      { to: '/admin/suppliers', label: 'Suppliers' },
      { to: '/admin/customers', label: 'Customers' },
      { to: '/admin/purchase-orders', label: 'Purchase Orders' },
      { to: '/admin/invoices', label: 'Invoices' },
      { to: '/admin/balance', label: 'Balance Sheet' },
      { to: '/admin/reports', label: 'Reports' },
    ],
  },
  {
    label: 'My HR',
    icon: Icons.staff,
    requiredPlan: 'enterprise',
    items: [
      { to: '/admin/dashboard', label: 'Staff Directory' },
      { to: '/admin/calendar', label: 'Attendance' },
      { to: '/admin/leaves', label: 'Leaves' },
      { to: '/admin/payroll', label: 'Payroll' },
      { to: '/admin/advances', label: 'Advances' },
    ],
  },
  { to: '/admin/settings', label: 'Settings', icon: Icons.settings, requiredPlan: 'free' },
];

const pageTitles = {
  '/admin/dashboard': 'My HR',
  '/admin/calendar': 'My HR',
  '/admin/leaves': 'My HR',
  '/admin/payroll': 'My HR',
  '/admin/advances': 'My HR',
  '/admin/suppliers': 'My Business',
  '/admin/customers': 'My Business',
  '/admin/purchase-orders': 'My Business',
  '/admin/invoices': 'My Business',
  '/admin/balance': 'My Business',
  '/admin/reports': 'My Business',
  '/admin/settings': 'Settings',
  '/admin/ledger': 'My Ledger Book',
  '/admin/ledger/buyers': 'My Ledger Book',
  '/admin/ledger/sellers': 'My Ledger Book',
  '/admin/ledger/staff': 'My Ledger Book',
  '/admin/ledger/cashbook': 'My Ledger Book',
  '/admin/ledger/reports': 'My Ledger Book',
};

const PLAN_LABELS = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };

export default function AdminLayout() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const defaultOpen = tenant?.subscriptionPlan === 'free'
    ? { 'My Ledger Book': true, 'My Business': false, 'My HR': false }
    : tenant?.subscriptionPlan === 'enterprise'
    ? { 'My Ledger Book': false, 'My Business': false, 'My HR': true }
    : { 'My Ledger Book': false, 'My Business': true, 'My HR': false };
  const [openGroups, setOpenGroups] = useState(defaultOpen);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [hiddenGroups, setHiddenGroups] = useState({});
  const menuRef = useRef(null);

  const currentPlan = tenant?.subscriptionPlan || 'free';
  const planRank = PLAN_RANK[currentPlan];

  const hasFeature = (requiredPlan) => planRank >= PLAN_RANK[requiredPlan];

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handler = (e) => setHiddenGroups(e.detail.hiddenGroups);
    window.addEventListener('settings-saved', handler);
    return () => window.removeEventListener('settings-saved', handler);
  }, []);

  useEffect(() => {
    hrService.getProfileCompletion().then(setProfileCompletion).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    hrService.getTenantSettings().then(res => {
      if (res.settings?.hiddenGroups) setHiddenGroups(res.settings.hiddenGroups);
      localStorage.setItem('hidden_groups', JSON.stringify(res.settings?.hiddenGroups || {}));
    }).catch(() => {
      const cached = localStorage.getItem('hidden_groups');
      if (cached) setHiddenGroups(JSON.parse(cached));
    });
  }, []);

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  const handleLogout = () => { logout(); navigate('/login'); };
  const pageTitle = pageTitles[location.pathname] || 'Dashboard';

  const sidebar = (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-gray-200 bg-gradient-subtle">
        <button onClick={() => navigate('/admin/dashboard')} className="flex items-center gap-2.5 font-bold text-lg truncate">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center text-white text-sm font-bold">H</div>
          <span className="text-gray-800">{tenant?.name || 'HRIS'}</span>
        </button>
      </div>

      {/* Plan badge */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          currentPlan === 'enterprise' ? 'bg-purple-100 text-purple-700' :
          currentPlan === 'pro' ? 'bg-indigo-100 text-indigo-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {PLAN_LABELS[currentPlan]} Plan
        </span>
        {currentPlan !== 'enterprise' && (
          <button onClick={() => navigate('/select-plan')} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Upgrade</button>
        )}
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          if (hiddenGroups[group.label]) return null;
          if ('items' in group) {
            const isLocked = !hasFeature(group.requiredPlan);
            const isAnyActive = !isLocked && group.items.some(item => location.pathname === item.to);
            return (
              <div key={group.label} className={isLocked ? 'opacity-50' : ''}>
                <button
                  onClick={() => { if (isLocked) { navigate('/select-plan'); return; } toggleGroup(group.label); }}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isAnyActive ? 'text-indigo-700 bg-indigo-50/60' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="shrink-0 text-gray-400">{group.icon}</span>
                  <span className="flex-1 text-left">{group.label}</span>
                  {isLocked ? (
                    <span className="shrink-0 text-gray-400">{Icons.lock}</span>
                  ) : (
                    <span className={`shrink-0 text-gray-400 transition-transform duration-200 ${openGroups[group.label] ? 'rotate-90' : ''}`}>{Icons.chevron}</span>
                  )}
                </button>
                {!isLocked && (
                  <div className={`grid transition-all duration-300 ease-in-out ${openGroups[group.label] ? 'grid-rows-[1fr] opacity-100 mt-0.5' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden min-h-0">
                      <div className="ml-4 pl-3 border-l-2 border-indigo-200 space-y-0.5">
                        {group.items.map((item) => {
                          const isActive = location.pathname === item.to;
                          return (
                            <NavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setSidebarOpen(false)}
                              className={`block relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                                isActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              {item.label}
                            </NavLink>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }
          const isActive = location.pathname === group.to;
          return (
            <NavLink
              key={group.to}
              to={group.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive ? 'text-indigo-700 bg-indigo-50/60' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="shrink-0 text-gray-400">{group.icon}</span>
              <span>{group.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Profile completion */}
      {profileCompletion && profileCompletion.percent < 100 && (
        <div className="px-4 py-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-500">Profile</span>
            <span className="text-xs font-medium text-gray-500">{profileCompletion.percent}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-primary rounded-full transition-all duration-500" style={{ width: `${profileCompletion.percent}%` }} />
          </div>
          <button onClick={() => navigate('/admin/settings')} className="text-xs text-indigo-600 hover:text-indigo-700 mt-1.5 font-medium">
            {profileCompletion.filled} of {profileCompletion.total} completed &rarr;
          </button>
        </div>
      )}

      <div className="p-3 border-t border-gray-200">
        <button onClick={handleLogout} className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150">
          {Icons.logout}
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden animate-fade-in">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 z-50 shadow-2xl animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </div>
        </div>
      )}
      <div className="hidden md:flex shrink-0">
        {sidebar}
      </div>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-gray-600 transition-colors">
              {Icons.menu}
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{pageTitle}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all">
              {Icons.bell}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-gray-100 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.firstName} {user?.lastName}</span>
                <svg className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-scale-in origin-top-right">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-gray-500">{user?.email}</p>
                  </div>
                  <button onClick={() => navigate('/admin/settings')} className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Settings</button>
                  <div className="border-t border-gray-100 pt-1 mt-1">
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">Sign out</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
