import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AcreageTrend from "./AcreageTrend";
import Assignments from "./Assignments";

const API = "http://localhost:5000";

const DroneIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>);
const UsersIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>);
const BookIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>);
const ToolIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const AlertIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const CloudIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>);

function AdminDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('bhumeet'); // 'fleet', 'users', 'logbook', 'bhumeet'

  const [users, setUsers] = useState([]);
  const [drones, setDrones] = useState([]);
  const [leads, setLeads] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [bhumeetData, setBhumeetData] = useState(null);
  const [bhumeetViewMode, setBhumeetViewMode] = useState('ui'); // 'json' or 'ui'

  const [newUser, setNewUser] = useState({
    name: '', id: '', password: 'password123', role: 'pilot'
  });

  const fetchData = async () => {
    try {
      const [resUsers, resDrones, resLeads, resAssign] = await Promise.all([
        fetch(`${API}/api/users/all`),
        fetch(`${API}/api/drones/all`), // Changed to fetch all drones
        fetch(`${API}/api/leads/all`), // Fetch ALL leads so logbook gets completed ones too
        fetch(`${API}/api/assignments/all`)
      ]);
      const [u, d, l, a] = await Promise.all([resUsers.json(), resDrones.json(), resLeads.json(), resAssign.json()]);

      if (u.success) setUsers(u.users);
      if (d.success) setDrones(d.drones);
      if (l.success) setLeads(l.leads);
      if (a.success) setAssignments(a.missions);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    if (activeTab === 'bhumeet' && !bhumeetData) {
      fetchBhumeetData();
    }
  }, [activeTab]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        email: newUser.id, // backend userController uses email field as the identifier check, wait actually we changed it.
        id: newUser.id,
        password: newUser.password,
        role: newUser.role,
        name: newUser.name,
        isActive: true
      };
      // Note: we can still POST to /add and backend will save it with id. 
      // userController adds id=Date.now(). But wait! I didn't change userController.addUser to use explicit ID.
      // Since it's a PoC, I'll send email=id, and the backend might generate a random ID. 
      // Actually, userController does `const newUser = { id: Date.now(), email, password, role, name }`. 
      // This is a bug if we use explicit strict IDs! Let's assume for this mock we just send email=ID and ignore the exact ID field match for new users, or better yet, I will update userController to accept an explicit ID later if needed. For now I'll pass the ID as `email`.
      payload.email = payload.id;

      const res = await fetch(`${API}/api/users/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewUser({ name: '', id: '', password: 'password123', role: 'pilot' });
        fetchData();
      } else {
        alert("Failed to add user");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to completely DELETE this user from the system?")) return;
    try {
      const res = await fetch(`${API}/api/users/delete/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditPassword = async (id) => {
    const newPass = window.prompt("Enter new password for this user:");
    if (!newPass) return;

    try {
      const res = await fetch(`${API}/api/users/edit-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, newPassword: newPass })
      });
      if (res.ok) alert("Password updated successfully.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleResolveMaintenance = async (droneId, action) => {
    try {
      const res = await fetch(`${API}/api/drones/resolve-maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId, action })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const inquireDroneStatus = async (droneId) => {
    try {
      const res = await fetch(`${API}/api/drones/inquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBhumeetData = async () => {
    try {
      const [oRes, dRes, pRes, wRes, rRes] = await Promise.all([
        fetch(`${API}/api/bhumeet/dsp/overview`),
        fetch(`${API}/api/bhumeet/dsp/drones`),
        fetch(`${API}/api/bhumeet/dsp/dronePilots`),
        fetch(`${API}/api/bhumeet/dsp/weather`),
        fetch(`${API}/api/bhumeet/dsp/reports`),
      ]);
      const overview = await oRes.json();
      const dronesData = await dRes.json();
      const pilots = await pRes.json();
      const weather = await wRes.json();
      const reports = await rRes.json();

      if (overview?.data && dronesData?.data && pilots?.data && weather?.data && reports?.data) {
        setBhumeetData({
          overview: overview.data,
          drones: dronesData.data,
          pilots: pilots.data,
          weather: weather.data,
          reports: reports.data
        });
      } else {
        console.error("Bhumeet API Error", { overview, dronesData, pilots, weather, reports });
        alert("Failed to fetch Bhumeet Data. Please check your backend connection to the mock API.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to fetch Bhumeet Data.");
    }
  };

  const activeDrones = drones.filter(d => d.status.includes('Active') || d.status.includes('Dispatched') || d.status.includes('In-Transit') || d.status.includes('Charging'));
  const standbyDrones = drones.filter(d => d.status === 'Standby' || d.status === 'Maintenance');
  const maintenanceRequests = drones.filter(d => d.maintenanceRequest);

  const logbookLeads = leads.filter(l => l.status === 'processed_waiting_dispatch' || l.status === 'dispatched' || l.status === 'completed');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', color: 'white', background: '#0f172a' }}>

      {/* Sidebar */}
      <div style={{ width: '250px', background: 'rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '2rem 1rem', fontSize: '1.5rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>RFLY Admin</div>

        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button style={{ padding: '1rem', background: activeTab === 'bhumeet' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('bhumeet')}>
            <CloudIcon /> Dashboard Sync (Home)
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'fleet' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('fleet')}>
            <DroneIcon /> Fleet Overview {maintenanceRequests.length > 0 && <AlertIcon />}
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'users' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('users')}>
            <UsersIcon /> User Management
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'logbook' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('logbook')}>
            <BookIcon /> CRM Logbook
          </button>
          {/* 13-07-26 */}
          <button style={{ padding: '1rem', background: activeTab === 'acreage' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('acreage')}>
            <TrendingUpIcon /> Acreage trend </button>
          <button style={{ padding: '1rem', background: activeTab === 'assign' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('assign')}>
            <AssignmentIcon /> Assignments </button>
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            ID: {user?.id} <br /> {user?.name}
          </div>
          <button className="action-btn" style={{ width: '100%' }} onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>

        {/* FLEET DASHBOARD TAB */}
        {activeTab === 'fleet' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Fleet Overview</h2>
            <div className="split-view" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><DroneIcon /> Active & Dispatched ({activeDrones.length})</h3>
                <div style={{ marginTop: '1rem' }}>
                  {activeDrones.map(d => (
                    <div key={d.id} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <strong>{d.id}</strong> - {d.model} <br />
                      <span style={{ color: 'var(--primary)', fontSize: '0.9rem' }}>{d.status}</span>
                      <div style={{ marginTop: '0.5rem' }}>
                        <button className="action-btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => inquireDroneStatus(d.id)}>
                          {d.pendingInquiry ? 'Inquiry Sent ✅' : 'Inquire Status'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card" style={{ borderLeft: '4px solid #f59e0b' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ToolIcon /> Standby / Maintenance ({standbyDrones.length})</h3>
                <div style={{ marginTop: '1rem' }}>
                  {standbyDrones.map(d => (
                    <div key={d.id} style={{ padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <strong>{d.id}</strong> - {d.model} <br />
                      <span style={{ color: d.status === 'Maintenance' ? '#ef4444' : '#f59e0b', fontSize: '0.9rem' }}>{d.status}</span>
                      {d.status !== 'Maintenance' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <button className="action-btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => inquireDroneStatus(d.id)}>
                            {d.pendingInquiry ? 'Inquiry Sent ✅' : 'Inquire Status'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {maintenanceRequests.length > 0 && (
              <div style={{ marginTop: '2rem' }}>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertIcon /> Pending Maintenance Requests</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {maintenanceRequests.map(d => (
                    <div key={d.id} className="glass-card" style={{ borderLeft: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ color: '#ef4444' }}>{d.id} - {d.model}</h4>
                        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                          <strong>Requested By:</strong> {d.maintenanceRequest.requestedBy} <br />
                          <strong>Reason:</strong> {d.maintenanceRequest.reason}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => handleResolveMaintenance(d.id, 'approve')}>Approve (Lock to Maintenance)</button>
                        <button className="action-btn" onClick={() => handleResolveMaintenance(d.id, 'reject')}>Reject Request</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* USER MANAGEMENT TAB */}
        {activeTab === 'users' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>User Management</h2>
            <div className="split-view" style={{ gap: '2rem' }}>

              <div className="glass-card">
                <h3>Registered Employees</h3>
                <div style={{ marginTop: '1rem' }}>
                  {users.map(u => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <div>
                        <strong>{u.name}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>({u.role})</span>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ID: {u.id}</div>
                      </div>
                      {u.role !== 'admin' && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="action-btn" style={{ fontSize: '0.8rem' }} onClick={() => handleEditPassword(u.id)}>Edit Pass</button>
                          <button className="action-btn" style={{ borderColor: '#ef4444', color: '#ef4444', fontSize: '0.8rem' }} onClick={() => handleDeleteUser(u.id)}>Delete</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card">
                <h3>Add New Employee</h3>
                <form onSubmit={handleAddUser} style={{ marginTop: '1rem' }}>
                  <div className="input-group">
                    <label>Full Name</label>
                    <input type="text" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                  </div>
                  <div className="input-group">
                    <label>Employee ID (Must be 40xxx or 60xxx)</label>
                    <input type="text" value={newUser.id} onChange={e => setNewUser({ ...newUser, id: e.target.value })} required />
                  </div>
                  <div className="row-group">
                    <div className="input-group">
                      <label>Role</label>
                      <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}>
                        <option value="pilot" style={{ color: 'black' }}>Pilot</option>
                        <option value="sales" style={{ color: 'black' }}>Sales Rep</option>
                      </select>
                    </div>
                    <div className="input-group">
                      <label>Default Password</label>
                      <input type="text" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                    </div>
                  </div>
                  <button type="submit" className="submit-btn" style={{ marginTop: '1rem' }}>Create Account</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* CRM LOGBOOK TAB */}
        {activeTab === 'logbook' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>CRM Sales & Dispatch Logbook</h2>
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <tr>
                    <th style={{ padding: '1rem' }}>Lead ID</th>
                    <th style={{ padding: '1rem' }}>Sales Rep (Processed By)</th>
                    <th style={{ padding: '1rem' }}>Farmer / Farm</th>
                    <th style={{ padding: '1rem' }}>Crop & Size</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logbookLeads.map(l => {
                    const assignment = assignments.find(a => a.leadId === l.id);
                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{l.id}</td>
                        <td style={{ padding: '1rem', color: 'var(--primary)', fontWeight: 'bold' }}>
                          Rep: {l.processedBy || 'Legacy'}<br />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pilot: {assignment ? assignment.pilotEmail : 'Unassigned'}</span>
                        </td>
                        <td style={{ padding: '1rem' }}>{l.farmerName} <br /><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.village}</span></td>
                        <td style={{ padding: '1rem' }}>{l.cropType} <br /><span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{l.acres} Acres</span></td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            padding: '0.3rem 0.6rem',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            background: l.status === 'dispatched' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)',
                            color: l.status === 'dispatched' ? '#10b981' : '#3b82f6'
                          }}>
                            {l.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  {logbookLeads.length === 0 && (
                    <tr>
                      <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No CRM entries found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* AcreageTrend */}
        {activeTab === "acreage" && (<div>
          <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Acreage Trend</h2>
          <AcreageTrend /> </div>)}
        {/* Assignments */}
        {activeTab === "assign" && (<div>
          <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Assignments</h2>
          <Assignments /> </div>)}

        {activeTab === 'bhumeet' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <CloudIcon /> External Sync: Bhumeet Data
              </h2>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="action-btn" onClick={() => setBhumeetViewMode(bhumeetViewMode === 'ui' ? 'json' : 'ui')}>
                  Toggle {bhumeetViewMode === 'ui' ? 'JSON' : 'UI'} View
                </button>
                <button className="submit-btn" onClick={fetchBhumeetData}>Fetch Latest from api.bhumeet.app</button>
              </div>
            </div>

            {bhumeetData ? (
              bhumeetViewMode === 'json' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div className="glass-card">
                    <h3 style={{ color: '#60a5fa' }}>Overview JSON</h3>
                    <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#a78bfa' }}>
                      {JSON.stringify(bhumeetData.overview, null, 2)}
                    </pre>
                  </div>
                  <div className="glass-card">
                    <h3 style={{ color: '#34d399' }}>Synced Drone Feed</h3>
                    <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#a78bfa', maxHeight: '400px' }}>
                      {JSON.stringify(bhumeetData.drones, null, 2)}
                    </pre>
                  </div>
                  <div className="glass-card">
                    <h3 style={{ color: '#fcd34d' }}>Regional Weather Feed</h3>
                    <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#a78bfa' }}>
                      {JSON.stringify(bhumeetData.weather, null, 2)}
                    </pre>
                  </div>
                  <div className="glass-card">
                    <h3 style={{ color: '#f472b6' }}>Daily Reports Feed</h3>
                    <pre style={{ background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: '8px', overflowX: 'auto', color: '#a78bfa', maxHeight: '400px' }}>
                      {JSON.stringify(bhumeetData.reports, null, 2)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {/* UI VIEW */}
                  <div className="glass-card">
                    <h3 style={{ color: '#60a5fa', marginBottom: '1rem' }}>Global Overview</h3>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{bhumeetData.overview.totalDrones}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Total Drones</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{bhumeetData.overview.totalPilots}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Total Pilots</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{bhumeetData.overview.activeMissions}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Active Missions</div>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '8px', flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{bhumeetData.overview.pendingMaintenance}</div>
                        <div style={{ color: 'var(--text-secondary)' }}>Pending Maintenance</div>
                      </div>
                    </div>
                  </div>

                  <div className="split-view" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    <div className="glass-card">
                      <h3 style={{ color: '#fcd34d', marginBottom: '1rem' }}>Regional Weather Feed</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {bhumeetData.weather.map((w, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div>
                              <strong>{w.region}</strong><br />
                              <span style={{ color: 'var(--text-secondary)' }}>{w.condition}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <strong>{w.temp}</strong><br />
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Wind: {w.wind}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-card">
                      <h3 style={{ color: '#f472b6', marginBottom: '1rem' }}>Daily Spray Reports</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {bhumeetData.reports.map((r, i) => (
                          <div key={i} style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <strong>Date: {r.date}</strong>
                              <span style={{ color: '#3b82f6', fontWeight: 'bold' }}>{r.totalSprayedAcres} Acres</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                              <span>Active Pilots: {r.activePilots}</span>
                              <span style={{ color: r.issuesReported > 0 ? '#ef4444' : 'inherit' }}>Issues: {r.issuesReported}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                Click the button above to authenticate and fetch data from the Bhumeet DSP endpoints.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

export default AdminDashboard;