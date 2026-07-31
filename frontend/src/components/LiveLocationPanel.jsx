import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/useAuth';
import OpsIcon from './OpsIcon';
import LocationLink from './LocationLink';
import { API_URL as API } from '../config';
import { extractCoordinates, openStreetMapEmbedUrl } from '../utils/locationPresentation';

const activeStatuses = new Set(['PILOT_ACCEPTED', 'IN_PROGRESS']);

function LiveLocationPanel() {
  const { token } = useAuth();
  const [missions, setMissions] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [location, setLocation] = useState(null);
  const [notice, setNotice] = useState(null);
  const [mapEnabled, setMapEnabled] = useState(false);

  const loadMissions = useCallback(async () => {
    try {
      const response = await fetch(`${API}/api/assignments/all`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not load live missions');
      const live = (data.missions || []).filter((mission) => activeStatuses.has(mission.lead?.status));
      setMissions(live);
      setSelectedId((current) => live.some((mission) => mission.id === current) ? current : live[0]?.id || '');
      setNotice(null);
    } catch (error) { setNotice(error.message); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMissions(), 0);
    return () => window.clearTimeout(timer);
  }, [loadMissions]);

  useEffect(() => {
    if (!selectedId || !token) return undefined;
    const socket = io(API, { auth: { token } });
    const update = (nextLocation) => setLocation(nextLocation);
    socket.on('location:update', update);
    socket.on('connect', () => socket.emit('location:watch', { assignmentId: selectedId }, (result) => {
      if (!result.success) { setNotice(result.error); return; }
      setLocation(result.location);
    }));
    return () => socket.disconnect();
  }, [selectedId, token]);

  const selectedMission = missions.find((mission) => mission.id === selectedId);
  const coordinates = extractCoordinates(location || {});
  const mapUrl = mapEnabled && coordinates ? openStreetMapEmbedUrl(coordinates) : '';

  return (
    <section className="panel panel--raised">
      <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="location" /></span><h2>Live pilot location</h2></div><p>Current mission position only - no historical route is stored.</p></div><button className="action-btn" type="button" onClick={() => void loadMissions()}><OpsIcon name="refresh" /> Refresh missions</button></div>
      <div className="panel-body">
        {notice && <div role="alert" className="notice notice--error"><span>{notice}</span></div>}
        {!missions.length ? <div className="empty-state"><strong>No active pilot location</strong><span>No pilot currently has an accepted or in-progress mission.</span></div> : <div className="gps-block">
          <div className="input-group"><label htmlFor="live-mission-picker">Mission to monitor</label><select id="live-mission-picker" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setLocation(null); setMapEnabled(false); }}>{missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.pilot?.name || 'Pilot'} - {mission.lead?.farmerName || 'Mission'}</option>)}</select></div>
          <div><p className="eyebrow">Assigned pilot</p><strong>{selectedMission?.pilot?.name || 'Pilot'}</strong></div>
          {location?.lastPingAt && coordinates ? <>
            <div className="live-location-summary">
              <div><span>Current position</span><LocationLink {...coordinates} pilotName={selectedMission?.pilot?.name || 'Pilot'} label={`Live position - ${selectedMission?.pilot?.name || 'Pilot'}`} showDisclosure={false} /></div>
              <div><span>Last update</span><strong>{new Date(location.lastPingAt).toLocaleString()}</strong></div>
            </div>
            <div className="map-disclosure">
              <p><strong>Map privacy:</strong> Loading the map sends this selected live position to OpenStreetMap. Opening the location link sends it to Google Maps. Neither provider is contacted until you choose one.</p>
              {!mapEnabled && <button type="button" className="action-btn" onClick={() => setMapEnabled(true)}>Load live map</button>}
            </div>
            {mapUrl && <div className="live-map"><iframe title={`Live map for ${selectedMission?.pilot?.name || 'pilot'}`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer" /></div>}
          </> : <div className="empty-state"><strong>Waiting for the first GPS update</strong><span>The latest mapped position will appear when the pilot device reports it.</span></div>}
        </div>}
      </div>
    </section>
  );
}

export default LiveLocationPanel;
