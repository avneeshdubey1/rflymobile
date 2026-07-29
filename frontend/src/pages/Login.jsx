import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { apiFetch, readJson } from '../services/apiClient';
import { homeForRole } from '../utils/authRouting';

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) { setError(data.error || data.message || t('login_failed', 'Login failed')); return; }

      login(data.user);
      navigate(homeForRole(data.user.role), { replace: true });
    } catch {
      setError(t('server_error_try_again', 'Server error. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">{t('secure_team_access', 'Secure team access')}</p>
          <h1>{t('employee_login_heading', 'One workspace for every field decision.')}</h1>
          <p>{t('employee_login_subheading', 'Operations, Sales, Fleet, and Pilot teams sign in to the same accountable service workflow.')}</p>
        </div>
        <p className="login-context__footer">{t('access_restricted', 'Access is restricted to authorized operational personnel.')}</p>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow">{t('employee_workspace', 'Employee workspace')}</p>
          <h2>{t('operations_console', 'Operations console')}</h2>
          <p className="subtitle">{t('employee_login_instruction', 'Use your assigned work account to continue.')}</p>

          {error && <div role="alert" className="alert error">{error}</div>}
          {location.state?.recoveryComplete && <div role="status" className="notice">{t('password_reset_login_notice', 'Password reset complete. Sign in with your new password.')}</div>}
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="login-email">{t('work_email', 'Work Email')}</label>
              <input id="login-email" name="email" type="email" placeholder="name@company.example" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="login-password">{t('password', 'Password')}</label>
              <input id="login-password" name="password" type="password" placeholder={t('enter_password', 'Enter your password')} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required disabled={busy} />
              <div style={{ textAlign: 'right', marginTop: '0.25rem' }}><Link to="/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>{t('forgot_password', 'Forgot password?')}</Link></div>
            </div>
            <button type="submit" className="submit-btn login-submit" disabled={busy}>{busy ? t('logging_in', 'Logging in…') : t('login', 'Login')}</button>
          </form>
          <button type="button" className="back-link" onClick={() => navigate('/farmer/login')}>{t('return_to_farmer_login', '← Return to farmer login')}</button>
        </div>
      </section>
    </main>
  );
}

export default Login;
