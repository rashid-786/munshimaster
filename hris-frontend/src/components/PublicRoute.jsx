import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PublicRoute = ({ children }) => {
  const { user } = useAuth();

  if (user) {
    if (user.role === 'super_admin') return <Navigate to="/super/dashboard" replace />;
    if (user.role === 'employee') return <Navigate to="/employee/profile" replace />;
    return <Navigate to="/admin/ledger" replace />;
  }

  return children;
};

export default PublicRoute;
