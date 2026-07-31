import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL } from '../config';
import { useAuth } from '../context/useAuth';
import LanguageSelector from '../components/LanguageSelector';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

export default function B2BRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    businessName: '',
    contactPerson: '',
    email: '',
    mobile: '',
    address: '',
    gstNo: '',
    password: ''
  });
  
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/api/auth/business/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed.');
      }
      
      toast.success('Registration submitted for approval!');
      navigate('/business/success', { replace: true });
    } catch (failure) {
      setError(failure?.message || 'Registration failed.');
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
          <p className="hero-kicker">Business Portal</p>
          <h1>Request drone services instantly.</h1>
          <p>Register your business to access drone services, manage requests, and monitor your operations anytime.</p>
        </div>
      </section>

      <section className="login-form-pane" style={{ overflowY: 'auto' }}>
        <div className="panel login-card">
          <p className="eyebrow eyebrow--accent">BUSINESS REGISTRATION</p>
          <h2>Create your account</h2>
          <p className="subtitle" style={{ marginBottom: '1.6rem' }}>Register your business to access our B2B services.</p>
          
          {error && <div className="alert error" role="alert">{error}</div>}
          
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="businessName">Business Name</label>
              <input id="businessName" type="text" value={formData.businessName} onChange={handleChange} placeholder="ABC Pvt Ltd" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="contactPerson">Contact Person</label>
              <input id="contactPerson" type="text" value={formData.contactPerson} onChange={handleChange} placeholder="John Doe" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="gstNo">GST Number</label>
              <input id="gstNo" type="text" value={formData.gstNo} onChange={handleChange} placeholder="Enter GST Number" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={formData.email} onChange={handleChange} placeholder="company@example.com" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="mobile">Mobile Number</label>
              <input id="mobile" inputMode="numeric" autoComplete="tel" value={formData.mobile} onChange={handleChange} placeholder="9876543210" maxLength="16" required disabled={busy} />
            </div>
            <div className="input-group">
              <label htmlFor="address">Business Address</label>
              <textarea id="address" value={formData.address} onChange={handleChange} placeholder="Enter your complete business address" required disabled={busy} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #ccc', resize: 'vertical' }} />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={formData.password} onChange={handleChange} placeholder="Create a password" required disabled={busy} />
            </div>
            
            <button className="submit-btn login-submit" disabled={busy}>{busy ? 'Registering…' : 'Register Business'}</button>
          </form>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'grid', gap: '0.5rem' }}>
            <p>Already have a business account? <Link to="/business/login" style={{ fontWeight: 'bold' }}>Login here</Link></p>
            <p className="muted">Farmer? <Link to="/farmer/register" style={{ color: 'inherit' }}>Farmer Registration</Link></p>
          </div>
        </div>
      </section>
    </main>
  );
}
