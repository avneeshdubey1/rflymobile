import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const homePathForRole = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'sales') return '/marketing';
  if (role === 'fleet-manager') return '/fleet-manager';
  if (role === 'pilot') return '/pilot';
  if (role === 'farmer') return '/farmer/dashboard';
  if (role === 'business') return '/business/dashboard';
  return '/';
};

const GuestOnlyRoute = ({ children }) => {
  const { user } = useAuth();

  if (user) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }

  return children;
};

export default GuestOnlyRoute;
