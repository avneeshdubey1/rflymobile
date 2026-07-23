import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { signInWithPhoneNumber, signOut } from 'firebase/auth';
import { auth, authReady } from '../lib/firebase';
import { clearPhoneRecaptcha, getPhoneRecaptcha, normalizeIndianPhone } from '../lib/firebasePhone';
import OtpInput from '../components/OtpInput';
import LanguageSelector from '../components/LanguageSelector';
import { apiFetch, readJson } from '../services/apiClient';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', phone: '', village: '', district: '' });
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [step, setStep] = useState('register');
  const [countdown, setCountdown] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => clearPhoneRecaptcha(), []);
  useEffect(() => {
    if (step !== 'success') return undefined;
    if (countdown <= 0) {
      navigate('/farmer/login', { replace: true });
      return undefined;
    }
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, navigate, step]);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const sendRegistrationOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authReady;
      const result = await signInWithPhoneNumber(auth, normalizeIndianPhone(form.phone), getPhoneRecaptcha());
      setConfirmation(result);
      setStep('otp');
    } catch {
      clearPhoneRecaptcha();
      setError(t('unable_to_send_otp', 'Unable to send OTP. Please check the number and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const completeRegistration = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const credential = await confirmation.confirm(otp.trim());
      const idToken = await credential.user.getIdToken();
      const response = await apiFetch('/api/auth/farmer/complete-signup', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, name: form.name, village: form.village, district: form.district }),
      });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Registration failed.');
      clearPhoneRecaptcha();
      setStep('success');
    } catch {
      setError(t('otp_verification_failed', 'OTP verification failed. Please try again.'));
    } finally {
      if (auth?.currentUser) await signOut(auth).catch(() => undefined);
      setBusy(false);
    }
  };

  return (
    <div className="landing-container">
      <nav className="navbar">
        <div className="logo">Daas</div>
        <div className="navbar__actions">
          <LanguageSelector />
          <button className="login-btn" onClick={() => navigate('/farmer/login')}>{t('farmer_login_eyebrow', 'Farmer login')}</button>
          <button className="login-btn" onClick={() => navigate('/login')}>{t('employee_login')}</button>
        </div>
      </nav>

      <motion.main className="hero-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <section className="hero-intro">
          <div className="hero-content">
            <span className="hero-kicker">{t('hero_kicker')}</span>
            <h1 className="hero-title">Daas</h1>
            <p className="hero-subtitle">{t('hero_subtitle', 'Create your Farmer account and request drone services.')}</p>
            <div className="hero-points">
              <div className="hero-point"><strong>{t('hero_location_title')}</strong><span>{t('hero_location_copy')}</span></div>
              <div className="hero-point"><strong>{t('hero_operations_title')}</strong><span>{t('hero_operations_copy')}</span></div>
              <div className="hero-point"><strong>{t('hero_mobile_title')}</strong><span>{t('hero_mobile_copy')}</span></div>
            </div>
          </div>
        </section>

        <section className="request-pane">
          <div className="panel form-container">
            {error && <div className="alert error" role="alert">{error}</div>}

            {step === 'register' && (
              <>
                <div className="form-heading">
                  <p className="eyebrow eyebrow--accent">{t('farmer_registration', 'FARMER REGISTRATION')}</p>
                  <h2>{t('create_an_account_heading', 'Create your account')}</h2>
                  <p>{t('already_registered', 'Already registered?')} <Link to="/farmer/login">{t('login_here', 'Login using OTP')}</Link></p>
                </div>
                <form onSubmit={sendRegistrationOtp} className="lead-form">
                  <div className="input-group"><label htmlFor="farmer-name">{t('full_name')}</label><input id="farmer-name" value={form.name} onChange={update('name')} minLength="2" maxLength="120" autoComplete="name" required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="farmer-phone">{t('mobile_number', 'Mobile number')}</label><input id="farmer-phone" value={form.phone} onChange={update('phone')} inputMode="numeric" autoComplete="tel" placeholder="9876543210" maxLength="16" required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="farmer-village">{t('village_town', 'Village / approximate location')}</label><input id="farmer-village" value={form.village} onChange={update('village')} maxLength="120" required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="farmer-district">{t('district_label', 'District')}</label><input id="farmer-district" value={form.district} onChange={update('district')} maxLength="120" required disabled={busy} /></div>
                  <div id="recaptcha-container" />
                  <button className="submit-btn" disabled={busy}>{busy ? t('sending_otp', 'Sending…') : t('send_otp', 'Verify mobile number')}</button>
                </form>
                <p>{t('business_registration_note', 'Business registration will be added in the next module.')}</p>
              </>
            )}

            {step === 'otp' && (
              <form onSubmit={completeRegistration} className="lead-form">
                <div className="form-heading"><p className="eyebrow eyebrow--accent">{t('verify_mobile_eyebrow', 'VERIFY MOBILE')}</p><h2>{t('enter_otp', 'Enter the OTP')}</h2><p>{t('sent_six_digit_code', 'We sent a six-digit code to your mobile number.')}</p></div>
                <div className="input-group">
                  <label>{t('otp_label', '6-digit OTP')}</label>
                  <OtpInput value={otp} onChange={setOtp} length={6} disabled={busy} label={t('otp_label', '6-digit OTP')} />
                </div>
                <button className="submit-btn" disabled={busy || otp.length !== 6}>{busy ? t('registering', 'Creating account…') : t('complete_registration', 'Complete registration')}</button>
                <button type="button" className="login-btn" onClick={() => { setStep('register'); setOtp(''); setConfirmation(null); setError(''); clearPhoneRecaptcha(); }} disabled={busy}>{t('edit_details', 'Change details')}</button>
              </form>
            )}

            {step === 'success' && (
              <div className="form-heading form-heading--center" role="status" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <motion.svg width="86" height="86" viewBox="0 0 50 50" initial="hidden" animate="visible">
                    <motion.circle cx="25" cy="25" r="22" fill="none" stroke="var(--success)" strokeWidth="2.5" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1, transition: { duration: 0.6 } } }} />
                    <motion.path d="M15 26 L22 32 L35 17" fill="none" stroke="var(--success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" variants={{ hidden: { pathLength: 0 }, visible: { pathLength: 1, transition: { delay: 0.3, duration: 0.4 } } }} />
                  </motion.svg>
                </div>
                <p className="eyebrow eyebrow--accent">{t('registration_successful', 'REGISTRATION SUCCESSFUL')}</p>
                <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>{t('account_ready', 'Your Farmer account is ready')}</h2>
                <p style={{ marginBottom: '1.5rem' }}>{t('redirect_login', 'You will be redirected to login in {{countdown}} seconds.', { countdown })}</p>
                <button className="submit-btn button-wide" onClick={() => navigate('/farmer/login', { replace: true })}>{t('continue_login', 'Continue to login')}</button>
              </div>
            )}
          </div>
        </section>
      </motion.main>
    </div>
  );
}
