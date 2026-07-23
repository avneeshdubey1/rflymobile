import { useEffect, useState } from 'react';
import OpsIcon from './OpsIcon';
import { useAuth } from '../context/useAuth';
import { apiFetch, readJson } from '../services/apiClient';

function BhumeetLogbook() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  const [flights, setFlights] = useState([]);
  const [flightsLoading, setFlightsLoading] = useState(true);
  
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchFlights() {
      try {
        const res = await apiFetch('/api/bhumeet/logs');
        const data = await readJson(res);
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load logs');
        setFlights(data.flights || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setFlightsLoading(false);
      }
    }

    async function fetchDashboard() {
      try {
        const [overviewRes, dronesRes, pilotsRes, weatherRes, reportsRes] = await Promise.all([
          apiFetch('/api/bhumeet/overview'),
          apiFetch('/api/bhumeet/drones'),
          apiFetch('/api/bhumeet/dronePilots'),
          apiFetch('/api/bhumeet/weather'),
          apiFetch('/api/bhumeet/reports')
        ]);

        const [overview, drones, pilots, weather, reports] = await Promise.all([
          readJson(overviewRes), readJson(dronesRes), readJson(pilotsRes), readJson(weatherRes), readJson(reportsRes)
        ]);

        setDashboardData({
          overview: overview.data,
          drones: drones.data,
          pilots: pilots.data,
          weather: weather.data,
          reports: reports.data
        });
      } catch (err) {
        setError("Failed to load dashboard data: " + err.message);
      } finally {
        setDashboardLoading(false);
      }
    }

    fetchFlights();
    fetchDashboard();
  }, [user]);

  return (
    <div>
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Integrations</p>
          <h1>Bhumeet Data Link</h1>
          <p>Review the raw flight records and global metrics synced from the Bhumeet DSP API.</p>
        </div>
        <div className="page-header__actions">
          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-raised)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => setActiveTab('overview')} 
              className={activeTab === 'overview' ? 'submit-btn' : 'ghost-btn'}
              style={{ minHeight: '32px', padding: '0.4rem 1rem' }}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('logs')} 
              className={activeTab === 'logs' ? 'submit-btn' : 'ghost-btn'}
              style={{ minHeight: '32px', padding: '0.4rem 1rem' }}
            >
              Raw Logs
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="notice notice--error">
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'overview' && (
        <div>
          {dashboardLoading || !dashboardData ? (
             <div className="empty-state"><strong>Loading Dashboard...</strong></div>
          ) : (
            <>
              {/* Metrics */}
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-card__top">
                    <span>Total Drones</span>
                    <span className="metric-card__icon"><OpsIcon name="server" /></span>
                  </div>
                  <div className="metric-card__value">{dashboardData.overview.totalDrones}</div>
                </div>
                <div className="metric-card metric-card--info">
                  <div className="metric-card__top">
                    <span>Active Missions</span>
                    <span className="metric-card__icon"><OpsIcon name="location" /></span>
                  </div>
                  <div className="metric-card__value">{dashboardData.overview.activeMissions}</div>
                </div>
                <div className="metric-card metric-card--accent">
                  <div className="metric-card__top">
                    <span>Pending Maint</span>
                    <span className="metric-card__icon"><OpsIcon name="shield" /></span>
                  </div>
                  <div className="metric-card__value">{dashboardData.overview.pendingMaintenance}</div>
                </div>
                <div className="metric-card metric-card--success">
                  <div className="metric-card__top">
                    <span>Monthly Rev</span>
                    <span className="metric-card__icon"><OpsIcon name="list" /></span>
                  </div>
                  <div className="metric-card__value">{dashboardData.overview.revenueThisMonth}</div>
                </div>
              </div>

              <div className="row-group">
                {/* Weather */}
                <div className="panel panel--raised">
                  <div className="panel-header">
                     <div className="panel-header__title">
                       <h2>Regional Weather Feed</h2>
                     </div>
                  </div>
                  <div className="panel-body data-stack" style={{ padding: 0 }}>
                    {dashboardData.weather.map((w, idx) => (
                      <div className="data-row" key={idx}>
                        <div className="data-row__main">
                           <span className="data-row__title">{w.region}</span>
                           <span className="data-row__meta">{w.condition} • {w.temp} • {w.wind}</span>
                        </div>
                        <span className={`status-badge ${w.suitable ? 'status-badge--success' : 'status-badge--danger'}`}>
                          <span className="status-dot"></span>
                          {w.suitable ? 'Clear to Fly' : 'No Fly Zone'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Pilots */}
                <div className="panel panel--raised">
                  <div className="panel-header">
                     <div className="panel-header__title">
                       <h2>Pilot Status</h2>
                     </div>
                  </div>
                  <div className="panel-body data-stack" style={{ padding: 0 }}>
                    {dashboardData.pilots.map((p, idx) => (
                      <div className="data-row" key={idx}>
                        <div className="data-row__main">
                           <span className="data-row__title">{p.name}</span>
                           <span className="data-row__meta">Rating: {p.rating} / 5.0</span>
                        </div>
                        <span className="status-badge">
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="panel panel--raised section-gap">
          <div className="panel-header">
            <div className="panel-header__title">
              <div className="panel-title-row">
                <span className="panel-title-icon"><OpsIcon name="list" /></span>
                <h2>Flight Logs</h2>
              </div>
              <p>Recent flight records retrieved from Bhumeet.</p>
            </div>
          </div>
          <div className="panel-body" style={{ overflowX: 'auto' }}>
            {flightsLoading ? (
              <div className="empty-state">
                <strong>Loading...</strong>
              </div>
            ) : flights.length === 0 ? (
              <div className="empty-state">
                <strong>No flights found.</strong>
                <span>Ensure the Bhumeet integration is running and syncing correctly.</span>
              </div>
            ) : (
              <table className="data-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Date</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Flight ID</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Farmer</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Village</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Acres</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Aircraft</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Amount</th>
                    <th style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {flights.map((flight) => (
                    <tr key={flight.id}>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{new Date(flight.date).toLocaleDateString()}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}><code style={{ fontSize: '12px' }}>{flight.remoteFlightId}</code></td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
                        <strong>{flight.farmerName || '—'}</strong><br />
                        <span className="caption">{flight.farmerPhone || '—'}</span>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{flight.village || '—'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{flight.areaAcres ? `${flight.areaAcres} ac` : '—'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{flight.droneName || '—'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{flight.amount ? `₹${flight.amount}` : '—'}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>{flight.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default BhumeetLogbook;
