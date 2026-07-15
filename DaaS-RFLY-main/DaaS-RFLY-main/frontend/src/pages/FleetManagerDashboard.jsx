import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const API = "http://localhost:5000";

const SendIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>);
const DroneIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>);
const UserIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const ToolIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const HistoryIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const GraphIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>);

function FleetManagerDashboard() {
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState('dispatch'); // 'dispatch', 'history'
  
  // Data State
  const [leads, setLeads] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [drones, setDrones] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  // Dispatch State (maps lead.id to { pilots: [], drones: [] })
  const [stagedDispatch, setStagedDispatch] = useState({});
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [expandedLead, setExpandedLead] = useState(null);
  const [activeDrawer, setActiveDrawer] = useState(null); // 'pilot' | 'drone' | null

  const fetchData = async () => {
    try {
      const [resLeads, resPilots, resDrones, resAssign] = await Promise.all([
        fetch(`${API}/api/leads/pending`),
        fetch(`${API}/api/users/pilots`),
        fetch(`${API}/api/drones/all`),
        fetch(`${API}/api/assignments/all`)
      ]);
      
      const [l, p, d, a] = await Promise.all([resLeads.json(), resPilots.json(), resDrones.json(), resAssign.json()]);
      
      if (l.success) setLeads(l.leads);
      if (p.success) setPilots(p.pilots);
      if (d.success) setDrones(d.drones);
      if (a.success) setAssignments(a.missions);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); 
    return () => clearInterval(interval);
  }, [activeTab]);


  // -- Drag and Drop Logic --
  const onDragStart = (e, type, data) => {
    e.dataTransfer.setData("type", type);
    e.dataTransfer.setData("item", JSON.stringify(data));
  };

  const onDragOver = (e, targetLeadId) => {
    e.preventDefault();
    if (dragOverTarget !== targetLeadId) setDragOverTarget(targetLeadId);
  };

  const onDragLeave = () => {
    setDragOverTarget(null);
  };

  const onDropToLead = (e, targetLeadId) => {
    e.preventDefault();
    setDragOverTarget(null);
    const type = e.dataTransfer.getData("type");
    const itemData = JSON.parse(e.dataTransfer.getData("item"));
    
    setStagedDispatch(prev => {
      const existing = prev[targetLeadId] || { pilots: [], drones: [] };
      if (type === 'pilot' && !existing.pilots.find(p => p.id === itemData.id)) {
        return { ...prev, [targetLeadId]: { ...existing, pilots: [...existing.pilots, itemData] }};
      }
      if (type === 'drone' && !existing.drones.find(d => d.id === itemData.id)) {
        return { ...prev, [targetLeadId]: { ...existing, drones: [...existing.drones, itemData] }};
      }
      return prev;
    });
  };

  const removeAssignment = (leadId, type, itemId) => {
    setStagedDispatch(prev => {
      const existing = prev[leadId];
      if (!existing) return prev;
      if (type === 'pilot') {
        return { ...prev, [leadId]: { ...existing, pilots: existing.pilots.filter(p => p.id !== itemId) }};
      } else {
        return { ...prev, [leadId]: { ...existing, drones: existing.drones.filter(d => d.id !== itemId) }};
      }
    });
  };

  const dispatchMission = async (lead) => {
    const stage = stagedDispatch[lead.id];
    if (!stage || stage.pilots.length === 0 || stage.drones.length === 0) return;

    const pilot = stage.pilots[0];
    const drone = stage.drones[0];

    try {
      const res = await fetch(`${API}/api/assignments/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: lead,
          pilot: pilot,
          droneId: drone.id
        })
      });
      if (res.ok) {
        setStagedDispatch(prev => {
          const next = {...prev};
          delete next[lead.id];
          return next;
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resolveMaintenance = async (droneId) => {
    try {
      const res = await fetch(`${API}/api/drones/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ droneId, status: 'Standby' })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReschedule = async (id, newTime) => {
    try {
      const res = await fetch(`${API}/api/assignments/${id}/reschedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedSpraying: newTime })
      });
      if (res.ok) {
        fetchData(); // refresh to show updated times
      }
    } catch (err) {
      console.error(err);
    }
  };

  const dispatchableLeads = leads.filter(l => l.status === 'processed_waiting_dispatch');
  const activeAssignments = assignments.filter(a => a.status === 'in_progress');
  const activePilots = pilots.filter(p => p.isActive);
  const maintenanceDrones = drones.filter(d => d.status === 'Maintenance');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', color: 'white', background: '#0f172a' }}>
      
      {/* Sidebar */}
      <div style={{ width: '250px', background: 'rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '2rem 1rem', fontSize: '1.5rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Fleet Manager</div>
        
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button style={{ padding: '1rem', background: activeTab === 'dispatch' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.3s' }} onClick={() => setActiveTab('dispatch')}>
            <SendIcon/> Dispatch Fleet
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'gantt' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.3s' }} onClick={() => setActiveTab('gantt')}>
            <GraphIcon/> Gantt Schedule
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'history' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.3s' }} onClick={() => setActiveTab('history')}>
            <HistoryIcon/> History & Repairs
          </button>
        </div>

        <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            ID: {user?.id} <br/> {user?.name}
          </div>
          <button className="action-btn" style={{ width: '100%' }} onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        
        {/* DISPATCH TAB */}
        {activeTab === 'dispatch' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Fleet Dispatch Board</h2>
            
            {dispatchableLeads.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No pending leads available.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                {dispatchableLeads.map(lead => (
                  <div 
                    key={lead.id} 
                    className="glass-card" 
                    onClick={() => setExpandedLead(lead.id)}
                    style={{ 
                      cursor: 'pointer',
                      borderLeft: '4px solid var(--primary)', 
                      transition: '0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <h4>{lead.farmerName}</h4>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{lead.village} | {lead.cropType} ({lead.acres} Ac)</p>
                    
                    {stagedDispatch[lead.id] && (stagedDispatch[lead.id].pilots.length > 0 || stagedDispatch[lead.id].drones.length > 0) && (
                      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--primary)' }}>
                        Assignment in progress...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* EXPANDED LEAD MODAL */}
            {expandedLead && (
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                onClick={() => { setExpandedLead(null); setActiveDrawer(null); }}
              >
                
                {/* Modal Content */}
                <div 
                  className="glass-card" 
                  style={{ 
                    width: '90%', maxWidth: '1000px', height: '70vh', position: 'relative', display: 'flex', flexDirection: 'column', padding: '2rem',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    transform: activeDrawer ? 'translateY(-15vh)' : 'translateY(0)'
                  }}
                  onClick={(e) => { e.stopPropagation(); setActiveDrawer(null); }}
                >
                  <button 
                    onClick={() => { setExpandedLead(null); setActiveDrawer(null); }}
                    style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer' }}
                  >
                    ×
                  </button>

                  {(() => {
                    const lead = dispatchableLeads.find(l => l.id === expandedLead);
                    if (!lead) return null;
                    const stage = stagedDispatch[lead.id] || { pilots: [], drones: [] };
                    const isReady = stage.pilots.length > 0 && stage.drones.length > 0;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem', flexShrink: 0 }}>
                          <h2 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>{lead.farmerName} - Dispatch Setup</h2>
                          <p style={{ color: 'var(--text-secondary)' }}>{lead.village} | {lead.cropType} | {lead.acres} Acres</p>
                        </div>

                        {/* Two Halves Container */}
                        <div style={{ display: 'flex', flex: 1, borderTop: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                          
                          {/* LEFT HALF: PILOT */}
                          <div 
                            style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', borderRight: '2px dashed rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setActiveDrawer('pilot'); }}
                            onDragOver={(e) => onDragOver(e, lead.id)} 
                            onDragLeave={onDragLeave}
                            onDrop={(e) => {
                              const type = e.dataTransfer.getData("type");
                              if (type === 'pilot') { onDropToLead(e, lead.id); setActiveDrawer(null); }
                            }}
                          >
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <h3 style={{ textAlign: 'center', color: 'var(--text-secondary)' }}><UserIcon/> Assigned Pilot</h3>
                              
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {stage.pilots.length === 0 ? (
                                  <div style={{ color: 'rgba(255,255,255,0.3)', border: '2px dashed rgba(255,255,255,0.2)', padding: '2rem', borderRadius: '12px', width: '100%', textAlign: 'center' }}>
                                    Click or Drag Pilot Here
                                  </div>
                                ) : (
                                  stage.pilots.map(p => (
                                    <div key={p.id} className="glass-card" style={{ background: 'rgba(59, 130, 246, 0.2)', borderColor: 'var(--primary)', width: '100%', textAlign: 'center' }}>
                                      <h3>{p.name}</h3>
                                      <p>ID: {p.id}</p>
                                      <button onClick={(e) => { e.stopPropagation(); removeAssignment(lead.id, 'pilot', p.id); }} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.2rem 1rem', borderRadius: '4px', marginTop: '1rem', cursor: 'pointer' }}>Remove</button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          {/* RIGHT HALF: DRONE */}
                          <div 
                            style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); setActiveDrawer('drone'); }}
                            onDragOver={(e) => onDragOver(e, lead.id)} 
                            onDragLeave={onDragLeave}
                            onDrop={(e) => {
                              const type = e.dataTransfer.getData("type");
                              if (type === 'drone') { onDropToLead(e, lead.id); setActiveDrawer(null); }
                            }}
                          >
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                              <h3 style={{ textAlign: 'center', color: 'var(--text-secondary)' }}><DroneIcon/> Assigned Drone</h3>
                              
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {stage.drones.length === 0 ? (
                                  <div style={{ color: 'rgba(255,255,255,0.3)', border: '2px dashed rgba(255,255,255,0.2)', padding: '2rem', borderRadius: '12px', width: '100%', textAlign: 'center' }}>
                                    Click or Drag Drone Here
                                  </div>
                                ) : (
                                  stage.drones.map(d => (
                                    <div key={d.id} className="glass-card" style={{ background: 'rgba(34, 197, 94, 0.2)', borderColor: '#22c55e', width: '100%', textAlign: 'center' }}>
                                      <h3>{d.id}</h3>
                                      <p>{d.model}</p>
                                      <button onClick={(e) => { e.stopPropagation(); removeAssignment(lead.id, 'drone', d.id); }} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '0.2rem 1rem', borderRadius: '4px', marginTop: '1rem', cursor: 'pointer' }}>Remove</button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* DISPATCH ACTION */}
                        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                          <button 
                            className="submit-btn" 
                            disabled={!isReady}
                            style={{ padding: '1rem 3rem', fontSize: '1.2rem', opacity: isReady ? 1 : 0.5 }}
                            onClick={() => {
                              dispatchMission(lead);
                              setExpandedLead(null);
                              setActiveDrawer(null);
                            }}
                          >
                            CONFIRM DISPATCH FLEET
                          </button>
                        </div>

                      </div>
                    );
                  })()}
                </div>

                {/* BOTTOM DRAWER FOR PILOTS (ABSOLUTE TO SCREEN) */}
                <div 
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '35vh', background: 'rgba(15, 23, 42, 0.98)',
                    borderTop: '2px solid var(--primary)',
                    boxShadow: '0 -20px 50px rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(10px)',
                    transform: activeDrawer === 'pilot' ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex', alignItems: 'center', zIndex: 1100,
                    padding: '2rem', gap: '2rem', overflowX: 'auto'
                  }}
                >
                  <h2 style={{ flexShrink: 0, color: 'var(--text-primary)', marginLeft: '2rem' }}>Available<br/>Pilots</h2>
                  {activePilots.map(pilot => (
                    <div 
                      key={pilot.id} 
                      className="glass-card jiggle-hover" 
                      draggable 
                      onDragStart={(e) => onDragStart(e, 'pilot', pilot)}
                      style={{ cursor: 'grab', flexShrink: 0, width: '180px', height: '220px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.1)' }}
                    >
                      {/* Photo Placeholder */}
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        <UserIcon />
                      </div>
                      <div style={{ fontWeight: '600', textAlign: 'center', fontSize: '1.2rem' }}>{pilot.name}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>ID: {pilot.id}</div>
                    </div>
                  ))}
                  {activePilots.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)' }}>No standby pilots available.</p>}
                  
                  {/* Close button for drawer */}
                  <button onClick={() => setActiveDrawer(null)} style={{ position: 'absolute', top: '1rem', right: '2rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
                </div>

                {/* BOTTOM DRAWER FOR DRONES (ABSOLUTE TO SCREEN) */}
                <div 
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    height: '35vh', background: 'rgba(15, 23, 42, 0.98)',
                    borderTop: '2px solid #22c55e',
                    boxShadow: '0 -20px 50px rgba(0,0,0,0.8)',
                    backdropFilter: 'blur(10px)',
                    transform: activeDrawer === 'drone' ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex', alignItems: 'center', zIndex: 1100,
                    padding: '2rem', gap: '2rem', overflowX: 'auto'
                  }}
                >
                  <h2 style={{ flexShrink: 0, color: 'var(--text-primary)', marginLeft: '2rem' }}>Available<br/>Drones</h2>
                  {drones.filter(d => d.status === 'Standby').map(drone => (
                    <div 
                      key={drone.id} 
                      className="glass-card jiggle-hover" 
                      draggable 
                      onDragStart={(e) => onDragStart(e, 'drone', drone)}
                      style={{ cursor: 'grab', flexShrink: 0, width: '180px', height: '220px', padding: '1.5rem', border: '2px solid rgba(255,255,255,0.1)', borderLeft: '4px solid #22c55e', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {/* Photo Placeholder */}
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
                        <DroneIcon />
                      </div>
                      <div style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
                        {drone.id}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>{drone.model}</div>
                    </div>
                  ))}
                  {drones.filter(d => d.status === 'Standby').length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)' }}>No standby drones available.</p>}
                  
                  {/* Close button for drawer */}
                  <button onClick={() => setActiveDrawer(null)} style={{ position: 'absolute', top: '1rem', right: '2rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
                </div>

              </div>
            )}

            {/* Active Assignments Subsection */}
            <div style={{ marginTop: '3rem' }}>
                <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Active Pilot ↔ Drone Assignments</h3>
                {activeAssignments.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)' }}>No active assignments currently running.</p>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {activeAssignments.map(a => (
                            <div key={a.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid #10b981' }}>
                                <strong>Task:</strong> {a.farmerName} - {a.village}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                                        <UserIcon/> {a.pilotEmail}
                                    </div>
                                    <span style={{ color: 'var(--text-secondary)' }}>↔</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#22c55e' }}>
                                        <DroneIcon/> {a.droneId}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

          </div>
        )}

        {/* GANTT CHART TAB */}
        {activeTab === 'gantt' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Fleet Schedule (Gantt)</h2>
                
                <div className="glass-card" style={{ flex: 1, overflowX: 'auto', padding: '0', background: 'rgba(15, 23, 42, 0.6)' }}>
                    <div style={{ minWidth: '800px', padding: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '1rem', fontWeight: 'bold' }}>
                            <div>Drone / Task</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                                <span>Morning</span>
                                <span>Afternoon</span>
                                <span>Evening</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {assignments.filter(a => a.status === 'in_progress' || a.status === 'scheduled').map(a => (
                                <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '1rem', alignItems: 'center' }}>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{a.droneId}<br/><span style={{ color: 'white' }}>{a.farmerName}</span></div>
                                    <div style={{ background: 'rgba(255,255,255,0.05)', height: '40px', borderRadius: '8px', position: 'relative' }}>
                                        
                                        {/* Mock Timeline Block */}
                                        <div 
                                            style={{ 
                                                position: 'absolute', 
                                                left: '20%', 
                                                width: '40%', 
                                                height: '100%', 
                                                background: 'linear-gradient(90deg, var(--primary), #60a5fa)', 
                                                borderRadius: '8px', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                fontSize: '0.8rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                            }}
                                            onClick={() => {
                                                const newTime = window.prompt("Reschedule Timing (e.g. 'Tomorrow 10 AM')\nThis will notify the Sales Team.", a.expectedSpraying || '');
                                                if(newTime && newTime !== a.expectedSpraying) {
                                                    handleReschedule(a.id, newTime);
                                                }
                                            }}
                                        >
                                            {a.expectedSpraying || "Not Set"}
                                        </div>

                                    </div>
                                </div>
                            ))}
                            {assignments.filter(a => a.status === 'in_progress' || a.status === 'scheduled').length === 0 && (
                                <p style={{ color: 'var(--text-secondary)' }}>No scheduled tasks to display on timeline.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* HISTORY & REPAIRS TAB */}
        {activeTab === 'history' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Drone History & Maintenance</h2>
            
            <div className="split-view" style={{ gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
              
              {/* Repair Shop */}
              <div>
                <h3 style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ToolIcon/> Repair Shop
                </h3>
                {maintenanceDrones.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No drones currently require repairs.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {maintenanceDrones.map(drone => (
                      <div key={drone.id} className="glass-card" style={{ borderLeft: '4px solid #ef4444' }}>
                        <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><DroneIcon/> {drone.id}</h4>
                        <p style={{ color: '#ef4444', fontSize: '0.9rem', margin: '0.5rem 0' }}>Status: {drone.status}</p>
                        <button className="submit-btn" style={{ width: '100%', marginTop: '0.5rem', background: '#10b981' }} onClick={() => resolveMaintenance(drone.id)}>
                          Repairs Complete - Set Active
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mission History */}
              <div>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HistoryIcon/> Global Mission Log
                </h3>
                {assignments.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No missions found in the history.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '70vh', overflowY: 'auto' }}>
                    {assignments.map(mission => (
                      <div key={mission.id} className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4>Mission ID: {mission.id}</h4>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                            <strong>Pilot:</strong> {mission.pilotName} ({mission.pilotEmail}) <br/>
                            <strong>Drone:</strong> {mission.droneId} <br/>
                            <strong>Location:</strong> {mission.village} | <strong>Farmer:</strong> {mission.farmerName}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span className="badge" style={{ background: mission.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: mission.status === 'completed' ? '#10b981' : '#60a5fa' }}>
                            {mission.status.replace('_', ' ').toUpperCase()}
                          </span>
                          {mission.status === 'completed' && (
                            <p style={{ marginTop: '0.5rem', fontWeight: 'bold', color: '#10b981' }}>₹{mission.finalCost}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FleetManagerDashboard;
