import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { clearPhoneRecaptcha, getPhoneRecaptcha, normalizeIndianPhone } from '../lib/firebasePhone';
import { API_URL } from '../config';
import { useAuth } from '../context/useAuth';
import OtpInput from '../components/OtpInput';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export default function FarmerRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  
  const [name, setName] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [phone, setPhone] = useState('');
  
  const [otp, setOtp] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => clearPhoneRecaptcha(), []);

  const sendOtp = async (event) => {
    event.preventDefault();
    if (!name.trim() || !village.trim() || !district.trim() || !phone.trim()) {
      setError(t('fill_all_fields_error', 'Please fill in all fields before verifying your phone.'));
      return;
    }
    
    setBusy(true);
    setError('');
    try {
      const result = await signInWithPhoneNumber(auth, normalizeIndianPhone(phone), getPhoneRecaptcha());
      setConfirmation(result);
    } catch (failure) {
      clearPhoneRecaptcha();
      setError(failure?.message || t('unable_to_send_otp', 'Unable to send OTP.'));
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
      
      const response = await fetch(`${API_URL}/api/auth/farmer/complete-signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          idToken,
          name: name.trim(),
          village: village.trim(),
          district: district.trim()
        }),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('registration_failed', 'Registration failed.'));
      
      login(data.user, data.token);
      toast.success(t('registration_complete', 'Registration Complete!'));
      navigate('/success', { replace: true });
    } catch (failure) {
      setError(failure?.message || t('registration_verification_failed', 'Registration verification failed.'));
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
          <p className="hero-kicker">{t('farmer_portal', 'Farmer Portal')}</p>
          <h1>{t('join_network', 'Join the network.')}</h1>
          <p>{t('register_description', 'Register once to effortlessly request and track drone operations on your farm.')}</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">{t('farmer_registration', 'FARMER REGISTRATION')}</p>
          <h2>{t('create_an_account_heading', 'Create an account')}</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>{t('fill_details', 'Fill in your details and verify your mobile number.')}</p>
          
          {error && <div className="alert error" role="alert">{error}</div>}
          
          {!confirmation ? (
            <form className="login-form" onSubmit={sendOtp}>
              <div className="input-group">
                <label htmlFor="reg-name">{t('full_name', 'Full Name')}</label>
                <input id="reg-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('enter_full_name', 'Enter your full name')} required disabled={busy} />
              </div>
              <div className="input-group">
                <label htmlFor="reg-village">{t('village_town', 'Village / Town')}</label>
                <input id="reg-village" type="text" value={village} onChange={e => setVillage(e.target.value)} placeholder={t('eg_village', 'E.g. Alangulam')} required disabled={busy} />
              </div>
              <div className="input-group">
                <label htmlFor="reg-district">{t('district_label', 'District')}</label>
                <input id="reg-district" type="text" value={district} onChange={e => setDistrict(e.target.value)} placeholder={t('eg_district', 'E.g. Tenkasi')} required disabled={busy} />
              </div>
              <div className="input-group">
                <label htmlFor="reg-phone">{t('mobile_number', 'Mobile number')}</label>
                <input id="reg-phone" inputMode="numeric" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="9876543210" maxLength="16" required disabled={busy} />
              </div>
              
              <div id="recaptcha-container" />
              <button className="submit-btn login-submit" disabled={busy}>{busy ? t('sending_otp', 'Sending OTP…') : t('send_otp_register', 'Send OTP & Register')}</button>
            </form>
          ) : (
            <form className="login-form" onSubmit={verifyOtp}>
              <div className="input-group">
                <label>{t('otp_sent_to', '6-digit OTP sent to')} {phone}</label>
                <OtpInput length={6} onComplete={(val) => { setOtp(val); }} disabled={busy} />
              </div>
              <button className="submit-btn login-submit" disabled={busy || otp.length !== 6}>{busy ? t('registering', 'Registering…') : t('complete_registration', 'Complete Registration')}</button>
              <button type="button" className="login-btn button-wide" style={{ marginTop: '0.65rem' }} onClick={() => { setConfirmation(null); setOtp(''); clearPhoneRecaptcha(); }} disabled={busy}>{t('edit_details', 'Edit Details')}</button>
            </form>
          )}
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p>{t('already_registered', 'Already registered?')} <Link to="/farmer/login" style={{ fontWeight: 'bold' }}>{t('login_here', 'Login here')}</Link></p>
            <p>New Business? <Link to="/business/register" style={{ fontWeight: 'bold' }}>Business Registration</Link></p>
            <p className="muted">{t('employee_q', 'Employee?')} <Link to="/login" style={{ color: 'inherit' }}>{t('employee_login', 'Employee login')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
