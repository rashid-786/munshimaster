import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { resolvePlan } from '../config/subscriptionPlans';
import { getFirstDashboardRoute } from '../config/subscriptionMenuBuilder';

function getHiddenGroups() {
  try {
    const stored = localStorage.getItem('hidden_groups');
    if (stored) return JSON.parse(stored);
    const tenantData = JSON.parse(localStorage.getItem('tenant_data') || '{}');
    return tenantData?.settings?.hiddenGroups || {};
  } catch {
    return {};
  }
}

const PublicRoute = ({ children }) => {
  const { user, tenant } = useAuth();

  if (user) {
    if (user.role === 'super_admin') return <Navigate to="/super/dashboard" replace />;
    if (user.role === 'employee') return <Navigate to="/employee/profile" replace />;
    const rawPlan = tenant?.subscriptionPlan || (() => {
      try { return JSON.parse(localStorage.getItem('tenant_data') || '{}')?.subscriptionPlan || 'FREE'; } catch { return 'FREE'; }
    })();
    const plan = resolvePlan(rawPlan);
    const hiddenGroups = getHiddenGroups();
    if (plan === 'BUSINESS' || plan === 'BUSINESS_PRO') return <Navigate to="/admin/business" replace />;
    return <Navigate to={getFirstDashboardRoute(plan, hiddenGroups)} replace />;
  }

  return children;
};

export default PublicRoute;
