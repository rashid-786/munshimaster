import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PLAN_RANK = { free: 0, pro: 1, enterprise: 2 };

const REDIRECT_MAP = {
  free: '/admin/ledger/buyers',
  pro: '/admin/customers',
};

export default function PlanRoute({ children, minPlan }) {
  const { tenant } = useAuth();
  const currentPlan = tenant?.subscriptionPlan || 'free';
  const currentRank = PLAN_RANK[currentPlan] ?? 0;
  const requiredRank = PLAN_RANK[minPlan] ?? 0;

  if (currentRank < requiredRank) {
    const redirect = REDIRECT_MAP[currentPlan] || '/admin/ledger/buyers';
    return <Navigate to={redirect} replace />;
  }

  return children;
}
