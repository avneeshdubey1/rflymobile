import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { signInWithPhoneNumber } from 'firebase/auth';
import { supportedLanguages } from '../i18n';
import { API_URL } from '../config';
import { auth } from '../lib/firebase';
import { clearPhoneRecaptcha, getPhoneRecaptcha, normalizeIndianPhone } from '../lib/firebasePhone';
import OtpInput from '../components/OtpInput';

export default function LandingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [preferredLanguage, setPreferredLanguage] = useState(i18n.language);
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

  const changeLanguage = (event) => {
    const language = event.target.value;
    localStorage.setItem('field-operations-language', language);
    void i18n.changeLanguage(language);
    setPreferredLanguage(language);
  };

  const sendRegistrationOtp = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await signInWithPhoneNumber(auth, normalizeIndianPhone(form.phone), getPhoneRecaptcha());
      setConfirmation(result);
      setStep('otp');
    } catch (failure) {
      clearPhoneRecaptcha();
      setError(failure?.message || 'Unable to send OTP.');
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
      const response = await fetch(`${API_URL}/api/auth/farmer/complete-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, name: form.name, village: form.village, district: form.district }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed.');
      clearPhoneRecaptcha();
      setStep('success');
    } catch (failure) {
      setError(failure?.message || 'OTP verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="landing-container">
      <nav className="navbar">
        <div className="logo">Daas</div>
        <div className="navbar__actions">
          <select aria-label={t('preferred_language')} value={preferredLanguage} onChange={changeLanguage}>
            {supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
          <button className="login-btn" onClick={() => navigate('/farmer/login')}>Farmer login</button>
          <button className="login-btn" onClick={() => navigate('/login')}>{t('employee_login')}</button>
        </div>
      </nav>

      <motion.main className="hero-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <section className="hero-intro">
          <div className="hero-content">
            <span className="hero-kicker">{t('hero_kicker')}</span>
            <h1 className="hero-title">Daas</h1>
            <p className="hero-subtitle">Create your Farmer account and request drone services.</p>
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
                  <p className="eyebrow eyebrow--accent">FARMER REGISTRATION</p>
                  <h2>Create your account</h2>
                  <p>Already registered? <Link to="/farmer/login">Login using OTP</Link></p>
                </div>
                <form onSubmit={sendRegistrationOtp} className="lead-form">
                  <div className="input-group"><label htmlFor="farmer-name">{t('full_name')}</label><input id="farmer-name" value={form.name} onChange={update('name')} minLength="2" maxLength="120" autoComplete="name" required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="farmer-phone">Mobile number</label><input id="farmer-phone" value={form.phone} onChange={update('phone')} inputMode="numeric" autoComplete="tel" placeholder="9876543210" maxLength="16" required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="farmer-village">Village / approximate location</label><input id="farmer-village" value={form.village} onChange={update('village')} maxLength="120" required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="farmer-district">District</label><input id="farmer-district" value={form.district} onChange={update('district')} maxLength="120" required disabled={busy} /></div>
                  <div id="recaptcha-container" />
                  <button className="submit-btn" disabled={busy}>{busy ? 'Sending…' : 'Verify mobile number'}</button>
                </form>
                <p>Business registration will be added in the next module.</p>
              </>
            )}

            {step === 'otp' && (
              <form onSubmit={completeRegistration} className="lead-form">
                <div className="form-heading"><p className="eyebrow eyebrow--accent">VERIFY MOBILE</p><h2>Enter the OTP</h2><p>We sent a six-digit code to your mobile number.</p></div>
                <div className="input-group">
                  <label>6-digit OTP</label>
                  <OtpInput length={6} onComplete={(val) => { setOtp(val); }} disabled={busy} />
                </div>
                <button className="submit-btn" disabled={busy || otp.length !== 6}>{busy ? 'Creating account…' : 'Complete registration'}</button>
                <button type="button" className="login-btn" onClick={() => { setStep('register'); setOtp(''); setConfirmation(null); clearPhoneRecaptcha(); }} disabled={busy}>Change details</button>
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
                <p className="eyebrow eyebrow--accent">REGISTRATION SUCCESSFUL</p>
                <h2 style={{ marginTop: '0.5rem', marginBottom: '0.25rem' }}>Your Farmer account is ready</h2>
                <p style={{ marginBottom: '1.5rem' }}>You will be redirected to login in <strong>{countdown}</strong> seconds.</p>
                <button className="submit-btn button-wide" onClick={() => navigate('/farmer/login', { replace: true })}>Continue to login</button>
              </div>
            )}
          </div>
        </section>
      </motion.main>
    </div>
  );
}
