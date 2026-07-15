import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = "http://localhost:5000";

function LandingPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    farmerName: '',
    phone: '',
    village: '',
    cropType: '',
    acres: ''
  });
  const [status, setStatus] = useState('');
  const [locationLocked, setLocationLocked] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const getGPSLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            village: `GPS: ${position.coords.latitude}, ${position.coords.longitude}`
          });
          setLocationLocked(true);
        },
        (error) => {
          alert("Error fetching GPS location. Please type your location manually.");
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('submitting');
    try {
      const res = await fetch(`${API}/api/leads/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setStatus('success');
        setFormData({ farmerName: '', phone: '', village: '', cropType: '', acres: '' });
        setLocationLocked(false);
      } else {
        setStatus('error');
      }
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="landing-container drone-bg">
      <nav className="navbar">
        <div className="logo">RFLY DaaS</div>
        <button className="login-btn" onClick={() => navigate('/login')}>Employee Login</button>
      </nav>
      
      <main className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">RFLY DaaS</h1>
          <p className="hero-subtitle">Request a drone service today.</p>
          
          <div className="glass-card form-container">
            <h2>Request Service</h2>
            {status === 'success' && <div className="alert success">Request submitted successfully! Our team will contact you shortly.</div>}
            {status === 'error' && <div className="alert error">Failed to submit request. Please try again.</div>}
            
            <form onSubmit={handleSubmit} className="lead-form">
              <div className="input-group">
                <label>Full Name</label>
                <input type="text" name="farmerName" value={formData.farmerName} onChange={handleChange} required placeholder="Enter your name" />
              </div>
              <div className="input-group">
                <label>Phone Number</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required placeholder="10-digit number" />
              </div>
              
              <div className="input-group">
                <label>Village / Location</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="text" 
                    name="village" 
                    value={locationLocked ? "GPS location fetched" : formData.village} 
                    onChange={handleChange} 
                    required 
                    placeholder="Enter village or fetch GPS" 
                    disabled={locationLocked}
                  />
                  {!locationLocked && (
                    <button type="button" className="action-btn" onClick={getGPSLocation}>
                      Fetch GPS
                    </button>
                  )}
                </div>
              </div>

              <div className="row-group">
                <div className="input-group">
                  <label>Crop Type</label>
                  <input type="text" name="cropType" value={formData.cropType} onChange={handleChange} required placeholder="e.g. Cotton, Wheat" />
                </div>
                <div className="input-group">
                  <label>Total Acres</label>
                  <input type="number" name="acres" value={formData.acres} onChange={handleChange} required placeholder="Area in acres" />
                </div>
              </div>
              <button type="submit" className="submit-btn" disabled={status === 'submitting'}>
                {status === 'submitting' ? 'Submitting...' : 'Book a Drone'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default LandingPage;
