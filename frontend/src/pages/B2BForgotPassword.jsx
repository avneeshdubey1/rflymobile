import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import OtpInput from '../components/OtpInput';
import LanguageSelector from '../components/LanguageSelector';
import toast from 'react-hot-toast';

export default function B2BForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/business/recovery/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.challengeId) throw new Error(data.error || 'OTP request failed.');
      setChallengeId(data.challengeId);
      setOtp('');
      setStep(2);
    } catch (failure) {
      setError(failure?.message || 'Unable to send OTP.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/business/recovery/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpChallengeId: challengeId, code: otp.trim(), newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to reset password.');
      toast.success('Password reset successfully. All existing sessions were signed out.');
      navigate('/business/login', { replace: true });
    } catch (failure) {
      setError(failure?.message || 'Failed to reset password.');
    } finally {
      setBusy(false);
    }
  };

  const useAnotherNumber = () => {
    setStep(1);
    setChallengeId('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
  };

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Drone as a Service</div>
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
                  <input id="login-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="9876543210" maxLength="20" required disabled={busy} />
                </div>
                <button className="submit-btn login-submit" disabled={busy}>{busy ? 'Sending OTP...' : 'Send OTP'}</button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Enter OTP and set a new password</h2>
              <p className="subtitle" style={{ marginBottom: '1.6rem' }}>Enter the six-digit code delivered to the registered mobile number.</p>
              {error && <div className="alert error" role="alert">{error}</div>}
              <form className="login-form" onSubmit={resetPassword}>
                <div className="input-group">
                  <label>OTP Code</label>
                  <OtpInput length={6} onComplete={setOtp} disabled={busy} />
                </div>
                <div className="input-group">
                  <label htmlFor="new-password">New password</label>
                  <input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required disabled={busy} minLength="12" maxLength="128" autoComplete="new-password" />
                  <span className="field-hint">Use 12-128 characters.</span>
                </div>
                <div className="input-group">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={busy} minLength="12" maxLength="128" autoComplete="new-password" />
                </div>
                <button className="submit-btn login-submit" disabled={busy || otp.length !== 6 || !newPassword}>{busy ? 'Updating...' : 'Reset Password'}</button>
                <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={useAnotherNumber} disabled={busy}>Use another number</button>
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
