import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import { useTranslation } from 'react-i18next';
import { apiFetch, readJson } from '../services/apiClient';

const statusLabel = (status) => String(status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const statusTone = (status) => {
  if (['COMPLETED', 'PROCESSED'].includes(status)) return 'success';
  if (['CANCELLED', 'REJECTED'].includes(status)) return 'danger';
  if (['IN_PROGRESS', 'SCHEDULED'].includes(status)) return 'info';
  return 'warning';
};

export default function FarmerDashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('services');
  const [leads, setLeads] = useState([]);
  const [portalSummary, setPortalSummary] = useState({ total: 0, active: 0, completed: 0 });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  
  const [form, setForm] = useState({ 
    acreage: '', 
    cropType: '', 
    village: user?.village || '', 
    district: user?.district || '', 
    latitude: '',
    longitude: '',
    soilType: '',
    cropAgeWeeks: '',
    chemicalBrand: '',
    sprayPurpose: [],
    hasChemical: true,
    expectedDate: '',
    expectedTime: '',
    waterBodyNearby: false,
    terrainType: ''
  });

  const loadPortal = useCallback(async (signal) => {
    try {
      const response = await apiFetch('/api/portal/farmer/summary', { signal });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || t('request_error'));
      setLeads(data.portal?.leads || []);
      setPortalSummary(data.portal?.totals || { total: 0, active: 0, completed: 0 });
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setNotice({ kind: 'error', message: error.message || t('request_error') });
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void loadPortal(controller.signal), 0);
    return () => { window.clearTimeout(initialLoad); controller.abort(); };
  }, [loadPortal]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setNotice({ kind: 'error', message: t('service_location_unavailable') });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
      },
      () => setNotice({ kind: 'error', message: t('service_location_unavailable') }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const payload = {
        acreage: parseFloat(form.acreage),
        cropType: form.cropType,
        village: form.village,
        district: form.district,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        soilType: form.soilType,
        cropAgeWeeks: form.cropAgeWeeks ? parseInt(form.cropAgeWeeks) : undefined,
        chemicalBrand: form.chemicalBrand,
        sprayPurpose: Array.isArray(form.sprayPurpose) ? form.sprayPurpose.join(', ') : form.sprayPurpose,
        hasChemical: form.hasChemical,
        expectedDate: form.expectedDate,
        expectedTime: form.expectedTime,
        waterBodyNearby: form.waterBodyNearby,
        terrainType: form.terrainType
      };
      
      const response = await apiFetch('/api/leads/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await readJson(response);
      if (data.code === 'OUTSIDE_SERVICE_AREA') {
        setNotice({ kind: 'warning', message: t('service_area_unavailable') });
        setForm((current) => ({ ...current, acreage: '', cropType: '', latitude: '', longitude: '' }));
        return;
      }
      if (!response.ok) throw new Error(data.code === 'LOCATION_REQUIRED' ? t('service_location_required') : (data.error || t('request_error')));
      
      setNotice({ kind: 'success', message: t('request_received_for_review') });
      setForm({ ...form, acreage: '', cropType: '', latitude: '', longitude: '' });
      await loadPortal();
      setActiveTab('services');
    } catch (err) {
      setNotice({ kind: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const navItems = [
    { id: 'services', label: t('My Services'), icon: 'location' },
    { id: 'new-request', label: t('Request Drone'), icon: 'plus' },
  ];

  return (
    <OperationsShell roleLabel={t('farmer_workspace', 'Farmer Workspace')} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} user={user} onLogout={logout}>
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">FARMER PORTAL</p>
          <h1>{activeTab === 'services' ? t('My Services') : t('Request Drone Service')}</h1>
          <p>{activeTab === 'services' ? t('Track your active and past drone service requests.') : t('Provide details about your farm to request a drone spraying service.')}</p>
        </div>
      </header>

      {notice && (
        <div role="alert" className={`notice notice--${notice.kind}`}>
          <span>{notice.message}</span>
          <button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button>
        </div>
      )}

      {activeTab === 'services' && (
        <>
          <section className="metric-grid">
            <article className="metric-card"><div className="metric-card__top"><span>{t('Active Services')}</span><span className="metric-card__icon"><OpsIcon name="activeServices" /></span></div><strong className="metric-card__value">{portalSummary.active}</strong></article>
            <article className="metric-card"><div className="metric-card__top"><span>{t('Complete Services')}</span><span className="metric-card__icon"><OpsIcon name="complete" /></span></div><strong className="metric-card__value">{portalSummary.completed}</strong></article>
            <article className="metric-card"><div className="metric-card__top"><span>{t('Total Requests')}</span><span className="metric-card__icon"><OpsIcon name="request" /></span></div><strong className="metric-card__value">{portalSummary.total}</strong></article>
          </section>
          <section className="panel panel--raised">
            <div className="panel-header">
              <div className="panel-header__title">
                <div className="panel-title-row">
                  <span className="panel-title-icon"><OpsIcon name="drone" /></span>
                  <h2>{t('Recent Requests')}</h2>
                </div>
                <p>{t('Your requested services will appear here.')}</p>
              </div>
            </div>
            {leads.length > 0 ? (
              <div className="data-stack">
                {leads.map(lead => (
                  <div className="data-row" key={lead.id}>
                    <div className="data-row__main">
                      <span className="data-row__title">{lead.acreage} {t('Acres')} - {lead.cropType || t('Crop')}</span>
                      <span className="data-row__meta">{new Date(lead.createdAt).toLocaleDateString()} • {lead.farmerAddress || lead.matchedCenter?.name || t('Location received')}</span>
                      <span className={`status-badge status-badge--${statusTone(lead.status)}`}>{statusLabel(lead.status)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel-body">
                <div className="empty-state empty-state--center">
                  <strong>{t('No active requests found')}</strong>
                  <span>{t("Click on 'Request Drone' to book your first service.")}</span>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'new-request' && (
        <section className="panel panel--raised" style={{ maxWidth: '700px' }}>
          <div className="panel-header">
            <div className="panel-header__title">
              <div className="panel-title-row">
                <span className="panel-title-icon"><OpsIcon name="plus" /></span>
                <h2>{t('Service Details')}</h2>
              </div>
              <p>{t('Fill in the form to book a flight.')}</p>
            </div>
          </div>
          <form className="panel-body" style={{ padding: '1.5rem', background: 'var(--canvas)' }} onSubmit={submitRequest}>
            
            {/* Section 1: Farm Details */}
            <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <OpsIcon name="leaf" size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Farm Details')}</h3>
              </div>
              <div className="form-stack">
                <div className="row-group">
                  <div className="input-group">
                    <label>{t('Farm Size (Acres)')}</label>
                    <input type="number" step="0.1" min="0.1" required disabled={busy} value={form.acreage} onChange={e => setForm({...form, acreage: e.target.value})} placeholder={t('e.g. 2.5')} />
                  </div>
                  <div className="input-group">
                    <label>{t('Crop Type')}</label>
                    <input type="text" required disabled={busy} value={form.cropType} onChange={e => setForm({...form, cropType: e.target.value})} placeholder={t('e.g. Paddy, Cotton')} />
                  </div>
                </div>
                <div className="row-group">
                  <div className="input-group">
                    <label>{t('Soil Type')}</label>
                    <input type="text" disabled={busy} value={form.soilType} onChange={e => setForm({...form, soilType: e.target.value})} placeholder={t('e.g. Black soil, Red soil')} />
                  </div>
                  <div className="input-group">
                    <label>{t('Crop Age (Weeks)')}</label>
                    <input type="number" disabled={busy} value={form.cropAgeWeeks} onChange={e => setForm({...form, cropAgeWeeks: e.target.value})} placeholder={t('e.g. 4')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Spraying Requirements */}
            <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <OpsIcon name="drone" size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Spraying Requirements')}</h3>
              </div>
              <div className="form-stack">
                <div className="row-group">
                  <div className="input-group">
                    <label>{t('Expected Spraying Date')}</label>
                    <input type="date" disabled={busy} value={form.expectedDate} onChange={e => setForm({...form, expectedDate: e.target.value})} />
                  </div>
                  <div className="input-group">
                    <label>{t('Expected Time')}</label>
                    <select disabled={busy} value={form.expectedTime} onChange={e => setForm({...form, expectedTime: e.target.value})}>
                      <option value="">{t('Any time')}</option>
                      <option value="Morning">{t('Morning (6 AM - 11 AM)')}</option>
                      <option value="Afternoon">{t('Afternoon (11 AM - 4 PM)')}</option>
                      <option value="Evening">{t('Evening (4 PM - 7 PM)')}</option>
                    </select>
                  </div>
                </div>

                <div className="input-group">
                  <label style={{ marginBottom: '0.2rem' }}>{t('Spray Purpose')}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.65rem' }}>
                    {['Pest Control', 'Nutrient Spray', 'Weed Control', 'Disease Control'].map(purpose => {
                      const isChecked = Array.isArray(form.sprayPurpose) && form.sprayPurpose.includes(purpose);
                      return (
                        <label key={purpose} style={{ 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          padding: '0.85rem 0.5rem', 
                          border: `2px solid ${isChecked ? 'var(--primary)' : 'var(--border)'}`, 
                          borderRadius: 'var(--radius-sm)', 
                          background: isChecked ? 'var(--primary-soft)' : 'var(--surface)',
                          cursor: busy ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease',
                          textAlign: 'center',
                          fontWeight: isChecked ? '700' : '500',
                          color: isChecked ? 'var(--primary-hover)' : 'var(--text-primary)',
                          userSelect: 'none',
                          lineHeight: '1.2'
                        }}>
                          <input 
                            type="checkbox" 
                            style={{ display: 'none' }}
                            disabled={busy}
                            checked={isChecked}
                            onChange={(e) => {
                              const current = Array.isArray(form.sprayPurpose) ? form.sprayPurpose : [];
                              const newPurposes = e.target.checked 
                                ? [...current, purpose]
                                : current.filter(p => p !== purpose);
                              setForm({...form, sprayPurpose: newPurposes});
                            }}
                          />
                          {t(purpose)}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.15rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--surface)', cursor: busy ? 'not-allowed' : 'pointer', marginTop: '0.2rem' }}>
                  <span style={{ fontWeight: 650, color: 'var(--text-primary)' }}>{t('Is there a water body nearby?')}</span>
                  <input type="checkbox" disabled={busy} checked={form.waterBodyNearby} onChange={e => setForm({...form, waterBodyNearby: e.target.checked})} style={{ width: '22px', height: '22px', margin: 0, cursor: 'pointer' }} />
                </label>

                <div className="row-group">
                  <div className="input-group">
                    <label>{t('Chemical/Fertilizer Availability')}</label>
                    <select required disabled={busy} value={form.hasChemical ? 'yes' : 'no'} onChange={e => setForm({...form, hasChemical: e.target.value === 'yes'})}>
                      <option value="yes">{t('Yes, I have it')}</option>
                      <option value="no">{t('No, Daas should procure it')}</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label>{t('Chemical Brand (if known)')}</label>
                    <input type="text" disabled={busy} value={form.chemicalBrand} onChange={e => setForm({...form, chemicalBrand: e.target.value})} placeholder={t('e.g. Coragen, Urea')} />
                  </div>
                </div>

              </div>
            </div>

            {/* Section 3: Location */}
            <div style={{ background: 'var(--surface-raised)', padding: '1.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '1.5rem', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.6rem' }}>
                <OpsIcon name="location" size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.15rem', fontWeight: 750 }}>{t('Location')}</h3>
              </div>
              <div className="form-stack">
                <div className="row-group">
                  <div className="input-group">
                    <label>{t('Village Location')}</label>
                    <input type="text" required disabled={busy} value={form.village} onChange={e => setForm({...form, village: e.target.value})} placeholder={t('Village name')} />
                  </div>
                  <div className="input-group">
                    <label>{t('District')}</label>
                    <input type="text" required disabled={busy} value={form.district} onChange={e => setForm({...form, district: e.target.value})} placeholder={t('District name')} />
                  </div>
                </div>

                <fieldset className="form-stack">
                  <legend>{t('service_location_title')}</legend>
                  <span className="field-hint" style={{ marginBottom: '0.8rem', display: 'block' }}>{t('service_location_hint')}</span>
                  <div className="row-group">
                    <div className="input-group"><label htmlFor="farmer-latitude">{t('latitude_label')}</label><input id="farmer-latitude" type="number" min="-90" max="90" step="any" inputMode="decimal" required disabled={busy} value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></div>
                    <div className="input-group"><label htmlFor="farmer-longitude">{t('longitude_label')}</label><input id="farmer-longitude" type="number" min="-180" max="180" step="any" inputMode="decimal" required disabled={busy} value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></div>
                  </div>
                  <button type="button" className="action-btn" onClick={useCurrentLocation} disabled={busy}>{t('use_current_location')}</button>
                </fieldset>
              </div>
            </div>
            
            <div className="form-actions">
              <button type="submit" className="submit-btn" disabled={busy} style={{ width: '100%', padding: '1rem', fontSize: '1.15rem', borderRadius: 'var(--radius-md)', boxShadow: '0 8px 20px rgba(46, 107, 77, 0.25)' }}>
                {busy ? t('Submitting...') : t('Submit Request')}
              </button>
            </div>
          </form>
        </section>
      )}
    </OperationsShell>
  );
}
