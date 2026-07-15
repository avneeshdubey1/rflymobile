import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { io } from "socket.io-client";

const API = "http://localhost:5000";

const SendIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>);
const DroneIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>);
const AlertIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>);
const UserIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>);
const ClipboardIcon = () => (<svg className="svg-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>);
function MarketingDashboard() {
  const { user, logout } = useAuth();
  
  const [activeTab, setActiveTab] = useState('process'); // 'process', 'manual', 'complaints'
  
  // Data State
  const [leads, setLeads] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [drones, setDrones] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Manual Lead State
  const [manualLead, setManualLead] = useState({
    farmerName: '', phone: '', village: '', cropType: '', acres: ''
  });
  const [manualStatus, setManualStatus] = useState('');

  // Old workflow state for processing step 1
  const [selectedLead, setSelectedLead] = useState(null);
  const [extraDetails, setExtraDetails] = useState({
    mandal: '', district: '', fertilizerShop: '', expectedSpraying: '', 
    expectedDate: '',
  expectedTime: '',
    soilType: '', pesticideBrand: '', cropAge: '' // New detailed fields
  });
  const [processStatus, setProcessStatus] = useState('');
  
  // Toast
  const [showToast, setShowToast] = useState(false);

  const fetchData = async () => {
    try {
      const [resLeads, resPilots, resDrones, resAssign] = await Promise.all([
        fetch(`${API}/api/leads/pending`),
        fetch(`${API}/api/users/pilots`),
        fetch(`${API}/api/drones/active`),
        fetch(`${API}/api/assignments/all`)
      ]);
      
      const [l, p, d, a] = await Promise.all([resLeads.json(), resPilots.json(), resDrones.json(), resAssign.json()]);
      
      if (l.success) setLeads(l.leads);
      if (p.success) setPilots(p.pilots);
      if (d.success) setDrones(d.drones);
      if (a.success) {
        setAssignments(a.missions);
        // Check for new complaints for Toast
        const hasComplaints = a.missions.some(m => m.status === 'issue_reported');
        if (hasComplaints && activeTab !== 'complaints') {
          setShowToast("A pilot reported an issue!");
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Realtime polling every 5s

    // Socket.io for instant reschedule notifications
    const socket = io(API);
    socket.on("assignment_rescheduled", (mission) => {
        setShowToast(`Assignment rescheduled for ${mission.farmerName}. New time: ${mission.expectedSpraying}. Please inform customer.`);
    });

    return () => {
        clearInterval(interval);
        socket.disconnect();
    };
  }, [activeTab]);

  // -- STEP 1: Processing the Lead to Google Form --
  const handleProcess = async (e) => {
    e.preventDefault();
    setProcessStatus('processing');
    try {
      const res = await fetch(`${API}/api/leads/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: selectedLead.id, 
          employeeId: user.id, // Strictly use logged in Employee ID
          ...extraDetails 
        })
      });
      if (res.ok) {
        setProcessStatus('success');
        setSelectedLead(null);
        setExtraDetails({ mandal: '', district: '', fertilizerShop: '', expectedSpraying: '', expectedDate: '',
  expectedTime: '',soilType: '', pesticideBrand: '', cropAge: '' });
        fetchData();
      } else setProcessStatus('error');
    } catch (err) {
      setProcessStatus('error');
    }
  };

  // -- STEP 2: Manual Lead Entry --
  const handleManualLeadSubmit = async (e) => {
    e.preventDefault();
    setManualStatus('processing');
    try {
      const res = await fetch(`${API}/api/leads/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualLead)
      });
      if (res.ok) {
        setManualStatus('success');
        setManualLead({ farmerName: '', phone: '', village: '', cropType: '', acres: '' });
        fetchData(); // Refresh pending leads
        setTimeout(() => setManualStatus(''), 3000);
      } else {
        setManualStatus('error');
      }
    } catch (err) {
      setManualStatus('error');
    }
  };

  const handleResolve = async (id) => {
    try {
      const res = await fetch(`${API}/api/assignments/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Segregate leads
  const newLeads = leads.filter(l => l.status === 'pending');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', color: 'white', background: '#0f172a' }}>
      
      {/* Toast Notification */}
      {showToast && (
        <div style={{ position: 'fixed', top: '20px', right: '20px', background: typeof showToast === 'string' && showToast.includes('rescheduled') ? 'var(--primary)' : '#ef4444', padding: '1rem', borderRadius: '8px', zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', border: '1px solid white', cursor: 'pointer' }} onClick={() => { if(typeof showToast === 'string' && showToast.includes('rescheduled')) setShowToast(false); else setActiveTab('complaints'); }}>
          <strong>{typeof showToast === 'string' && showToast.includes('rescheduled') ? '📅 SCHEDULE UPDATED' : '⚠️ PILOT COMPLAINT RAISED'}</strong><br/>
          {typeof showToast === 'string' ? showToast : 'Click here to navigate to Complaints Tab.'}
        </div>
      )}

      {/* Sidebar */}
      <div style={{ width: '250px', background: 'rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '2rem 1rem', fontSize: '1.5rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>RFLY Sales</div>
        
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button style={{ padding: '1rem', background: activeTab === 'process' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('process')}>
            <ClipboardIcon/> Process Leads
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'manual' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('manual')}>
            <UserIcon/> Enter New Lead
          </button>
          <button style={{ padding: '1rem', background: activeTab === 'complaints' ? 'var(--primary)' : 'transparent', border: 'none', color: 'white', textAlign: 'left', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => setActiveTab('complaints')}>
            <AlertIcon/> Complaints {showToast && <AlertIcon/>}
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
        
        {/* COMPLAINTS TAB */}
        {activeTab === 'complaints' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Pilot Complaints & Discrepancies</h2>
            {assignments.filter(a => a.status === 'issue_reported' || a.discrepancyFlag === 'High').length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active complaints. Everything is running smoothly!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {assignments.filter(a => a.status === 'issue_reported' || a.discrepancyFlag === 'High').map(alert => (
                  <div key={alert.id} className="glass-card" style={{ borderLeft: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ color: '#ef4444' }}>SYSTEM ALERT</h3>
                      <strong>Farmer:</strong> {alert.farmerName} | <strong>Pilot ID:</strong> {alert.pilotEmail}
                      <p style={{ marginTop: '0.5rem' }}>
                        {alert.status === 'issue_reported' 
                          ? `Complaint Filed: ${alert.issue}. System suggests swapping to: ${alert.suggestedSwap}` 
                          : `Cost Discrepancy! Pilot claimed ${alert.pilotEnteredAcres} acres, GPS logged ${alert.dcsLoggedAcres.toFixed(2)} acres (${alert.discrepancyPercent}% diff).`
                        }
                      </p>
                    </div>
                    <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => handleResolve(alert.id)}>Review & Resolve</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MANUAL LEAD ENTRY TAB */}
        {activeTab === 'manual' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>Enter Manual Lead</h2>
            <div className="glass-card" style={{ maxWidth: '600px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Enter a lead manually (same format as the homepage). It will appear in your Process Leads tab.</p>
              
              {manualStatus === 'success' && <div className="alert success" style={{ marginBottom: '1rem' }}>Lead created successfully! Check 'Process Leads'.</div>}
              {manualStatus === 'error' && <div className="alert error" style={{ marginBottom: '1rem' }}>Failed to create lead. Please try again.</div>}
              
              <form onSubmit={handleManualLeadSubmit}>
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                  <label>Farmer Name</label>
                  <input type="text" value={manualLead.farmerName} onChange={(e) => setManualLead({...manualLead, farmerName: e.target.value})} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                  <label>Phone Number</label>
                  <input type="tel" value={manualLead.phone} onChange={(e) => setManualLead({...manualLead, phone: e.target.value})} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
                <div className="input-group" style={{ marginBottom: '1rem' }}>
                  <label>Village / Location</label>
                  <input type="text" value={manualLead.village} onChange={(e) => setManualLead({...manualLead, village: e.target.value})} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
                <div className="row-group" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Crop Type</label>
                    <input type="text" value={manualLead.cropType} onChange={(e) => setManualLead({...manualLead, cropType: e.target.value})} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <div className="input-group" style={{ flex: 1 }}>
                    <label>Estimated Acres</label>
                    <input type="number" value={manualLead.acres} onChange={(e) => setManualLead({...manualLead, acres: e.target.value})} required style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                </div>
                <button type="submit" className="submit-btn" disabled={manualStatus === 'processing'} style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}>
                  {manualStatus === 'processing' ? 'Creating...' : 'Create Lead'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PROCESS LEADS TAB */}
        {activeTab === 'process' && (
          <div>
            <h2 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>New Incoming Requests</h2>
            <div className="split-view">
              <div className="leads-list">
                <h3>Pending Tasks</h3>
                {newLeads.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No pending leads.</p>
                ) : (
                  newLeads.map(lead => (
                    <div key={lead.id} className="glass-card lead-card" style={{ marginBottom: '1rem', cursor: 'pointer', borderColor: selectedLead?.id === lead.id ? 'var(--primary)' : 'var(--surface-border)' }} onClick={() => setSelectedLead(lead)}>
                      <h3>{lead.farmerName}</h3>
                      <p><strong>Location:</strong> {lead.village}</p>
                      <p><strong>Crop:</strong> {lead.cropType} ({lead.acres} Acres)</p>
                      <p><strong>Phone:</strong> {lead.phone}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="lead-details">
                {selectedLead ? (
                  <div className="glass-card">
                    <h2>Process Lead Details</h2>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Fill in the intricate field details. Once submitted, it moves to the Dispatch Board.</p>
                    
                    {processStatus === 'success' && <div className="alert success">Lead submitted! Ready for Dispatch.</div>}
                    
                    <form onSubmit={handleProcess}>
                      <div className="input-group">
                        <label>Handling Sales Rep (Locked)</label>
                        <input type="text" value={`Employee ID: ${user?.id} (${user?.name})`} disabled style={{ opacity: 0.7 }} />
                      </div>
                      
                      <div className="row-group">
                        <div className="input-group">
                          <label>Mandal</label>
                          <input type="text" value={extraDetails.mandal} onChange={(e) => setExtraDetails({...extraDetails, mandal: e.target.value})} required />
                        </div>
                        <div className="input-group">
                          <label>District</label>
                          <input type="text" value={extraDetails.district} onChange={(e) => setExtraDetails({...extraDetails, district: e.target.value})} required />
                        </div>
                      </div>

                      <div className="row-group">
                        <div className="input-group">
                          <label>Soil Type</label>
                          <input type="text" placeholder="e.g. Red, Black Cotton" value={extraDetails.soilType} onChange={(e) => setExtraDetails({...extraDetails, soilType: e.target.value})} required />
                        </div>
                        <div className="input-group">
                          <label>Crop Age (Weeks)</label>
                          <input type="text" placeholder="e.g. 12" value={extraDetails.cropAge} onChange={(e) => setExtraDetails({...extraDetails, cropAge: e.target.value})} required />
                        </div>
                      </div>

                      <div className="input-group">
                        <label>Fertilizer / Pesticide Brand</label>
                        <input type="text" placeholder="e.g. Bayer, Syngenta" value={extraDetails.pesticideBrand} onChange={(e) => setExtraDetails({...extraDetails, pesticideBrand: e.target.value})} required />
                      </div>

                      <div className="input-group">
                        <label>Expected Spraying Times / Acres</label>
                        <input type="text" value={extraDetails.expectedSpraying} onChange={(e) => setExtraDetails({...extraDetails, expectedSpraying: e.target.value})} required />
                      </div>

                      {/* 14-07-26 */}
                      <div className="row-group">

  <div className="input-group">
    <label>Expected Date</label>
    <input
      type="date"
      value={extraDetails.expectedDate}
      onChange={(e) =>
        setExtraDetails({
          ...extraDetails,
          expectedDate: e.target.value
        })
      }
      required
    />
  </div>

  <div className="input-group">
    <label>Expected Time</label>
    <input
      type="time"
      value={extraDetails.expectedTime}
      onChange={(e) =>
        setExtraDetails({
          ...extraDetails,
          expectedTime: e.target.value
        })
      }
      required
    />
  </div>

</div>
                      
                      <button type="submit" className="submit-btn" disabled={processStatus === 'processing'}>
                        {processStatus === 'processing' ? 'Submitting...' : 'Submit to Google & Move to Dispatch'}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="glass-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                    Select an incoming lead to process
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

export default MarketingDashboard;
