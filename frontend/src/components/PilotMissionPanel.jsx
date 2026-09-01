import { useCallback, useEffect, useMemo, useState } from 'react';
import OpsIcon from './OpsIcon';
import { flushQueuedActions, queueAction, queuedActions } from '../services/offlineActionQueue';
import { API_URL as API } from '../config';
import { useAuth } from '../context/useAuth';
import LocationLink from './LocationLink';

const GPS_INTERVAL_MS = Number(import.meta.env.VITE_GPS_PING_INTERVAL_MS) || 60_000;
const activeStatuses = new Set(['PILOT_ACCEPTED', 'IN_PROGRESS']);
const statusLabel = (status) => (status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const statusTone = (status) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FLAGGED') return 'danger';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'PILOT_ACCEPTED') return 'warning';
  return '';
};
const responseMessage = (data, fallback) => (
  typeof data?.error === 'string' ? data.error : data?.error?.message || fallback
);

function PilotMissionPanel() {
  const { user } = useAuth();
  const userId = user?.id;
  const [missions, setMissions] = useState([]);
  const [queuedCount, setQueuedCount] = useState(0);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [notice, setNotice] = useState(null);
  const [actualAcreage, setActualAcreage] = useState({});
  const [decommissionReason, setDecommissionReason] = useState({});
  const [gpsStatus, setGpsStatus] = useState('GPS will start after you accept a mission.');
  const [transitioningMissionIds, setTransitioningMissionIds] = useState(() => new Set());
  const [copilotDialog, setCopilotDialog] = useState(null);

  const refreshQueueCount = useCallback(async () => setQueuedCount(userId ? (await queuedActions(userId)).length : 0), [userId]);
  const fetchMissions = useCallback(async () => {
    const response = await fetch(`${API}/api/assignments/pilot`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(responseMessage(data, 'Could not load missions'));
    setMissions(data.missions || []);
  }, []);

  const openCopilotSelection = useCallback(async (mission) => {
    setCopilotDialog({ mission, candidates: [], selectedId: '', loading: true, submitting: false, error: '' });
    try {
      const response = await fetch(`${API}/api/assignments/${mission.id}/eligible-copilots`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(responseMessage(data, 'Eligible Copilots could not be loaded'));
      setCopilotDialog((current) => current?.mission.id === mission.id
        ? { ...current, candidates: data.candidates || [], loading: false }
        : current);
    } catch (error) {
      setCopilotDialog((current) => current?.mission.id === mission.id
        ? { ...current, loading: false, error: error.message }
        : current);
    }
  }, []);

  const confirmCopilotSelection = useCallback(async (event) => {
    event.preventDefault();
    if (!copilotDialog?.selectedId || copilotDialog.submitting) return;
    const { mission, selectedId } = copilotDialog;
    setCopilotDialog((current) => ({ ...current, submitting: true, error: '' }));
    try {
      const response = await fetch(`${API}/api/assignments/${mission.id}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId: selectedId, expectedRevision: mission.revision }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(responseMessage(data, 'Copilot selection failed'));
      setCopilotDialog(null);
      setNotice({ kind: 'success', message: `${data.mission?.copilot?.name || 'Copilot'} joined the crew.` });
      await fetchMissions();
    } catch (error) {
      setCopilotDialog((current) => current?.mission.id === mission.id
        ? { ...current, submitting: false, error: error.message }
        : current);
      await fetchMissions().catch(() => undefined);
    }
  }, [copilotDialog, fetchMissions]);

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || !userId) return;
    const result = await flushQueuedActions(userId);
    await refreshQueueCount();
    if (result.sent) {
      setNotice({ kind: 'success', message: `${result.sent} offline action${result.sent === 1 ? '' : 's'} synced.` });
      await fetchMissions();
    }
    if (result.discarded) setNotice({ kind: 'error', message: `${result.discarded} queued action${result.discarded === 1 ? '' : 's'} could no longer be applied and was removed.` });
  }, [fetchMissions, refreshQueueCount, userId]);

  useEffect(() => {
    const load = window.setTimeout(() => {
      void fetchMissions().catch((error) => setNotice({ kind: 'error', message: error.message }));
      void refreshQueueCount();
      void syncQueue();
    }, 0);
    const handleOnline = () => { setOnline(true); void syncQueue(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.clearTimeout(load); window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [fetchMissions, refreshQueueCount, syncQueue]);

  const sendOrQueue = useCallback(async (action, optimisticStatus) => {
    if (!navigator.onLine) {
      if (optimisticStatus) setMissions((items) => items.map((mission) => mission.id === action.assignmentId ? { ...mission, lead: { ...mission.lead, status: optimisticStatus } } : mission));
      try { await queueAction(userId, action); }
      catch (error) { setNotice({ kind: 'error', message: error.message }); return; }
      await refreshQueueCount();
      setNotice({ kind: 'success', message: 'Offline: action saved on this device and will sync when you reconnect.' });
      return;
    }
    const pausesGps = action.kind === 'mission-state';
    if (pausesGps) setTransitioningMissionIds((ids) => new Set(ids).add(action.assignmentId));
    try {
      const response = await fetch(action.url, { method: action.method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action.body || {}) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(responseMessage(data, 'Action failed'));
      if (action.kind !== 'location') await fetchMissions();
    } catch (error) {
      if (error instanceof TypeError) {
        if (optimisticStatus) setMissions((items) => items.map((mission) => mission.id === action.assignmentId ? { ...mission, lead: { ...mission.lead, status: optimisticStatus } } : mission));
        try { await queueAction(userId, action); }
        catch (queueError) { setNotice({ kind: 'error', message: queueError.message }); return; }
        await refreshQueueCount();
        setNotice({ kind: 'success', message: 'Connection was lost: action saved locally and will sync when you reconnect.' });
      } else {
        await fetchMissions().catch(() => undefined);
        setNotice({ kind: 'error', message: error.message });
      }
    } finally {
      if (pausesGps) setTransitioningMissionIds((ids) => { const next = new Set(ids); next.delete(action.assignmentId); return next; });
    }
  }, [fetchMissions, refreshQueueCount, userId]);

  const activeMissions = useMemo(() => missions.filter((mission) => activeStatuses.has(mission.lead?.status) && !transitioningMissionIds.has(mission.id)), [missions, transitioningMissionIds]);
  const completedCount = useMemo(() => missions.filter((mission) => mission.lead?.status === 'COMPLETED').length, [missions]);
  const sendLocation = useCallback(async (assignmentId, position) => {
    const { latitude, longitude } = position.coords;
    await sendOrQueue({
      assignmentId,
      url: `${API}/api/assignments/${assignmentId}/location`,
      body: { latitude, longitude, capturedAt: new Date(position.timestamp).toISOString(), accuracy: position.coords.accuracy ?? null },
      kind: 'location',
    });
    setGpsStatus(`Last location captured at ${new Date(position.timestamp).toLocaleTimeString()}.`);
  }, [sendOrQueue]);

  useEffect(() => {
    if (!activeMissions.length) return undefined;
    if (!navigator.geolocation) {
      const timer = window.setTimeout(() => setGpsStatus('This browser does not support GPS location.'), 0);
      return () => window.clearTimeout(timer);
    }
    let stopped = false;
    const capture = () => navigator.geolocation.getCurrentPosition(
      (position) => { if (!stopped) activeMissions.forEach((mission) => void sendLocation(mission.id, position)); },
      (error) => { if (!stopped) setGpsStatus(`GPS unavailable: ${error.message}`); },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
    capture();
    const interval = window.setInterval(capture, GPS_INTERVAL_MS);
    return () => { stopped = true; window.clearInterval(interval); };
  }, [activeMissions, sendLocation]);

  return (
    <section>
      <header className="page-header">
        <div className="page-header__copy"><p className="eyebrow">Pilot workspace</p><h1>My spraying tasks</h1><p>Mission actions and location updates remain available through intermittent connectivity.</p></div>
        <div className={`connectivity ${online ? '' : 'connectivity--offline'}`}><span className="connectivity__dot" /><span><strong>{online ? 'Online' : 'Offline'}</strong><br />{queuedCount} action{queuedCount === 1 ? '' : 's'} waiting to sync</span></div>
      </header>

      {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div>}

      <section className="metric-grid" aria-label="Mission summary">
        <article className="metric-card"><div className="metric-card__top"><span>Assigned tasks</span><span className="metric-card__icon"><OpsIcon name="clipboard" /></span></div><strong className="metric-card__value">{missions.length}</strong></article>
        <article className="metric-card metric-card--info"><div className="metric-card__top"><span>Active now</span><span className="metric-card__icon"><OpsIcon name="location" /></span></div><strong className="metric-card__value">{activeMissions.length}</strong></article>
        <article className="metric-card"><div className="metric-card__top"><span>Completed</span><span className="metric-card__icon"><OpsIcon name="drone" /></span></div><strong className="metric-card__value">{completedCount}</strong></article>
        <article className="metric-card metric-card--accent"><div className="metric-card__top"><span>Offline queue</span><span className="metric-card__icon"><OpsIcon name="refresh" /></span></div><strong className="metric-card__value">{queuedCount}</strong></article>
      </section>

      {activeMissions.length > 0 && <div className="notice notice--info"><span><strong>Live GPS:</strong> {gpsStatus}</span></div>}
      {!missions.length && <div className="empty-state empty-state--center"><span className="panel-title-icon"><OpsIcon name="drone" /></span><strong>You have no assigned missions</strong><span>New work will appear here after Fleet schedules it.</span></div>}

      <div className="mission-grid">
        {missions.map((mission) => {
          const status = mission.lead?.status;
          const details = mission.lead || {};
          const isPrimaryPilot = mission.pilotId === userId;
          const crewPending = mission.crewFormationState === 'PENDING_COPILOT_SELECTION';
          const cardTone = status === 'COMPLETED' ? 'mission-card--completed' : activeStatuses.has(status) ? 'mission-card--active' : '';
          return (
            <article key={mission.id} className={`mission-card ${cardTone}`}>
              <div className="mission-card__header"><div><p className="eyebrow">Scheduled mission</p><h3>{details.farmerName || 'Farmer'}{details.cropType ? ` — ${details.cropType}` : ''}</h3></div><span className={`status-badge ${statusTone(status) ? `status-badge--${statusTone(status)}` : ''}`}>{statusLabel(status)}</span></div>
              <div className="mission-card__details">
                <div className="mission-card__detail"><span>Location</span><strong><LocationLink latitude={details.latitude} longitude={details.longitude} address={details.farmerAddress} centerName={details.matchedCenter?.name} farmerName={details.farmerName} fallback="Mission field location" /></strong></div>
                <div className="mission-card__detail"><span>Expected area</span><strong>{mission.expectedAcreage} acres</strong></div>
                <div className="mission-card__detail"><span>Aircraft</span><strong>{mission.drone?.serialNumber || mission.droneId}</strong></div>
                <div className="mission-card__detail"><span>Primary Pilot</span><strong>{mission.pilot?.name || 'Not assigned'}</strong></div>
                <div className="mission-card__detail"><span>Copilot</span><strong>{mission.copilot?.name || 'Selection required'}</strong></div>
                <div className="mission-card__detail"><span>LMV</span><strong>{mission.lmv?.label || mission.lmv?.registrationNo || 'Not assigned'}</strong></div>
              </div>
              <div className="mission-actions">
                {status === 'SCHEDULED' && crewPending && isPrimaryPilot && <button className="submit-btn" type="button" onClick={() => void openCopilotSelection(mission)}>Select Copilot</button>}
                {status === 'SCHEDULED' && crewPending && <span className="field-hint">Crew formation must be completed before acceptance.</span>}
                {status === 'SCHEDULED' && !crewPending && <button className="submit-btn" onClick={() => void sendOrQueue({ assignmentId: mission.id, url: `${API}/api/assignments/${mission.id}/accept`, kind: 'mission-state' }, 'PILOT_ACCEPTED')}>Accept mission</button>}
                {status === 'PILOT_ACCEPTED' && <button className="submit-btn" onClick={() => void sendOrQueue({ assignmentId: mission.id, url: `${API}/api/assignments/${mission.id}/start`, kind: 'mission-state' }, 'IN_PROGRESS')}>Start mission</button>}
                {status === 'IN_PROGRESS' && <>
                  <div className="input-group"><label htmlFor={`actual-acreage-${mission.id}`}>Actual acreage</label><input id={`actual-acreage-${mission.id}`} type="number" min="0" step="0.01" placeholder="Actual acres" value={actualAcreage[mission.id] || ''} onChange={(event) => setActualAcreage((items) => ({ ...items, [mission.id]: event.target.value }))} /></div>
                  <button className="submit-btn" onClick={() => { if (!actualAcreage[mission.id]) { setNotice({ kind: 'error', message: 'Enter the actual acreage before completing.' }); return; } void sendOrQueue({ assignmentId: mission.id, url: `${API}/api/assignments/${mission.id}/complete`, body: { actualAcreage: Number(actualAcreage[mission.id]) }, kind: 'mission-state' }, 'COMPLETED'); }}>Complete</button>
                  <div className="input-group"><label htmlFor={`decommission-reason-${mission.id}`}>Aircraft issue</label><input id={`decommission-reason-${mission.id}`} placeholder="Decommission reason" value={decommissionReason[mission.id] || ''} onChange={(event) => setDecommissionReason((items) => ({ ...items, [mission.id]: event.target.value }))} /></div>
                  <button className="danger-btn" onClick={() => void sendOrQueue({ assignmentId: mission.id, url: `${API}/api/assignments/${mission.id}/decommission`, body: { reason: decommissionReason[mission.id] || 'Pilot reported decommission' }, kind: 'mission-state' }, 'FLAGGED')}>Decommission</button>
                </>}
              </div>
            </article>
          );
        })}
      </div>

      {copilotDialog && <div className="modal-backdrop" role="presentation">
        <section className="modal-card copilot-selection-dialog" role="dialog" aria-modal="true" aria-labelledby="copilot-selection-title">
          <div className="modal-card__header"><div><p className="eyebrow">Crew formation</p><h2 id="copilot-selection-title">Select an eligible Copilot</h2></div><button type="button" className="icon-button" aria-label="Close Copilot selection" disabled={copilotDialog.submitting} onClick={() => setCopilotDialog(null)}>×</button></div>
          <p className="muted">The server checks operating centre, availability, licence and schedule conflicts again when you confirm.</p>
          {copilotDialog.error && <div className="notice notice--error" role="alert">{copilotDialog.error}</div>}
          {copilotDialog.loading ? <p className="muted">Loading eligible Pilots…</p> : <form className="form-stack" onSubmit={confirmCopilotSelection}>
            {!copilotDialog.candidates.length ? <div className="empty-state"><strong>No eligible Copilots</strong><span>Fleet or Admin must resolve the crew exception.</span></div> : <div className="copilot-candidate-list" role="radiogroup" aria-label="Eligible Copilots">
              {copilotDialog.candidates.map((candidate) => <label key={candidate.id} className={`copilot-candidate ${copilotDialog.selectedId === candidate.id ? 'is-selected' : ''}`}><input type="radio" name="copilot" value={candidate.id} checked={copilotDialog.selectedId === candidate.id} onChange={() => setCopilotDialog((current) => ({ ...current, selectedId: candidate.id, error: '' }))} /><span><strong>{candidate.name}</strong><small>{candidate.employeeCode || 'Employee code not recorded'}</small></span></label>)}
            </div>}
            <div className="button-row button-row--end"><button type="button" className="action-btn" disabled={copilotDialog.submitting} onClick={() => setCopilotDialog(null)}>Cancel</button><button type="submit" className="submit-btn" disabled={!copilotDialog.selectedId || copilotDialog.submitting}>{copilotDialog.submitting ? 'Confirming…' : 'Confirm Copilot'}</button></div>
          </form>}
        </section>
      </div>}
    </section>
  );
}

export default PilotMissionPanel;
