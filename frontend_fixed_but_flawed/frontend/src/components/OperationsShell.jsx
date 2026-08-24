import OpsIcon from './OpsIcon';

function initials(name) {
  return String(name || 'User').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function OperationsShell({ roleLabel, navItems, activeTab, onTabChange, user, onLogout, children }) {
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

        {/* <div className="ops-sidebar__footer">
          <div className="account-chip">
            <span className="account-chip__avatar">{initials(user?.name)}</span>
            <span className="account-chip__text"><strong>{user?.name || roleLabel}</strong><small>{roleLabel}</small></span>
          </div>
          <button className="sidebar-signout" type="button" onClick={onLogout}>
            <OpsIcon name="logout" />
            <span>Sign out</span>
          </button>
        </div> */}

      </aside>

      <main className="ops-main">
        <div className="ops-main__inner">{children}</div>
      </main>
    </div>
  );
}

export default OperationsShell;