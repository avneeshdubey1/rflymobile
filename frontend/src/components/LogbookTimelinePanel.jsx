import { useCallback, useEffect, useMemo, useState } from 'react';
import OpsIcon from './OpsIcon';
import { API_URL as API } from '../config';
import LocationLink from './LocationLink';
import { SkeletonTableRows, SkeletonText } from './Skeleton';

const readable = (value) => (value || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const formatDate = (value) => value ? new Date(value).toLocaleString() : 'Not recorded';
const PAGE_SIZE = 10;

const statusDisplayLabel = (status) => {
  const map = {
    MANUAL_CALL_REQUIRED: 'Processing',
  };
  return map[status] || readable(status);
};

function LogbookTimelinePanel() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [entries, setEntries] = useState([]);
  const [notice, setNotice] = useState(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const loadLeads = useCallback(async () => {
    setLoadingLeads(true);
    try {
      const response = await fetch(`${API}/api/leads/all`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load the logbook');
      setLeads(data.leads || []);
    } catch (error) { setNotice(error.message); }
    finally { setLoadingLeads(false); }
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
      const response = await fetch(`${API}/api/audit-log?entityType=Lead&entityId=${encodeURIComponent(lead.id)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load this timeline');
      const currentlyVisibleActions = new Set(['CREATED', 'GEOFENCE_VALIDATED', 'GEOFENCE_CHECKED']);
      setEntries((data.entries || []).filter((entry) => currentlyVisibleActions.has(entry.action)));
    } catch (error) { setNotice(error.message); }
    finally { setLoadingTimeline(false); }
  }, []);

  const visibleLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter((lead) => [lead.farmerName, lead.farmerPhone, lead.farmerAddress, lead.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(term)));
  }, [leads, search]);

  const totalPages = Math.max(1, Math.ceil(visibleLeads.length / PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [search, leads]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return visibleLeads.slice(start, start + PAGE_SIZE);
  }, [visibleLeads, currentPage]);

const getSeasonCrop = (lead) => {
  if (lead.cropType) return lead.cropType;

  const customer = lead.customer || {};
  const seasonalCrops = [
    customer.kharifCrop === 'Others' ? customer.kharifOtherCrop : customer.kharifCrop,
    customer.rabiCrop === 'Others' ? customer.rabiOtherCrop : customer.rabiCrop,
    customer.summerCrop === 'Others' ? customer.summerOtherCrop : customer.summerCrop,
  ].filter(Boolean);

  return [...new Set(seasonalCrops)].join(', ') || '-';
};

  return (
    <section>
      <div className="toolbar-row">
        <div className="toolbar-row__copy">
          <p>Search a customer and open the complete recorded service history.</p></div>
        {notice && <div role="alert" className="notice notice--error"><span>{notice}</span><button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}
        <input className="search-control" aria-label="Search logbook" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search farmer, phone, address, or status" />
      </div>
      <div className={`logbook-layout ${selectedLead ? '' : 'logbook-layout--closed'}`}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Farmer</th><th>Address</th><th>Acreage</th>
              <th>Crop Type</th>
              <th>Expected Date</th>
              <th>Expected Time</th>
            </tr></thead>
            <tbody>
              {loadingLeads ? (
                <SkeletonTableRows rows={5} columns={6} />
              ) : (
                <>
                  {paginatedLeads.map((lead) => <tr key={lead.id} tabIndex="0" aria-selected={selectedLead?.id === lead.id} onDoubleClick={() => void openTimeline(lead)} onClick={() => void openTimeline(lead)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); void openTimeline(lead); } }}>
                    <td><strong>{lead.farmerName}</strong><br />
                      <span className="caption">{lead.farmerPhone}</span></td>
                    <td><LocationLink latitude={lead.latitude} longitude={lead.longitude} address={lead.farmerAddress} centerName={lead.matchedCenter?.name} farmerName={lead.farmerName} fallback="Location not recorded" onClick={(event) => event.stopPropagation()} /></td>
                    <td>{lead.acreage}</td>
                    {/* <td>{lead.cropType || "-"}</td> */}
                    <td>{getSeasonCrop(lead)}</td>
                    <td>
                      {lead.expectedDate
                        ? new Date(lead.expectedDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td>{lead.expectedTime || "-"}</td>
                  </tr>)}
                  {!visibleLeads.length && <tr><td colSpan="6"><div className="empty-state"><strong>No matching leads</strong><span>Try a different farmer, phone, address, or status.</span></div></td></tr>}
                </>
              )}
            </tbody>
          </table>

          {!loadingLeads && visibleLeads.length > 0 && (
            <div className="pagination-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.75rem 0.25rem' }}>
              <span className="caption">
                {` Showing ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, visibleLeads.length)} of ${visibleLeads.length}`}
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="pagination-btn pagination-btn--icon"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                >
                  &lt;
                </button>
                <span className="pagination-page">{`Page ${currentPage} of ${totalPages}`}</span>
                <button
                  type="button"
                  className="pagination-btn pagination-btn--icon"
                  aria-label="Next page"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                >
                  &gt;
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedLead && <aside className="panel panel--raised timeline-panel">
          <div className="panel-header"><div className="panel-header__title"><p className="eyebrow">{selectedLead.farmerName}</p><h3>Lifecycle timeline</h3><p>Append-only operational history.</p></div><button type="button" className="action-btn" onClick={() => setSelectedLead(null)}>Close</button></div>
          <div className="panel-body">
            {loadingTimeline ? (
              <SkeletonText lines={4} />
            ) : (
              <div className="timeline">
                {entries.map((entry) => <article className="timeline-entry" key={entry.id}><strong>{readable(entry.action)}</strong><p>{formatDate(entry.createdAt)} · {entry.entityType}</p>{entry.reason && <p>Reason: {entry.reason}</p>}
                  {entry.afterState?.status && <p>Status: {statusDisplayLabel(entry.afterState.status)}</p>}
                </article>)}
                {!entries.length && <div className="empty-state"><strong>No recorded events</strong><span>This lead does not have a timeline entry yet.</span></div>}
              </div>
            )}
          </div>
        </aside>}
      </div>
    </section>
  );
}

export default LogbookTimelinePanel;
