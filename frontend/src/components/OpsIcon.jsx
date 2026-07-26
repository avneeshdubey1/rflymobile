const paths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></>,
  chat: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></>,
  wallet: <><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 14h2"/></>,
  location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6"/></>,
  alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5M12 18h.01"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  drone: <><path d="M7 10h10M12 10v7M8 17h8M5 7h2v3H4a2 2 0 1 1 1-3ZM19 7h-2v3h3a2 2 0 1 0-1-3Z"/><circle cx="12" cy="19" r="1"/></>,
  vehicle: <><path d="M4 16V9l2-4h12l2 4v7"/><path d="M6 16h12"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M7 9h10"/></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></>,
  leaf: <><path d="M11 20A7 7 0 0 1 4 13C4 6 11 3 20 4c1 9-2 16-9 16Z"/><path d="M4 21c4-5 8-9 14-13"/></>,
  refresh: <><path d="M20 11a8 8 0 1 0 2 5M20 4v7h-7"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
 complete: (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9" />
  </>
),
requests: (
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V2h6v2" />
    <path d="M9 10h6" />
    <path d="M9 14h6" />
  </>
),
notification: (
  <>
    <path d="M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </>
),
settings: (
  <>
    <circle cx="12" cy="8" r="3" />
    <path d="M5 20a7 7 0 0114 0" />
    <circle cx="19" cy="18" r="2" />
    <path d="M19 15v1M19 20v1M16 18h1M21 18h1" />
  </>
),
invoices: (
  <>
    <path d="M6 2h9l3 3v17H6z" />
    <path d="M15 2v4h4" />
    <path d="M9 10h6" />
    <path d="M9 14h6" />
    <path d="M9 18h4" />
  </>
),
activeServices: (
  <>
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20z" />
    <path d="M12 6v6l4 2" />
    <circle cx="12" cy="12" r="2" />
  </>
),
search: (
  <>
    <circle cx="11" cy="11" r="7"/>
    <path d="M21 21l-4.35-4.35"/>
  </>
),

};

function OpsIcon({ name, size = 18, className = '' }) {
  return (
    <svg className={`ops-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.overview}
    </svg>
  );
}

export default OpsIcon;
