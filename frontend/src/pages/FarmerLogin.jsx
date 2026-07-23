import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber, signOut } from 'firebase/auth';
import { auth, authReady } from '../lib/firebase';
import { clearPhoneRecaptcha, getPhoneRecaptcha, normalizeIndianPhone } from '../lib/firebasePhone';
import { useAuth } from '../context/useAuth';
import OtpInput from '../components/OtpInput';
import { useTranslation } from 'react-i18next';

import LanguageSelector from '../components/LanguageSelector';
import { apiFetch, readJson } from '../services/apiClient';

export default function FarmerLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => clearPhoneRecaptcha(), []);

  const sendOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authReady;
      const result = await signInWithPhoneNumber(auth, normalizeIndianPhone(phone), getPhoneRecaptcha());
      setConfirmation(result);
    } catch {
      clearPhoneRecaptcha();
      setError(t('unable_to_send_otp', 'Unable to send OTP. Please check the number and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const credential = await confirmation.confirm(otp.trim());
      const idToken = await credential.user.getIdToken();
      const response = await apiFetch('/api/auth/farmer/login', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      login(data.user);
      navigate('/farmer/dashboard', { replace: true });
    } catch {
      setError(t('otp_verification_failed', 'OTP verification failed. Please try again.'));
    } finally {
      if (auth?.currentUser) await signOut(auth).catch(() => undefined);
      setBusy(false);
    }
  };

  const { t } = useTranslation();

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
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
          
          {!confirmation ? (
            <form className="login-form" onSubmit={sendOtp}>
              <div className="input-group">
                <label htmlFor="login-phone">{t('mobile_number', 'Mobile number')}</label>
                <input id="login-phone" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="9876543210" maxLength="16" required disabled={busy} />
              </div>
              <div id="recaptcha-container" />
              <button className="submit-btn login-submit" disabled={busy}>{busy ? t('sending', 'Sending…') : t('send_otp', 'Send OTP')}</button>
            </form>
          ) : (
            <form className="login-form" onSubmit={verifyOtp}>
              <div className="input-group">
                <label>{t('otp_label', '6-digit OTP')}</label>
                <OtpInput value={otp} onChange={setOtp} length={6} disabled={busy} label={t('otp_label', '6-digit OTP')} />
              </div>
              <button className="submit-btn login-submit" disabled={busy || otp.length !== 6}>{busy ? t('verifying', 'Verifying…') : t('login', 'Login')}</button>
              <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={() => { setConfirmation(null); setOtp(''); clearPhoneRecaptcha(); }} disabled={busy}>{t('use_another_number', 'Use another number')}</button>
            </form>
          )}
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p>{t('new_to_here', 'New to here?')} <Link to="/farmer/register" style={{ fontWeight: 'bold' }}>{t('create_account', 'Farmer Registration')}</Link></p>
            <p>{t('business_account_question', 'Business account?')} <Link to="/business/login" style={{ fontWeight: 'bold' }}>{t('business_login', 'Business Login')}</Link></p>
            <p className="muted">{t('employee_q', 'Employee?')} <Link to="/login" style={{ color: 'inherit' }}>{t('employee_login', 'Employee login')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
