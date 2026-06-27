import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PLAN_RANK = { free: 0, business: 1, business_monthly: 1, pro: 2, pro_monthly: 2 };
const LEGACY_RANK = { free: 0, pro: 1, enterprise: 2 };

function rank(planId) {
  return PLAN_RANK[planId] ?? LEGACY_RANK[planId] ?? 0;
}

export default function PlanRoute({ children, minPlan }) {
  const { tenant } = useAuth();
  const currentPlan = tenant?.subscriptionPlan || 'free';

  if (rank(currentPlan) < rank(minPlan)) {
    return <Navigate to="/admin/ledger" replace />;
  }

  return children;
}
