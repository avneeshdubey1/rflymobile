import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import OperationsShell from "../components/OperationsShell";
import OpsIcon from '../components/OpsIcon';
import { useAuth } from "../context/useAuth";
import { apiFetch, readJson } from "../services/apiClient";

const statusLabel = (status) => String(status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const statusTone = (status) => {
  if (['COMPLETED', 'PROCESSED'].includes(status)) return 'success';
  if (['CANCELLED', 'REJECTED'].includes(status)) return 'danger';
  if (['IN_PROGRESS', 'SCHEDULED', 'PILOT_ACCEPTED'].includes(status)) return 'info';
  return 'warning';
};

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('over');
  const [portal, setPortal] = useState({ organizations: [], totals: { active: 0, completed: 0, total: 0 } });
  const [notice, setNotice] = useState('');

  const loadPortal = useCallback(async (signal) => {
    try {
      const response = await apiFetch('/api/portal/business/summary', { signal });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Could not load linked business requests.');
      setPortal(data.portal || { organizations: [], totals: { active: 0, completed: 0, total: 0 } });
      setNotice('');
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setNotice(error.message || 'Could not load linked business requests.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void loadPortal(controller.signal), 0);
    return () => { window.clearTimeout(initialLoad); controller.abort(); };
  }, [loadPortal]);
  
  const navItems = [
    { id: 'over', label: 'Overview', icon: 'overview' },
    { id: 'users', label: 'Requests', icon: 'requests' },
    { id: 'sp', label: 'Settings/Profile', icon: 'settings' },
  ];
  
  // Safe fallback if user fields are missing
  const business = user || {};
  const linkedLeads = portal.organizations.flatMap((organization) => organization.leads.map((lead) => ({ ...lead, organizationName: organization.name })));

  const handleLogout = async () => {
    await logout();
    navigate('/business/login', { replace: true });
  };

  const pageInfo = {
    over: {
      title: "Overview",
      description: "View active and completed service requests explicitly linked to your organization.",
    },
    users: {
      title: "Requests",
      description: "View service requests explicitly linked to this business account.",
    },
    sp: {
      title: "Settings / Profile",
      description: "Manage your business profile and account information.",
    },
  };

  return (
    <OperationsShell
      roleLabel="Business"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      user={{ name: business.name || business.contactPerson || 'Business User' }}
      onLogout={handleLogout}
      onRefresh={loadPortal}
    >
      <header className="page-header">
        <div className="page-header__copy">
          <p className="eyebrow">Business Portal</p>
          <h2>{pageInfo[activeTab].title}</h2>
          <p className="page-description">
            {pageInfo[activeTab].description}
          </p>
        </div>
      </header>

      {notice && <div role="alert" className="notice notice--error"><span>{notice}</span></div>}

      {activeTab === "over" && (
        <>
          <section className="metric-grid">
            <article className="metric-card" >
              <div className="metric-card__top">
                <span>Active Services</span>
                <span className="metric-card__icon">
                  <OpsIcon name="activeServices" />
                </span>
              </div>
              <strong className="metric-card__value">{portal.totals.active}</strong>
            </article>

            <article className="metric-card">
              <div className="metric-card__top">
                <span>Complete Services</span>
                <span className="metric-card__icon">
                  <OpsIcon name="complete" />
                </span>
              </div>
              <strong className="metric-card__value">{portal.totals.completed}</strong>
            </article>

            <article className="metric-card">
              <div className="metric-card__top">
                <span>Total Requests</span>
                <span className="metric-card__icon">
                  <OpsIcon name="request" />
                </span>
              </div>
              <strong className="metric-card__value">{portal.totals.total}</strong>
            </article>

          </section>

          <div className="overview-bottom">
            <section className="recent-card">
              <div className="recent-header"><h3>Recent Requests</h3></div>
              {linkedLeads.length ? (
                <div className="data-stack">
                  {linkedLeads.slice(0, 5).map((lead) => (
                    <div className="data-row" key={lead.id}>
                      <div className="data-row__main">
                        <span className="data-row__title">{lead.acreage} Acres - {lead.cropType || 'Crop'}</span>
                        <span className="data-row__meta">{lead.organizationName} · {new Date(lead.createdAt).toLocaleDateString()}</span>
                      </div>
                      <span className={`status-badge status-badge--${statusTone(lead.status)}`}>{statusLabel(lead.status)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="recent-empty">
                  <div className="recent-icon">
                    <OpsIcon name="search" size={68} />
                  </div>
                  <h5>No requests yet</h5>
                  <p>You have no explicitly linked service requests yet.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
      
      {activeTab === "users" && (
        <section className="request-page">
          <div className="request-header">
            <h2>Requests</h2>
          </div>
          {!portal.organizations.length && (
            <div className="request-empty">
              <div className="request-empty__icon">
                <OpsIcon name="clipboard" size={70} />
              </div>
              <h3>No linked organization</h3>
              <p>
                Linked requests will appear here after an Admin/Sales-approved organization membership is created.
              </p>
            </div>
          )}
          <div className="data-stack">
            {portal.organizations.map((organization) => (
              <article className="panel panel--raised" key={organization.id}>
                <div className="panel-header">
                  <div className="panel-header__title">
                    <p className="eyebrow">Linked organization</p>
                    <h3>{organization.name}</h3>
                    <p>{organization.totals.total} linked request{organization.totals.total === 1 ? '' : 's'}</p>
                  </div>
                </div>
                {organization.leads.length ? (
                  <div className="data-stack">
                    {organization.leads.map((lead) => (
                      <div className="data-row" key={lead.id}>
                        <div className="data-row__main">
                          <span className="data-row__title">{lead.acreage} Acres - {lead.cropType || 'Crop'}</span>
                          <span className="data-row__meta">{new Date(lead.createdAt).toLocaleDateString()} · {lead.matchedCenter?.name || 'Centre pending'}</span>
                          <span className={`status-badge status-badge--${statusTone(lead.status)}`}>{statusLabel(lead.status)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="panel-body"><div className="empty-state"><strong>No requests linked</strong><span>Only explicitly linked work is visible here.</span></div></div>
                )}
              </article>
            ))}
          </div>
        </section>
      )}
      
      
      {activeTab === "sp" && (
        <section className="settings-page">
          <div className="settings-header">
            <h2>Settings / Profile</h2>
          </div>
          <div className="settings-card">
            <div className="settings-grid">
              <div className="settings-field">
                <label>Business Name</label>
                <input type="text" value={business.businessName || ""} readOnly />
              </div>
              <div className="settings-field">
                <label>Contact Person / Name</label>
                <input type="text" value={business.name || business.contactPerson || ""} readOnly />
              </div>
              <div className="settings-field">
                <label>GST Number</label>
                <input type="text" value={business.gstNo || ""} readOnly />
              </div>
              <div className="settings-field">
                <label>Email</label>
                <input type="email" value={business.email || ""} readOnly />
              </div>
              <div className="settings-field">
                <label>Mobile Number</label>
                <input type="text" value={business.phone || business.mobile || ""} readOnly />
              </div>
              <div className="settings-field settings-field-full">
                <label>Business Address</label>
                <textarea rows="2" value={business.address || ""} readOnly>
                </textarea>
              </div>
            </div>
            <hr className="settings-divider" />
            <div className="account-info">
              <h3>Account Information</h3>
              <div className="info-row">
                <span>Account ID</span>
                <strong>{business.id}</strong>
              </div>
              <div className="info-row">
                <span>Role</span>
                <strong>{business.role}</strong>
              </div>
              <div className="info-row">
                <span>Login Method</span>
                <strong>Email and Password</strong>
              </div>
            </div>
          </div>
        </section>
      )}
    </OperationsShell>
  );
}
