import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../context/useAuth';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import { apiFetch, readJson } from '../services/apiClient';

export default function B2BLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleEmailLogin = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/business/login', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || t('login_failed', 'Login failed.'));
      login(data.user);
      navigate('/business/dashboard', { replace: true });
    } catch (failure) {
      setError(failure?.message || t('login_failed', 'Login failed.'));
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
          <p className="hero-kicker">{t('business_portal', 'Business Portal')}</p>
          <h1>{t('business_login_heading', 'Manage your drone operations.')}</h1>
          <p>{t('business_login_subheading', 'Login to your B2B account to request drone services, manage operations, and view invoices.')}</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">{t('business_login', 'BUSINESS LOGIN')}</p>
          <h2>{t('welcome_back', 'Welcome back')}</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>{t('business_login_instruction', 'Access your business dashboard using your email and password.')}</p>
          
          {error && <div className="alert error" role="alert">{error}</div>}
          
          <form className="login-form" onSubmit={handleEmailLogin}>
            <div className="input-group">
              <label htmlFor="login-email">{t('email_address', 'Email address')}</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="company@example.com" autoComplete="username" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="login-password">{t('password', 'Password')}</label>
              <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={t('enter_password', 'Enter password')} autoComplete="current-password" required disabled={busy} />
              <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
                <Link to="/business/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>{t('forgot_password', 'Forgot password?')}</Link>
              </div>
            </div>
            <button className="submit-btn login-submit" disabled={busy}>{busy ? t('logging_in', 'Logging in…') : t('login', 'Login')}</button>
          </form>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p>{t('new_to_here', 'New to here?')} <Link to="/farmer/register" style={{ fontWeight: 'bold' }}>{t('farmer_registration', 'Farmer Registration')}</Link></p>
            <p>{t('new_business_question', 'New Business?')} <Link to="/business/register" style={{ fontWeight: 'bold' }}>{t('business_registration', 'Business Registration')}</Link></p>
            <p className="muted">{t('employee_q', 'Employee?')} <Link to="/login" style={{ color: 'inherit' }}>{t('employee_login', 'Employee login')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
