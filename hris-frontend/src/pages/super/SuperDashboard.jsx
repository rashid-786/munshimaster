import { useState, useEffect } from 'react';
import { superService } from '../../services/super.service';
import { Link } from 'react-router-dom';
import useIsMobile from '../../hooks/useIsMobile';

const SuperDashboard = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    superService.getDashboard()
      .then(setStats)
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">{error}</div>;
  }

  const cards = [
    {
      label: 'Total Tenants',
      value: stats.totalTenants,
      path: '/super/tenants',
      color: 'bg-indigo-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      label: 'Total Employees',
      value: stats.totalEmployees,
      path: '/super/employees',
      color: 'bg-emerald-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      ),
    },
    {
      label: 'Pending Leaves',
      value: stats.pendingLeaves,
      path: '/super/tenants',
      color: 'bg-amber-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Role Distribution',
      value: stats.roleDistribution?.map(r => `${r.role}: ${r.count}`).join(', ') || '-',
      path: null,
      color: 'bg-purple-500',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${card.color} text-white`}>{card.icon}</div>
            </div>
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            {card.label === 'Role Distribution' ? (
              <div className="mt-2 space-y-1.5">
                {stats.roleDistribution?.map(r => (
                  <div key={r.role} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 capitalize">{r.role.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-900">{r.count}</span>
                  </div>
                )) || <p className="text-sm text-gray-400 mt-1">-</p>}
              </div>
            ) : (
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
              </p>
            )}
            {card.path && (
              <Link to={card.path} className="text-sm text-indigo-600 hover:text-indigo-500 mt-3 inline-block font-medium">
                View all →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Recently Onboarded Tenants</h3>
        </div>
        {isMobile ? (
          <div className="divide-y divide-gray-100">
            {stats.recentTenants?.map((tenant) => (
              <Link key={tenant.id} to={`/super/tenants/${tenant.id}`} className="flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{tenant.company_name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tenant.subdomain} &middot; {new Date(tenant.created_at).toLocaleDateString()}</p>
                </div>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
            {(!stats.recentTenants || stats.recentTenants.length === 0) && (
              <div className="text-center text-gray-400 py-8 text-sm">No tenants yet</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">Company Name</th>
                  <th className="table-header">Subdomain</th>
                  <th className="table-header">Created</th>
                  <th className="table-header"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.recentTenants?.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-medium">{tenant.company_name}</td>
                    <td className="table-cell text-gray-500">{tenant.subdomain}</td>
                    <td className="table-cell text-gray-500">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-cell">
                      <Link
                        to={`/super/tenants/${tenant.id}`}
                        className="text-indigo-600 hover:text-indigo-500 text-sm font-medium"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
                {(!stats.recentTenants || stats.recentTenants.length === 0) && (
                  <tr><td colSpan={4} className="table-cell text-center text-gray-400 py-8">No tenants yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperDashboard;
