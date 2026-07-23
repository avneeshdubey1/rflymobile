import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber, signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { auth, authReady } from '../lib/firebase';
import { clearPhoneRecaptcha, getPhoneRecaptcha, normalizeIndianPhone } from '../lib/firebasePhone';
import OtpInput from '../components/OtpInput';
import LanguageSelector from '../components/LanguageSelector';
import { apiFetch, readJson } from '../services/apiClient';

export default function B2BForgotPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recovery, setRecovery] = useState({ challengeId: '', resetToken: '' });
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
      setStep(2);
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
      const response = await apiFetch('/api/auth/business/recovery/verify-phone', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success || !data.challengeId || !data.resetToken) {
        throw new Error('PHONE_RECOVERY_FAILED');
      }
      setRecovery({ challengeId: data.challengeId, resetToken: data.resetToken });
      setStep(3);
    } catch {
      setError(t('otp_verification_failed', 'OTP verification failed. Please try again.'));
    } finally {
      if (auth?.currentUser) await signOut(auth).catch(() => undefined);
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('passwords_do_not_match', 'The passwords do not match.'));
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch('/api/auth/business/recovery/complete', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...recovery, newPassword }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || t('recovery_complete_failed', 'Failed to reset password.'));
      toast.success(t('password_reset_success', 'Password reset successfully. All existing sessions were signed out.'));
      navigate('/business/login', { replace: true });
    } catch (failure) {
      setError(failure?.message || t('recovery_complete_failed', 'Failed to reset password.'));
    } finally {
      setBusy(false);
    }
  };

  const useAnotherNumber = () => {
    setStep(1);
    setConfirmation(null);
    setOtp('');
    setRecovery({ challengeId: '', resetToken: '' });
    setError('');
    clearPhoneRecaptcha();
  };

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">{t('business_portal', 'Business Portal')}</p>
          <h1>{t('reset_your_password', 'Reset your password')}</h1>
          <p>{t('business_recovery_description', 'Verify your registered mobile number to securely update your password.')}</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">{t('password_recovery', 'PASSWORD RECOVERY')}</p>

          {step === 1 && <>
            <h2>{t('verify_your_number', 'Verify your number')}</h2>
            <p className="subtitle" style={{ marginBottom: '1.6rem' }}>{t('business_phone_instruction', 'Enter the mobile number associated with your business account.')}</p>
            {error && <div className="alert error" role="alert">{error}</div>}
            <form className="login-form" onSubmit={sendOtp}>
              <div className="input-group">
                <label htmlFor="login-phone">{t('mobile_number', 'Mobile number')}</label>
                <input id="login-phone" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="9876543210" maxLength="16" required disabled={busy} />
              </div>
              <div id="recaptcha-container" />
              <button className="submit-btn login-submit" disabled={busy}>{busy ? t('sending_otp', 'Sending OTP…') : t('send_otp', 'Send OTP')}</button>
            </form>
          </>}

          {step === 2 && <>
            <h2>{t('enter_otp', 'Enter OTP')}</h2>
            <p className="subtitle" style={{ marginBottom: '1.6rem' }}>{t('otp_sent_to', 'We sent a 6-digit code to')} {phone}</p>
            {error && <div className="alert error" role="alert">{error}</div>}
            <form className="login-form" onSubmit={verifyOtp}>
              <div className="input-group">
                <label>{t('otp_label', 'OTP Code')}</label>
                <OtpInput value={otp} onChange={setOtp} length={6} disabled={busy} label={t('otp_label', 'OTP Code')} />
              </div>
              <button className="submit-btn login-submit" disabled={busy || otp.length !== 6}>{busy ? t('verifying', 'Verifying…') : t('verify', 'Verify')}</button>
              <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={useAnotherNumber} disabled={busy}>{t('use_another_number', 'Use another number')}</button>
            </form>
          </>}

          {step === 3 && <>
            <h2>{t('set_new_password', 'Set new password')}</h2>
            <p className="subtitle" style={{ marginBottom: '1.6rem' }}>{t('identity_verified_password', 'Your identity has been verified. You can now set a new password.')}</p>
            {error && <div className="alert error" role="alert">{error}</div>}
            <form className="login-form" onSubmit={resetPassword}>
              <div className="input-group">
                <label htmlFor="new-password">{t('new_password', 'New Password')}</label>
                <input id="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder={t('enter_new_password', 'Enter new password')} required disabled={busy} minLength="12" maxLength="128" autoComplete="new-password" />
                <span className="field-hint">{t('password_length_hint', 'Use 12–128 characters.')}</span>
              </div>
              <div className="input-group">
                <label htmlFor="confirm-password">{t('confirm_password', 'Confirm new password')}</label>
                <input id="confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required disabled={busy} minLength="12" maxLength="128" autoComplete="new-password" />
              </div>
              <button className="submit-btn login-submit" disabled={busy || !newPassword || !recovery.resetToken}>{busy ? t('updating', 'Updating…') : t('reset_password', 'Reset Password')}</button>
            </form>
          </>}

          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p><Link to="/business/login" style={{ fontWeight: 'bold' }}>{t('back_to_login', 'Back to Login')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
