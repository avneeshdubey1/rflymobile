import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

export default function B2BRegister() {
  const { t } = useTranslation();

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">{t('business_portal', 'Business Portal')}</p>
          <h1>{t('business_registration_staff_heading', 'Business access is enabled by the operations team.')}</h1>
          <p>{t('business_registration_staff_description', 'A staff member must first link your account to an approved organization and its service requests.')}</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">{t('business_registration', 'BUSINESS REGISTRATION')}</p>
          <h2>{t('contact_sales_to_start', 'Contact Sales to start')}</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>
            {t('business_self_registration_retired', 'Public self-registration is unavailable. This prevents an unapproved account from seeing company or farm-group records.')}
          </p>
          <div className="alert info">
            {t('business_phone_first_note', 'The team can still record a service request by phone while business portal access is being arranged.')}
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p><Link to="/request" style={{ fontWeight: 'bold' }}>{t('public_booking_link', 'Public booking form')}</Link></p>
            <p>{t('already_registered', 'Already registered?')} <Link to="/business/login" style={{ fontWeight: 'bold' }}>{t('login_here', 'Login here')}</Link></p>
            <p>{t('farmer_q', 'Farmer?')} <Link to="/farmer/login" style={{ color: 'inherit' }}>{t('farmer_login', 'Farmer login')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
