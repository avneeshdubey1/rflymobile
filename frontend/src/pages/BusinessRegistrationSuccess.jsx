import { useNavigate } from 'react-router-dom';

function BusinessRegistrationSuccess() {
  const navigate = useNavigate();

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
          Registered Successfully!
        </h2>
        <p className="subtitle" style={{ marginBottom: '32px', fontSize: '16px', lineHeight: '1.5' }}>
          Your business account registration is complete. Our executives will verify your details and get back to you shortly to activate your account.
        </p>
        
        <button 
          className="submit-btn login-submit" 
          onClick={() => navigate('/business/login')}
          style={{ width: '100%' }}
        >
          Return to Login
        </button>
      </div>
    </div>
  );
}

export default BusinessRegistrationSuccess;
