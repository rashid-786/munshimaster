import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const navItems = [
  { to: '/employee/profile', label: 'My Profile', icon: '👤' },
  { to: '/employee/attendance', label: 'Attendance', icon: '⏰' },
  { to: '/employee/leaves', label: 'Leave Requests', icon: '📋' },
  { to: '/employee/payslips', label: 'Payslips', icon: '💰' },
];

export default function EmpLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebar = (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="h-16 flex items-center px-4 border-b border-gray-200">
        <span className="font-bold text-lg text-indigo-600">HRIS</span>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
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
      {/* Desktop sidebar */}
      <div className="hidden md:flex shrink-0">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
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
            <h1 className="text-lg font-semibold text-gray-800 truncate">Employee Portal</h1>
          </div>
          {user && (
            <div className="flex items-center gap-2 md:gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <span className="text-sm text-gray-600 hidden sm:block">{user.firstName} {user.lastName}</span>
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
