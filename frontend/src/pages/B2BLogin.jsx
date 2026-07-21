import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth } from '../context/useAuth';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from 'react-i18next';

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
      const response = await fetch(`${API_URL}/api/auth/business/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      login(data.user, data.token);
      navigate('/business/dashboard', { replace: true });
    } catch (failure) {
      setError(failure?.message || 'Login failed.');
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
          <p className="hero-kicker">Business Portal</p>
          <h1>Manage your drone operations.</h1>
          <p>Login to your B2B account to request drone services, manage operations, and view invoices.</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">BUSINESS LOGIN</p>
          <h2>Welcome back</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>Access your business dashboard using your email and password.</p>
          
          {error && <div className="alert error" role="alert">{error}</div>}
          
          <form className="login-form" onSubmit={handleEmailLogin}>
            <div className="input-group">
              <label htmlFor="login-email">Email address</label>
              <input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="company@example.com" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="login-password">Password</label>
              <input id="login-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required disabled={busy} />
              <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
                <Link to="/business/forgot-password" style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>Forgot password?</Link>
              </div>
            </div>
            <button className="submit-btn login-submit" disabled={busy}>{busy ? 'Logging in…' : 'Login'}</button>
          </form>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p>New to here? <Link to="/farmer/register" style={{ fontWeight: 'bold' }}>Farmer Registration</Link></p>
            <p>New Business? <Link to="/business/register" style={{ fontWeight: 'bold' }}>Business Registration</Link></p>
            <p className="muted">Employee? <Link to="/login" style={{ color: 'inherit' }}>Employee login</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
