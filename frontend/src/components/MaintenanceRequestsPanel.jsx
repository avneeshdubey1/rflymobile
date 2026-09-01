import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_URL as API } from '../config';
import { csrfHeaders } from '../utils/csrf';
import OpsIcon from './OpsIcon';

const labels = {
  BATTERY_NOT_CHARGED: 'Battery not charged',
  PROPELLER_DAMAGED: 'Propeller damaged',
  VEHICLE_BREAKDOWN: 'Vehicle breakdown',
  TYRE_ISSUE: 'Tyre damage',
  ENGINE_ISSUE: 'Engine issue',
  ELECTRICAL_ISSUE: 'Electrical issue',
  OTHER: 'Other',
};

function assetLabel(request) {
  if (request.assetType === 'DRONE') {
    return request.drone?.name || request.drone?.model || request.drone?.serialNumber || 'Drone';
  }
  return request.lmv?.label || request.lmv?.registrationNo || 'LMV';
}

export default function MaintenanceRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [activity, setActivity] = useState([]);
  const [filter, setFilter] = useState('OPEN');
  const [busyId, setBusyId] = useState(null);
  const [notes, setNotes] = useState({});
  const [returnToService, setReturnToService] = useState({});
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const [requestResponse, activityResponse] = await Promise.all([
      fetch(`${API}/api/maintenance-requests`, { credentials: 'include' }),
      fetch(`${API}/api/maintenance-requests/activity`, { credentials: 'include' }),
    ]);
    const [requestData, activityData] = await Promise.all([
      requestResponse.json().catch(() => ({})),
      activityResponse.json().catch(() => ({})),
    ]);
    if (!requestResponse.ok || !requestData.success) throw new Error(requestData.error || 'Maintenance requests could not be loaded');
    if (!activityResponse.ok || !activityData.success) throw new Error(activityData.error || 'Asset activity could not be loaded');
    setRequests(requestData.requests || []);
    setActivity(activityData.activity || []);
  }, []);

  useEffect(() => {
    void load().catch((error) => setNotice({ kind: 'error', message: error.message }));
  }, [load]);

  const visible = useMemo(() => requests.filter((request) => (
    filter === 'OPEN'
      ? ['PENDING', 'ACCEPTED'].includes(request.status)
      : ['REJECTED', 'RESOLVED'].includes(request.status)
  )), [filter, requests]);

  const update = async (request, action) => {
    const note = String(notes[request.id] || '').trim();
    if (note.length < 3) {
      setNotice({ kind: 'error', message: 'Enter an accountable processing note of at least 3 characters.' });
      return;
    }
    setBusyId(request.id);
    setNotice(null);
    try {
      const response = await fetch(`${API}/api/maintenance-requests/${request.id}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
        body: JSON.stringify({ note, returnToService: action === 'resolve' && returnToService[request.id] === true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Maintenance request could not be updated');
      setNotes((current) => ({ ...current, [request.id]: '' }));
      setNotice({ kind: 'success', message: `${assetLabel(request)} maintenance request updated.` });
      await load();
    } catch (error) {
      setNotice({ kind: 'error', message: error.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="panel panel--raised maintenance-board">
      <div className="panel-header">
        <div className="panel-header__title">
          <div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="alert" /></span><h2>Maintenance requests</h2></div>
          <p>Pilot and Operations maintenance, status changes, returns to service, and retirement remain attributable.</p>
        </div>
        <div className="segmented-control" aria-label="Maintenance request filter">
          <button type="button" className={filter === 'OPEN' ? 'is-active' : ''} onClick={() => setFilter('OPEN')}>Open</button>
          <button type="button" className={filter === 'REQUEST_HISTORY' ? 'is-active' : ''} onClick={() => setFilter('REQUEST_HISTORY')}>Request history</button>
          <button type="button" className={filter === 'ASSET_ACTIVITY' ? 'is-active' : ''} onClick={() => setFilter('ASSET_ACTIVITY')}>Asset activity</button>
        </div>
      </div>
      <div className="panel-body">
        {notice && <div role="alert" className={`notice notice--${notice.kind}`}>{notice.message}</div>}
        {filter === 'ASSET_ACTIVITY' ? (
          !activity.length ? <div className="empty-state"><strong>No lifecycle activity</strong><span>Maintenance, out-of-service, return, and retirement decisions will appear here.</span></div> : (
            <div className="maintenance-list">
              {activity.map((entry) => {
                const label = entry.assetType === 'DRONE'
                  ? entry.asset?.name || entry.asset?.model || entry.asset?.serialNumber || 'Drone'
                  : entry.asset?.label || entry.asset?.registrationNo || 'LMV';
                return <article className="maintenance-card maintenance-card--activity" key={entry.id}>
                  <div className="maintenance-card__summary">
                    <div><span className="maintenance-card__asset">{entry.assetType} · {label}</span><span className={`status-badge status-badge--${entry.eventType === 'RETIRED' ? 'danger' : 'info'}`}>{entry.eventType.toLowerCase().replaceAll('_', ' ')}</span></div>
                    {entry.beforeStatus || entry.afterStatus ? <p><strong>{String(entry.beforeStatus || 'unknown').toLowerCase().replaceAll('_', ' ')}</strong> → <strong>{String(entry.afterStatus || 'unknown').toLowerCase().replaceAll('_', ' ')}</strong></p> : null}
                    <p>{entry.reason || 'Lifecycle decision recorded without a legacy reason.'}</p>
                    <p className="caption">Recorded by {entry.actor?.name || 'System'} · {new Date(entry.createdAt).toLocaleString()}</p>
                  </div>
                </article>;
              })}
            </div>
          )
        ) : !visible.length ? <div className="empty-state"><strong>No {filter === 'OPEN' ? 'open' : 'completed'} maintenance requests</strong><span>New Pilot or Operations reports and completed decisions appear here.</span></div> : (
          <div className="maintenance-list">
            {visible.map((request) => (
              <article className="maintenance-card" key={request.id}>
                <div className="maintenance-card__summary">
                  <div><span className="maintenance-card__asset">{request.assetType} · {assetLabel(request)}</span><span className={`status-badge status-badge--${request.status === 'PENDING' ? 'warning' : request.status === 'ACCEPTED' ? 'info' : request.status === 'RESOLVED' ? 'success' : 'danger'}`}>{request.status.toLowerCase()}</span></div>
                  <p><strong>{labels[request.reasonCode] || request.reasonCode}</strong> — {request.reason}</p>
                  <p className="caption">Requested by {request.requestedBy?.name || 'Pilot'} · {new Date(request.createdAt).toLocaleString()}</p>
                  {request.processedBy && <p className="caption">Processed by {request.processedBy.name}{request.processingNote ? `: ${request.processingNote}` : ''}</p>}
                  {request.resolvedBy && <p className="caption">Resolved by {request.resolvedBy.name}{request.resolutionNote ? `: ${request.resolutionNote}` : ''}</p>}
                </div>
                {['PENDING', 'ACCEPTED'].includes(request.status) && (
                  <div className="maintenance-card__actions">
                    <label className="input-group"><span>Processing note</span><textarea value={notes[request.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} minLength="3" maxLength="500" placeholder="Inspection, decision, or repair note" /></label>
                    {request.status === 'PENDING' && <div className="button-row"><button type="button" className="submit-btn" disabled={busyId === request.id} onClick={() => void update(request, 'accept')}>Accept</button><button type="button" className="danger-btn" disabled={busyId === request.id} onClick={() => void update(request, 'reject')}>Reject</button></div>}
                    <label className="checkbox-row"><input type="checkbox" checked={returnToService[request.id] === true} onChange={(event) => setReturnToService((current) => ({ ...current, [request.id]: event.target.checked }))} /> Return asset to service after resolution</label>
                    <button type="button" className="action-btn" disabled={busyId === request.id} onClick={() => void update(request, 'resolve')}>Resolve request</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
