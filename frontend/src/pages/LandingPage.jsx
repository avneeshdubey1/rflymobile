import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { supportedLanguages } from '../i18n';
import { API_URL as API } from '../config';
import LocationLink from '../components/LocationLink';

function LandingPage() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [formData, setFormData] = useState({ farmerName: '', phone: '', village: '', cropType: '', acres: '', preferredLanguage: i18n.language });
  const [status, setStatus] = useState('');
  const [locationLocked, setLocationLocked] = useState(false);
  const [appealOffer, setAppealOffer] = useState(null);

  const handleChange = (event) => setFormData({ ...formData, [event.target.name]: event.target.value });

  const getGPSLocation = () => {
    if (!navigator.geolocation) { alert(t('gps_unsupported')); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((current) => ({ ...current, village: t('gps_fetched'), latitude: position.coords.latitude, longitude: position.coords.longitude }));
        setLocationLocked(true);
      },
      () => alert(t('gps_error')),
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('submitting');
    try {
      const response = await fetch(`${API}/api/leads/ingest/website`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await response.json();
      if (!response.ok) { setStatus('error'); return; }
      if (!data.inRange) { setAppealOffer({ leadId: data.lead.id, ...data.appealOffer }); setStatus('out-of-range'); return; }
      setStatus('success');
      setFormData({ farmerName: '', phone: '', village: '', cropType: '', acres: '', preferredLanguage: i18n.language });
      setLocationLocked(false);
    } catch { setStatus('error'); }
  };

  const requestAppeal = async () => {
    try {
      const response = await fetch(`${API}/api/leads/${appealOffer.leadId}/appeal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerMessage: 'Requested from the website' }) });
      if (!response.ok) throw new Error('Appeal request failed');
      setStatus('appeal-pending');
    } catch { setStatus('error'); }
  };

  const changeLanguage = (event) => {
    const language = event.target.value;
    localStorage.setItem('field-operations-language', language);
    void i18n.changeLanguage(language);
    setFormData((current) => ({ ...current, preferredLanguage: language }));
  };

  return (
    <div className="landing-container">
      <nav className="navbar">
        <div className="logo">Daas</div>
        <div className="navbar__actions">
          <select aria-label={t('preferred_language')} value={formData.preferredLanguage} onChange={changeLanguage}>
            {supportedLanguages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
          </select>
          <button className="login-btn" onClick={() => navigate('/login')}>{t('employee_login')}</button>
        </div>
      </nav>

      <motion.main className="hero-section" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <section className="hero-intro">
          <div className="hero-content">
            <span className="hero-kicker">{t('hero_kicker')}</span>
            <h1 className="hero-title">Daas</h1>
            <p className="hero-subtitle">{t('request_subtitle')}</p>
            <div className="hero-points">
              <div className="hero-point"><strong>{t('hero_location_title')}</strong><span>{t('hero_location_copy')}</span></div>
              <div className="hero-point"><strong>{t('hero_operations_title')}</strong><span>{t('hero_operations_copy')}</span></div>
              <div className="hero-point"><strong>{t('hero_mobile_title')}</strong><span>{t('hero_mobile_copy')}</span></div>
            </div>
          </div>
        </section>

        <section className="request-pane">
          <div className="panel form-container">
            <div className="form-heading">
              <p className="eyebrow eyebrow--accent">{t('request_kicker')}</p>
              <h2>{t('request_service')}</h2>
              <p>{t('request_subtitle')}</p>
            </div>

            {status === 'success' && <div role="status" className="alert success">{t('request_success')}</div>}
            {status === 'error' && <div role="alert" className="alert error">{t('request_error')}</div>}
            {status === 'out-of-range' && appealOffer && (
              <div className="alert error appeal-notice">
                <span>{t('out_of_range', { excessKm: appealOffer.excessKm.toFixed(1), fee: appealOffer.suggestedFee ?? '—' })}</span>
                <button type="button" className="action-btn" onClick={requestAppeal}>{t('cover_transport')}</button>
              </div>
            )}
            {status === 'appeal-pending' && <div role="status" className="alert success">{t('appeal_pending')}</div>}

            <form onSubmit={handleSubmit} className="lead-form">
              <div className="input-group">
                <label htmlFor="farmer-name">{t('full_name')}</label>
                <input id="farmer-name" type="text" name="farmerName" value={formData.farmerName} onChange={handleChange} required minLength={2} maxLength={120} placeholder={t('name_placeholder')} />
              </div>
              <div className="input-group">
                <label htmlFor="farmer-phone">{t('phone_number')}</label>
                <input id="farmer-phone" type="tel" name="phone" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value.replace(/[^\d+\s().-]/g, '') })} required minLength={7} maxLength={20} inputMode="tel" placeholder={t('phone_placeholder')} />
              </div>
              <div className="input-group">
                <label htmlFor="farm-location">{t('village_location')}</label>
                <div className="gps-field">
                  <input id="farm-location" type="text" name="village" value={locationLocked ? t('gps_fetched') : formData.village} onChange={handleChange} required placeholder={t('location_placeholder')} disabled={locationLocked} />
                  {!locationLocked && <button type="button" className="action-btn" onClick={getGPSLocation}>{t('fetch_gps')}</button>}
                </div>
                {locationLocked && <LocationLink latitude={formData.latitude} longitude={formData.longitude} label={t('gps_fetched')} fallback={t('gps_fetched')} />}
              </div>
              <div className="row-group">
                <div className="input-group"><label htmlFor="crop-type">{t('crop_type')}</label><input id="crop-type" type="text" name="cropType" value={formData.cropType} onChange={handleChange} required maxLength={120} placeholder={t('crop_placeholder')} /></div>
                <div className="input-group"><label htmlFor="total-acres">{t('total_acres')}</label><input id="total-acres" type="number" name="acres" value={formData.acres} onChange={handleChange} required min="0.01" step="0.01" placeholder={t('acres_placeholder')} /></div>
              </div>
              <button type="submit" className="submit-btn" disabled={status === 'submitting'}>{status === 'submitting' ? t('submitting') : t('book_drone')}</button>
            </form>
          </div>
        </section>
      </motion.main>
    </div>
  );
}

export default LandingPage;
