import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    // User not logged in, boot to corporate login screen
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Logged in but doesn't possess permissions (e.g., employee trying to see payroll setup)
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
