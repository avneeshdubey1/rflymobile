import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

function RegistrationSuccess() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="login-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="login-card panel" style={{ textAlign: 'center', padding: '50px 30px', maxWidth: '450px', width: '100%' }}>
        <div style={{ 
          backgroundColor: '#22c55e', 
          width: '90px', 
          height: '90px', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 24px',
          boxShadow: '0 0 25px rgba(34, 197, 94, 0.5)'
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2 style={{ marginBottom: '16px', fontSize: '28px' }}>
          {t('registration_completed', 'Registration Completed!')}
        </h2>
        <p className="subtitle" style={{ marginBottom: '32px', fontSize: '16px', lineHeight: '1.5' }}>
          {t('registration_success_message', 'Your service request has been successfully submitted. Our team will contact you shortly.')}
        </p>
        
        <button 
          className="submit-btn login-submit" 
          onClick={() => navigate('/')}
          style={{ width: '100%' }}
        >
          {t('return_to_home', 'Return to Home')}
        </button>
      </div>
    </div>
  );
}

export default RegistrationSuccess;
