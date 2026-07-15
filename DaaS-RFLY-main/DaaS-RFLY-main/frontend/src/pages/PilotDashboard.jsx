import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";


const API = "http://localhost:5000";

const DroneIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>);
const AlertIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const ToolIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const ClipboardIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>);


function PilotDashboard() {
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks', 'fleet'
  const [missions, setMissions] = useState([]);
  const [drones, setDrones] = useState([]);
  const [isActive, setIsActive] = useState(user?.isActive || true);
  
  const [acresData, setAcresData] = useState({});
  const [complaintForm, setComplaintForm] = useState(null); 
  const [complaintData, setComplaintData] = useState({ issueType: 'Battery Failure', description: '' });

  // Drone Maintenance Form
  const [maintenanceForm, setMaintenanceForm] = useState(null);
  const [maintenanceData, setMaintenanceData] = useState({ category: 'Hardware Damage', description: '' });

  const fetchPilotData = async () => {
    try {
      const [resMissions, resUsers, resDrones] = await Promise.all([
        fetch(`${API}/api/assignments/pilot?email=${user.id}`),
        fetch(`${API}/api/users/all`),
        fetch(`${API}/api/drones/all`)
      ]);
      const m = await resMissions.json();
      const u = await resUsers.json();
      const d = await resDrones.json();
      
      if (m.success) setMissions(m.missions);
      if (d.success) setDrones(d.drones);
      if (u.success) {
        const me = u.users.find(x => x.id === user.id);
        if (me) setIsActive(me.isActive);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPilotData();
    const interval = setInterval(fetchPilotData, 5000); 
    return () => clearInterval(interval);
  }, [user]);

  const toggleActiveStatus = async () => {
    try {
      const newStatus = !isActive;
      const res = await fetch(`${API}/api/users/toggle-active`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: user.id, isActive: newStatus })
      });
      if (res.ok) setIsActive(newStatus);
    } catch (err) {
      console.error(err);
    }
  };

  const submitComplaint = async (id) => {
    try {
      const issueString = `${complaintData.issueType} - ${complaintData.description}`;
      const res = await fetch(`${API}/api/assignments/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'issue_reported', issueType: issueString })
      });
      if (res.ok) {
        setComplaintForm(null);
        setComplaintData({ issueType: 'Battery Failure', description: '' });
        fetchPilotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const completeMission = async (id) => {
    const acres = acresData[id];
    if (!acres) return;
    try {
      const res = await fetch(`${API}/api/assignments/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enteredAcres: acres })
      });
      if (res.ok) fetchPilotData();
    } catch (err) {
      console.error(err);
    }
  };

  const submitMaintenance = async (droneId) => {
    try {
      const reason = `${maintenanceData.category} - ${maintenanceData.description}`;
      const res = await fetch(`${API}/api/drones/request-maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId, pilotId: user.id, reason })
      });
      if (res.ok) {
        setMaintenanceForm(null);
        setMaintenanceData({ category: 'Hardware Damage', description: '' });
        fetchPilotData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateDroneStatus = async (droneId, newStatus) => {
    if (newStatus === 'Standby') {
      if (!window.confirm("Are you sure you want to release this drone and set it to Standby? This means the drone is waiting for its next assignment.")) {
        return;
      }
    }
    try {
      const res = await fetch(`${API}/api/drones/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId, status: newStatus })
      });
      if (res.ok) fetchPilotData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', color: 'white', background: '#0f172a' }}>
      
      {/* Sidebar */}
      <div style={{ width: '250px', background: 'rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '2rem 1rem', fontSize: '1.5rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Pilot Operations</div>
        
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button style={{ padding: '1rem', background: activeTab === 'tasks' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('tasks')}>
            <ClipboardIcon/> Spraying Tasks
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'fleet' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('fleet')}>
            <ToolIcon/> Fleet Maintenance
          </button>
           
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.9rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>ID: {user?.id} <br/> {user?.name}</span>
          </div>
          <div style={{ background: isActive ? 'var(--primary)' : '#ef4444', padding: '0.5rem', textAlign: 'center', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '1rem' }} onClick={toggleActiveStatus}>
            {isActive ? 'STATUS: ACTIVE' : 'STATUS: INACTIVE'}
          </div>
          <button className="action-btn" style={{ width: '100%' }} onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        
        {activeTab === 'tasks' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>My Spraying Tasks</h2>
            
            {missions.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>You currently have no assigned missions. Ensure your status is ACTIVE to receive dispatches.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
                {missions.map(mission => (
                  <div key={mission.id} className="glass-card" style={{ borderLeft: mission.status === 'completed' ? '4px solid #10b981' : '4px solid var(--primary)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h3>{mission.farmerName} - {mission.cropType}</h3>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                          <strong>Location:</strong> {mission.village}<br/>
                          <strong>Estimated Acres:</strong> {mission.acres}<br/>
                          <strong>Drone Assigned:</strong> {mission.droneId}
                        </p>
                      </div>
                    </div>

                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
                      <p style={{ marginBottom: '1rem' }}><strong>Status:</strong> <span style={{ textTransform: 'capitalize', color: 'var(--primary)' }}>{mission.status.replace('_', ' ')}</span></p>
                      
                      {mission.status === 'in_progress' && (
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          <input 
                            type="number" 
                            placeholder="Enter Final Acres Sprayed" 
                            style={{ padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--surface-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white', flex: 1, minWidth: '200px' }}
                            value={acresData[mission.id] || ''}
                            onChange={(e) => setAcresData({...acresData, [mission.id]: e.target.value})}
                          />
                          <button className="submit-btn" style={{ flex: 1, minWidth: '150px' }} onClick={() => completeMission(mission.id)}>Complete</button>
                          <button className="action-btn" style={{ flex: 1, minWidth: '150px', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => setComplaintForm(mission.id)}>Report Issue</button>
                        </div>
                      )}

                      {/* Complaints Form */}
                      {complaintForm === mission.id && (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px' }}>
                          <h4 style={{ color: '#ef4444', marginBottom: '1rem' }}>Submit Field Complaint</h4>
                          <div className="input-group">
                            <label>Issue Type</label>
                            <select 
                              value={complaintData.issueType} 
                              onChange={(e) => setComplaintData({...complaintData, issueType: e.target.value})}
                              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #ef4444' }}
                            >
                              <option>Battery Failure</option>
                              <option>Motor / Hardware Damage</option>
                              <option>Software / Signal Loss</option>
                              <option>Weather Interference</option>
                              <option>Other</option>
                            </select>
                          </div>
                          <div className="input-group" style={{ marginTop: '1rem' }}>
                            <label>Detailed Description</label>
                            <textarea 
                              rows="3" 
                              value={complaintData.description} 
                              onChange={(e) => setComplaintData({...complaintData, description: e.target.value})}
                              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #ef4444' }}
                              placeholder="Describe what happened..."
                            ></textarea>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => submitComplaint(mission.id)}>Submit Complaint</button>
                            <button className="action-btn" onClick={() => setComplaintForm(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                      
                      {mission.status === 'completed' && (
                        <div style={{ marginTop: '1rem' }}>
                          <p><strong>Pilot Claimed Acres:</strong> {mission.pilotEnteredAcres}</p>
                          {mission.discrepancyFlag !== 'None' && <p><strong>GPS Logged Acres:</strong> {mission.dcsLoggedAcres.toFixed(2)}</p>}
                          {mission.discrepancyFlag === 'High' && (
                            <p style={{ color: '#ef4444', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid #ef4444', borderRadius: '4px' }}>
                              High Discrepancy Flagged ({mission.discrepancyPercent}% difference). Under Admin Review.
                            </p>
                          )}
                          {mission.discrepancyFlag === 'Resolved' && (
                            <p style={{ color: '#10b981', marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(16,185,129,0.1)', border: '1px solid #10b981', borderRadius: '4px' }}>
                              Discrepancy Resolved by Admin. Cost Finalized: ₹{mission.finalCost}
                            </p>
                          )}
                          {mission.discrepancyFlag === 'Low' && (
                            <p style={{ color: '#10b981', marginTop: '0.5rem' }}>Auto-Approved. Final Cost: ₹{mission.finalCost}</p>
                          )}
                          {mission.discrepancyFlag === 'None' && (
                            <p style={{ color: '#10b981', marginTop: '0.5rem' }}>Job Done! Match Verified. Final Cost: ₹{mission.finalCost}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'fleet' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Fleet Maintenance & Status</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {(user.id === '60001' ? drones : drones.filter(d => missions.some(m => m.droneId === d.id && m.status !== 'completed'))).map(drone => (
                <div key={drone.id} className="glass-card" style={{ borderLeft: drone.status === 'Active' ? '4px solid #10b981' : (drone.status === 'Maintenance' ? '4px solid #ef4444' : '4px solid #f59e0b') }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><DroneIcon/> {drone.id}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{drone.model} | <span style={{ color: drone.status === 'Maintenance' ? '#ef4444' : 'white' }}>{drone.status.includes('Dispatched') ? 'Dispatched' : drone.status}</span></p>
                    </div>
                  </div>

                  {/* Drone Status Buttons */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {['Active', 'Standby', 'In-Transit', 'Charging'].map(st => (
                      <button
                        key={st}
                        disabled={drone.status === 'Maintenance'}
                        onClick={() => updateDroneStatus(drone.id, st)}
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.8rem',
                          borderRadius: '20px',
                          border: drone.status === st ? 'none' : '1px solid rgba(255,255,255,0.3)',
                          background: drone.status === st ? 'var(--primary)' : 'transparent',
                          color: 'white',
                          cursor: drone.status === 'Maintenance' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {st === 'Standby' ? 'Release Drone' : st}
                      </button>
                    ))}
                  </div>
                  
                  {drone.pendingInquiry && (
                    <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '4px' }}>
                      <h5 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertIcon/> Admin Status Inquiry</h5>
                      <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>{drone.pendingInquiry.message}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Please update the drone's status using the dropdown above to clear this alert.</p>
                    </div>
                  )}

                  {drone.maintenanceRequest ? (
                    <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderRadius: '4px', fontSize: '0.9rem' }}>
                      Maintenance Requested. Awaiting Admin Approval.
                    </div>
                  ) : (
                    <>
                      {maintenanceForm === drone.id ? (
                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px' }}>
                          <h4 style={{ color: '#ef4444', marginBottom: '1rem' }}>Request Maintenance</h4>
                          <div className="input-group">
                            <label>Issue Category</label>
                            <select 
                              value={maintenanceData.category} 
                              onChange={(e) => setMaintenanceData({...maintenanceData, category: e.target.value})}
                              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #ef4444' }}
                            >
                              <option>Hardware Damage</option>
                              <option>Motor / Propeller</option>
                              <option>Battery Issue</option>
                              <option>Software / Calibration</option>
                              <option>Other</option>
                            </select>
                          </div>
                          <div className="input-group" style={{ marginTop: '1rem' }}>
                            <label>Brief Description</label>
                            <textarea 
                              rows="2" 
                              value={maintenanceData.description} 
                              onChange={(e) => setMaintenanceData({...maintenanceData, description: e.target.value})}
                              style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid #ef4444' }}
                              placeholder="Describe the issue..."
                            ></textarea>
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => submitMaintenance(drone.id)}>Submit Request</button>
                            <button className="action-btn" onClick={() => setMaintenanceForm(null)}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button className="action-btn" style={{ width: '100%', marginTop: '1rem', borderColor: '#ef4444', color: '#ef4444' }} onClick={() => setMaintenanceForm(drone.id)}>
                          Flag Not Flight Worthy
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
      
      </div>
    </div>
  );
}

export default PilotDashboard;
