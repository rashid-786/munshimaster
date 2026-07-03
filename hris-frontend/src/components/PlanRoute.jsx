import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FeatureLocked from './FeatureLocked';
import { getRouteAccessInfo, isRouteAccessible } from '../config/subscriptionMenuBuilder';
import { resolvePlan, getRank } from '../config/subscriptionPlans';

export default function PlanRoute({ children, minPlan }) {
  const { tenant } = useAuth();
  const location = useLocation();

  const rawPlan = tenant?.subscriptionPlan || 'free';
  const currentPlan = resolvePlan(rawPlan);

  const routeInfo = getRouteAccessInfo(location.pathname);
  const featureName = routeInfo?.featureName || null;
  const requiredPlan = routeInfo?.requiredPlan || resolvePlan(minPlan || 'FREE');

  const accessible = routeInfo
    ? isRouteAccessible(location.pathname, currentPlan)
    : getRank(currentPlan) >= getRank(requiredPlan);

  if (!accessible) {
    return <FeatureLocked featureName={featureName} requiredPlan={requiredPlan} />;
  }

  return children;
}
