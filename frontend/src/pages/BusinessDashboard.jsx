import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OperationsShell from "../components/OperationsShell";
import OpsIcon from '../components/OpsIcon';
import { useAuth } from "../context/useAuth";

export default function BusinessDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('over');
  
  const navItems = [
    { id: 'over', label: 'Overview', icon: 'overview' },
    { id: 'users', label: 'Requests', icon: 'requests' },
    { id: 'not', label: 'Notification', icon: 'notification' },
    { id: 'sp', label: 'Settings/Profile', icon: 'settings' },
  ];
  
  // Safe fallback if user fields are missing
  const business = user || {};

  const handleLogout = async () => {
    await logout();
    navigate('/business/login', { replace: true });
  };

  const pageInfo = {
    over: {
      title: "Overview",
      description: "View your business overview, active services, recent requests and invoices.",
    },
    users: {
      title: "Requests",
      description: "View service requests explicitly linked to this business account.",
    },
    not: {
      title: "Notifications",
      description: "Stay updated with the latest notifications and service updates.",
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
              <strong className="metric-card__value">0</strong>
            </article>

            <article className="metric-card">
              <div className="metric-card__top">
                <span>Complete Services</span>
                <span className="metric-card__icon">
                  <OpsIcon name="complete" />
                </span>
              </div>
              <strong className="metric-card__value">0</strong>
            </article>

            <article className="metric-card">
              <div className="metric-card__top">
                <span>Total Requests</span>
                <span className="metric-card__icon">
                  <OpsIcon name="request" />
                </span>
              </div>
              <strong className="metric-card__value">0</strong>
            </article>

            <article className="metric-card">
              <div className="metric-card__top">
                <span>Total Invoices</span>
                <span className="metric-card__icon">
                  <OpsIcon name="invoices" />
                </span>
              </div>
              <strong className="metric-card__value">0</strong>
            </article>
          </section>

          <div className="overview-bottom">
            <section className="recent-card">
              <div className="recent-header">
                <h3>Recent Requests</h3>
                <button className="view-all-btn">
                  View all <span>›</span>
                </button>
              </div>
              <div className="recent-empty">
                <div className="recent-icon">
                  <OpsIcon name="search" size={68} />
                </div>
                <h5>No requests yet</h5>
                <p>You haven't made any service requests yet.</p>
              </div>
            </section>

            <section className="recent-card">
              <div className="recent-header">
                <h3>Recent Invoices</h3>
                <button className="view-all-btn">
                  View all <span>›</span>
                </button>
              </div>
              <div className="recent-empty">
                <div className="recent-icon">
                  <OpsIcon name="invoice" size={68} />
                </div>
                <h5>No invoices yet</h5>
                <p>You don't have any invoices yet.</p>
              </div>
            </section>
          </div>
        </>
      )}
      
      {activeTab === "users" && (
        <section className="request-page">
          <div className="request-header">
            <h2>Requests</h2>
          </div>
          <div className="request-empty">
            <div className="request-empty__icon">
              <OpsIcon name="clipboard" size={70} />
            </div>
            <h3>No requests found</h3>
            <p>
              Linked requests will appear here after the Sales team records them.
            </p>
          </div>
        </section>
      )}
      
      {activeTab === "not" && (
        <section className="panel-card">
          <div className="panel-header">
            <h2>Notifications</h2>
          </div>
          <div className="empty-state">
            <span className="empty-state__icon">
              <OpsIcon name="notification" size={64} />
            </span>
            <h3>No Notifications Yet</h3>
            <p>
              You don't have any notifications at the moment.
              Updates about your requests, services and invoices
              will appear here.
            </p>
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
