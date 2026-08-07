import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../config';
import LanguageSelector from '../components/LanguageSelector';

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
      setNotice({ kind: 'error', text: t('service_location_unavailable', 'Location is unavailable. Please call the operations team.') });
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
        setNotice({ kind: 'success', text: t('service_location_captured', 'Farm location captured. You can now submit the request.') });
        focusNotice();
      },
      () => {
        setNotice({ kind: 'error', text: t('service_location_unavailable', 'Location is unavailable. Please call the operations team.') });
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
      const response = await fetch(`${API_URL}/api/leads/ingest/website`, {
        method: 'POST',
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
      const data = await response.json().catch(() => ({}));
      if (data.code === 'OUTSIDE_SERVICE_AREA') {
        setNotice({ kind: 'declined', text: t('service_area_unavailable', 'Service is unavailable at this location.') });
        setForm((current) => ({ ...current, latitude: '', longitude: '', acres: '', cropType: '' }));
      } else if (!response.ok) {
        setNotice({ kind: 'error', text: data.code === 'LOCATION_REQUIRED' ? t('service_location_required', 'Enter a valid farm location.') : t('request_error', 'Failed to submit request. Please try again.') });
      } else {
        setNotice({ kind: 'success', text: t('request_received_for_review', 'Your request was received and is waiting for Sales review.') });
        setForm(initialForm);
      }
      focusNotice();
    } catch {
      setNotice({ kind: 'error', text: t('request_error', 'Failed to submit request. Please try again.') });
      focusNotice();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="landing-container">
      <nav className="navbar" aria-label={t('public_navigation_label', 'Public navigation')}>
        <div className="logo">Drone as a Service</div>
        <div className="navbar__actions">
          <LanguageSelector />
          <Link className="login-btn" to="/farmer/login">{t('farmer_login_eyebrow', 'Farmer login')}</Link>
          <Link className="login-btn" to="/login">{t('employee_login', 'Employee login')}</Link>
        </div>
      </nav>

      <section className="hero-section">
        <div className="hero-intro">
          <div className="hero-content">
            <span className="hero-kicker">{t('public_booking_eyebrow', 'Public service request')}</span>
            <h1 className="hero-title">{t('public_booking_heading', 'Request a drone service')}</h1>
            <p className="hero-subtitle">{t('public_booking_copy', 'Online requests are reviewed by Sales. Calling the operations team remains the fastest way to begin.')}</p>
            <div className="hero-points">
              <div className="hero-point"><strong>{t('phone_first_title', 'Phone-first support')}</strong><span>{t('phone_first_copy', 'Call the operations team if a phone conversation is easier than this form.')}</span></div>
              <div className="hero-point"><strong>{t('service_area_title', 'Service-area checked')}</strong><span>{t('service_area_copy', 'Requests are accepted only inside an active operating area.')}</span></div>
              <div className="hero-point"><strong>{t('location_privacy_title', 'Location used carefully')}</strong><span>{t('location_privacy_copy', 'Location is used to decide whether service is available.')}</span></div>
            </div>
          </div>
        </div>

        <section className="request-pane" aria-labelledby="public-booking-form-title">
          <div className="panel form-container">
            <div className="form-heading">
              <p className="eyebrow eyebrow--accent">{t('request_kicker', 'Service request')}</p>
              <h2 id="public-booking-form-title">{t('request_service', 'Request Service')}</h2>
              <p>{t('public_booking_form_copy', 'We use the farm location only to check whether service is available.')}</p>
            </div>
            {notice && <div ref={noticeRef} tabIndex="-1" role={notice.kind === 'error' ? 'alert' : 'status'} className={`notice notice--${notice.kind === 'declined' ? 'warning' : notice.kind}`}>{notice.text}</div>}
            <form className="lead-form" onSubmit={submit}>
              <div className="input-group"><label htmlFor="public-farmer-name">{t('full_name', 'Full Name')}</label><input id="public-farmer-name" value={form.farmerName} onChange={update('farmerName')} minLength="2" maxLength="120" autoComplete="name" required disabled={busy} /></div>
              <div className="input-group"><label htmlFor="public-phone">{t('phone_number', 'Phone Number')}</label><input id="public-phone" value={form.phone} onChange={update('phone')} inputMode="tel" autoComplete="tel" maxLength="20" required disabled={busy} /></div>
              <div className="input-group"><label htmlFor="public-village">{t('village_location', 'Village / Location')}</label><input id="public-village" value={form.village} onChange={update('village')} maxLength="500" required disabled={busy} /></div>
              <div className="row-group">
                <div className="input-group"><label htmlFor="public-crop">{t('crop_type', 'Crop Type')}</label><input id="public-crop" value={form.cropType} onChange={update('cropType')} maxLength="120" required disabled={busy} /></div>
                <div className="input-group"><label htmlFor="public-acres">{t('total_acres', 'Total Acres')}</label><input id="public-acres" type="number" min="0.01" step="0.01" value={form.acres} onChange={update('acres')} required disabled={busy} /></div>
              </div>
              <fieldset className="form-stack">
                <legend>{t('service_location_title', 'Farm location')}</legend>
                <p className="field-hint">{t('service_location_hint', 'Enter coordinates or use your device location so we can check service availability.')}</p>
                <div className="row-group">
                  <div className="input-group"><label htmlFor="public-latitude">{t('latitude_label', 'Latitude')}</label><input id="public-latitude" type="number" min="-90" max="90" step="any" inputMode="decimal" value={form.latitude} onChange={update('latitude')} required disabled={busy} /></div>
                  <div className="input-group"><label htmlFor="public-longitude">{t('longitude_label', 'Longitude')}</label><input id="public-longitude" type="number" min="-180" max="180" step="any" inputMode="decimal" value={form.longitude} onChange={update('longitude')} required disabled={busy} /></div>
                </div>
                <button type="button" className="action-btn" onClick={useCurrentLocation} disabled={busy}>{t('use_current_location', 'Use current location')}</button>
              </fieldset>
              <button className="submit-btn" disabled={busy}>{busy ? t('submitting', 'Submitting...') : t('book_drone', 'Book a Drone')}</button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
