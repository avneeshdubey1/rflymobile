import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import PendingPaymentsPanel from '../components/PendingPaymentsPanel';
import LogbookTimelinePanel from '../components/LogbookTimelinePanel';
import LocationLink from '../components/LocationLink';
import { extractCoordinates } from '../utils/locationPresentation';
import { createAuthenticatedSocket } from '../services/authenticatedSocket';
import { apiFetch, readJson } from '../services/apiClient';

function MarketingDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('process');
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

  const fetchData = useCallback(async (signal) => {
    try {
      const [leadResponse, alertResponse] = await Promise.all([
        apiFetch('/api/leads/pending', { signal }),
        apiFetch('/api/assignments/sales-alerts', { signal }),
      ]);
      const [leadData, alertData] = await Promise.all([leadResponse.json(), alertResponse.json()]);
      if (leadData.success) setLeads(leadData.leads);
      if (alertData.success) {
        setAlerts(alertData.alerts || []);
        if ((alertData.alerts || []).length && activeTab !== 'appeals') setShowToast('A mission needs Sales follow-up.');
      }
      if (!leadResponse.ok || !alertResponse.ok) throw new Error(leadData.error || alertData.error || 'Could not refresh Sales data.');
      setDataError('');
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setDataError('Could not refresh Sales data. Check the connection and try again.');
    }
  }, [activeTab]);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void fetchData(controller.signal), 0);
    const interval = window.setInterval(() => void fetchData(controller.signal), 5000);
    const socket = createAuthenticatedSocket();
    socket.on('assignment_rescheduled', (mission) => setShowToast(`Assignment rescheduled for ${mission.farmerName}. New time: ${mission.expectedSpraying}. Please inform customer.`));
    return () => { window.clearTimeout(initialLoad); window.clearInterval(interval); controller.abort(); socket.disconnect(); };
  }, [fetchData]);

  const handleProcess = async (event) => {
    event.preventDefault();
    setProcessStatus('processing');
    try {
      const response = await apiFetch('/api/leads/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedLead.id, employeeId: user.id, ...extraDetails }),
      });
      const data = await readJson(response);
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
      const response = await apiFetch('/api/leads/ingest/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await readJson(response);
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
      const response = await apiFetch(`/api/leads/${leadId}/appeal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerMessage: 'Recorded by Sales after farmer follow-up' }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Could not record the appeal');
      setAppealStatus('Farmer appeal recorded and ready for review.');
      await fetchData();
    } catch (error) { setAppealStatus(error.message); }
  };

  const reviewAppeal = async (lead, decision) => {
    try {
      setAppealStatus('processing');
      const finalFee = appealFees[lead.id] ?? lead.appeal?.suggestedFee;
      const response = await apiFetch(`/api/leads/${lead.id}/appeal/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, finalFee, reason: 'Reviewed in the Sales appeal queue' }) });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Could not review the appeal');
      setAppealStatus(decision === 'APPROVED' ? 'Appeal approved and sent to scheduling.' : 'Appeal rejected and recorded.');
      await fetchData();
    } catch (error) { setAppealStatus(error.message); }
  };

  const newLeads = leads.filter((lead) => lead.status === 'NEW');
  const appealLeads = leads.filter((lead) => ['OUT_OF_RANGE', 'APPEAL_PENDING'].includes(lead.status));
  const followUpCount = appealLeads.length + alerts.length;
  const navItems = [
    { id: 'process', label: 'Process Leads', icon: 'clipboard', badge: newLeads.length || null },
    { id: 'manual', label: 'Enter New Lead', icon: 'plus' },
    { id: 'appeals', label: 'Appeals & alerts', icon: 'alert', badge: followUpCount || null },
    { id: 'payments', label: 'Payment Collection', icon: 'wallet' },
    { id: 'logbook', label: 'CRM Logbook', icon: 'book' },
  ];
  const pageCopy = {
    process: ['Lead operations', 'Incoming service requests', 'Verify new requests and move complete field information into scheduling.'],
    manual: ['Verified intake', 'Enter a new lead', 'Capture a phone or field enquiry and immediately attempt scheduling.'],
    appeals: ['Customer follow-up', 'Appeals & operational alerts', 'Resolve out-of-range requests and mission exceptions that need Sales action.'],
    payments: ['Revenue follow-up', 'Payment collection', 'Complete cash collection or retry configured payment methods.'],
    logbook: ['Customer history', 'CRM logbook', 'Search and review every recorded step in a service request.'],
  };
  const [eyebrow, title, description] = pageCopy[activeTab];
  const toastIsSchedule = typeof showToast === 'string' && showToast.includes('rescheduled');

  return (
    <OperationsShell roleLabel="Sales operations" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} user={user} onLogout={logout}>
      {showToast && <div className={`toast ${toastIsSchedule ? '' : 'toast--alert'}`} onClick={() => { if (toastIsSchedule) setShowToast(false); else { setActiveTab('appeals'); setShowToast(false); } }}><strong>{toastIsSchedule ? 'Schedule updated' : 'Operational follow-up'}</strong><span>{showToast}</span></div>}

      <header className="page-header">
        <div className="page-header__copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
        <div className="page-header__actions"><button className="action-btn" type="button" onClick={() => void fetchData()}><OpsIcon name="refresh" /> Refresh data</button></div>
      </header>

      {dataError && <div role="alert" className="notice notice--error"><span>{dataError}</span></div>}

      {activeTab === 'appeals' && (
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
      )}

      {activeTab === 'manual' && (
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
      )}

      {activeTab === 'process' && (
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
      )}

      {activeTab === 'payments' && <PendingPaymentsPanel />}
      {activeTab === 'logbook' && <LogbookTimelinePanel />}
    </OperationsShell>
  );
}

export default MarketingDashboard;
