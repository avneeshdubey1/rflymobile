import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { API_URL as API } from '../config';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!data.success) { setError(data.error || data.message || 'Login failed'); return; }

      login(data.user, data.token);
      if (data.user.role === 'admin') navigate('/admin');
      else if (data.user.role === 'sales') navigate('/marketing');
      else if (data.user.role === 'pilot') navigate('/pilot');
      else if (data.user.role === 'fleet-manager') navigate('/fleet-manager');
      else navigate('/');
    } catch {
      setError('Server error. Please try again.');
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

          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <label htmlFor="login-email">{t('work_email', 'Work Email')}</label>
              <input id="login-email" name="email" type="email" placeholder="name@company.example" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required />
            </div>
            <div className="input-group">
              <label htmlFor="login-password">{t('password', 'Password')}</label>
              <input id="login-password" name="password" type="password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
            </div>
            <button type="submit" className="submit-btn login-submit">{t('login', 'Login')}</button>
          </form>
          <button type="button" className="back-link" onClick={() => navigate('/')}>{t('return_to_service', '← Return to service request')}</button>
        </div>
      </section>
    </main>
  );
}

export default Login;
