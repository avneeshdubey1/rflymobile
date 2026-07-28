import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';

export default function FarmerRegister() {
  const { t } = useTranslation();

  return (
    <main className="login-container">
      <LanguageSelector style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }} />
      <section className="login-context">
        <div className="login-context__brand logo">Daas</div>
        <div className="login-context__copy">
          <p className="hero-kicker">{t('farmer_portal', 'Farmer Portal')}</p>
          <h1>{t('farmer_registration_staff_heading', 'Farmer accounts are created by the team.')}</h1>
          <p>{t('farmer_registration_staff_description', 'Call the company or speak with Sales. They can register your phone number and raise a request on your behalf.')}</p>
        </div>
      </section>

      <section className="login-form-pane">
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">{t('farmer_registration', 'FARMER REGISTRATION')}</p>
          <h2>{t('contact_sales_to_start', 'Contact Sales to start')}</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>
            {t('farmer_self_registration_retired', 'Self-registration is retired. A trusted staff member will create or link your farmer record before portal access is enabled.')}
          </p>

          <div className="alert info">
            {t('farmer_phone_first_note', 'You can still request service by phone. Sales can create the request and later open your farmer dashboard from the customer list.')}
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p><Link to="/request" style={{ fontWeight: 'bold' }}>{t('public_booking_link', 'Public booking form')}</Link></p>
            <p>{t('already_registered', 'Already registered?')} <Link to="/farmer/login" style={{ fontWeight: 'bold' }}>{t('login_here', 'Login here')}</Link></p>
            <p>{t('new_business_question', 'New Business?')} <Link to="/business/register" style={{ fontWeight: 'bold' }}>{t('business_registration', 'Business Registration')}</Link></p>
            <p className="muted">{t('employee_q', 'Employee?')} <Link to="/login" style={{ color: 'inherit' }}>{t('employee_login', 'Employee login')}</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
