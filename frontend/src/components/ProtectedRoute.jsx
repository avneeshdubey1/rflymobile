import { Navigate, Outlet, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/useAuth';
import { homeForRole, loginForPath } from '../utils/authRouting';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user, status, refreshSession } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  if (status === 'checking') {
    return <main className="login-container" role="status" aria-live="polite"><section className="login-form-pane"><div className="panel login-card"><h2>{t('checking_session', 'Checking your session…')}</h2><p className="subtitle">{t('checking_session_detail', 'Please wait while secure access is verified.')}</p></div></section></main>;
  }

  if (status === 'offline' && !user) {
    return <main className="login-container"><section className="login-form-pane"><div className="panel login-card"><h2>{t('session_unavailable', 'Unable to verify your session')}</h2><p className="subtitle">{t('session_unavailable_detail', 'Reconnect to the service before opening protected information.')}</p><button type="button" className="submit-btn login-submit" onClick={() => void refreshSession()}>{t('try_again', 'Try again')}</button></div></section></main>;
  }

  if (!user) {
    return <Navigate to={loginForPath(location.pathname)} replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
