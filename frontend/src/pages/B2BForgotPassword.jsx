import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { clearPhoneRecaptcha, getPhoneRecaptcha, normalizeIndianPhone } from '../lib/firebasePhone';
import { API_URL } from '../config';
import OtpInput from '../components/OtpInput';
import toast from 'react-hot-toast';

export default function B2BForgotPassword() {
  const navigate = useNavigate();
  
  // Steps: 1 (Phone), 2 (OTP), 3 (New Password)
  const [step, setStep] = useState(1);
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  
  const [newPassword, setNewPassword] = useState('');
  const [idToken, setIdToken] = useState('');
  
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
      setStep(2);
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
      const token = await credential.user.getIdToken();
      setIdToken(token);
      setStep(3);
    } catch (failure) {
      setError(failure?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/business/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password.');
      
      toast.success('Password reset successfully!');
      navigate('/business/login', { replace: true });
    } catch (failure) {
      setError(failure?.message || 'Failed to reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-container">
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">Business Portal</p>
          <h1>Reset your password</h1>
          <p>Verify your registered mobile number to securely update your password.</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">PASSWORD RECOVERY</p>
          
          {step === 1 && (
            <>
              <h2>Verify your number</h2>
              <p className="subtitle" style={{ marginBottom: '1.6rem' }}>Enter the mobile number associated with your business account.</p>
              
              {error && <div className="alert error" role="alert">{error}</div>}
              
              <form className="login-form" onSubmit={sendOtp}>
                <div className="input-group">
                  <label htmlFor="login-phone">Mobile number</label>
                  <input id="login-phone" inputMode="numeric" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9876543210" maxLength="16" required disabled={busy} />
                </div>
                <div id="recaptcha-container" />
                <button className="submit-btn login-submit" disabled={busy}>{busy ? 'Sending OTP…' : 'Send OTP'}</button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Enter OTP</h2>
              <p className="subtitle" style={{ marginBottom: '1.6rem' }}>We sent a 6-digit code to {phone}</p>
              
              {error && <div className="alert error" role="alert">{error}</div>}
              
              <form className="login-form" onSubmit={verifyOtp}>
                <div className="input-group">
                  <label>OTP Code</label>
                  <OtpInput length={6} onComplete={(val) => { setOtp(val); }} disabled={busy} />
                </div>
                <button className="submit-btn login-submit" disabled={busy || otp.length !== 6}>{busy ? 'Verifying…' : 'Verify'}</button>
                <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={() => { setStep(1); setConfirmation(null); setOtp(''); clearPhoneRecaptcha(); }} disabled={busy}>Use another number</button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <h2>Set new password</h2>
              <p className="subtitle" style={{ marginBottom: '1.6rem' }}>Your identity has been verified. You can now set a new password.</p>
              
              {error && <div className="alert error" role="alert">{error}</div>}
              
              <form className="login-form" onSubmit={resetPassword}>
                <div className="input-group">
                  <label htmlFor="new-password">New Password</label>
                  <input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" required disabled={busy} minLength="6" />
                </div>
                <button className="submit-btn login-submit" disabled={busy || !newPassword}>{busy ? 'Updating…' : 'Reset Password'}</button>
              </form>
            </>
          )}
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p><Link to="/business/login" style={{ fontWeight: 'bold' }}>Back to Login</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
