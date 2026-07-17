import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { clearPhoneRecaptcha, getPhoneRecaptcha, normalizeIndianPhone } from '../lib/firebasePhone';
import { API_URL } from '../config';
import { useAuth } from '../context/useAuth';
import OtpInput from '../components/OtpInput';

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
      const result = await signInWithPhoneNumber(auth, normalizeIndianPhone(phone), getPhoneRecaptcha());
      setConfirmation(result);
    } catch (failure) {
      clearPhoneRecaptcha();
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
      const credential = await confirmation.confirm(otp.trim());
      const idToken = await credential.user.getIdToken();
      const response = await fetch(`${API_URL}/api/auth/farmer/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      login(data.user, data.token);
      navigate('/farmer/dashboard', { replace: true });
    } catch (failure) {
      setError(failure?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-container">
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">Farmer Portal</p>
          <h1>Request drone services instantly.</h1>
          <p>Login to track your requests, view past services, and request new flights.</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">FARMER LOGIN</p>
          <h2>Welcome back</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>Use the mobile number registered with your Farmer account.</p>
          
          {error && <div className="alert error" role="alert">{error}</div>}
          
          {!confirmation ? (
            <form className="login-form" onSubmit={sendOtp}>
              <div className="input-group">
                <label htmlFor="login-phone">Mobile number</label>
                <input id="login-phone" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="9876543210" maxLength="16" required disabled={busy} />
              </div>
              <div id="recaptcha-container" />
              <button className="submit-btn login-submit" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</button>
            </form>
          ) : (
            <form className="login-form" onSubmit={verifyOtp}>
              <div className="input-group">
                <label>6-digit OTP</label>
                <OtpInput length={6} onComplete={(val) => { setOtp(val); }} disabled={busy} />
              </div>
              <button className="submit-btn login-submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Login'}</button>
              <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={() => { setConfirmation(null); setOtp(''); clearPhoneRecaptcha(); }} disabled={busy}>Use another number</button>
            </form>
          )}
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p>New Farmer? <Link to="/" style={{ fontWeight: 'bold' }}>Create an account</Link></p>
            <p className="muted">Employee? <Link to="/login" style={{ color: 'inherit' }}>Employee login</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}

