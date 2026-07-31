import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import OpsIcon from './OpsIcon';

function initials(name) {
  return String(name || 'User').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function OperationsShell({ roleLabel, navItems, activeTab, onTabChange, user, onLogout, onRefresh, children }) {
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    if (!onLogout || signingOut) return;
    setAccountOpen(false);
    setSigningOut(true);
    try {
      await onLogout();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <div className="ops-brand">
          <span className="ops-brand__mark"><OpsIcon name="leaf" size={21} /></span>
          <span><strong>Daas</strong><small>Control workspace</small></span>
        </div>

        <div className="ops-role-block">
          <span className="ops-role-block__label">Workspace</span>
          <span className="ops-role-block__name">{roleLabel}</span>
        </div>

        <nav className="ops-nav" aria-label={`${roleLabel} navigation`}>
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={activeTab === item.id ? 'page' : undefined}
              onClick={() => onTabChange(item.id)}
            >
              <OpsIcon name={item.icon} />
              <span>{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>
      </aside>

      <main className="ops-main">
        <div className="ops-main__inner">
          <div className="ops-account-menu profile-menu">
            <button
              type="button"
              className="profile-trigger"
              aria-label="Open account profile menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((open) => !open)}
            >
              {initials(user?.name).charAt(0)}
            </button>
            {accountOpen && (
              <div className="profile-dropdown">
                <div className="profile-dropdown__header">
                  <div className="profile-avatar">{initials(user?.name)}</div>
                  <div><h4>{user?.name || roleLabel}</h4><p>{roleLabel}</p></div>
                </div>
                <hr />
                <button type="button" className="dropdown-item" onClick={() => { setAccountOpen(false); navigate('/settings'); }}>
                  <OpsIcon name="users" /> My Profile
                </button>
                {onRefresh && (
                  <button type="button" className="dropdown-item" onClick={() => { setAccountOpen(false); void onRefresh(); }}>
                    <OpsIcon name="refresh" /> Refresh data
                  </button>
                )}
                <button type="button" className="dropdown-item logout" onClick={() => void handleSignOut()} disabled={signingOut || !onLogout}>
                  <OpsIcon name="logout" /> {signingOut ? t('signing_out', 'Signing out…') : t('sign_out', 'Sign out')}
                </button>
              </div>
            )}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export default OperationsShell;
