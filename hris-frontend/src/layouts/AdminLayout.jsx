import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const navGroups = [
  {
    label: 'Employees',
    icon: '👥',
    items: [
      { to: '/admin/dashboard', label: 'Employee Directory' },
      { to: '/admin/calendar', label: 'Attendance Calendar' },
      { to: '/admin/leaves', label: 'Leave Management' },
      { to: '/admin/payroll', label: 'Payroll' },
    ],
  },
  {
    label: 'Vendors',
    icon: '🏢',
    items: [
      { to: '/admin/suppliers', label: 'Suppliers' },
      { to: '/admin/customers', label: 'Customers' },
      { to: '/admin/purchase-orders', label: 'Purchase Orders' },
      { to: '/admin/invoices', label: 'Invoices' },
    ],
  },
  { to: '/admin/settings', label: 'Settings', icon: '⚙️' },
];

export default function AdminLayout() {
  const { user, tenant, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState({ Employees: true, Vendors: false });

  const toggleGroup = (label) => setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebar = (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <button onClick={() => navigate('/admin/dashboard')} className="font-bold text-lg text-indigo-600 hover:text-indigo-500 truncate">
          {tenant?.name || 'HRIS'}
        </button>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navGroups.map((group) => {
          if ('items' in group) {
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <span className="text-lg">{group.icon}</span>
                  <span className="flex-1 text-left">{group.label}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${openGroups[group.label] ? 'rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {openGroups[group.label] && (
                  <div className="ml-2 mt-0.5 space-y-0.5 border-l-2 border-indigo-200 pl-2">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setSidebarOpen(false)}
                        className={({ isActive }) =>
                          `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-100'
                          }`
                        }
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <NavLink
              key={group.to}
              to={group.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <span className="text-lg">{group.icon}</span>
              <span>{group.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="hidden md:flex shrink-0">
        {sidebar}
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div className="fixed inset-y-0 left-0 w-64 z-50 shadow-xl">
            {sidebar}
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-800 truncate">Dashboard</h1>
          </div>
          {user && (
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <span className="text-sm text-gray-600 hidden sm:block">Welcome, {user.firstName} {user.lastName}</span>
            </div>
          )}
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
