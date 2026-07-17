import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import { API_URL as API } from '../config';

const statusLabel = (status) => String(status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const statusTone = (status) => {
  if (['COMPLETED', 'PROCESSED'].includes(status)) return 'success';
  if (['CANCELLED', 'REJECTED', 'OUT_OF_RANGE'].includes(status)) return 'danger';
  if (['IN_PROGRESS', 'SCHEDULED'].includes(status)) return 'info';
  return 'warning';
};

export default function FarmerDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('services');
  const [leads, setLeads] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  
  const [form, setForm] = useState({ 
    acreage: '', 
    cropType: '', 
    village: user?.village || '', 
    district: user?.district || '', 
    mapsLink: '' 
  });
  
  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const payload = {
        farmerName: user.name,
        farmerPhone: user.phone,
        acreage: parseFloat(form.acreage),
        cropType: form.cropType,
        village: `${form.village}, ${form.district}`,
        mapsLink: form.mapsLink
      };
      
      const response = await fetch(`${API}/api/leads/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to submit request.');
      
      setNotice({ kind: 'success', message: 'Your drone service request has been submitted successfully! We will contact you soon.' });
      setForm({ ...form, acreage: '', cropType: '', mapsLink: '' });
      setLeads([data.lead, ...leads]);
      setActiveTab('services');
    } catch (err) {
      setNotice({ kind: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const navItems = [
    { id: 'services', label: 'My Services', icon: 'location' },
    { id: 'new-request', label: 'Request Drone', icon: 'plus' },
  ];

  return (
    <OperationsShell roleLabel="Farmer Workspace" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} user={user} logout={logout}>
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">FARMER PORTAL</p>
          <h1>{activeTab === 'services' ? 'My Services' : 'Request Drone Service'}</h1>
          <p>{activeTab === 'services' ? 'Track your active and past drone service requests.' : 'Provide details about your farm to request a drone spraying service.'}</p>
        </div>
      </header>

      {notice && (
        <div role="alert" className={`notice notice--${notice.kind}`}>
          <span>{notice.message}</span>
          <button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      {activeTab === 'services' && (
        <section className="panel panel--raised">
          <div className="panel-header">
            <div className="panel-header__title">
              <div className="panel-title-row">
                <span className="panel-title-icon"><OpsIcon name="drone" /></span>
                <h2>Recent Requests</h2>
              </div>
              <p>Your requested services will appear here.</p>
            </div>
          </div>
          {leads.length > 0 ? (
            <div className="data-stack">
              {leads.map(lead => (
                <div className="data-row" key={lead.id}>
                  <div className="data-row__main">
                    <span className="data-row__title">{lead.acreage} Acres - {lead.cropType || 'Crop'}</span>
                    <span className="data-row__meta">{new Date(lead.createdAt).toLocaleDateString()} • {lead.farmerAddress}</span>
                    <span className={`status-badge status-badge--${statusTone(lead.status)}`}>{statusLabel(lead.status)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="panel-body">
              <div className="empty-state empty-state--center">
                <strong>No active requests found</strong>
                <span>Click on 'Request Drone' to book your first service.</span>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'new-request' && (
        <section className="panel panel--raised" style={{ maxWidth: '700px' }}>
          <div className="panel-header">
            <div className="panel-header__title">
              <div className="panel-title-row">
                <span className="panel-title-icon"><OpsIcon name="plus" /></span>
                <h2>Service Details</h2>
              </div>
              <p>Fill in the form to book a flight.</p>
            </div>
          </div>
          <form className="panel-body form-stack" onSubmit={submitRequest}>
            <div className="row-group">
              <div className="input-group">
                <label>Farm Size (Acres)</label>
                <input type="number" step="0.1" min="0.1" required disabled={busy} value={form.acreage} onChange={e => setForm({...form, acreage: e.target.value})} placeholder="e.g. 2.5" />
              </div>
              <div className="input-group">
                <label>Crop Type</label>
                <input type="text" required disabled={busy} value={form.cropType} onChange={e => setForm({...form, cropType: e.target.value})} placeholder="e.g. Paddy, Cotton" />
              </div>
            </div>
            
            <div className="input-group">
              <label>Village Location</label>
              <input type="text" required disabled={busy} value={form.village} onChange={e => setForm({...form, village: e.target.value})} placeholder="Village name" />
            </div>

            <div className="input-group">
              <label>District</label>
              <input type="text" required disabled={busy} value={form.district} onChange={e => setForm({...form, district: e.target.value})} placeholder="District name" />
            </div>

            <div className="input-group">
              <label>Google Maps Link (Optional but highly recommended)</label>
              <input type="url" disabled={busy} value={form.mapsLink} onChange={e => setForm({...form, mapsLink: e.target.value})} placeholder="https://maps.google.com/..." />
              <span className="field-hint">Providing a precise map link helps us assign the right pilot faster.</span>
            </div>
            
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button type="submit" className="submit-btn" disabled={busy}>
                {busy ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </section>
      )}
    </OperationsShell>
  );
}
