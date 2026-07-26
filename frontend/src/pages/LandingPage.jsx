import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import { apiFetch, readJson } from '../services/apiClient';

const initialForm = {
  farmerName: '',
  phone: '',
  village: '',
  cropType: '',
  acres: '',
  latitude: '',
  longitude: '',
};

export default function LandingPage() {
  const { t, i18n } = useTranslation();
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeRef = useRef(null);

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const focusNotice = () => window.setTimeout(() => noticeRef.current?.focus(), 0);

  const useCurrentLocation = () => {
    setNotice(null);
    if (!navigator.geolocation) {
      setNotice({ kind: 'error', text: t('service_location_unavailable') });
      focusNotice();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setNotice({ kind: 'success', text: t('service_location_captured') });
        focusNotice();
      },
      () => {
        setNotice({ kind: 'error', text: t('service_location_unavailable') });
        focusNotice();
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const response = await apiFetch('/api/leads/ingest/website', {
        method: 'POST',
        authFailure: 'ignore',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          farmerName: form.farmerName,
          phone: form.phone,
          village: form.village,
          cropType: form.cropType,
          acres: form.acres,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          preferredLanguage: i18n.language,
        }),
      });
      const data = await readJson(response);
      if (data.code === 'OUTSIDE_SERVICE_AREA') {
        setNotice({ kind: 'declined', text: t('service_area_unavailable') });
        setForm((current) => ({ ...current, latitude: '', longitude: '', acres: '', cropType: '' }));
        focusNotice();
        return;
      }
      if (!response.ok) {
        setNotice({ kind: 'error', text: data.code === 'LOCATION_REQUIRED' ? t('service_location_required') : t('request_error') });
        focusNotice();
        return;
      }
      setNotice({ kind: 'success', text: t('request_received_for_review') });
      setForm(initialForm);
      focusNotice();
    } catch {
      setNotice({ kind: 'error', text: t('request_error') });
      focusNotice();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="landing-container">
      <nav className="navbar" aria-label={t('public_navigation_label')}>
        <div className="logo">Daas</div>
        <div className="navbar__actions">
          <LanguageSelector />
          <Link className="login-btn" to="/farmer/login">{t('farmer_login_eyebrow')}</Link>
          <Link className="login-btn" to="/login">{t('employee_login')}</Link>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-intro">
          <div className="hero-content">
            <span className="hero-kicker">{t('public_booking_eyebrow')}</span>
            <h1 className="hero-title">{t('public_booking_heading')}</h1>
            <p className="hero-subtitle">{t('public_booking_copy')}</p>
            <div className="hero-points">
              <div className="hero-point"><strong>{t('phone_first_title')}</strong><span>{t('phone_first_copy')}</span></div>
              <div className="hero-point"><strong>{t('service_area_title')}</strong><span>{t('service_area_copy')}</span></div>
              <div className="hero-point"><strong>{t('location_privacy_title')}</strong><span>{t('location_privacy_copy')}</span></div>
            </div>
          </div>
        </div>

        <section className="request-pane" aria-labelledby="public-booking-form-title">
          <div className="panel form-container">
            <div className="form-heading">
              <p className="eyebrow eyebrow--accent">{t('request_kicker')}</p>
              <h2 id="public-booking-form-title">{t('request_service')}</h2>
              <p>{t('public_booking_form_copy')}</p>
            </div>

            {notice && (
              <div ref={noticeRef} tabIndex="-1" role={notice.kind === 'error' ? 'alert' : 'status'} className={`notice notice--${notice.kind === 'declined' ? 'warning' : notice.kind}`}>
                {notice.text}
              </div>
            )}

            <form className="lead-form" onSubmit={submit}>
              <div className="input-group"><label htmlFor="public-farmer-name">{t('full_name')}</label><input id="public-farmer-name" value={form.farmerName} onChange={update('farmerName')} minLength="2" maxLength="120" autoComplete="name" required disabled={busy} /></div>
              <div className="input-group"><label htmlFor="public-phone">{t('phone_number')}</label><input id="public-phone" value={form.phone} onChange={update('phone')} inputMode="tel" autoComplete="tel" maxLength="20" required disabled={busy} /></div>
              <div className="input-group"><label htmlFor="public-village">{t('village_location')}</label><input id="public-village" value={form.village} onChange={update('village')} maxLength="500" required disabled={busy} /></div>
              <div className="row-group">
                <div className="input-group"><label htmlFor="public-crop">{t('crop_type')}</label><input id="public-crop" value={form.cropType} onChange={update('cropType')} maxLength="120" required disabled={busy} /></div>
                <div className="input-group"><label htmlFor="public-acres">{t('total_acres')}</label><input id="public-acres" type="number" min="0.01" step="0.01" value={form.acres} onChange={update('acres')} required disabled={busy} /></div>
              </div>
              <fieldset className="form-stack">
                <legend>{t('service_location_title')}</legend>
                <p className="field-hint">{t('service_location_hint')}</p>
                <div className="row-group">
                  <div className="input-group"><label htmlFor="public-latitude">{t('latitude_label')}</label><input id="public-latitude" type="number" min="-90" max="90" step="any" inputMode="decimal" value={form.latitude} onChange={update('latitude')} required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="public-longitude">{t('longitude_label')}</label><input id="public-longitude" type="number" min="-180" max="180" step="any" inputMode="decimal" value={form.longitude} onChange={update('longitude')} required disabled={busy} /></div>
                </div>
                <button type="button" className="action-btn" onClick={useCurrentLocation} disabled={busy}>{t('use_current_location')}</button>
              </fieldset>
              <button className="submit-btn" disabled={busy}>{busy ? t('submitting') : t('book_drone')}</button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
