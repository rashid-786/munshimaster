import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { hrService } from '../services/hr.service';
import { subscriptionService } from '../services/subscription.service';
import NotificationBell from '../components/NotificationBell';
import SearchBar from '../components/SearchBar';
import UpgradeModal from '../components/UpgradeModal';
import DowngradeModal from '../components/DowngradeModal';
import OnboardingWizard from '../components/OnboardingWizard';
import { buildMenu, getFirstDashboardRoute } from '../config/subscriptionMenuBuilder.jsx';
import { resolvePlan, getRank, PLAN_LABELS, PLAN_COLORS } from '../config/subscriptionPlans';

const Icons = {
  chevron: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  menu: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  logout: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  lock: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
};

export default function AdminLayout() {
  const { user, tenant, logout, refreshTenant } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileCompletion, setProfileCompletion] = useState(null);
  const [hiddenGroups, setHiddenGroups] = useState({});
  const [groupLabels, setGroupLabels] = useState({});
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showDowngrade, setShowDowngrade] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [entities, setEntities] = useState([]);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const menuRef = useRef(null);
  const entityRef = useRef(null);

  const rawPlan = tenant?.subscriptionPlan || 'free';
  const currentPlan = resolvePlan(rawPlan);

  const menuItems = useMemo(() => buildMenu(currentPlan), [currentPlan]);

  const DEFAULT_LABEL_OVERRIDES = { Entities: { FREE: 'My Stores', MANAGE: 'My Stores' } };
  const labelOf = (key) => {
    const custom = groupLabels[key];
    if (custom) return custom;
    const planOverride = DEFAULT_LABEL_OVERRIDES[key]?.[currentPlan];
    return planOverride || key;
  };

  const pageTitles = useMemo(() => {
    const titles = {};
    for (const section of menuItems) {
      if (section.type === 'group' && section.items) {
        for (const item of section.items) {
          titles[item.route] = labelOf(section.label);
        }
        titles[section.route] = labelOf(section.label);
      } else {
        titles[section.route] = labelOf(section.label);
      }
    }
    return titles;
  }, [menuItems, groupLabels, currentPlan]);

  const firstVisibleDashboard = useMemo(() => {
    return getFirstDashboardRoute(currentPlan);
  }, [currentPlan]);

  const defaultOpen = useMemo(() => {
    const obj = {};
    for (const section of menuItems) {
      if (section.type === 'group') {
        obj[section.label] = false;
      }
    }
    if (menuItems.length > 0 && menuItems[0].type === 'group') {
      obj[menuItems[0].label] = true;
    }
    return obj;
  }, [menuItems]);

  const [openGroups, setOpenGroups] = useState(defaultOpen);

  useEffect(() => {
    setOpenGroups(defaultOpen);
  }, [defaultOpen]);

  useEffect(() => {
    const handleClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false); if (entityRef.current && !entityRef.current.contains(e.target)) setEntityDropdownOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.detail.hiddenGroups) setHiddenGroups(e.detail.hiddenGroups);
      if (e.detail.groupLabels) setGroupLabels(e.detail.groupLabels);
    };
    window.addEventListener('settings-saved', handler);
    return () => window.removeEventListener('settings-saved', handler);
  }, []);

  useEffect(() => {
    hrService.getProfileCompletion().then(setProfileCompletion).catch(() => {});
  }, [location.pathname]);

  useEffect(() => {
    const path = location.pathname;
    const updates = {};
    for (const section of menuItems) {
      if (section.type !== 'group') continue;
      if (path === section.route || path.startsWith(section.route + '/')) {
        updates[section.label] = true;
      }
      if (section.items) {
        for (const item of section.items) {
          if (path === item.route) {
            updates[section.label] = true;
          }
        }
      }
    }
    if (Object.keys(updates).length) setOpenGroups(prev => ({ ...prev, ...updates }));
  }, [location.pathname, menuItems]);

  // Check onboarding on mount
  useEffect(() => {
    const dismissed = localStorage.getItem('bahi_onboarding_dismissed');
    if (dismissed) return;
    if (!tenant?.id) return;
    subscriptionService.getOnboardingStatus()
      .then(data => {
        if (data.onboardingDismissed) {
          localStorage.setItem('bahi_onboarding_dismissed', 'true');
          return;
        }
        if (!data.allDone) setShowOnboarding(true);
      })
      .catch(() => {});
  }, [tenant?.id]);

  // Fetch entities for switcher
  useEffect(() => {
    hrService.getEntities().then(data => setEntities(data)).catch(() => {});
  }, []);

  useEffect(() => {
    hrService.getTenantSettings().then(res => {
      if (res.settings?.hiddenGroups) setHiddenGroups(res.settings.hiddenGroups);
      if (res.settings?.groupLabels) setGroupLabels(res.settings.groupLabels);
      localStorage.setItem('hidden_groups', JSON.stringify(res.settings?.hiddenGroups || {}));
      localStorage.setItem('group_labels', JSON.stringify(res.settings?.groupLabels || {}));
    }).catch(() => {
      const cached = localStorage.getItem('hidden_groups');
      if (cached) setHiddenGroups(JSON.parse(cached));
      const cachedLabels = localStorage.getItem('group_labels');
      if (cachedLabels) setGroupLabels(JSON.parse(cachedLabels));
    });
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showSearch]);

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSwitchEntity = useCallback(async (targetTenantId) => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await hrService.switchEntity(targetTenantId);
      localStorage.setItem('auth_token', res.token);
      localStorage.setItem('tenant_id', res.tenant.id);
      localStorage.setItem('tenant_data', JSON.stringify({
        id: res.tenant.id,
        name: res.tenant.companyName,
        branchName: res.tenant.branchName,
        subscriptionPlan: res.tenant.subscriptionPlan,
        settings: {},
      }));
      window.location.reload();
    } catch (e) {
      console.error('Switch failed:', e);
      setSwitching(false);
    }
  }, [switching]);
  const pageTitle = pageTitles[location.pathname] || '';

  useEffect(() => {
    const path = location.pathname;
    const inHiddenGroup = menuItems.some(section => {
      if (!hiddenGroups[section.label]) return false;
      if (section.type === 'group') {
        if (path === section.route) return true;
        return section.items?.some(item => path === item.route) || false;
      }
      return path === section.route;
    });
    if (inHiddenGroup) {
      navigate(firstVisibleDashboard, { replace: true });
    }
  }, [hiddenGroups, location.pathname, firstVisibleDashboard, navigate, menuItems]);

  const sidebar = (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-gray-200 bg-gradient-subtle">
        <button onClick={() => navigate(firstVisibleDashboard)} className="flex flex-col items-start justify-center leading-tight">
          <span className="text-xl font-bold tracking-tight leading-none">
            <span style={{ color: '#0B3C5D' }}>bahi</span>
            <span style={{ color: '#2FBF71' }}>360</span>
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--primary-600)' }}>{tenant?.name || ''}</span>
        </button>
      </div>

      {/* Plan badge */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[currentPlan] || 'bg-gray-100 text-gray-600'}`}>
          {PLAN_LABELS[currentPlan] || currentPlan} Plan
        </span>
        <div className="flex items-center gap-2">
          {getRank(currentPlan) >= 1 && (
            <button onClick={() => setShowDowngrade(true)} className="text-xs text-gray-400 hover:text-red-600 font-medium">Cancel</button>
          )}
          {getRank(currentPlan) < 3 && (
            <button onClick={() => setShowUpgrade(true)} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">Upgrade</button>
          )}
        </div>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {menuItems.map((section) => {
          if (hiddenGroups[section.label]) return null;
          if (section.type === 'group') {
            const isActive = location.pathname === section.route;
            return (
              <div key={section.label}>
                <div className="flex items-center gap-1 w-full px-1 py-0.5 rounded-lg transition-all duration-150">
                  <NavLink
                    to={section.route}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 flex-1 px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                      isActive ? 'text-indigo-700 bg-indigo-50/60' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="shrink-0 text-gray-400">{section.icon}</span>
                    <span className="flex-1 text-left">{labelOf(section.label)}</span>
                  </NavLink>
                  <button
                    onClick={() => toggleGroup(section.label)}
                    className="shrink-0 px-1.5 py-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all duration-150"
                  >
                    <span className={`block transition-transform duration-200 ${openGroups[section.label] ? 'rotate-90' : ''}`}>{Icons.chevron}</span>
                  </button>
                </div>
                <div className={`grid transition-all duration-300 ease-in-out ${openGroups[section.label] ? 'grid-rows-[1fr] opacity-100 mt-0.5' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden min-h-0">
                    <div className="ml-4 pl-3 border-l-2 border-indigo-200 space-y-0.5">
                      {section.items.map((item) => {
                        const isItemActive = location.pathname === item.route;
                        return (
                          <NavLink
                            key={item.route}
                            to={item.route}
                            onClick={() => setSidebarOpen(false)}
                            className={`block relative px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                              isItemActive ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            {item.label}
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          const isLinkActive = location.pathname === section.route;
          return (
            <NavLink
              key={section.route}
              to={section.route}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isLinkActive ? 'text-indigo-700 bg-indigo-50/60' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span className="shrink-0 text-gray-400">{section.icon}</span>
              <span>{labelOf(section.label)}</span>
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
        <header className="h-14 md:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 md:px-6 shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-gray-600 transition-colors p-1.5 -ml-1.5">
              {Icons.menu}
            </button>
            <div
              className="hidden sm:flex w-8 h-8 rounded-lg items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ backgroundColor: tenant?.settings?.primaryColor || '#4f46e5' }}
            >
              {(tenant?.name || 'B').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-semibold text-gray-900 truncate">{pageTitle || tenant?.name || 'My Business'}</h1>
              {entities.length > 1 && (
                <div className="relative" ref={entityRef}>
                  <button
                    onClick={() => setEntityDropdownOpen(!entityDropdownOpen)}
                    className="flex items-center gap-1 text-[10px] md:text-xs text-gray-400 hover:text-gray-600 mt-0.5"
                  >
                    <svg className="w-2.5 h-2.5 md:w-3 md:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                    <span className="truncate max-w-[120px] md:max-w-none">{entities.find(e => e.id === localStorage.getItem('tenant_id'))?.branchName || tenant?.name || 'Entity'}</span>
                    <svg className={`w-2.5 h-2.5 md:w-3 md:h-3 transition-transform shrink-0 ${entityDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {entityDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-scale-in origin-top-left">
                      {entities.map(entity => {
                        const isActive = entity.id === localStorage.getItem('tenant_id');
                        return (
                          <button
                            key={entity.id}
                            onClick={() => { if (!isActive) handleSwitchEntity(entity.id); setEntityDropdownOpen(false); }}
                            disabled={switching}
                            className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                              isActive ? 'text-indigo-700 bg-indigo-50 font-medium' : 'text-gray-600 hover:bg-gray-50'
                            } ${switching ? 'opacity-50' : ''}`}
                          >
                            <span className="truncate">
                              {entity.branchName || entity.company_name}
                            </span>
                            {isActive && <span className="text-xs text-indigo-500 shrink-0 ml-2">Active</span>}
                            {switching && isActive && (
                              <svg className="w-3.5 h-3.5 animate-spin text-indigo-500 shrink-0 ml-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 md:gap-3 shrink-0">
            <NotificationBell />
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full hidden sm:inline-block ${PLAN_COLORS[currentPlan] || 'bg-gray-100 text-gray-600'}`}>
              {PLAN_LABELS[currentPlan] || currentPlan}
            </span>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1 md:gap-2.5 p-1 rounded-lg md:p-1.5 hover:bg-gray-100 transition-all"
              >
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-primary flex items-center justify-center text-white font-semibold text-xs md:text-sm shadow-sm">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.firstName} {user?.lastName}</span>
                <svg className={`hidden sm:block w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50 animate-scale-in origin-top-right">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-gray-500">{user?.phone || user?.email}</p>
                  </div>
                  <button onClick={() => navigate('/admin/entities')} className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">{labelOf('Entities')}</button>
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

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
      />
      <DowngradeModal
        open={showDowngrade}
        onClose={() => setShowDowngrade(false)}
        onDowngraded={refreshTenant}
      />
      <OnboardingWizard
        open={showOnboarding}
        onComplete={() => {
          setShowOnboarding(false);
          localStorage.setItem('bahi_onboarding_dismissed', 'true');
        }}
      />
      <SearchBar open={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
