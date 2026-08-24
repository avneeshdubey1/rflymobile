import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import ChatPanel from '../components/ChatPanel';
import PendingPaymentsPanel from '../components/PendingPaymentsPanel';
import LiveLocationPanel from '../components/LiveLocationPanel';
import LogbookTimelinePanel from '../components/LogbookTimelinePanel';
import { API_URL as API } from '../config';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import RegisteredFarmers from "../components/RegisteredFarmers";
import FarmDetails from '../components/FarmDetails';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import AdminProfile from "../components/AdminProfile";
import { SkeletonRow, SkeletonCard } from '../components/Skeleton';
import MyDrones from '../components/MyDrones';
import AcreageTrend from '../components/AcreageTrend';
import CustomerRegistration from '../components/CustomerRegistration';
import ManagePilots from '../components/ManagePilots';
import AssignmentDetails from '../components/AssignmentDetails';

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
  // const [newUser, setNewUser] = useState({ name: '', email: '', phone: '', password: '', role: 'PILOT', homeCenterId: '' });
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    homeCenterId: '',
    password: '',
    confirmPassword: '',
    role: 'SALES',
    active: true,
  });

  const [passwordTarget, setPasswordTarget] = useState(null);
  const [replacementPassword, setPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingCenterId, setEditingCenterId] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);

  // Centers
  const [centers, setCenters] = useState([]);
  const [newCenter, setNewCenter] = useState({ name: '', radiusKm: 30 });
  const [centerPosition, setCenterPosition] = useState(null);

  // farmer 
  const [farmerData, setFarmerData] = useState({
    name: "",
    phone: "",
    village: "",
    district: "",
    state: "",
  });
  const [farmerNotice, setFarmerNotice] = useState(null);
  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    try {
      const [userResponse, droneResponse, centerResponse] = await Promise.all([
        fetch(`${API}/api/users/all`, { signal }),
        fetch(`${API}/api/drones/all`, { signal }),
        fetch(`${API}/api/centers/all`, { signal }),
      ]);
      const [userData, droneData, centerData] = await Promise.all([userResponse.json(), droneResponse.json(), centerResponse.json()]);
      if (userData.success) setUsers(userData.users);
      if (droneData.success) setDrones(droneData.drones);
      if (centerData.success) setCenters(centerData.centers);
      if (!userResponse.ok || !droneResponse.ok || !centerResponse.ok) setAdminNotice({ kind: 'error', message: userData.error || droneData.error || centerData.error || 'Could not load administration data.' });
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setAdminNotice({ kind: 'error', message: 'Could not load administration data.' });
    }
    finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void fetchData(controller.signal), 0);
    return () => { window.clearTimeout(initialLoad); controller.abort(); };
  }, [fetchData]);

  // const handleAddUser = async (event) => {
  //   event.preventDefault();
  //   setAdminNotice(null);
  //   try {
  //     const response = await fetch(`${API}/api/users/add`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json' },
  //       body: JSON.stringify(newUser),
  //     });
  //     const data = await response.json().catch(() => ({}));
  //     if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'Failed to add user.' }); return; }
  //     // setNewUser({ name: '', email: '', phone: '', password: '', role: 'PILOT', homeCenterId: '' });

  //     setNewUser({ name: '', email: '', phone: '', password: '', role: 'PILOT', homeCenterId: '', idProof: '', licenseId: '', addressLine1: '', addressLine2: '', state: '', city: '', pincode: '' });
  //     //       setNewUser({
  //     //   name: '',
  //     //   email: '',
  //     //   password: '',
  //     //   role: 'ADMIN',
  //     //   firstName: '',
  //     //   middleName: '',
  //     //   lastName: '',
  //     //   idProof: '',
  //     //   licenseId: '',
  //     //   location: '',
  //     //   countryCode: '+91',
  //     //   phone: '',
  //     //   addressLine1: '',
  //     //   addressLine2: '',
  //     //   state: '',
  //     //   city: '',
  //     //   pincode: '',
  //     //   assignedDrone: '',
  //     // });
  //     setAdminNotice({ kind: 'success', message: `${data.user.name} can now sign in with their work email.` });
  //     await fetchData();
  //   } catch {
  //     setAdminNotice({ kind: 'error', message: 'The account could not be created. Check the server connection.' });
  //   }
  // };

  const handleAddUser = async (event) => {
    event.preventDefault();
    setAdminNotice(null);
    if (newUser.password !== newUser.confirmPassword) {
      setAdminNotice({ kind: 'error', message: 'Passwords do not match.' });
      return;
    }
    try {
      const { confirmPassword, ...payload } = newUser;
      const response = await fetch(`${API}/api/users/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'Failed to add user.' }); return; }
      setNewUser({ name: '', email: '', phone: '', address: '', homeCenterId: '', password: '', confirmPassword: '', role: 'SALES', active: true });
      setAdminNotice({ kind: 'success', message: `${data.user.name} can now sign in with their work email.` });
      await fetchData();
    } catch {
      setAdminNotice({ kind: 'error', message: 'The account could not be created. Check the server connection.' });
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    try {
      const response = await fetch(`${API}/api/users/delete/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setDeleteError(data.error || 'The user could not be deleted.'); return; }
      setAdminNotice({ kind: 'success', message: `${deleteTarget.name} was deleted.` });
      setDeleteTarget(null);
      setDeleteError('');
      await fetchData();
    } catch {
      setDeleteError('The user could not be deleted.');
    }
  };

  const submitPasswordReset = async (event) => {
    event.preventDefault();
    if (!passwordTarget) return;
    try {
      const response = await fetch(`${API}/api/users/edit-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: passwordTarget.id, newPassword: replacementPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setAdminNotice({ kind: 'error', message: data.error || 'Password update failed.' }); return; }
      setAdminNotice({ kind: 'success', message: `Password updated for ${passwordTarget.name}.` });
      setPasswordTarget(null);
      setReplacementPassword('');
    } catch {
      setAdminNotice({ kind: 'error', message: 'Password update failed.' });
    }
  };

  const handleResolveMaintenance = async (droneId, action) => {
    try {
      const response = await fetch(`${API}/api/drones/resolve-maintenance`, {
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
      const response = await fetch(`${API}/api/drones/inquire`, {
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
      const response = await fetch(`${API}/api/centers/add`, {
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
      const response = await fetch(`${API}/api/centers/delete/${id}`, { method: 'DELETE' });
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
      const response = await fetch(`${API}/api/users/toggle-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (response.ok) await fetchData();
      else setAdminNotice({ kind: 'error', message: data.error });
    } catch (err) {
      setAdminNotice({ kind: 'error', message: 'Failed to toggle active status.' });
    }
  };

  const updatePilotCenter = async (pilotId, homeCenterId) => {
    try {
      const response = await fetch(`${API}/api/users/${pilotId}/operating-center`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeCenterId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Pilot center could not be updated.');
      setAdminNotice({ kind: 'success', message: 'Pilot operating center updated.' });
      await fetchData();
    } catch (error) { setAdminNotice({ kind: 'error', message: error.message }); }
  };

  // const handleFarmerRegistration = async (e) => {
  //   e.preventDefault();
  //   try {
  //     const payload = {
  //       ...farmerData,
  //       registeredBy: user?.email,
  //       registeredByName: user?.name,
  //     };
  //     const response = await fetch(`${API}/api/farmers/register`, {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(payload),
  //     });
  //     const data = await response.json();
  //     if (!response.ok) {
  //       setFarmerNotice({
  //         type: "error",
  //         message:
  //           data.message || "Customer registration could not be completed.",
  //       });
  //       return;
  //     }
  //     setFarmerNotice({
  //       type: "success",
  //       message: "Customer registered successfully!",
  //     });
  //     setFarmerData({
  //       name: "",
  //       phone: "",
  //       village: "",
  //       district: "",
  //       state: "",
  //     });
  //   } catch (error) {
  //     console.error(error);
  //     setFarmerNotice({
  //       type: "error",
  //       message: "An unexpected error occurred. Please try again.",
  //     });
  //   }
  // };

  useEffect(() => {
    if (!farmerNotice) return;
    const timer = setTimeout(() => setFarmerNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [farmerNotice]);

  useEffect(() => {
    if (!farmerNotice) return;

    const timer = setTimeout(() => {
      setFarmerNotice(null);
    }, 4500);

    return () => clearTimeout(timer);
  }, [farmerNotice]);

  const handleFarmerRegistration = async (e, confirmed = false) => {
    e.preventDefault();
    try {
      const payload = {
        ...farmerData,
        registeredBy: user?.email,
        registeredByName: user?.name,
        confirmed,
      };
      const response = await fetch(`${API}/api/farmers/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        if (data.needsConfirmation) {
          setConfirmModal({
            message: data.message,
            onConfirm: () => {
              setConfirmModal(null);
              handleFarmerRegistration(e, true);
            },
          });
          return;
        }
        setFarmerNotice({
          type: "error",
          message: data.message || "Customer registration could not be completed.",
        });
        return;
      }

      setFarmerNotice({ type: "success", message: "Customer registered successfully!" });
      setFarmerData({ name: "", phone: "", village: "", district: "", state: "" });
    } catch (error) {
      console.error(error);
      setFarmerNotice({ type: "error", message: "An unexpected error occurred. Please try again." });
    }
  };

  const handleEditCenter = (center) => {
    setEditingCenterId(center.id);
    setCenterForm({
      name: center.name,
      latitude: center.latitude,
      longitude: center.longitude,
      radiusKm: center.radiusKm,
    });
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const activeDrones = useMemo(() => drones.filter((drone) => ['AVAILABLE', 'ASSIGNED'].includes(drone.status)), [drones]);
  const standbyDrones = useMemo(() => drones.filter((drone) => ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(drone.status)), [drones]);
  const maintenanceRequests = useMemo(() => drones.filter((drone) => drone.maintenanceRequest), [drones]);
  const navItems = [
    { id: 'fleet', label: 'Fleet Overview', icon: 'overview', badge: maintenanceRequests.length || null },
    { id: 'centers', label: 'Feasible Regions', icon: 'location' },
    { id: 'farmerRegistration', label: 'Customer Registration', icon: 'user-plus' },
    { id: 'manual', label: 'Enter New Lead', icon: 'plus' },
    { id: 'drone', label: 'Drones', icon: 'drone' },
    { id: 'pilots', label: 'Pilots', icon: 'users' },
    // { id: 'chat', label: 'Pilot Support Chat', icon: 'chat' },
    // { id: 'payments', label: 'Payment Collection', icon: 'wallet' },
    // { id: 'location', label: 'Live Pilot GPS', icon: 'location' },
    { id: 'assignments', label: 'Assignments', icon: 'assignment' },
    { id: "registeredFarmers", label: "Registered Customers", icon: "customers" },
    { id: 'logbook', label: 'Lead Details', icon: 'book' },
    { id: 'users', label: 'My Team', icon: 'team' },
    // { id: 'trend', label: 'Acreage Trend', icon: 'trend' },
    { id: 'profile', label: 'Profile', icon: 'user' },
  ];

  const pageCopy = {
    fleet: ['Operations overview', 'Fleet readiness', 'Monitor availability, active allocations, and maintenance exceptions.'],
    users: ['Access administration', 'User management', 'Create and maintain secure operational accounts.'],
    manual: ['Service Request', 'Enter a new lead', 'Register a new spraying request with farm and scheduling details.'],
    centers: ['Geo-fencing', 'Feasible Regions', 'Configure geographic areas of operation.'],
    logbook: ['Lead Records', 'Lead Details', 'Review each lead’s complete recorded lifecycle.'],
    // chat: ['Support desk', 'Pilot support chat', 'Coordinate directly with field teams and retain the conversation state.'],
    // payments: ['Revenue operations', 'Payment collection', 'Resolve completed missions waiting for settlement.'],
    // location: ['Live operations', 'Pilot GPS', 'View the latest position for accepted and active missions.'],
    assignments: [
      'Operations Planning',
      'Spraying Assignments',
      'View automatically assigned pilots, co-pilots, drones, date, and schedule details.'
    ],
    drone: ['Fleet management', 'Drones', 'Add, update, and monitor drones registered to your fleet.'],
    pilots: ['Fleet management', 'Pilots', 'Manage registered pilots, licenses, and operating centers.'],
    farmerRegistration: ['Customer onboarding', 'Customer Registration', 'Register new Customers and create their accounts.'],
    registeredFarmers: ['Customer records', 'Registered Customers', 'View all registered Customers and their registration details.'],
    profile: ['Account', 'Administrator Profile', 'View and manage your profile, account information, and security settings.'],
    trend: ['Acreage Trend', 'Acreage Analysis', 'View and analyze total acreage trends and growth patterns'],
  };
  const [eyebrow, title, description] = pageCopy[activeTab];
  const droneOptions = [
    { label: 'UA00SZMSOTC', value: 'UA00SZMSOTC' },
    { label: 'UA00T1DS0TC', value: 'UA00T1DS0TC' },
    { label: 'UA00S2USOTC', value: 'UA00S2USOTC' },
  ];

  return (
    <OperationsShell roleLabel="Operations control" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} user={user} onLogout={logout}>
      <header className="page-header">
        <div className="page-header__copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
        <div className="page-header__actions">
          <div className="profile-menu">
            <button
              className="profile-trigger"
              onClick={() => setShowProfileMenu(!showProfileMenu)}>
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </button>
            {showProfileMenu && (
              <div className="profile-dropdown">
                <div className="profile-dropdown__header">
                  <div className="profile-avatar">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h4>{user?.name || "User"}</h4>
                    <p>{user?.role || "Sales Operations"}</p>
                  </div>
                </div>
                <hr />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setActiveTab("profile");
                    setShowProfileMenu(false);
                  }}>
                  <OpsIcon name="user" />
                  My Profile
                </button>
                <button
                  className="dropdown-item logout"
                  onClick={logout}>
                  <OpsIcon name="logout" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {adminNotice && <div role="alert" className={`notice notice--${adminNotice.kind}`}><span>{adminNotice.message}</span><button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setAdminNotice(null)}>×</button></div>}

      {activeTab === "profile" && (
        <AdminProfile user={user} />
      )}

      {activeTab === 'fleet' && (
        <>
          <section className="metric-grid" aria-label="Fleet status summary">
            {loading ? (
              <SkeletonCard count={4} />
            ) : (
              <>
                <article className="metric-card"><div className="metric-card__top"><span>Total fleet</span><span className="metric-card__icon"><OpsIcon name="drone" /></span></div><strong className="metric-card__value">{drones.length}</strong></article>
                <article className="metric-card"><div className="metric-card__top"><span>Available</span><span className="metric-card__icon"><OpsIcon name="overview" /></span></div><strong className="metric-card__value">{drones.filter((drone) => drone.status === 'AVAILABLE').length}</strong></article>
                <article className="metric-card metric-card--info"><div className="metric-card__top"><span>Assigned</span><span className="metric-card__icon"><OpsIcon name="location" /></span></div><strong className="metric-card__value">{drones.filter((drone) => drone.status === 'ASSIGNED').length}</strong></article>
                <article className="metric-card metric-card--danger"><div className="metric-card__top"><span>Needs attention</span><span className="metric-card__icon"><OpsIcon name="alert" /></span></div><strong className="metric-card__value">{standbyDrones.length}</strong></article>
              </>
            )}
          </section>

          <section className="admin-fleet-grid">
            <div className="panel panel--raised">
              <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="drone" /></span><h2>Available &amp; Assigned ({activeDrones.length})</h2></div><p>Aircraft ready for allocation or currently attached to work.</p></div></div>
              {loading ? (
                <div className="data-stack"><SkeletonRow count={3} /></div>
              ) : activeDrones.length ? (
                <div className="data-stack">{activeDrones.map((drone) => <div className="data-row" key={drone.id}><div className="data-row__main"><span className="data-row__title">{drone.model}</span><span className="data-row__meta">Serial {drone.serialNumber || drone.id}</span><span className={`status-badge status-badge--${statusTone(drone.status)}`}>{statusLabel(drone.status)}</span></div><div className="data-row__actions"><button className="action-btn" type="button" onClick={() => void inquireDroneStatus(drone.id)}>{drone.pendingInquiry ? 'Inquiry Sent ✓' : 'Inquire Status'}</button></div></div>)}</div>
              ) : (
                <div className="panel-body"><div className="empty-state"><strong>No ready aircraft</strong><span>Available and assigned drones will appear here.</span></div></div>
              )}
            </div>

            <div className="panel panel--accent">
              <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="alert" /></span><h2>Maintenance &amp; out of service ({standbyDrones.length})</h2></div><p>Aircraft unavailable for new scheduling.</p></div></div>
              {loading ? (
                <div className="data-stack"><SkeletonRow count={2} /></div>
              ) : standbyDrones.length ? (
                <div className="data-stack">{standbyDrones.map((drone) => <div className="data-row" key={drone.id}><div className="data-row__main"><span className="data-row__title">{drone.model}</span><span className="data-row__meta">Serial {drone.serialNumber || drone.id}</span><span className={`status-badge status-badge--${statusTone(drone.status)}`}>{statusLabel(drone.status)}</span></div>{drone.status !== 'MAINTENANCE' && <div className="data-row__actions"><button className="action-btn" type="button" onClick={() => void inquireDroneStatus(drone.id)}>{drone.pendingInquiry ? 'Inquiry Sent ✓' : 'Inquire Status'}</button></div>}</div>)}</div>
              ) : (
                <div className="panel-body"><div className="empty-state"><strong>No maintenance exceptions</strong><span>The unavailable fleet queue is clear.</span></div></div>
              )}
            </div>
          </section>

          {!loading && maintenanceRequests.length > 0 && <section className="panel maintenance-card section-gap"><div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="alert" /></span><h2>Pending maintenance requests</h2></div><p>Review pilot and Fleet requests before changing aircraft availability.</p></div></div>{maintenanceRequests.map((drone) => <article className="maintenance-row" key={drone.id}><div><strong>{drone.model} · {drone.serialNumber || drone.id}</strong><p className="caption">Requested by {drone.maintenanceRequest.requestedBy}</p><p>{drone.maintenanceRequest.reason}</p></div><div className="button-row"><button className="danger-btn" type="button" onClick={() => void handleResolveMaintenance(drone.id, 'approve')}>Approve maintenance</button><button className="action-btn" type="button" onClick={() => void handleResolveMaintenance(drone.id, 'reject')}>Reject request</button></div></article>)}</section>}
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
              </div>
            </div>
            <div className="data-stack">
              {loading ? (
                <SkeletonRow count={4} />
              ) : (
                users
                  .filter((u) =>
                    activeUserTab === "employees"
                      ? ["ADMIN", "SALES", "FLEET_MANAGER"].includes(u.role)
                      : u.role === "FARMER"
                  ).map((account) => (
                    <div className="data-row" key={account.id}>
                      <div className="data-row__main">
                        <span className="data-row__title">{account.name}</span>
                        <span className="data-row__meta">  {account.email}
                          {account.phone && ` - ${account.phone}`}</span>
                        <span className="status-badge">{statusLabel(account.role)}</span>
                        <span className={`status-badge status-badge--${account.active ? 'success' : 'danger'}`} style={{ marginLeft: '0.5rem' }}>{account.active ? 'Active' : 'Disabled'}</span>
                        {account.role === 'PILOT' && <label className="input-group"><span>Operating center</span><select value={account.homeCenterId || ''} onChange={(event) => void updatePilotCenter(account.id, event.target.value)}><option value="" disabled>Select center</option>{centers.filter((center) => center.active).map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label>}
                      </div>
                      {account.role === 'ADMIN' && account.id === user?.id && (
                        <div className="data-row__actions">
                          <button className="action-btn" type="button" onClick={() => { setPasswordTarget(account); setPassword(''); }}>Change my password</button>
                        </div>
                      )}
                      {account.role !== 'ADMIN' && account.id !== user?.id && (
                        <div className="data-row__actions">
                          <button className="action-btn" type="button" onClick={() => toggleUserActive(account.id)}>{account.active ? 'Deactivate login' : 'Reactivate login'}</button>
                          {account.role !== 'FARMER' && (
                            <button className="action-btn" type="button" onClick={() => { setPasswordTarget(account); setPassword(''); }}>Reset password</button>
                          )}
                          <button className="danger-btn" type="button" onClick={() => { setDeleteError(''); setDeleteTarget(account); }}>Delete permanently</button>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>

          {activeUserTab === 'employees' && (
            <div className="panel panel--raised">
              <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Add new employee</h2></div><p>Create a role-scoped work account.</p></div></div>
              {/* <form className="panel-body form-stack" onSubmit={handleAddUser}>
                <div className="input-group"><label htmlFor="new-user-name">Full Name</label><input id="new-user-name" type="text" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} required minLength={2} maxLength={120} /></div>
                <div className="input-group"><label htmlFor="new-user-email">Work Email</label><input id="new-user-email" type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required autoComplete="off" /></div>
                <div className="input-group">
                  <label htmlFor="new-user-phone">Mobile Number</label>
                  <input
                    id="new-user-phone"
                    type="tel"
                    placeholder="Enter mobile number"
                    value={newUser.phone || ''}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "").slice(0, 10);
                      setNewUser({ ...newUser, phone: value });
                    }}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    required
                  />
                  {newUser.phone && newUser.phone.length !== 10 && (
                    <small className="error-text">Mobile number must be exactly 10 digits.</small>
                  )}
                </div>
                <div className="input-group"><label htmlFor="new-user-password">Temporary Password</label><input id="new-user-password" type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required minLength={12} maxLength={128} autoComplete="new-password" /><span className="field-hint">Use 12–128 characters and share it through an approved channel.</span></div>
                <div className="input-group"><label htmlFor="new-user-role">Role</label><select id="new-user-role" value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                  <option value="PILOT">Pilot</option><option value="SALES">Sales Executive</option><option value="FLEET_MANAGER">Fleet Manager</option></select></div>
                {newUser.role === 'PILOT' && <div className="input-group"><label htmlFor="new-user-center">Operating center</label><select id="new-user-center" value={newUser.homeCenterId} onChange={(event) => setNewUser({ ...newUser, homeCenterId: event.target.value })} required><option value="">Select active center</option>{centers.filter((center) => center.active).map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></div>}
                <div className="form-actions"><button type="submit" className="submit-btn">Create Account</button></div>
              </form> */}
              <form className="panel-body form-stack" onSubmit={handleAddUser}>
                <div className="input-group">
                  <label htmlFor="new-user-name">Full Name</label>
                  <input id="new-user-name" type="text" value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} required minLength={2} maxLength={120} />
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-email">Work Email</label>
                  <input id="new-user-email" type="email" value={newUser.email} onChange={(event) => setNewUser({ ...newUser, email: event.target.value })} required autoComplete="off" />
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-phone">Mobile Number</label>
                  <input
                    id="new-user-phone"
                    type="tel"
                    placeholder="Enter mobile number"
                    value={newUser.phone || ''}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "").slice(0, 10);
                      setNewUser({ ...newUser, phone: value });
                    }}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    required
                  />
                  {newUser.phone && newUser.phone.length !== 10 && (
                    <small className="error-text">Mobile number must be exactly 10 digits.</small>
                  )}
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-address">Address</label>
                  <input id="new-user-address" type="text" value={newUser.address} onChange={(event) => setNewUser({ ...newUser, address: event.target.value })} required />
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-location">Location</label>
                  <select id="new-user-location" value={newUser.homeCenterId} onChange={(event) => setNewUser({ ...newUser, homeCenterId: event.target.value })} required>
                    <option value="">Select location…</option>
                    {centers.filter((center) => center.active).map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}
                  </select>
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-role">Role</label>
                  <select id="new-user-role" value={newUser.role} onChange={(event) => setNewUser({ ...newUser, role: event.target.value })}>
                    <option value="ADMIN">Admin</option>
                    <option value="SALES">Sales Executive</option>
                    <option value="FLEET_MANAGER">Fleet Manager</option>

                  </select>
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-password">Password</label>
                  <input id="new-user-password" type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} required minLength={12} maxLength={128} autoComplete="new-password" />
                  <span className="field-hint">Use 12–128 characters and share it through an approved channel.</span>
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-confirm-password">Confirm Password</label>
                  <input id="new-user-confirm-password" type="password" value={newUser.confirmPassword} onChange={(event) => setNewUser({ ...newUser, confirmPassword: event.target.value })} required minLength={12} maxLength={128} autoComplete="new-password" />
                  {newUser.confirmPassword && newUser.password !== newUser.confirmPassword && (
                    <small className="error-text">Passwords do not match.</small>
                  )}
                </div>

                <div className="input-group">
                  <label htmlFor="new-user-status">Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      id="new-user-status"
                      onClick={() => setNewUser({ ...newUser, active: !newUser.active })}
                      style={{
                        width: '44px', height: '24px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                        background: newUser.active ? 'var(--primary, #2e6b4d)' : '#d1d5db',
                        position: 'relative', transition: 'background 0.2s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: '2px', left: newUser.active ? '22px' : '2px',
                        width: '20px', height: '20px', borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                      }} />
                    </button>
                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>{newUser.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                <div className="form-actions"><button type="submit" className="submit-btn">Create Account</button></div>
              </form>

            </div>
          )}
        </section>
      )}

      {activeTab === 'manual' && <FarmDetails />}

      {activeTab === 'drone' && <MyDrones />}

      {activeTab === "assignments" && (
        <AssignmentDetails />
      )}
      {activeTab === 'trend' && <AcreageTrend />}
      {activeTab === 'centers' && (
        <section className="user-admin-grid">
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="location" /></span><h2>Active Feasible Regions</h2></div>
              <p>{centers.length} center{centers.length === 1 ? '' : 's'} configured.</p></div></div>
            <div className="data-stack">
              {loading ? (
                <SkeletonRow count={3} />
              ) : (
                centers.map((center) => <div className="data-row" key={center.id}><div className="data-row__main"><span className="data-row__title">{center.name}</span>
                  <span className="data-row__meta">Radius: {center.radiusKm} km | {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}</span></div>
                  <div className="data-row__actions">
                    <button className="danger-btn" type="button" onClick={() => confirmDeleteCenter(center.id)}>Remove</button>
                  </div>
                </div>)
              )}
            </div>
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
      {activeTab === 'pilots' && <ManagePilots />}

      {/* {activeTab === "farmerRegistration" && (
        <section className="panel panel--raised">
          <div className="panel-header">
            <div className="panel-header__title">
              <div className="panel-title-row">
                <span className="panel-title-icon">
                  <OpsIcon name="user-plus" />
                </span>
                <h2>Customer Registration</h2>
              </div>
              <p>Register a new customer</p>
            </div>
          </div>

          <div className="panel-body">
            {farmerNotice && (
              <div
                style={{
                  marginBottom: "15px",
                  padding: "12px",
                  borderRadius: "8px",
                  backgroundColor:
                    farmerNotice.type === "success"
                      ? "#d4edda"
                      : "#f8d7da",
                  color:
                    farmerNotice.type === "success"
                      ? "#155724"
                      : "#721c24",
                  fontWeight: "600",
                  textAlign: "center"
                }}
              >
                {farmerNotice.message}
              </div>
            )}
            <form onSubmit={handleFarmerRegistration} className="form-stack">
              <div className="row-group">
                <div className="input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter full name"
                    value={farmerData.name}
                    onChange={(e) => {
                      const value = e.target.value;

                      // Allow only letters and spaces
                      if (/^[A-Za-z\s]*$/.test(value)) {
                        setFarmerData({
                          ...farmerData,
                          name: value,
                        });
                      }
                    }}
                    required
                  />
                </div>

                <div className="input-group">
                  <label>Mobile Number</label>
                  <input
                    type="tel"
                    placeholder="Enter mobile number"
                    value={farmerData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setFarmerData({ ...farmerData, phone: value });
                    }}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    required
                  />

                  {farmerData.phone && farmerData.phone.length !== 10 && (
                    <small className="error-text">
                      Mobile number must be exactly 10 digits.
                    </small>
                  )}
                </div>
              </div>

              <div className="row-group">

                <div className="input-group">
                  <label>Village / Town</label>
                  <input
                    type="text"
                    placeholder="Enter village or town"
                    value={farmerData.village}
                    onChange={(e) =>
                      setFarmerData({ ...farmerData, village: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="input-group">
                  <label>District</label>
                  <input
                    type="text"
                    placeholder="Enter district"
                    value={farmerData.district}
                    onChange={(e) =>
                      setFarmerData({ ...farmerData, district: e.target.value })
                    }
                    required
                  />
                </div>

              </div>

              <div className="row-group">
                <div className="input-group">
                  <label>State</label>
                  <input
                    type="text"
                    placeholder="Enter state"
                    value={farmerData.state}
                    onChange={(e) =>
                      setFarmerData({ ...farmerData, state: e.target.value })
                    }
                    required
                  />
                </div>

              </div>
              <div className="form-actions">
                <button type="submit" className="submit-btn">
                  Register Customer
                </button>
              </div>

            </form>
          </div>
          {confirmModal && (
            <div
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: "10px",
                  padding: "24px",
                  maxWidth: "400px",
                  width: "90%",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
                }}
              >
                <h3 style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600 }}>
                  Confirm Registration
                </h3>
                <p style={{ margin: "0 0 20px", color: "#444", fontSize: "14px", lineHeight: 1.5 }}>
                  {confirmModal.message}
                </p>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                  <button
                    onClick={() => setConfirmModal(null)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "1px solid #ccc",
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmModal.onConfirm}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      border: "none",
                      background: "#2f6feb",
                      color: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )} */}

      {activeTab === "farmerRegistration" && (
        <CustomerRegistration
          API={API}
          user={user}
          confirmModal={confirmModal}
          setConfirmModal={setConfirmModal}
        />
      )}

      {activeTab === "registeredFarmers" && (
        <RegisteredFarmers />
      )}
      {passwordTarget && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="password-dialog-title"><div className="modal-card__header"><div><p className="eyebrow">Credential reset</p><h2 id="password-dialog-title">Reset {passwordTarget.name}’s password</h2></div><button className="icon-button" type="button" aria-label="Close password reset" onClick={() => setPasswordTarget(null)}>×</button></div><form className="form-stack" onSubmit={submitPasswordReset}><div className="input-group"><label htmlFor="replacement-password">New temporary password</label><input id="replacement-password" type="password" value={replacementPassword} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /><span className="field-hint">The application stores only a bcrypt hash.</span></div><div className="button-row button-row--end"><button type="button" className="action-btn" onClick={() => setPasswordTarget(null)}>Cancel</button><button type="submit" className="submit-btn">Update password</button></div></form></section></div>}

      {deleteTarget && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div className="modal-card__header"><div><p className="eyebrow">Confirm permanent deletion</p><h2 id="delete-dialog-title">Delete {deleteTarget.name}?</h2></div></div><p className="muted">This account can be deleted only when it is not linked to protected operational records. Otherwise, deactivate its login instead.</p>{deleteError && <div className="notice notice--error" role="alert">{deleteError}</div>}<div className="button-row button-row--end"><button type="button" className="action-btn" onClick={() => { setDeleteTarget(null); setDeleteError(''); }}>Cancel</button><button type="button" className="danger-btn" onClick={() => void confirmDeleteUser()}>Delete permanently</button></div></section></div>}
    </OperationsShell>

  );
}

export default AdminDashboard;
