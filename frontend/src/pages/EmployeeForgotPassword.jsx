import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import OtpInput from '../components/OtpInput';
import { apiFetch, readJson } from '../services/apiClient';

export default function EmployeeForgotPassword() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState('request');
  const [identifier, setIdentifier] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [challengeId, setChallengeId] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const requestRecovery = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await apiFetch('/api/auth/recovery/request', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), channel }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || t('recovery_request_failed', 'Unable to start account recovery. Please try again later.'));
      setChallengeId(data.challengeId || '');
      setNotice(data.message || t('recovery_generic_notice', 'If an eligible account matches, recovery instructions have been sent through the selected channel.'));
      setStep('complete');
    } catch (failure) {
      setError(failure?.message || t('recovery_request_failed', 'Unable to start account recovery. Please try again later.'));
    } finally {
      setBusy(false);
    }
  };

  const completeRecovery = async (event) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError(t('passwords_do_not_match', 'The passwords do not match.'));
      return;
    }
    setBusy(true);
    try {
      const response = await apiFetch('/api/auth/recovery/complete', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code, newPassword }),
      });
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || t('recovery_complete_failed', 'The code is invalid or expired. Request a new code and try again.'));
      navigate('/login', { replace: true, state: { recoveryComplete: true } });
    } catch (failure) {
      setError(failure?.message || t('recovery_complete_failed', 'The code is invalid or expired. Request a new code and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep('request');
    setChallengeId('');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setNotice('');
    setError('');
  };

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">{t('secure_account_recovery', 'Secure account recovery')}</p>
          <h1>{t('recover_employee_account', 'Recover your work account.')}</h1>
          <p>{t('recovery_channel_description', 'WhatsApp is the default recovery channel, with SMS and email available as fallbacks for verified destinations.')}</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow">{t('employee_workspace', 'Employee workspace')}</p>
          <h2>{step === 'request' ? t('forgot_password', 'Forgot password?') : t('enter_recovery_code', 'Enter your recovery code')}</h2>
          {notice && <div className="notice" role="status">{notice}</div>}
          {error && <div className="alert error" role="alert">{error}</div>}

          {step === 'request' ? (
            <form className="login-form" onSubmit={requestRecovery}>
              <div className="input-group">
                <label htmlFor="recovery-identifier">{t('work_email_or_phone', 'Work email or verified phone')}</label>
                <input id="recovery-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required disabled={busy} />
              </div>
              <div className="input-group">
                <label htmlFor="recovery-channel">{t('recovery_channel', 'Recovery channel')}</label>
                <select id="recovery-channel" value={channel} onChange={(event) => setChannel(event.target.value)} disabled={busy}>
                  <option value="whatsapp">{t('whatsapp_default', 'WhatsApp (default)')}</option>
                  <option value="sms">{t('sms', 'SMS')}</option>
                  <option value="email">{t('email', 'Email')}</option>
                </select>
              </div>
              <button className="submit-btn login-submit" disabled={busy}>{busy ? t('sending', 'Sending…') : t('send_recovery_code', 'Send recovery code')}</button>
            </form>
          ) : (
            <form className="login-form" onSubmit={completeRecovery}>
              <div className="input-group">
                <label>{t('recovery_code', 'Recovery code')}</label>
                <OtpInput value={code} onChange={setCode} length={6} disabled={busy} label={t('recovery_code', 'Recovery code')} />
              </div>
              <div className="input-group">
                <label htmlFor="recovery-password">{t('new_password', 'New password')}</label>
                <input id="recovery-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy} />
                <span className="field-hint">{t('password_length_hint', 'Use 12–128 characters.')}</span>
              </div>
              <div className="input-group">
                <label htmlFor="recovery-password-confirm">{t('confirm_password', 'Confirm new password')}</label>
                <input id="recovery-password-confirm" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required disabled={busy} />
              </div>
              <button className="submit-btn login-submit" disabled={busy || code.length !== 6 || !challengeId}>{busy ? t('updating', 'Updating…') : t('reset_password', 'Reset password')}</button>
              <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={restart} disabled={busy}>{t('request_new_code', 'Request a new code')}</button>
            </form>
          )}

          <p style={{ marginTop: '1.5rem', textAlign: 'center' }}><Link to="/login">{t('back_to_login', 'Back to login')}</Link></p>
        </div>
      </section>
    </main>
  );
}
