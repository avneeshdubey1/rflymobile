import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import dragAndDropModule from 'react-big-calendar/lib/addons/dragAndDrop';
import { addHours, format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import LiveLocationPanel from '../components/LiveLocationPanel';
import { API_URL as API } from '../config';
import MyDrones from '../components/MyDrones';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'en-US': enUS } });
const withDragAndDrop = dragAndDropModule.default ?? dragAndDropModule;
const DnDCalendar = withDragAndDrop(Calendar);
const readableStatus = (status) => (status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const localDateTimeValue = (date) => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};

function FleetManagerDashboard() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('schedule');
  const [leads, setLeads] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [drones, setDrones] = useState([]);
  const [lmvs, setLmvs] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [scheduleDraft, setScheduleDraft] = useState({ pilotId: '', copilotId: '', droneId: '', lmvId: '', scheduledDate: '' });
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const emptyPilot = { name: '', email: '', phone: '', password: '', homeCenterId: '', idProof: '', licenseId: '', addressLine1: '', addressLine2: '', state: '', city: '', pincode: '' };
  const [newPilot, setNewPilot] = useState(emptyPilot);
  const [newLmv, setNewLmv] = useState({ registrationNo: '', label: '', homeCenterId: '', capacity: 1 });

  const showNotice = useCallback((kind, message) => setNotice({ kind, message }), []);
  const request = useCallback(async (url, options) => {
    const response = await fetch(`${API}${url}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'The request could not be completed');
    return data;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [leadData, pilotData, droneData, lmvData, assignmentData, centerData] = await Promise.all([
        request('/api/leads/pending'), request('/api/users/pilots'), request('/api/drones/all'), request('/api/lmvs/all'), request('/api/assignments/all'), request('/api/centers/all')
      ]);
      setLeads(leadData.leads || []);
      setPilots(pilotData.pilots || []);
      setDrones(droneData.drones || []);
      setLmvs(lmvData.lmvs || []);
      setAssignments(assignmentData.missions || []);
      setCenters(centerData.centers || []);
    } catch (error) { showNotice('error', error.message); }
    finally { setLoading(false); }
  }, [request, showNotice]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [fetchData]);

  const manualQueue = useMemo(() => leads.filter((lead) => lead.status === 'NEEDS_MANUAL_SCHEDULING'), [leads]);
  const availableDrones = useMemo(() => drones.filter((drone) => drone.status === 'AVAILABLE'), [drones]);
  const events = useMemo(() => assignments.map((assignment) => ({
    id: assignment.id,
    title: `${assignment.lead?.farmerName || 'Farmer'} — ${assignment.pilot?.name || 'Pilot'}`,
    start: new Date(assignment.scheduledDate),
    end: addHours(new Date(assignment.scheduledDate), 2),
    resourceId: assignment.pilotId,
    assignment,
  })), [assignments]);

  const handleEventDrop = useCallback(({ event, start, resourceId }) => {
    void (async () => {
      try {
        const targetPilotId = resourceId || event.resourceId;
        await request(`/api/assignments/${event.id}/reschedule`, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ scheduledDate: start.toISOString(), reason: 'Calendar drag-and-drop', pilotId: targetPilotId }) 
        });
        showNotice('success', `${event.assignment.lead?.farmerName || 'Assignment'} was rescheduled. Sales has been notified.`);
        await fetchData();
      } catch (error) { showNotice('error', error.message); }
    })();
  }, [fetchData, request, showNotice]);

  const eligiblePilots = useMemo(() => pilots.filter((pilot) => pilot.active && !pilot.archivedAt && pilot.homeCenterId === selectedLead?.matchedCenterId), [pilots, selectedLead]);
  const eligibleDrones = useMemo(() => drones.filter((drone) => ['AVAILABLE', 'ASSIGNED'].includes(drone.status) && drone.homeCenterId === selectedLead?.matchedCenterId), [drones, selectedLead]);
  const eligibleLmvs = useMemo(() => lmvs.filter((lmv) => ['AVAILABLE', 'ASSIGNED'].includes(lmv.status) && lmv.homeCenterId === selectedLead?.matchedCenterId), [lmvs, selectedLead]);

  const selectLeadForScheduling = useCallback((lead) => {
    const date = new Date(calendarDate);
    date.setHours(9, 0, 0, 0);
    setSelectedLead(lead);
    setScheduleDraft({ pilotId: '', copilotId: '', droneId: '', lmvId: '', scheduledDate: localDateTimeValue(date) });
  }, [calendarDate]);

  const submitCrewSchedule = useCallback(async (event) => {
    event.preventDefault();
    if (!selectedLead) return;
    if (scheduleDraft.pilotId === scheduleDraft.copilotId) { showNotice('error', 'Primary Pilot and Copilot must be different people.'); return; }
    try {
      await request('/api/assignments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, ...scheduleDraft, scheduledDate: new Date(scheduleDraft.scheduledDate).toISOString() }),
      });
      showNotice('success', `${selectedLead.farmerName} was added to the crew's daily schedule.`);
      setSelectedLead(null);
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  }, [fetchData, request, scheduleDraft, selectedLead, showNotice]);

  const selectSection = (id) => {
    setActiveSection(id);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  
  const handleAddPilot = async (e) => {
    e.preventDefault();
    try {
      await request('/api/users/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newPilot, role: 'PILOT' }) });
      setNewPilot(emptyPilot);
      showNotice('success', 'Pilot added. Requires admin approval to activate.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };

  const updatePilotCenter = async (pilotId, homeCenterId) => {
    try {
      await request(`/api/users/${pilotId}/operating-center`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeCenterId }),
      });
      showNotice('success', 'Pilot operating center updated.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };

  const handleAddLmv = async (event) => {
    event.preventDefault();
    try {
      await request('/api/lmvs/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLmv) });
      setNewLmv({ registrationNo: '', label: '', homeCenterId: '', capacity: 1 });
      showNotice('success', 'LMV registered and available for scheduling.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };

  const updateLmvStatus = async (lmvId, status) => {
    try {
      await request('/api/lmvs/update-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lmvId, status }) });
      showNotice('success', 'LMV status updated.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };

  const [showProfileMenu, setShowProfileMenu] = useState(false);

const pageCopy = {
  schedule: ['Fleet manager', 'Exception scheduling calendar', 'Resolve requests that need a human scheduling decision and monitor current allocations.'],
  pilots: ['Fleet manager', 'Pilots', 'Manage registered pilots and their operating centers.'],
  drones: ['Fleet manager', 'Drones', 'Register and manage fleet aircraft.'],
  lmvs: ['Fleet manager', 'Light motor vehicles', 'Each scheduled crew reserves one LMV.'],
  location: ['Fleet manager', 'Live Pilot GPS', 'Track pilot locations in real time.'],
};

const [eyebrow, title, description] = pageCopy[activeSection] || pageCopy.schedule;
  const navItems = [
    { id: 'schedule', label: 'Scheduling board', icon: 'calendar', badge: manualQueue.length || null },
    { id: 'pilots', label: 'Pilots', icon: 'users' },
    { id: 'drones', label: 'Drones', icon: 'drone' },
    { id: 'lmvs', label: 'LMVs', icon: 'truck' },
    { id: 'location', label: 'Live Pilot GPS', icon: 'location' },
  ];

  return (
    <OperationsShell roleLabel="Fleet operations" navItems={navItems} activeTab={activeSection} onTabChange={selectSection} user={user}  onLogout={logout}>
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
                         selectSection("profile");
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
     
      {activeSection === 'schedule' && (
      <section id="schedule">
        {/* <header className="page-header">
          <div className="page-header__copy"><p className="eyebrow">Fleet manager</p><h1>Exception scheduling calendar</h1><p>Resolve requests that need a human scheduling decision and monitor current allocations.</p></div>
          <div className="page-header__actions"><button type="button" className="action-btn" onClick={() => void fetchData()}><OpsIcon name="refresh" /> Refresh board</button></div>
        </header> */}

        {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

        <section className="metric-grid" aria-label="Scheduling summary">
          <article className="metric-card metric-card--accent"><div className="metric-card__top"><span>Manual queue</span><span className="metric-card__icon"><OpsIcon name="alert" /></span></div><strong className="metric-card__value">{manualQueue.length}</strong></article>
          <article className="metric-card"><div className="metric-card__top"><span>Pilots</span><span className="metric-card__icon"><OpsIcon name="users" /></span></div><strong className="metric-card__value">{pilots.length}</strong></article>
          <article className="metric-card metric-card--info"><div className="metric-card__top"><span>Available drones</span><span className="metric-card__icon"><OpsIcon name="drone" /></span></div><strong className="metric-card__value">{availableDrones.length}</strong></article>
          <article className="metric-card"><div className="metric-card__top"><span>Assignments</span><span className="metric-card__icon"><OpsIcon name="calendar" /></span></div><strong className="metric-card__value">{assignments.length}</strong></article>
        </section>

        <section className="fleet-layout">
          <aside className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="clipboard" /></span><h2>Crew scheduling</h2></div><p>Select a request, then assign its complete two-person operational unit.</p></div></div>
            <div className="panel-body form-stack">
              {!selectedLead && <div className="section-gap">
                {loading && <div className="empty-state"><strong>Loading requests…</strong></div>}
                {!loading && !manualQueue.length && <div className="empty-state"><strong>No scheduling exceptions</strong><span>All verified requests have an assignment path.</span></div>}
                {manualQueue.map((lead) => <article key={lead.id} className="queue-card"><strong>{lead.farmerName}</strong><p className="caption">{lead.village || 'Location pending'} · {lead.acreage} acres</p><p className="caption">Center: {lead.matchedCenter?.name || 'Not matched'}</p><p className="queue-card__warning">{lead.notes || 'Manual crew assignment required.'}</p><button type="button" className="submit-btn button-wide" onClick={() => selectLeadForScheduling(lead)}>Choose crew and time</button></article>)}
              </div>}
              {selectedLead && <form className="form-stack" onSubmit={submitCrewSchedule}>
                <div className="panel-title-row"><div><strong>{selectedLead.farmerName}</strong><p className="caption">{selectedLead.acreage} acres · {selectedLead.matchedCenter?.name || 'No operating center'}</p></div><button type="button" className="action-btn" onClick={() => setSelectedLead(null)}>Change request</button></div>
                {eligiblePilots.length < 2 && <div className="notice notice--error" role="alert">Two active Pilots at this operating center are required. Admin must activate both accounts and assign their center.</div>}
                {!eligibleDrones.length && <div className="notice notice--error" role="alert">No schedulable drone is registered at this operating center.</div>}
                {!eligibleLmvs.length && <div className="notice notice--error" role="alert">No schedulable LMV is registered at this operating center. Add one from the LMVs tab.</div>}
                <div className="input-group"><label htmlFor="crew-date">Date and start time</label><input id="crew-date" type="datetime-local" value={scheduleDraft.scheduledDate} onChange={(event) => setScheduleDraft({ ...scheduleDraft, scheduledDate: event.target.value })} required /></div>
                <div className="input-group"><label htmlFor="primary-pilot">Primary Pilot</label><select id="primary-pilot" value={scheduleDraft.pilotId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, pilotId: event.target.value })} required><option value="">Select primary Pilot</option>{eligiblePilots.map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}</select></div>
                <div className="input-group"><label htmlFor="copilot">Copilot</label><select id="copilot" value={scheduleDraft.copilotId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, copilotId: event.target.value })} required><option value="">Select Copilot</option>{eligiblePilots.filter((pilot) => pilot.id !== scheduleDraft.pilotId).map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}</select></div>
                <div className="input-group"><label htmlFor="crew-drone">Drone</label><select id="crew-drone" value={scheduleDraft.droneId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, droneId: event.target.value })} required><option value="">Select drone</option>{eligibleDrones.map((drone) => <option key={drone.id} value={drone.id}>{drone.model} · {drone.serialNumber} ({readableStatus(drone.status)})</option>)}</select></div>
                <div className="input-group"><label htmlFor="crew-lmv">LMV</label><select id="crew-lmv" value={scheduleDraft.lmvId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, lmvId: event.target.value })} required><option value="">Select LMV</option>{eligibleLmvs.map((lmv) => <option key={lmv.id} value={lmv.id}>{lmv.registrationNo}{lmv.label ? ` · ${lmv.label}` : ''} ({readableStatus(lmv.status)})</option>)}</select></div>
                <button type="submit" className="submit-btn button-wide" disabled={eligiblePilots.length < 2 || !eligibleDrones.length || !eligibleLmvs.length}>Add to daily schedule</button>
              </form>}
            </div>
          </aside>

          <section className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="calendar" /></span><h2>Pilot calendar</h2></div><p>Click a date for day view. Drag an existing assignment to reschedule it.</p></div></div>
            <div className="panel-body"><div className="calendar-wrap"><div className="calendar-stage"><DnDCalendar localizer={localizer} events={events} date={calendarDate} view={calendarView} onNavigate={setCalendarDate} onView={setCalendarView} views={['month', 'week', 'day']} defaultView="month" popup selectable onDrillDown={(date) => { setCalendarDate(date); setCalendarView('day'); }} onSelectSlot={({ start }) => { if (calendarView === 'month') { setCalendarDate(start); setCalendarView('day'); } }} resources={pilots} resourceIdAccessor="id" resourceTitleAccessor="name" onEventDrop={handleEventDrop} draggableAccessor={(event) => ['SCHEDULED', 'PILOT_ACCEPTED'].includes(event.assignment?.lead?.status)} eventPropGetter={(event) => ({ style: { backgroundColor: event.assignment?.autoAssigned ? '#2e6b4d' : '#9a6920', border: 0 } })} tooltipAccessor={(event) => `${event.title} (${readableStatus(event.assignment?.lead?.status || event.status)})`} /></div></div></div>
          </section>
        </section>
      </section>
      )}

      {activeSection === 'pilots' && (
        <section className="user-admin-grid">
          {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="users" /></span><h2>Registered Pilots</h2></div><p>{pilots.length} pilot(s).</p></div></div>
            <div className="data-stack">{pilots.map((pilot) => <div className="data-row" key={pilot.id}><div className="data-row__main"><span className="data-row__title">{pilot.name}</span><span className="data-row__meta">{pilot.email}</span><span className={`status-badge status-badge--${pilot.active ? 'success' : 'danger'}`}>{pilot.active ? 'Active' : 'Pending Admin Approval'}</span></div><div className="data-row__actions"><label className="input-group"><span>Operating center</span><select value={pilot.homeCenterId || ''} onChange={(event) => void updatePilotCenter(pilot.id, event.target.value)}><option value="" disabled>Select center</option>{centers.filter((center) => center.active).map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label></div></div>)}</div>
          </div>
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Add Pilot</h2></div><p>Register a new pilot. Requires admin activation.</p></div></div>
            <form className="panel-body form-stack" onSubmit={handleAddPilot}>
              <div className="input-group"><label>Full Name</label><input type="text" value={newPilot.name} onChange={(e) => setNewPilot({ ...newPilot, name: e.target.value })} required /></div>
              <div className="input-group"><label>Email</label><input type="email" value={newPilot.email} onChange={(e) => setNewPilot({ ...newPilot, email: e.target.value })} required /></div>
              <div className="input-group"><label>Mobile Number</label><input type="tel" value={newPilot.phone} onChange={(e) => setNewPilot({ ...newPilot, phone: e.target.value })} required /></div>
              <div className="input-group"><label>Temporary Password</label><input type="password" value={newPilot.password} onChange={(e) => setNewPilot({ ...newPilot, password: e.target.value })} minLength={12} required /></div>
              <div className="input-group"><label>Home Center</label><select value={newPilot.homeCenterId} onChange={(e) => setNewPilot({ ...newPilot, homeCenterId: e.target.value })} required><option value="">Select Center</option>{centers.filter((center) => center.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="input-group"><label>ID Proof Reference</label><input value={newPilot.idProof} onChange={(e) => setNewPilot({ ...newPilot, idProof: e.target.value })} required /></div>
              <div className="input-group"><label>Pilot License ID</label><input value={newPilot.licenseId} onChange={(e) => setNewPilot({ ...newPilot, licenseId: e.target.value })} required /></div>
              <div className="input-group"><label>Address Line 1</label><input value={newPilot.addressLine1} onChange={(e) => setNewPilot({ ...newPilot, addressLine1: e.target.value })} required /></div>
              <div className="input-group"><label>Address Line 2 (optional)</label><input value={newPilot.addressLine2} onChange={(e) => setNewPilot({ ...newPilot, addressLine2: e.target.value })} /></div>
              <div className="input-group"><label>State</label><input value={newPilot.state} onChange={(e) => setNewPilot({ ...newPilot, state: e.target.value })} required /></div>
              <div className="input-group"><label>City</label><input value={newPilot.city} onChange={(e) => setNewPilot({ ...newPilot, city: e.target.value })} required /></div>
              <div className="input-group"><label>Pincode</label><input inputMode="numeric" pattern="[0-9]{6}" value={newPilot.pincode} onChange={(e) => setNewPilot({ ...newPilot, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} required /></div>
              <div className="form-actions"><button type="submit" className="submit-btn">Add Pilot</button></div>
            </form>
          </div>
        </section>
      )}

{activeSection === 'drones' && <MyDrones/>}
      {activeSection === 'lmvs' && (
        <section className="user-admin-grid">
          {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="truck" /></span><h2>Light motor vehicles</h2></div><p>Each scheduled crew reserves one LMV.</p></div></div>
            <div className="data-stack">{lmvs.map((lmv) => <div className="data-row" key={lmv.id}><div className="data-row__main"><span className="data-row__title">{lmv.registrationNo}{lmv.label ? ` · ${lmv.label}` : ''}</span><span className="data-row__meta">Center: {lmv.homeCenter?.name || 'N/A'}</span><span className="status-badge">{readableStatus(lmv.status)}</span></div><div className="data-row__actions">{lmv.status === 'AVAILABLE' && <><button type="button" className="action-btn" onClick={() => void updateLmvStatus(lmv.id, 'MAINTENANCE')}>Maintenance</button><button type="button" className="danger-btn" onClick={() => void updateLmvStatus(lmv.id, 'OUT_OF_SERVICE')}>Out of service</button></>}{['MAINTENANCE', 'OUT_OF_SERVICE'].includes(lmv.status) && <button type="button" className="submit-btn" onClick={() => void updateLmvStatus(lmv.id, 'AVAILABLE')}>Return to service</button>}</div></div>)}</div>
          </div>
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Add LMV</h2></div><p>Keep registration and assigned operating center current.</p></div></div>
            <form className="panel-body form-stack" onSubmit={handleAddLmv}>
              <div className="input-group"><label htmlFor="lmv-registration">Registration number</label><input id="lmv-registration" value={newLmv.registrationNo} onChange={(event) => setNewLmv({ ...newLmv, registrationNo: event.target.value })} required /></div>
              <div className="input-group"><label htmlFor="lmv-label">Short label (optional)</label><input id="lmv-label" value={newLmv.label} onChange={(event) => setNewLmv({ ...newLmv, label: event.target.value })} /></div>
              <div className="input-group"><label htmlFor="lmv-center">Operating center</label><select id="lmv-center" value={newLmv.homeCenterId} onChange={(event) => setNewLmv({ ...newLmv, homeCenterId: event.target.value })} required><option value="">Select active center</option>{centers.filter((center) => center.active).map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></div>
              <button type="submit" className="submit-btn">Register LMV</button>
            </form>
          </div>
        </section>
      )}

      {activeSection === 'location' && <section id="location" className="section-gap"><LiveLocationPanel /></section>}
    </OperationsShell>
  );
}

export default FleetManagerDashboard;
