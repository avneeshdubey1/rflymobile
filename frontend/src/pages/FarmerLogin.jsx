import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth } from '../context/useAuth';
import OtpInput from '../components/OtpInput';
import { useTranslation } from 'react-i18next';

import LanguageSelector from '../components/LanguageSelector';

export default function FarmerLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/farmer/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.challengeId) throw new Error(data.error || 'OTP request failed.');
      setChallengeId(data.challengeId);
      setOtp('');
    } catch (failure) {
      setError(failure?.message || 'Unable to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/farmer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code: otp.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      login(data.user);
      navigate('/farmer/dashboard', { replace: true });
    } catch (failure) {
      setError(failure?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const { t } = useTranslation();

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">RFLY DaaS</div>
        <div className="login-context__copy">
          <p className="hero-kicker">{t('farmer_portal', 'Farmer Portal')}</p>
          <h1>{t('farmer_login_heading', 'Request drone services instantly.')}</h1>
          <p>{t('farmer_login_subheading', 'Login to track your requests, view past services, and request new flights.')}</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">{t('farmer_login_eyebrow', 'FARMER LOGIN')}</p>
          <h2>{t('welcome_back', 'Welcome back')}</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>{t('login_mobile_instruction', 'Use the mobile number registered with your Farmer account.')}</p>

          {error && <div className="alert error" role="alert">{error}</div>}

          {!challengeId ? (
            <form className="login-form" onSubmit={sendOtp}>
              <div className="input-group">
                <label htmlFor="login-phone">
                  {t('mobile_number', 'Mobile number')}
                </label>
                <input
                  id="login-phone"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="9876543210"
                  maxLength="20"
                  required
                  disabled={busy}
                />
              </div>
              <button className="submit-btn login-submit" disabled={busy}>{busy ? t('sending', 'Sending…') : t('send_otp', 'Send OTP')}</button>
            </form>
          ) : (
            <form className="login-form" onSubmit={verifyOtp}>
              <div className="input-group">
                <label>{t('otp_label', '6-digit OTP')}</label>
                <OtpInput length={6} onComplete={(val) => { setOtp(val); }} disabled={busy} />
              </div>
              <button className="submit-btn login-submit" disabled={busy || otp.length !== 6}>{busy ? t('verifying', 'Verifying…') : t('login', 'Login')}</button>
              <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={() => { setChallengeId(''); setOtp(''); setError(''); }} disabled={busy}>{t('use_another_number', 'Use another number')}</button>
            </form>
          )}

          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p>{t('new_to_here', 'New to here?')} <Link to="/farmer/register" style={{ fontWeight: 'bold' }}>{t('create_account', 'Farmer Registration')}</Link></p>
            <p>Business account? <Link to="/business/login" style={{ fontWeight: 'bold' }}>Business Login</Link></p>
            <p className="muted">{t('employee_q', 'Employee?')} <Link to="/login" style={{ color: 'inherit' }}>{t('employee_login', 'Employee login')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}

