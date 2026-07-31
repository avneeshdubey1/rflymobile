import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import LocationLink from '../components/LocationLink';
import CustomerProfileFields from '../components/CustomerProfileFields';
import { createAuthenticatedSocket } from '../services/authenticatedSocket';
import { apiFetch, readJson } from '../services/apiClient';

const blankManualLead = { farmerName: '', phone: '', village: '', cropType: '', acres: '', latitude: '', longitude: '' };
const blankCustomer = {
  displayName: '', phone: '', preferredLanguage: 'ta', ownership: '', totalAcres: '',
  village: '', mandal: '', district: '', state: '',
  kharifCrop: '', kharifOtherCrop: '', kharifAcres: '', kharifTanks: '', kharifSprayings: '',
  rabiCrop: '', rabiOtherCrop: '', rabiAcres: '', rabiTanks: '', rabiSprayings: '',
  summerCrop: '', summerOtherCrop: '', summerAcres: '', summerTanks: '', summerSprayings: '',
  subscriptionCardNumber: '', subscriptionYear: '', remarks: '',
};

function MarketingDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('customers');
  const [leads, setLeads] = useState([]);
  const [dataError, setDataError] = useState('');
  const [manualLead, setManualLead] = useState(blankManualLead);
  const [manualStatus, setManualStatus] = useState('');
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [newCustomer, setNewCustomer] = useState(blankCustomer);
  const [customerStatus, setCustomerStatus] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [extraDetails, setExtraDetails] = useState({ mandal: '', district: '', fertilizerShop: '', expectedSpraying: '', soilType: '', pesticideBrand: '', cropAge: '' });
  const [processStatus, setProcessStatus] = useState('');
  const [showToast, setShowToast] = useState('');

  const fetchData = useCallback(async (signal) => {
    try {
      const leadResponse = await apiFetch('/api/leads/pending', { signal });
      const leadData = await readJson(leadResponse);
      if (!leadResponse.ok) throw new Error(leadData.error || 'Could not refresh Sales data.');
      setLeads(leadData.leads || []);
      setDataError('');
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setDataError('Could not refresh Sales data. Check the connection and try again.');
    }
  }, []);

  const fetchCustomers = useCallback(async (query = '', signal) => {
    try {
      const response = await apiFetch(`/api/customers/sales?q=${encodeURIComponent(query || '')}`, { signal });
      const data = await readJson(response);
      if (!response.ok) throw new Error(data.error || 'Could not refresh customers.');
      setCustomers(data.customers || []);
      setCustomerStatus('');
    } catch (error) {
      if (error.name !== 'AbortError' && !signal?.aborted) setCustomerStatus(error.message || 'Could not refresh customers.');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void fetchData(controller.signal), 0);
    const initialCustomers = window.setTimeout(() => void fetchCustomers('', controller.signal), 0);
    const interval = window.setInterval(() => void fetchData(controller.signal), 5000);
    const socket = createAuthenticatedSocket();
    socket.on('assignment_rescheduled', (mission) => setShowToast(`Assignment rescheduled for ${mission.farmerName}. Please contact the customer.`));
    return () => { window.clearTimeout(initialLoad); window.clearTimeout(initialCustomers); window.clearInterval(interval); controller.abort(); socket.disconnect(); };
  }, [fetchData, fetchCustomers]);

  const handleProcess = async (event) => {
    event.preventDefault();
    if (!selectedLead) return;
    setProcessStatus('processing');
    try {
      const response = await apiFetch('/api/leads/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedLead.id, ...extraDetails }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setProcessStatus(data.code === 'SERVICE_AREA_REVALIDATION_FAILED'
          ? 'The active service area no longer covers this request. It was not scheduled.'
          : (data.error || 'The request could not be processed.'));
        return;
      }
      setProcessStatus('success');
      setSelectedLead(null);
      setExtraDetails({ mandal: '', district: '', fertilizerShop: '', expectedSpraying: '', soilType: '', pesticideBrand: '', cropAge: '' });
      await fetchData();
    } catch {
      setProcessStatus('The request could not be processed.');
    }
  };

  const handleManualLeadSubmit = async (event) => {
    event.preventDefault();
    setManualStatus('processing');
    try {
      const path = selectedCustomer ? `/api/customers/sales/${selectedCustomer.id}/leads` : '/api/leads/ingest/manual';
      const response = await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualLead),
      });
      const data = await readJson(response);
      if (data.code === 'OUTSIDE_SERVICE_AREA') {
        setManualStatus('declined');
        setManualLead((current) => ({ ...current, acres: '', cropType: '', latitude: '', longitude: '' }));
        return;
      }
      if (!response.ok) {
        setManualStatus(data.code === 'LOCATION_REQUIRED' ? 'Enter a valid farm latitude and longitude.' : (data.error || 'Failed to create lead. Please try again.'));
        return;
      }
      setManualStatus(data.assignmentOutcome === 'MANUAL_SCHEDULING' ? 'manual-queue' : 'success');
      setManualLead(selectedCustomer ? { ...blankManualLead, farmerName: selectedCustomer.displayName, phone: selectedCustomer.phone, village: selectedCustomer.village || '' } : blankManualLead);
      await fetchData();
      await fetchCustomers(customerSearch);
      window.setTimeout(() => setManualStatus(''), 3000);
    } catch {
      setManualStatus('Failed to create lead. Please try again.');
    }
  };

  const handleCustomerSearch = async (event) => {
    event.preventDefault();
    setCustomerStatus('searching');
    await fetchCustomers(customerSearch);
  };

  const handleCustomerCreate = async (event) => {
    event.preventDefault();
    setCustomerStatus('saving');
    try {
      const response = await apiFetch('/api/customers/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setCustomerStatus(data.error || 'Could not create customer.');
        return;
      }
      setNewCustomer(blankCustomer);
      setSelectedCustomer(data.customer);
      setManualLead({ ...blankManualLead, farmerName: data.customer.displayName, phone: data.customer.phone, village: data.customer.village || '' });
      setCustomerStatus(data.created ? 'Customer created. Service view is ready.' : 'Existing customer opened. Service view is ready.');
      await fetchCustomers(customerSearch);
      setActiveTab('manual');
    } catch {
      setCustomerStatus('Could not create customer.');
    }
  };

  const openCustomerServiceView = async (customer) => {
    setCustomerStatus('opening');
    try {
      const response = await apiFetch(`/api/customers/sales/${customer.id}/service-context`);
      const data = await readJson(response);
      if (!response.ok) {
        setCustomerStatus(data.error || 'Could not open customer service view.');
        return;
      }
      setSelectedCustomer(data.customer);
      setManualLead({ ...blankManualLead, farmerName: data.customer.displayName, phone: data.customer.phone, village: data.customer.village || '' });
      setManualStatus('');
      setCustomerStatus('');
      setActiveTab('manual');
    } catch {
      setCustomerStatus('Could not open customer service view.');
    }
  };

  const handleCustomerUpdate = async (event) => {
    event.preventDefault();
    if (!editingCustomer) return;
    setCustomerStatus('saving');
    try {
      const response = await apiFetch(`/api/customers/sales/${editingCustomer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCustomer),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setCustomerStatus(data.error || 'Could not update customer.');
        return;
      }
      setEditingCustomer(null);
      setSelectedCustomer((current) => current?.id === data.customer.id ? data.customer : current);
      setCustomerStatus('Customer details updated.');
      await fetchCustomers(customerSearch);
    } catch {
      setCustomerStatus('Could not update customer.');
    }
  };

  const enableFarmerPortalAccess = async (customer) => {
    if (!customer || customer.hasFarmerPortalUser) return;
    setCustomerStatus('enabling');
    try {
      const response = await apiFetch(`/api/customers/sales/${customer.id}/portal-access`, { method: 'POST' });
      const data = await readJson(response);
      if (!response.ok) {
        setCustomerStatus(data.error || 'Could not enable Farmer portal access.');
        return;
      }
      setCustomers((current) => current.map((entry) => (entry.id === data.customer.id ? data.customer : entry)));
      if (selectedCustomer?.id === data.customer.id) setSelectedCustomer(data.customer);
      setCustomerStatus(data.createdUser ? 'Farmer portal access enabled. The farmer can now log in with OTP.' : 'Farmer portal access is already linked.');
      await fetchCustomers(customerSearch);
    } catch {
      setCustomerStatus('Could not enable Farmer portal access.');
    }
  };

  const newLeads = leads.filter((lead) => ['NEW', 'MANUAL_CALL_REQUIRED'].includes(lead.status));
  const navItems = [
    { id: 'customers', label: 'Customer Registration', icon: 'users', badge: selectedCustomer ? '1' : null },
    { id: 'manual', label: 'Enter New Lead', icon: 'plus' },
    { id: 'process', label: 'Access Leads', icon: 'clipboard', badge: newLeads.length || null },
    { id: 'profile', label: 'Profile', icon: 'users' },
  ];
  const pageCopy = {
    customers: ['Customer onboarding', 'Customer Registration', 'Register customers, maintain their farm profile, and open their service view.'],
    manual: ['Service request', 'Enter a new lead', 'Record a phone request and validate the farm against the active service area.'],
    process: ['Lead access', 'Incoming leads', 'Review accepted public requests and send complete details to scheduling.'],
    profile: ['Account', 'Profile', 'View the employee identity and role currently operating this Sales workspace.'],
  };
  const [eyebrow, title, description] = pageCopy[activeTab] || pageCopy.customers;

  return (
    <OperationsShell roleLabel="Sales Dashboard" navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab} user={user} onLogout={logout}>
      <header className="page-header">
        <div className="page-header__copy"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
        <div className="page-header__actions"><button className="action-btn" type="button" onClick={() => void fetchData()}><OpsIcon name="refresh" /> Refresh data</button></div>
      </header>

      {showToast && <div role="status" className="notice notice--warning"><span>{showToast}</span><button className="notice__close" type="button" aria-label="Dismiss message" onClick={() => setShowToast('')}>×</button></div>}
      {dataError && <div role="alert" className="notice notice--error"><span>{dataError}</span></div>}

      {activeTab === 'customers' && (
        <section className="lead-workbench">
          <div className="panel">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="users" /></span><h2>Registered customers</h2></div><p>Search by name, phone, location, subscription card, or seasonal crop before raising a request.</p></div></div>
            <div className="panel-body">
              {customerStatus && !['searching', 'saving', 'opening', 'enabling'].includes(customerStatus) && <div role="status" className={customerStatus.includes('Could') ? 'notice notice--error' : 'notice notice--success'}>{customerStatus}</div>}
              <form className="row-group" onSubmit={handleCustomerSearch}>
                <div className="input-group"><label htmlFor="customer-search">Search customers</label><input id="customer-search" type="search" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Name, phone, location, crop or subscription card" /></div>
                <div className="form-actions"><button type="submit" className="action-btn" disabled={customerStatus === 'searching'}><OpsIcon name="search" /> {customerStatus === 'searching' ? 'Searching…' : 'Search'}</button></div>
              </form>
              <div className="data-stack">
                {!customers.length && <div className="empty-state"><strong>No customers found</strong><span>Create a customer from the call details on the right.</span></div>}
                {customers.map((customer) => (
                  <article className="data-row" key={customer.id}>
                    <div className="data-row__main">
                      <span className="data-row__title">{customer.displayName}</span>
                      <span className="data-row__meta">{customer.phone} · {customer.village || 'Village not set'}{customer.mandal ? `, ${customer.mandal}` : ''}{customer.district ? `, ${customer.district}` : ''}</span>
                      <span className="data-row__meta">{customer.ownership ? `${customer.ownership.toLowerCase()} · ` : ''}{customer.totalAcres ?? 'Acreage not recorded'}{customer.totalAcres != null ? ' total acres' : ''}</span>
                      <span className="data-row__meta">Crops: {[customer.kharifCrop, customer.rabiCrop, customer.summerCrop].filter(Boolean).join(', ') || 'Not recorded'}</span>
                      <span className={`status-badge status-badge--${customer.hasFarmerPortalUser ? 'success' : 'info'}`}>{customer.hasFarmerPortalUser ? 'Farmer portal user' : 'Staff-confirmed'}</span>
                    </div>
                    <div className="data-row__actions">
                      <button type="button" className="action-btn" onClick={() => { setEditingCustomer({ ...customer }); setCustomerStatus(''); }}>Edit details</button>
                      {!customer.hasFarmerPortalUser && <button type="button" className="action-btn" onClick={() => void enableFarmerPortalAccess(customer)} disabled={customerStatus === 'enabling'}>{customerStatus === 'enabling' ? 'Enabling...' : 'Enable portal'}</button>}
                      <button type="button" className="action-btn" onClick={() => void openCustomerServiceView(customer)} disabled={customerStatus === 'opening'}>Open service view</button>
                    </div>
                  </article>
                ))}
              </div>
              {editingCustomer && (
                <form className="form-stack workflow-card" onSubmit={handleCustomerUpdate}>
                  <div className="subsection-header"><div><p className="eyebrow">Customer master</p><h3>Edit {editingCustomer.displayName}</h3></div><button type="button" className="action-btn" onClick={() => setEditingCustomer(null)}>Cancel</button></div>
                  <div className="input-group"><label htmlFor="edit-customer-name">Customer / farmer name</label><input id="edit-customer-name" type="text" minLength="2" maxLength="120" value={editingCustomer.displayName} onChange={(event) => setEditingCustomer({ ...editingCustomer, displayName: event.target.value })} required /></div>
                  <CustomerProfileFields value={editingCustomer} onChange={setEditingCustomer} idPrefix="edit-customer" />
                  <div className="form-actions"><button type="submit" className="submit-btn" disabled={customerStatus === 'saving'}>{customerStatus === 'saving' ? 'Saving…' : 'Save customer details'}</button></div>
                </form>
              )}
            </div>
          </div>
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><p className="eyebrow">Phone call</p><h2>Create customer</h2><p>No OTP is needed for Sales-assisted internal intake. External Farmer portal access remains a separate verified flow.</p></div></div>
            <form className="panel-body form-stack" onSubmit={handleCustomerCreate}>
              <div className="input-group"><label htmlFor="customer-name">Customer / farmer name</label><input id="customer-name" type="text" minLength="2" maxLength="120" value={newCustomer.displayName} onChange={(event) => setNewCustomer({ ...newCustomer, displayName: event.target.value })} required /></div>
              <div className="input-group"><label htmlFor="customer-phone">Phone number</label><input id="customer-phone" type="tel" minLength="7" maxLength="20" value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value.replace(/[^\d+\s().-]/g, '') })} required /></div>
              <div className="input-group"><label htmlFor="customer-language">Preferred language</label><select id="customer-language" value={newCustomer.preferredLanguage} onChange={(event) => setNewCustomer({ ...newCustomer, preferredLanguage: event.target.value })}><option value="ta">Tamil</option><option value="en">English</option><option value="ml">Malayalam</option><option value="hi">Hindi</option></select></div>
              <CustomerProfileFields value={newCustomer} onChange={setNewCustomer} idPrefix="new-customer" />
              <div className="form-actions"><button type="submit" className="submit-btn" disabled={customerStatus === 'saving'}>{customerStatus === 'saving' ? 'Saving…' : 'Create and open service view'}</button></div>
            </form>
          </div>
        </section>
      )}

      {activeTab === 'manual' && (
        <section className="panel panel--raised manual-form-panel">
          <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>{selectedCustomer ? `Service view: ${selectedCustomer.displayName}` : 'Enter phone enquiry'}</h2></div><p>{selectedCustomer ? 'You are still signed in as Sales. Requests created here are audited as staff-assisted customer work.' : 'Record the caller’s details and exact farm location. The server applies the same strict service-area decision as the public form.'}</p></div>{selectedCustomer && <button type="button" className="action-btn" onClick={() => { setSelectedCustomer(null); setManualLead(blankManualLead); setManualStatus(''); }}>Clear customer</button>}</div>
          <div className="panel-body">
            {selectedCustomer && (
              <div className="notice notice--info">
                <span>{selectedCustomer.hasFarmerPortalUser ? 'Farmer portal access is enabled. The farmer can log in with OTP.' : 'Portal access is not enabled for this farmer yet.'}</span>
                {!selectedCustomer.hasFarmerPortalUser && <button type="button" className="action-btn" onClick={() => void enableFarmerPortalAccess(selectedCustomer)} disabled={customerStatus === 'enabling'}>{customerStatus === 'enabling' ? 'Enabling...' : 'Enable portal access'}</button>}
              </div>
            )}
            {manualStatus === 'success' && <div role="status" className="notice notice--success">Lead created and sent through the normal scheduling workflow.</div>}
            {manualStatus === 'manual-queue' && <div role="status" className="notice notice--success">Lead created. Fleet has been notified to schedule it manually.</div>}
            {manualStatus === 'declined' && <div role="status" className="notice notice--warning">This farm is outside the active service area. A contact-only declined enquiry was recorded; no lead or schedule was created.</div>}
            {manualStatus && !['success', 'manual-queue', 'declined', 'processing'].includes(manualStatus) && <div role="alert" className="notice notice--error">{manualStatus}</div>}
            <form className="form-stack" onSubmit={handleManualLeadSubmit}>
              <div className="input-group"><label htmlFor="manual-farmer-name">Farmer name</label><input id="manual-farmer-name" type="text" minLength="2" maxLength="120" value={manualLead.farmerName} onChange={(event) => setManualLead({ ...manualLead, farmerName: event.target.value })} disabled={Boolean(selectedCustomer)} required /></div>
              <div className="input-group"><label htmlFor="manual-phone">Phone number</label><input id="manual-phone" type="tel" minLength="7" maxLength="20" value={manualLead.phone} onChange={(event) => setManualLead({ ...manualLead, phone: event.target.value.replace(/[^\d+\s().-]/g, '') })} disabled={Boolean(selectedCustomer)} required /></div>
              <div className="input-group"><label htmlFor="manual-location">Village / location description</label><input id="manual-location" type="text" maxLength="500" value={manualLead.village} onChange={(event) => setManualLead({ ...manualLead, village: event.target.value })} required /></div>
              <div className="row-group"><div className="input-group"><label htmlFor="manual-crop">Crop type</label><input id="manual-crop" type="text" maxLength="120" value={manualLead.cropType} onChange={(event) => setManualLead({ ...manualLead, cropType: event.target.value })} required /></div><div className="input-group"><label htmlFor="manual-acres">Estimated acres</label><input id="manual-acres" type="number" min="0.01" step="0.01" value={manualLead.acres} onChange={(event) => setManualLead({ ...manualLead, acres: event.target.value })} required /></div></div>
              <div className="row-group"><div className="input-group"><label htmlFor="manual-latitude">Farm latitude</label><input id="manual-latitude" type="number" min="-90" max="90" step="any" inputMode="decimal" value={manualLead.latitude} onChange={(event) => setManualLead({ ...manualLead, latitude: event.target.value })} required /></div><div className="input-group"><label htmlFor="manual-longitude">Farm longitude</label><input id="manual-longitude" type="number" min="-180" max="180" step="any" inputMode="decimal" value={manualLead.longitude} onChange={(event) => setManualLead({ ...manualLead, longitude: event.target.value })} required /></div></div>
              <div className="form-actions"><button type="submit" className="submit-btn" disabled={manualStatus === 'processing'}>{manualStatus === 'processing' ? 'Checking service area…' : 'Create lead'}</button></div>
            </form>
          </div>
        </section>
      )}

      {activeTab === 'process' && (
        <section className="lead-workbench">
          <div className="panel"><div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="clipboard" /></span><h2>Requests awaiting Sales review</h2></div><p>{newLeads.length} request{newLeads.length === 1 ? '' : 's'} need review.</p></div></div><div className="panel-body lead-list">{!newLeads.length && <div className="empty-state"><strong>No pending requests</strong><span>In-area public requests appear here for Sales review.</span></div>}{newLeads.map((lead) => <article key={lead.id} className="lead-card" aria-selected={selectedLead?.id === lead.id}><h3>{lead.farmerName}</h3><p className="lead-card__location"><strong>Location:</strong> <LocationLink latitude={lead.latitude} longitude={lead.longitude} address={lead.farmerAddress} centerName={lead.matchedCenter?.name} farmerName={lead.farmerName} /></p><p><strong>Crop:</strong> {lead.cropType || 'Not supplied'} · {lead.acreage} acres</p><p><strong>Phone:</strong> {lead.farmerPhone}</p><button type="button" className="action-btn lead-card__select" aria-pressed={selectedLead?.id === lead.id} onClick={() => { setSelectedLead(lead); setProcessStatus(''); }}>Review request</button></article>)}</div></div>
          <div className="panel panel--raised">{selectedLead ? <><div className="panel-header"><div className="panel-header__title"><p className="eyebrow">Selected request</p><h2>{selectedLead.farmerName}</h2><p>Confirm the service details. The server rechecks the active service area before scheduling.</p></div><span className="status-badge status-badge--info">Awaiting review</span></div><div className="panel-body">{processStatus === 'success' && <div className="notice notice--success">Request accepted and sent to scheduling.</div>}{processStatus && !['success', 'processing'].includes(processStatus) && <div className="notice notice--error">{processStatus}</div>}<form className="processing-form" onSubmit={handleProcess}><div className="row-group"><div className="input-group"><label htmlFor="lead-mandal">Mandal</label><input id="lead-mandal" type="text" value={extraDetails.mandal} onChange={(event) => setExtraDetails({ ...extraDetails, mandal: event.target.value })} required /></div><div className="input-group"><label htmlFor="lead-district">District</label><input id="lead-district" type="text" value={extraDetails.district} onChange={(event) => setExtraDetails({ ...extraDetails, district: event.target.value })} required /></div></div><div className="row-group"><div className="input-group"><label htmlFor="lead-soil">Soil type</label><input id="lead-soil" type="text" value={extraDetails.soilType} onChange={(event) => setExtraDetails({ ...extraDetails, soilType: event.target.value })} required /></div><div className="input-group"><label htmlFor="lead-crop-age">Crop age (weeks)</label><input id="lead-crop-age" type="text" value={extraDetails.cropAge} onChange={(event) => setExtraDetails({ ...extraDetails, cropAge: event.target.value })} required /></div></div><div className="input-group"><label htmlFor="lead-brand">Fertilizer / pesticide brand</label><input id="lead-brand" type="text" value={extraDetails.pesticideBrand} onChange={(event) => setExtraDetails({ ...extraDetails, pesticideBrand: event.target.value })} required /></div><div className="input-group"><label htmlFor="lead-spraying">Expected spraying time / acres</label><input id="lead-spraying" type="text" value={extraDetails.expectedSpraying} onChange={(event) => setExtraDetails({ ...extraDetails, expectedSpraying: event.target.value })} required /></div><div className="form-actions"><button type="submit" className="submit-btn" disabled={processStatus === 'processing'}>{processStatus === 'processing' ? 'Submitting…' : 'Verify and send to scheduling'}</button></div></form></div></> : <div className="panel-body"><div className="empty-state empty-state--center"><span className="panel-title-icon"><OpsIcon name="clipboard" /></span><strong>Select an incoming request</strong><span>Farmer and field details will open here.</span></div></div>}</div>
        </section>
      )}

      {activeTab === 'profile' && (
        <section className="panel panel--raised profile-summary">
          <div className="panel-header"><div className="panel-header__title"><p className="eyebrow">Employee profile</p><h2>{user?.name || 'Sales employee'}</h2><p>Your authenticated work identity.</p></div></div>
          <div className="panel-body data-stack">
            <div className="data-row"><div className="data-row__main"><span className="data-row__title">Work email</span><span className="data-row__meta">{user?.email || 'Not available'}</span></div></div>
            <div className="data-row"><div className="data-row__main"><span className="data-row__title">Role</span><span className="status-badge status-badge--success">Sales Executive</span></div></div>
          </div>
        </section>
      )}
    </OperationsShell>
  );
}

export default MarketingDashboard;
