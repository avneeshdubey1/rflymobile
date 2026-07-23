import { useCallback, useEffect, useMemo, useState } from 'react';
import OpsIcon from './OpsIcon';
import LocationLink from './LocationLink';
import { apiFetch, readJson } from '../services/apiClient';

const readable = (value) => (value || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';

function LogbookTimelinePanel() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [entries, setEntries] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const loadLeads = useCallback(async () => {
    try {
      const response = await apiFetch('/api/leads/all');
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load the logbook');
      setLeads(data.leads || []);
    } catch (error) { setNotice(error.message); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadLeads(), 0);
    return () => window.clearTimeout(timer);
  }, [loadLeads]);

  const openTimeline = useCallback(async (lead) => {
    setSelectedLead(lead);
    setEntries([]);
    setLoadingTimeline(true);
    try {
      const response = await apiFetch(`/api/audit-log?entityType=Lead&entityId=${encodeURIComponent(lead.id)}`);
      const data = await readJson(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load this timeline');
      setEntries(data.entries || []);
    } catch (error) { setNotice(error.message); }
    finally { setLoadingTimeline(false); }
  }, []);

  const visibleLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) => [lead.farmerName, lead.farmerPhone, lead.farmerAddress, lead.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
  }, [leads, search]);

  return (
    <section>
      <div className="toolbar-row">
        <div className="toolbar-row__copy"><h2>CRM logbook</h2><p>Search a customer and open the complete recorded service history.</p></div>
        <button type="button" className="action-btn" onClick={() => void loadLeads()}><OpsIcon name="refresh" /> Refresh</button>
      </div>

      {notice && <div role="alert" className="notice notice--error"><span>{notice}</span><button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}
      <input className="search-control" aria-label="Search logbook" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search farmer, phone, address, or status" />

      <div className={`logbook-layout ${selectedLead ? '' : 'logbook-layout--closed'}`}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Farmer</th><th>Address</th><th>Acreage</th><th>Current status</th></tr></thead>
            <tbody>
              {visibleLeads.map((lead) => <tr key={lead.id} tabIndex="0" aria-selected={selectedLead?.id === lead.id} onDoubleClick={() => void openTimeline(lead)} onClick={() => void openTimeline(lead)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openTimeline(lead); } }}><td><strong>{lead.farmerName}</strong><br /><span className="caption">{lead.farmerPhone}</span></td><td><LocationLink latitude={lead.latitude} longitude={lead.longitude} address={lead.farmerAddress} centerName={lead.matchedCenter?.name} farmerName={lead.farmerName} fallback="Location not recorded" onClick={(event) => event.stopPropagation()} /></td><td>{lead.acreage}</td><td><span className="status-badge">{readable(lead.status)}</span></td></tr>)}
              {!visibleLeads.length && <tr><td colSpan="4"><div className="empty-state"><strong>No matching leads</strong><span>Try a different farmer, phone, address, or status.</span></div></td></tr>}
            </tbody>
          </table>
        </div>

        {selectedLead && <aside className="panel panel--raised timeline-panel">
          <div className="panel-header"><div className="panel-header__title"><p className="eyebrow">{selectedLead.farmerName}</p><h3>Lifecycle timeline</h3><p>Append-only operational history.</p></div><button type="button" className="action-btn" onClick={() => setSelectedLead(null)}>Close</button></div>
          <div className="panel-body">
            {loadingTimeline ? <div className="empty-state"><strong>Loading timeline…</strong><span>Retrieving recorded events.</span></div> : <div className="timeline">
              {entries.map((entry) => <article className="timeline-entry" key={entry.id}><strong>{readable(entry.action)}</strong><p>{formatDate(entry.createdAt)} · {entry.entityType}</p>{entry.reason && <p>Reason: {entry.reason}</p>}{entry.afterState?.status && <p>Status: {readable(entry.afterState.status)}</p>}</article>)}
              {!entries.length && <div className="empty-state"><strong>No recorded events</strong><span>This lead does not have a timeline entry yet.</span></div>}
            </div>}
          </div>
        </aside>}
      </div>
    </section>
  );
}

export default LogbookTimelinePanel;
