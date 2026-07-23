import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import ChatPanel from '../components/ChatPanel';
import PendingPaymentsPanel from '../components/PendingPaymentsPanel';
import LiveLocationPanel from '../components/LiveLocationPanel';
import LogbookTimelinePanel from '../components/LogbookTimelinePanel';
import { apiFetch } from '../services/apiClient';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    }
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

const statusLabel = (status) => String(status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const statusTone = (status) => {
  if (['AVAILABLE', 'ASSIGNED'].includes(status)) return 'success';
  if (status === 'MAINTENANCE') return 'danger';
  return 'warning';
};

function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('fleet');
  const [activeUserTab, setActiveUserTab] = useState('employees');
  const [users, setUsers] = useState([]);
  const [drones, setDrones] = useState([]);
  const [adminNotice, setAdminNotice] = useState(null);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'PILOT' });
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [replacementPassword, setPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  
  // Centers
  const [centers, setCenters] = useState([]);
  const [newCenter, setNewCenter] = useState({ name: '', radiusKm: 30 });
  const [centerPosition, setCenterPosition] = useState(null);

  const fetchData = useCallback(async (signal) => {
    try {
      const [userResponse, droneResponse, centerResponse] = await Promise.all([
        apiFetch('/api/users/all', { signal }),
        apiFetch('/api/drones/all', { signal }),
        apiFetch('/api/centers/all', { signal }),
      ]);
      const [userData, droneData, centerData] = await Promise.all([userResponse.json(), droneResponse.json(), centerResponse.json()]);
      if (userData.success) setUsers(userData.users);
      if (droneData.success) setDrones(droneData.drones);
      if (centerData.success) setCenters(centerData.centers);
      if (!userResponse.ok || !droneResponse.ok || !centerResponse.ok) setAdminNotice({ kind: 'error', message: userData.error || droneData.error || centerData.error || 'Could not load administration data.' });
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setAdminNotice({ kind: 'error', message: 'Could not load administration data.' });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void fetchData(controller.signal), 0);
    return () => { window.clearTimeout(initialLoad); controller.abort(); };
  }, [fetchData]);

  const handleAddUser = async (event) => {
    event.preventDefault();
    setAdminNotice(null);
    try {
      const response = await apiFetch('/api/users/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'Failed to add user.' }); return; }
      setNewUser({ name: '', email: '', password: '', role: 'PILOT' });
      setAdminNotice({ kind: 'success', message: `${data.user.name} can now sign in with their work email.` });
      await fetchData();
    } catch {
      setAdminNotice({ kind: 'error', message: 'The account could not be created. Check the server connection.' });
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      const response = await apiFetch(`/api/users/delete/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'The user could not be deleted.' }); return; }
      setAdminNotice({ kind: 'success', message: `${deleteTarget.name} was deleted.` });
      setDeleteTarget(null);
      await fetchData();
    } catch {
      setAdminNotice({ kind: 'error', message: 'The user could not be deleted.' });
    }
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    if (!passwordTarget) return;
    try {
      const response = await apiFetch('/api/users/edit-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: passwordTarget.id, newPassword: replacementPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'Password update failed.' }); return; }
      setAdminNotice({ kind: 'success', message: `Password updated for ${passwordTarget.name}.` });
      setPasswordTarget(null);
      setPassword('');
    } catch {
      setAdminNotice({ kind: 'error', message: 'Password update failed.' });
    }
  };

  const handleResolveMaintenance = async (droneId, action) => {
    try {
      const response = await apiFetch('/api/drones/resolve-maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId, action }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Maintenance decision failed.');
      setAdminNotice({ kind: 'success', message: action === 'approve' ? 'Maintenance request approved.' : 'Maintenance request rejected.' });
      await fetchData();
    } catch (error) { setAdminNotice({ kind: 'error', message: error.message }); }
  };

  const inquireDroneStatus = async (droneId) => {
    try {
      const response = await apiFetch('/api/drones/inquire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Status inquiry failed.');
      setAdminNotice({ kind: 'success', message: 'Status inquiry sent to Fleet.' });
      await fetchData();
    } catch (error) { setAdminNotice({ kind: 'error', message: error.message }); }
  };

  const handleAddCenter = async (event) => {
    event.preventDefault();
    if (!centerPosition) {
      setAdminNotice({ kind: 'error', message: 'Please click on the map to set the HQ location.' });
      return;
    }
    setAdminNotice(null);
    try {
      const response = await apiFetch('/api/centers/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCenter.name, radiusKm: newCenter.radiusKm, latitude: centerPosition.lat, longitude: centerPosition.lng }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'Failed to add center.' }); return; }
      setNewCenter({ name: '', radiusKm: 30 });
      setCenterPosition(null);
      setAdminNotice({ kind: 'success', message: `Operating center added.` });
      await fetchData();
    } catch {
      setAdminNotice({ kind: 'error', message: 'Failed to add operating center.' });
    }
  };

  const confirmDeleteCenter = async (id) => {
    try {
      const response = await apiFetch(`/api/centers/delete/${id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'Center could not be deleted.' }); return; }
      setAdminNotice({ kind: 'success', message: `Operating center deleted.` });
      await fetchData();
    } catch {
      setAdminNotice({ kind: 'error', message: 'Center could not be deleted.' });
    }
  };

  const toggleUserActive = async (userId) => {
    try {
      const response = await apiFetch('/api/users/toggle-active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (response.ok) await fetchData();
      else setAdminNotice({ kind: 'error', message: data.error });
    } catch {
      setAdminNotice({ kind: 'error', message: 'Failed to toggle active status.' });
    }
  };

  const activeDrones = useMemo(() => drones.filter((drone) => ['AVAILABLE', 'ASSIGNED'].includes(drone.status)), [drones]);
  const standbyDrones = useMemo(() => drones.filter((drone) => ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(drone.status)), [drones]);
  const maintenanceRequests = useMemo(() => drones.filter((drone) => drone.maintenanceRequest), [drones]);
  const navItems = [
    { id: 'fleet', label: 'Fleet Overview', icon: 'overview', badge: maintenanceRequests.length || null },
    { id: 'users', label: 'User Management', icon: 'users' },
    { id: 'centers', label: 'Operating Centers', icon: 'location' },
    { id: 'logbook', label: 'CRM Logbook', icon: 'book' },
    { id: 'chat', label: 'Pilot Support Chat', icon: 'chat' },
    { id: 'payments', label: 'Payment Collection', icon: 'wallet' },
    { id: 'location', label: 'Live Pilot GPS', icon: 'location' },
  ];

  const pageCopy = {
    fleet: ['Operations overview', 'Fleet readiness', 'Monitor availability, active allocations, and maintenance exceptions.'],
    users: ['Access administration', 'User management', 'Create and maintain secure operational accounts.'],
    centers: ['Geo-fencing', 'Operating Centers (HQ)', 'Configure geographic areas of operation.'],
    logbook: ['Operational history', 'CRM logbook', 'Review each lead’s complete recorded lifecycle.'],
    chat: ['Support desk', 'Pilot support chat', 'Coordinate directly with field teams and retain the conversation state.'],
    payments: ['Revenue operations', 'Payment collection', 'Resolve completed missions waiting for settlement.'],
    location: ['Live operations', 'Pilot GPS', 'View the latest position for accepted and active missions.'],
  };
  const [eyebrow, title, description] = pageCopy[activeTab];

  return (
    <OperationsShell roleLabel="Operations control" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} user={user} onLogout={logout}>
      <header className="page-header">
        <div className="page-header__copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
        <div className="page-header__actions"><button className="action-btn" type="button" onClick={() => void fetchData()}><OpsIcon name="refresh" /> Refresh data</button></div>
      </header>

      {adminNotice && <div role="alert" className={`notice notice--${adminNotice.kind}`}><span>{adminNotice.message}</span><button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setAdminNotice(null)}>×</button></div>}

      {activeTab === 'fleet' && (
        <>
          <section className="metric-grid" aria-label="Fleet status summary">
            <article className="metric-card"><div className="metric-card__top"><span>Total fleet</span><span className="metric-card__icon"><OpsIcon name="drone" /></span></div><strong className="metric-card__value">{drones.length}</strong></article>
            <article className="metric-card"><div className="metric-card__top"><span>Available</span><span className="metric-card__icon"><OpsIcon name="overview" /></span></div><strong className="metric-card__value">{drones.filter((drone) => drone.status === 'AVAILABLE').length}</strong></article>
            <article className="metric-card metric-card--info"><div className="metric-card__top"><span>Assigned</span><span className="metric-card__icon"><OpsIcon name="location" /></span></div><strong className="metric-card__value">{drones.filter((drone) => drone.status === 'ASSIGNED').length}</strong></article>
            <article className="metric-card metric-card--danger"><div className="metric-card__top"><span>Needs attention</span><span className="metric-card__icon"><OpsIcon name="alert" /></span></div><strong className="metric-card__value">{standbyDrones.length}</strong></article>
          </section>

          <section className="admin-fleet-grid">
            <div className="panel panel--raised">
              <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="drone" /></span><h2>Available &amp; Assigned ({activeDrones.length})</h2></div><p>Aircraft ready for allocation or currently attached to work.</p></div></div>
              {activeDrones.length ? <div className="data-stack">{activeDrones.map((drone) => <div className="data-row" key={drone.id}><div className="data-row__main"><span className="data-row__title">{drone.model}</span><span className="data-row__meta">Serial {drone.serialNumber || drone.id}</span><span className={`status-badge status-badge--${statusTone(drone.status)}`}>{statusLabel(drone.status)}</span></div><div className="data-row__actions"><button className="action-btn" type="button" onClick={() => void inquireDroneStatus(drone.id)}>{drone.pendingInquiry ? 'Inquiry Sent ✓' : 'Inquire Status'}</button></div></div>)}</div> : <div className="panel-body"><div className="empty-state"><strong>No ready aircraft</strong><span>Available and assigned drones will appear here.</span></div></div>}
            </div>

            <div className="panel panel--accent">
              <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="alert" /></span><h2>Maintenance &amp; out of service ({standbyDrones.length})</h2></div><p>Aircraft unavailable for new scheduling.</p></div></div>
              {standbyDrones.length ? <div className="data-stack">{standbyDrones.map((drone) => <div className="data-row" key={drone.id}><div className="data-row__main"><span className="data-row__title">{drone.model}</span><span className="data-row__meta">Serial {drone.serialNumber || drone.id}</span><span className={`status-badge status-badge--${statusTone(drone.status)}`}>{statusLabel(drone.status)}</span></div>{drone.status !== 'MAINTENANCE' && <div className="data-row__actions"><button className="action-btn" type="button" onClick={() => void inquireDroneStatus(drone.id)}>{drone.pendingInquiry ? 'Inquiry Sent ✓' : 'Inquire Status'}</button></div>}</div>)}</div> : <div className="panel-body"><div className="empty-state"><strong>No maintenance exceptions</strong><span>The unavailable fleet queue is clear.</span></div></div>}
            </div>
          </section>

          {maintenanceRequests.length > 0 && <section className="panel maintenance-card section-gap"><div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="alert" /></span><h2>Pending maintenance requests</h2></div><p>Review pilot and Fleet requests before changing aircraft availability.</p></div></div>{maintenanceRequests.map((drone) => <article className="maintenance-row" key={drone.id}><div><strong>{drone.model} · {drone.serialNumber || drone.id}</strong><p className="caption">Requested by {drone.maintenanceRequest.requestedBy}</p><p>{drone.maintenanceRequest.reason}</p></div><div className="button-row"><button className="danger-btn" type="button" onClick={() => void handleResolveMaintenance(drone.id, 'approve')}>Approve maintenance</button><button className="action-btn" type="button" onClick={() => void handleResolveMaintenance(drone.id, 'reject')}>Reject request</button></div></article>)}</section>}
        </>
      )}

      {activeTab === 'users' && (
        <section className="user-admin-grid">
          <div className="panel panel--raised">
            <div className="panel-header">
              <div className="panel-header__title">
                <div className="panel-title-row">
                  <span className="panel-title-icon"><OpsIcon name="users" /></span>
                  <h2>User Management</h2>
                </div>
                <p>Manage operational accounts and end-user profiles.</p>
              </div>
              <div className="flex gap-4 mt-4 border-b border-gray-200">
                <button type="button" className={`pb-2 font-medium ${activeUserTab === 'employees' ? 'border-b-2 border-forest text-forest' : 'text-gray-500'}`} onClick={() => setActiveUserTab('employees')}>Employees</button>
                <button type="button" className={`pb-2 font-medium ${activeUserTab === 'farmers' ? 'border-b-2 border-forest text-forest' : 'text-gray-500'}`} onClick={() => setActiveUserTab('farmers')}>Farmers</button>
              </div>
            </div>
            <div className="data-stack">
              {users.filter(u => activeUserTab === 'employees' ? u.role !== 'FARMER' : u.role === 'FARMER').map((account) => (
                <div className="data-row" key={account.id}>
                  <div className="data-row__main">
                    <span className="data-row__title">{account.name}</span>
                    <span className="data-row__meta">{account.email || account.phone}</span>
                    <span className="status-badge">{statusLabel(account.role)}</span>
                    <span className={`status-badge status-badge--${account.active ? 'success' : 'danger'}`} style={{marginLeft: '0.5rem'}}>{account.active ? 'Active' : 'Disabled'}</span>
                  </div>
                  {account.role !== 'ADMIN' && account.id !== user?.id && (
                    <div className="data-row__actions">
                      <button className="action-btn" type="button" onClick={() => toggleUserActive(account.id)}>{account.active ? 'Disable' : 'Enable'}</button>
                      {account.role !== 'FARMER' && (
                        <button className="action-btn" type="button" onClick={() => { setPasswordTarget(account); setPassword(''); }}>Reset password</button>
                      )}
                      <button className="danger-btn" type="button" onClick={() => setDeleteTarget(account)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {activeUserTab === 'employees' && (
            <div className="panel panel--raised">
              <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Add new employee</h2></div><p>Create a role-scoped work account.</p></div></div>
              <form className="panel-body form-stack" onSubmit={handleAddUser}>
                <div className="input-group"><label htmlFor="new-user-name">Full Name</label><input id="new-user-name" type="text" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} required minLength={2} maxLength={120} /></div>
                <div className="input-group"><label htmlFor="new-user-email">Work Email</label><input id="new-user-email" type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required autoComplete="off" /></div>
                <div className="input-group"><label htmlFor="new-user-password">Temporary Password</label><input id="new-user-password" type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required minLength={12} maxLength={128} autoComplete="new-password" /><span className="field-hint">Use 12–128 characters and share it through an approved channel.</span></div>
                <div className="input-group"><label htmlFor="new-user-role">Role</label><select id="new-user-role" value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}><option value="PILOT">Pilot</option><option value="SALES">Sales Rep</option><option value="FLEET_MANAGER">Fleet Manager</option></select></div>
                <div className="form-actions"><button type="submit" className="submit-btn">Create Account</button></div>
              </form>
            </div>
          )}
        </section>
      )}

      {activeTab === 'centers' && (
        <section className="user-admin-grid">
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="location" /></span><h2>Active Operating Centers</h2></div><p>{centers.length} center{centers.length === 1 ? '' : 's'} configured.</p></div></div>
            <div className="data-stack">{centers.map((center) => <div className="data-row" key={center.id}><div className="data-row__main"><span className="data-row__title">{center.name}</span><span className="data-row__meta">Radius: {center.radiusKm} km | {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}</span></div><div className="data-row__actions"><button className="danger-btn" type="button" onClick={() => confirmDeleteCenter(center.id)}>Remove</button></div></div>)}</div>
          </div>

          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Add New Center</h2></div><p>Click on the map to set HQ location.</p></div></div>
            <div className="panel-body">
              <div style={{ height: '300px', width: '100%', marginBottom: '1rem', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden' }}>
                <MapContainer center={[20.5937, 78.9629]} zoom={4} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
                  <LocationMarker position={centerPosition} setPosition={setCenterPosition} />
                  {centers.map(c => (
                    <Circle key={c.id} center={[c.latitude, c.longitude]} radius={c.radiusKm * 1000} color="blue" fillColor="blue" fillOpacity={0.2} />
                  ))}
                  {centerPosition && <Circle center={centerPosition} radius={newCenter.radiusKm * 1000} color="green" fillColor="green" fillOpacity={0.4} />}
                </MapContainer>
              </div>
              <form className="form-stack" onSubmit={handleAddCenter}>
                <div className="input-group"><label>Center Name</label><input type="text" value={newCenter.name} onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })} required /></div>
                <div className="input-group"><label>Radius (km)</label><input type="number" min="1" max="1000" value={newCenter.radiusKm} onChange={(e) => setNewCenter({ ...newCenter, radiusKm: Number(e.target.value) })} required /></div>
                <div className="form-actions"><button type="submit" className="submit-btn" disabled={!centerPosition}>Add Center</button></div>
              </form>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'logbook' && <LogbookTimelinePanel />}
      {activeTab === 'chat' && <ChatPanel />}
      {activeTab === 'payments' && <PendingPaymentsPanel />}
      {activeTab === 'location' && <LiveLocationPanel />}

      {passwordTarget && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title"><div className="modal-card__header"><div><p className="eyebrow">Credential reset</p><h2 id="password-dialog-title">Reset {passwordTarget.name}’s password</h2></div><button className="icon-button" type="button" aria-label="Close password reset" onClick={() => setPasswordTarget(null)}>×</button></div><form className="form-stack" onSubmit={submitPasswordReset}><div className="input-group"><label htmlFor="replacement-password">New temporary password</label><input id="replacement-password" type="password" value={replacementPassword} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /><span className="field-hint">The application stores only a bcrypt hash.</span></div><div className="button-row button-row--end"><button type="button" className="action-btn" onClick={() => setPasswordTarget(null)}>Cancel</button><button type="submit" className="submit-btn">Update password</button></div></form></section></div>}

      {deleteTarget && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div className="modal-card__header"><div><p className="eyebrow">Confirm deletion</p><h2 id="delete-dialog-title">Delete {deleteTarget.name}?</h2></div></div><p className="muted">This account will be removed only if it is not linked to protected operational records.</p><div className="button-row button-row--end"><button type="button" className="action-btn" onClick={() => setDeleteTarget(null)}>Cancel</button><button type="button" className="danger-btn" onClick={() => void confirmDeleteUser()}>Delete account</button></div></section></div>}
    </OperationsShell>
  );
}

export default AdminDashboard;
