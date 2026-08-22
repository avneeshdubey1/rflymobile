import { useCallback, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import PendingPaymentsPanel from '../components/PendingPaymentsPanel';
import LogbookTimelinePanel from '../components/LogbookTimelinePanel';
import LocationLink from '../components/LocationLink';
import { API_URL as API } from '../config';
import { extractCoordinates } from '../utils/locationPresentation';
import RegisteredFarmers from "../components/RegisteredFarmers";
import FarmDetails from '../components/FarmDetails';
import '../style/profile.css';
import AdminProfile from '../components/AdminProfile';
import CustomerRegistration from '../components/CustomerRegistration';
import { useTranslation } from 'react-i18next';

function MarketingDashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('farmerRegistration');
  const [leads, setLeads] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [appealFees, setAppealFees] = useState({});
  const [appealStatus, setAppealStatus] = useState('');
  const [dataError, setDataError] = useState('');
  const [manualLead, setManualLead] = useState({ farmerName: '', phone: '', village: '', cropType: '', acres: '' });
  const [manualStatus, setManualStatus] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [extraDetails, setExtraDetails] = useState({ mandal: '', district: '', fertilizerShop: '', expectedSpraying: '', soilType: '', pesticideBrand: '', cropAge: '' });
  const [processStatus, setProcessStatus] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [schedulingMode, setSchedulingMode] = useState(null);
  // const [registeredFarmers, setRegisteredFarmers] = useState([]);

  const [farmerData, setFarmerData] = useState({
    name: "",
    phone: "",
    village: "",
    district: "",
    state: "",
  });
  const [farmerNotice, setFarmerNotice] = useState(null);

  const fetchData = useCallback(async (signal) => {
    try {
      const [leadResponse, alertResponse, policyResponse] = await Promise.all([
        fetch(`${API}/api/leads/pending`, { signal }),
        fetch(`${API}/api/assignments/sales-alerts`, { signal }),
        fetch(`${API}/api/auto-assignment-policy/summary`, { signal }),
      ]);
      const [leadData, alertData, policyData] = await Promise.all([leadResponse.json(), alertResponse.json(), policyResponse.json()]);
      if (leadData.success) setLeads(leadData.leads);
      if (alertData.success) {
        setAlerts(alertData.alerts || []);
        if ((alertData.alerts || []).length && activeTab !== 'appeals') setShowToast('A mission needs Sales follow-up.');
      }
      if (policyResponse.ok) setSchedulingMode(policyData.policy?.mode);
      if (!leadResponse.ok || !alertResponse.ok || !policyResponse.ok) throw new Error(leadData.error || alertData.error || policyData.error || 'Could not refresh Sales data.');
      setDataError('');
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setDataError('Could not refresh Sales data. Check the connection and try again.');
    }
  }, [activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void fetchData(controller.signal), 0);
    const interval = window.setInterval(() => void fetchData(controller.signal), 5000);
    const socket = io(API, { transports: ['websocket'] });
    socket.on('assignment_rescheduled', (mission) => setShowToast(`Assignment rescheduled for ${mission.farmerName}. New time: ${mission.expectedSpraying}. Please inform customer.`));
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); controller.abort(); socket.disconnect(); };
  }, [fetchData]);

  const handleProcess = async (event) => {
    event.preventDefault();
    setProcessStatus('processing');
    try {
      const response = await fetch(`${API}/api/leads/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedLead.id, employeeId: user.id, ...extraDetails }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setProcessStatus(data.error || 'The lead could not be processed.'); return; }
      setProcessStatus('success');
      setSelectedLead(null);
      setExtraDetails({ mandal: '', district: '', fertilizerShop: '', expectedSpraying: '', soilType: '', pesticideBrand: '', cropAge: '' });
      await fetchData();
    } catch { setProcessStatus('The lead could not be processed.'); }
  };

  const handleManualLeadSubmit = async (event) => {
    event.preventDefault();
    setManualStatus('processing');
    try {
      const coordinates = extractCoordinates({ address: manualLead.village });
      const payload = coordinates ? { ...manualLead, ...coordinates, village: 'Pinned field location' } : manualLead;
      const response = await fetch(`${API}/api/leads/ingest/manual`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setManualStatus(data.error || 'Failed to create lead. Please try again.'); return; }
      setManualStatus(data.assignment?.outcome === 'MANUAL_SCHEDULING' ? 'manual-queue' : 'success');
      setManualLead({ farmerName: '', phone: '', village: '', cropType: '', acres: '' });
      await fetchData();
      window.setTimeout(() => setManualStatus(''), 3000);
    } catch { setManualStatus('Failed to create lead. Please try again.'); }
  };

  const createAppeal = async (leadId) => {
    try {
      setAppealStatus('processing');
      const response = await fetch(`${API}/api/leads/${leadId}/appeal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerMessage: 'Recorded by Sales after farmer follow-up' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not record the appeal');
      setAppealStatus('Farmer appeal recorded and ready for review.');
      await fetchData();
    } catch (error) { setAppealStatus(error.message); }
  };

  const reviewAppeal = async (lead, decision) => {
    try {
      setAppealStatus('processing');
      const finalFee = appealFees[lead.id] ?? lead.appeal?.suggestedFee;
      const response = await fetch(`${API}/api/leads/${lead.id}/appeal/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, finalFee, reason: 'Reviewed in the Sales appeal queue' }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not review the appeal');
      setAppealStatus(decision === 'APPROVED' ? 'Appeal approved and sent to scheduling.' : 'Appeal rejected and recorded.');
      await fetchData();
    } catch (error) { setAppealStatus(error.message); }
  };

  // const handleFarmerRegistration = async (e) => {
  //   e.preventDefault();
  //   try {
  //     const payload = {
  //       ...farmerData,
  //       registeredBy: user?.email,
  //       registeredByName: user?.name,
  //     };
  //     console.log("Logged-in user:", user);
  //     console.log("Payload:", payload);
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
  //         message: data.message || "Customer registration could not be completed.",
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

  const newLeads = leads.filter((lead) => lead.status === 'NEW');
  const appealLeads = leads.filter((lead) => ['OUT_OF_RANGE', 'APPEAL_PENDING'].includes(lead.status));
  const followUpCount = appealLeads.length + alerts.length;
  const navItems = [
    // { id: 'logbook', label: 'Lead managament', icon: 'book' },
    // { id: 'process', label: 'Process Leads', icon: 'clipboard', badge: newLeads.length || null },
    { id: 'farmerRegistration', label: 'Customer Registration', icon: 'user-plus' },
    { id: 'manual', label: 'New Lead', icon: 'plus' },
    // { id: 'appeals', label: 'Appeals & alerts', icon: 'alert', badge: followUpCount || null },
    // { id: 'payments', label: 'Payment Collection', icon: 'wallet' },
    { id: 'profile', label: 'Profile', icon: 'user' },
    // { id: "registeredFarmers", label: "Registered Customer", icon: "users" },
  ];
  const pageCopy = {
    // process: ['Lead operations', 'Incoming service requests', 'Verify new requests and move complete field information into scheduling.'],
    manual: ['Service Request', 'New Lead', 'Register a new spraying request with farm and scheduling details.'],
    // appeals: ['Customer follow-up', 'Appeals & operational alerts', 'Resolve out-of-range requests and mission exceptions that need Sales action.'],
    // payments: ['Revenue follow-up', 'Payment collection', 'Complete cash collection or retry configured payment methods.'],
    // logbook: ['Customer history', 'Lead managament', 'Search and review every recorded step in a service request.'],
    farmerRegistration: [
      'Customer onboarding',
      'Customer Registration',
      'Register new Customers and create their accounts.'
    ],
    profile: [
      'Account',
      'Profile',
      'View and update your profile information and account settings.'
    ],
    // registeredFarmers: [
    //   'Customer records',
    //   'Registered Customers',
    //   'View all registered Customers and their registration details.'
    // ],
  };
  const [eyebrow, title, description] = pageCopy[activeTab];
  const toastIsSchedule = typeof showToast === 'string' && showToast.includes('rescheduled');

  return (
    <OperationsShell roleLabel="Sales Dashboard" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} >
      {showToast && <div className={`toast ${toastIsSchedule ? '' : 'toast--alert'}`} onClick={() => { if (toastIsSchedule) setShowToast(false); else { setActiveTab('appeals'); setShowToast(false); } }}><strong>{toastIsSchedule ? 'Schedule updated' : 'Operational follow-up'}</strong><span>{showToast}</span></div>}

      <header className="page-header">
        <div className="page-header__copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
        {/* <div className="page-header__actions">
          <button className="action-btn" type="button" onClick={() => void fetchData()}>
            <OpsIcon name="refresh" /> Refresh data</button></div> */}

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
      <div className="notice notice--info" role="status">{t('auto_policy_title')}: {t(schedulingMode === 'automatic' ? 'auto_policy_automatic' : 'auto_policy_paused')}</div>
      {dataError && <div role="alert" className="notice notice--error"><span>{dataError}</span></div>}

      {/* {activeTab === 'appeals' && (
        <>
          {appealStatus && appealStatus !== 'processing' && <div role="status" className={`notice ${appealStatus.includes('Could not') ? 'notice--error' : 'notice--success'}`}><span>{appealStatus}</span><button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setAppealStatus('')}>×</button></div>}
          <section className="subsection">
            <div className="subsection-header"><div><p className="eyebrow eyebrow--accent">Range exceptions</p><h2>Out-of-range appeals</h2></div><span className="status-badge status-badge--warning">{appealLeads.length} waiting</span></div>
            {!appealLeads.length && <div className="empty-state"><strong>No appeals need review</strong><span>New out-of-range requests will appear here after intake.</span></div>}
            <div className="appeal-grid">{appealLeads.map((lead) => <article key={lead.id} className="workflow-card workflow-card--warning"><div className="mission-card__header"><div><h3>{lead.farmerName}</h3><p className="workflow-card__meta">{lead.farmerPhone} · {lead.acreage} acres · {lead.distanceFromCenterKm?.toFixed(1) || 'Unknown'} km from the nearest centre</p></div><span className="status-badge status-badge--warning">{lead.status.replaceAll('_', ' ')}</span></div>{lead.status === 'OUT_OF_RANGE' ? <button type="button" className="submit-btn" disabled={appealStatus === 'processing'} onClick={() => void createAppeal(lead.id)}>Record farmer appeal</button> : <div className="button-row"><div className="input-group"><label htmlFor={`appeal-fee-${lead.id}`}>Agreed transport fee</label><input id={`appeal-fee-${lead.id}`} type="number" min="0" step="0.01" value={appealFees[lead.id] ?? lead.appeal?.suggestedFee ?? ''} onChange={(event) => setAppealFees((fees) => ({ ...fees, [lead.id]: event.target.value }))} /></div><button type="button" className="submit-btn" disabled={appealStatus === 'processing'} onClick={() => void reviewAppeal(lead, 'APPROVED')}>Approve appeal</button><button type="button" className="danger-btn" disabled={appealStatus === 'processing'} onClick={() => void reviewAppeal(lead, 'REJECTED')}>Reject appeal</button></div>}</article>)}</div>
          </section>

          <section className="subsection">
            <div className="subsection-header"><div><p className="eyebrow">Mission exceptions</p><h2>Operational alerts</h2></div><span className="status-badge status-badge--danger">{alerts.length} open</span></div>
            {!alerts.length && <div className="empty-state"><strong>No mission alerts</strong><span>There are no discrepancies or decommission events awaiting follow-up.</span></div>}
            <div className="alert-grid">{alerts.map((alert) => <article key={alert.id} className="workflow-card workflow-card--danger"><div className="mission-card__header"><div><h3>{alert.lead?.farmerName || 'Mission alert'}</h3><p className="workflow-card__meta">Pilot: {alert.pilot?.name || 'Unassigned'}</p></div><span className="status-badge status-badge--danger">Follow up</span></div><p>{alert.decommissionedMidMission ? `Drone decommissioned: ${alert.decommissionReason || 'No reason supplied'}` : `Acreage discrepancy: ${alert.discrepancyNote || 'Review the mission logbook.'}`}</p></article>)}</div>
          </section>
        </>
      )} */}

      {/* {activeTab === 'manual' && (
        <section className="panel panel--raised manual-form-panel">
          <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Enter Manual Lead</h2></div><p>A Sales-entered lead is verified and immediately sent through automatic scheduling.</p></div></div>
          <div className="panel-body">
            {manualStatus === 'success' && <div role="status" className="notice notice--success">Lead created and automatically scheduled.</div>}
            {manualStatus === 'manual-queue' && <div role="status" className="notice notice--success">Lead created. Fleet has been notified to schedule it manually.</div>}
            {manualStatus && !['success', 'manual-queue', 'processing'].includes(manualStatus) && <div role="alert" className="notice notice--error">{manualStatus}</div>}
            <form className="form-stack" onSubmit={handleManualLeadSubmit}>
              <div className="input-group"><label htmlFor="manual-farmer-name">Farmer Name</label><input id="manual-farmer-name" type="text" minLength={2} maxLength={120} value={manualLead.farmerName} onChange={(event) => setManualLead({ ...manualLead, farmerName: event.target.value })} required /></div>
              <div className="input-group"><label htmlFor="manual-phone">Phone Number</label><input id="manual-phone" type="tel" minLength={7} maxLength={20} value={manualLead.phone} onChange={(event) => setManualLead({ ...manualLead, phone: event.target.value.replace(/[^\d+\s().-]/g, '') })} required /></div>
              <div className="input-group"><label htmlFor="manual-location">Village / Location</label><input id="manual-location" type="text" value={manualLead.village} onChange={(event) => setManualLead({ ...manualLead, village: event.target.value })} required /></div>
              <div className="row-group"><div className="input-group"><label htmlFor="manual-crop">Crop Type</label><input id="manual-crop" type="text" maxLength={120} value={manualLead.cropType} onChange={(event) => setManualLead({ ...manualLead, cropType: event.target.value })} required /></div><div className="input-group"><label htmlFor="manual-acres">Estimated Acres</label><input id="manual-acres" type="number" min="0.01" step="0.01" value={manualLead.acres} onChange={(event) => setManualLead({ ...manualLead, acres: event.target.value })} required /></div></div>
              <div className="form-actions"><button type="submit" className="submit-btn" disabled={manualStatus === 'processing'}>{manualStatus === 'processing' ? 'Creating…' : 'Create Lead'}</button></div>
            </form>
          </div>
        </section>
      )} */}

      {activeTab === 'manual' && <FarmDetails />}
      {/* {activeTab === 'process' && (
        <section className="lead-workbench">
          <div className="panel">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="clipboard" /></span><h2>Pending tasks</h2></div><p>{newLeads.length} new incoming request{newLeads.length === 1 ? '' : 's'}.</p></div></div>
            <div className="panel-body lead-list">
              {!newLeads.length && <div className="empty-state"><strong>No pending leads</strong><span>New website requests will appear here.</span></div>}
              {newLeads.map((lead) => <article key={lead.id} className="lead-card" aria-selected={selectedLead?.id === lead.id}><h3>{lead.farmerName}</h3><p className="lead-card__location"><strong>Location:</strong> <LocationLink latitude={lead.latitude} longitude={lead.longitude} address={lead.farmerAddress} centerName={lead.matchedCenter?.name} farmerName={lead.farmerName} /></p><p><strong>Crop:</strong> {lead.cropType || 'Not supplied'} · {lead.acreage} acres</p><p><strong>Phone:</strong> {lead.farmerPhone}</p><button type="button" className="action-btn lead-card__select" aria-pressed={selectedLead?.id === lead.id} onClick={() => { setSelectedLead(lead); setProcessStatus(''); }}>Review request</button></article>)}
            </div>
          </div>

          <div className="panel panel--raised">
            {selectedLead ? <><div className="panel-header"><div className="panel-header__title"><p className="eyebrow">Selected request</p><h2>{selectedLead.farmerName}</h2><p>Complete field verification before sending this request to scheduling.</p></div><span className="status-badge status-badge--info">New lead</span></div><div className="panel-body">{processStatus === 'success' && <div className="notice notice--success">Lead submitted! Ready for Dispatch.</div>}{processStatus && !['success', 'processing'].includes(processStatus) && <div className="notice notice--error">{processStatus}</div>}<form className="processing-form" onSubmit={handleProcess}><div className="input-group"><label htmlFor="sales-handler">Handling Sales Rep</label><input id="sales-handler" type="text" value={`${user?.name} · ${user?.id}`} disabled /></div><div className="row-group"><div className="input-group"><label htmlFor="lead-mandal">Mandal</label><input id="lead-mandal" type="text" value={extraDetails.mandal} onChange={(event) => setExtraDetails({ ...extraDetails, mandal: event.target.value })} required /></div><div className="input-group"><label htmlFor="lead-district">District</label><input id="lead-district" type="text" value={extraDetails.district} onChange={(event) => setExtraDetails({ ...extraDetails, district: event.target.value })} required /></div></div><div className="row-group"><div className="input-group"><label htmlFor="lead-soil">Soil Type</label><input id="lead-soil" type="text" placeholder="e.g. Red, Black Cotton" value={extraDetails.soilType} onChange={(event) => setExtraDetails({ ...extraDetails, soilType: event.target.value })} required /></div><div className="input-group"><label htmlFor="lead-crop-age">Crop Age (Weeks)</label><input id="lead-crop-age" type="text" placeholder="e.g. 12" value={extraDetails.cropAge} onChange={(event) => setExtraDetails({ ...extraDetails, cropAge: event.target.value })} required /></div></div><div className="input-group"><label htmlFor="lead-brand">Fertilizer / Pesticide Brand</label><input id="lead-brand" type="text" placeholder="e.g. Bayer, Syngenta" value={extraDetails.pesticideBrand} onChange={(event) => setExtraDetails({ ...extraDetails, pesticideBrand: event.target.value })} required /></div><div className="input-group"><label htmlFor="lead-spraying">Expected Spraying Times / Acres</label><input id="lead-spraying" type="text" value={extraDetails.expectedSpraying} onChange={(event) => setExtraDetails({ ...extraDetails, expectedSpraying: event.target.value })} required /></div><div className="form-actions"><button type="submit" className="submit-btn" disabled={processStatus === 'processing'}>{processStatus === 'processing' ? 'Submitting…' : 'Verify and send to scheduling'}</button></div></form></div></> : <div className="panel-body"><div className="empty-state empty-state--center"><span className="panel-title-icon"><OpsIcon name="clipboard" /></span><strong>Select an incoming lead to process</strong><span>Farmer and field details will open here.</span></div></div>}
          </div>
        </section>
      )} */}

      {/* {activeTab === 'payments' && <PendingPaymentsPanel />} */}
      {/* {activeTab === 'logbook' && <LogbookTimelinePanel />} */}
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

      {activeTab === "profile" && (
        <AdminProfile user={user} />
      )}


      {/* {activeTab === "registeredFarmers" && (
        <RegisteredFarmers />
      )} */}

    </OperationsShell>
  );
}

export default MarketingDashboard;
