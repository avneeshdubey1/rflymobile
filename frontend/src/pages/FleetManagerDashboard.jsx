import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import dragAndDropModule from 'react-big-calendar/lib/addons/dragAndDrop';
import { addMinutes, endOfDay, endOfMonth, endOfWeek, format, getDay, parse, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
import { useAuth } from '../context/useAuth';
import OperationsShell from '../components/OperationsShell';
import OpsIcon from '../components/OpsIcon';
import LiveLocationPanel from '../components/LiveLocationPanel';
import { API_URL as API } from '../config';
import MyDrones from '../components/MyDrones';
import AutoAssignmentPolicyPanel from '../components/AutoAssignmentPolicyPanel';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'en-US': enUS } });
const withDragAndDrop = dragAndDropModule.default ?? dragAndDropModule;
const DnDCalendar = withDragAndDrop(Calendar);
const readableStatus = (status) => (status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();
const localDateTimeValue = (date) => {
  const value = new Date(date);
  value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
  return value.toISOString().slice(0, 16);
};
const calendarBounds = (date, view) => {
  if (view === 'day') return { from: startOfDay(date), to: endOfDay(date) };
  if (view === 'week') return { from: startOfWeek(date), to: endOfWeek(date) };
  return { from: startOfWeek(startOfMonth(date)), to: endOfWeek(endOfMonth(date)) };
};

function FleetManagerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'ADMIN';
  const { t } = useTranslation();
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
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [scheduleDraft, setScheduleDraft] = useState({ pilotId: '', copilotId: '', droneId: '', lmvId: '', serviceWindowStart: '', serviceWindowEnd: '' });
  const [editDraft, setEditDraft] = useState(null);
  const [showTerminal, setShowTerminal] = useState(false);
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
      const bounds = calendarBounds(calendarDate, calendarView);
      const assignmentQuery = new URLSearchParams({ from: bounds.from.toISOString(), to: bounds.to.toISOString() });
      const [leadData, pilotData, droneData, lmvData, assignmentData, centerData] = await Promise.all([
        request('/api/leads/pending'), request('/api/users/pilots'), request('/api/drones/all'), request('/api/lmvs/all'), request(`/api/assignments/all?${assignmentQuery}`), request('/api/centers/all')
      ]);
      setLeads(leadData.leads || []);
      setPilots(pilotData.pilots || []);
      setDrones(droneData.drones || []);
      setLmvs(lmvData.lmvs || []);
      setAssignments(assignmentData.missions || []);
      setCenters(centerData.centers || []);
    } catch (error) { showNotice('error', error.message); }
    finally { setLoading(false); }
  }, [calendarDate, calendarView, request, showNotice]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void fetchData(), 0);
    return () => window.clearTimeout(initialLoad);
  }, [fetchData]);

  const manualQueue = useMemo(() => leads.filter((lead) => lead.status === 'NEEDS_MANUAL_SCHEDULING'), [leads]);
  const availableDrones = useMemo(() => drones.filter((drone) => drone.status === 'AVAILABLE'), [drones]);
  const events = useMemo(() => assignments.filter((assignment) => showTerminal || !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(assignment.lead?.status)).map((assignment) => ({
    id: assignment.id,
    title: `${assignment.lead?.farmerName || 'Farmer'} — ${assignment.pilot?.name || 'Pilot'}`,
    start: new Date(assignment.serviceWindowStart || assignment.scheduledDate),
    end: new Date(assignment.serviceWindowEnd || addMinutes(new Date(assignment.scheduledDate), 120)),
    resourceId: assignment.pilotId,
    assignment,
  })), [assignments, showTerminal]);

  const moveEvent = useCallback(({ event, start, end, resourceId, reason }) => {
    void (async () => {
      try {
        const targetPilotId = resourceId || event.resourceId;
        await request(`/api/assignments/${event.id}/reschedule`, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ serviceWindowStart: start.toISOString(), serviceWindowEnd: end.toISOString(), reason, pilotId: targetPilotId })
        });
        showNotice('success', `${event.assignment.lead?.farmerName || 'Assignment'} was rescheduled. Sales has been notified.`);
        await fetchData();
      } catch (error) { showNotice('error', error.message); }
    })();
  }, [fetchData, request, showNotice]);
  const handleEventDrop = useCallback(({ event, start, end, resourceId }) => moveEvent({ event, start, end, resourceId, reason: 'Calendar drag-and-drop' }), [moveEvent]);
  const handleEventResize = useCallback(({ event, start, end }) => moveEvent({ event, start, end, reason: 'Calendar duration changed' }), [moveEvent]);

  const eligiblePilots = useMemo(() => pilots.filter((pilot) => pilot.active && !pilot.archivedAt
    && pilot.pilotAvailabilityState === 'AVAILABLE' && pilot.homeCenterId === selectedLead?.matchedCenterId), [pilots, selectedLead]);
  const eligibleDrones = useMemo(() => drones.filter((drone) => ['AVAILABLE', 'ASSIGNED'].includes(drone.status) && drone.homeCenterId === selectedLead?.matchedCenterId), [drones, selectedLead]);
  const eligibleLmvs = useMemo(() => lmvs.filter((lmv) => ['AVAILABLE', 'ASSIGNED'].includes(lmv.status) && lmv.homeCenterId === selectedLead?.matchedCenterId), [lmvs, selectedLead]);

  const selectLeadForScheduling = useCallback((lead) => {
    const date = new Date(calendarDate);
    date.setHours(9, 0, 0, 0);
    setSelectedLead(lead);
    setScheduleDraft({ pilotId: '', copilotId: '', droneId: '', lmvId: '', serviceWindowStart: localDateTimeValue(date), serviceWindowEnd: localDateTimeValue(addMinutes(date, 120)) });
  }, [calendarDate]);

  const submitCrewSchedule = useCallback(async (event) => {
    event.preventDefault();
    if (!selectedLead) return;
    try {
      await request('/api/assignments/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: selectedLead.id, ...scheduleDraft, serviceWindowStart: new Date(scheduleDraft.serviceWindowStart).toISOString(), serviceWindowEnd: new Date(scheduleDraft.serviceWindowEnd).toISOString() }),
      });
      showNotice('success', `${selectedLead.farmerName} was added to the crew's daily schedule.`);
      setSelectedLead(null);
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  }, [fetchData, request, scheduleDraft, selectedLead, showNotice]);

  const cancelRequest = useCallback(async (event) => {
    event.preventDefault();
    if (!cancelTarget) return;
    try {
      await request(`/api/leads/${cancelTarget.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });
      showNotice('success', `${cancelTarget.farmerName}'s unscheduled request was removed from the queue.`);
      if (selectedLead?.id === cancelTarget.id) setSelectedLead(null);
      setCancelTarget(null);
      setCancelReason('');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  }, [cancelReason, cancelTarget, fetchData, request, selectedLead, showNotice]);

  const openAssignment = useCallback((event) => {
    const assignment = event.assignment;
    setSelectedAssignment(assignment);
    setEditDraft({
      pilotId: assignment.pilotId,
      copilotId: assignment.copilotId || '',
      droneId: assignment.droneId,
      lmvId: assignment.lmvId || '',
      serviceWindowStart: localDateTimeValue(assignment.serviceWindowStart || assignment.scheduledDate),
      serviceWindowEnd: localDateTimeValue(assignment.serviceWindowEnd || addMinutes(new Date(assignment.scheduledDate), 120)),
      dailySequence: assignment.dailySequence,
      reason: '',
    });
  }, []);

  const saveAssignment = useCallback(async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...editDraft,
        serviceWindowStart: new Date(editDraft.serviceWindowStart).toISOString(),
        serviceWindowEnd: new Date(editDraft.serviceWindowEnd).toISOString(),
      };
      if (!isAdmin) delete payload.copilotId;
      await request(`/api/assignments/${selectedAssignment.id}/reschedule`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          ...payload,
        }),
      });
      if (Number(editDraft.dailySequence) !== selectedAssignment.dailySequence) {
        await request(`/api/assignments/${selectedAssignment.id}/sequence`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailySequence: Number(editDraft.dailySequence) }) });
      }
      setSelectedAssignment(null);
      setEditDraft(null);
      showNotice('success', t('calendar_assignment_updated'));
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  }, [editDraft, fetchData, isAdmin, request, selectedAssignment, showNotice, t]);

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
               {isAdmin && <button type="button" className="action-btn" onClick={() => navigate('/admin')}>Return to Admin dashboard</button>}
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

        <AutoAssignmentPolicyPanel compact />

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
                <div className="button-row button-row--end"><button type="button" className="danger-btn" onClick={() => { setCancelTarget(selectedLead); setCancelReason(''); }}>Remove request</button></div>
                <div className="panel-title-row"><div><strong>{selectedLead.farmerName}</strong><p className="caption">{selectedLead.acreage} acres · {selectedLead.matchedCenter?.name || 'No operating center'}</p></div><button type="button" className="action-btn" onClick={() => setSelectedLead(null)}>Change request</button></div>
                {!eligiblePilots.length && <div className="notice notice--error" role="alert">An active Primary Pilot at this operating center is required.</div>}
                {!eligibleDrones.length && <div className="notice notice--error" role="alert">No schedulable drone is registered at this operating center.</div>}
                {!eligibleLmvs.length && <div className="notice notice--error" role="alert">No schedulable LMV is registered at this operating center. Add one from the LMVs tab.</div>}
                <div className="input-group"><label htmlFor="crew-start">{t('calendar_service_start')}</label><input id="crew-start" type="datetime-local" value={scheduleDraft.serviceWindowStart} onChange={(event) => setScheduleDraft({ ...scheduleDraft, serviceWindowStart: event.target.value })} required /></div>
                <div className="input-group"><label htmlFor="crew-end">{t('calendar_service_end')}</label><input id="crew-end" type="datetime-local" value={scheduleDraft.serviceWindowEnd} onChange={(event) => setScheduleDraft({ ...scheduleDraft, serviceWindowEnd: event.target.value })} required /></div>
                <div className="input-group"><label htmlFor="primary-pilot">Primary Pilot</label><select id="primary-pilot" value={scheduleDraft.pilotId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, pilotId: event.target.value })} required><option value="">Select primary Pilot</option>{eligiblePilots.map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}</select></div>
                {isAdmin ? <div className="input-group"><label htmlFor="crew-copilot">Copilot <span className="field-hint">(optional Admin override)</span></label><select id="crew-copilot" value={scheduleDraft.copilotId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, copilotId: event.target.value })}><option value="">Let the Primary Pilot choose</option>{eligiblePilots.filter((pilot) => pilot.id !== scheduleDraft.pilotId).map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}</select></div> : <p className="caption">After Fleet reserves the Primary Pilot, drone and LMV, the Primary Pilot selects one eligible Copilot in the Pilot app.</p>}
                <div className="input-group"><label htmlFor="crew-drone">Drone</label><select id="crew-drone" value={scheduleDraft.droneId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, droneId: event.target.value })} required><option value="">Select drone</option>{eligibleDrones.map((drone) => <option key={drone.id} value={drone.id}>{drone.model} · {drone.serialNumber} ({readableStatus(drone.status)})</option>)}</select></div>
                <div className="input-group"><label htmlFor="crew-lmv">LMV</label><select id="crew-lmv" value={scheduleDraft.lmvId} onChange={(event) => setScheduleDraft({ ...scheduleDraft, lmvId: event.target.value })} required><option value="">Select LMV</option>{eligibleLmvs.map((lmv) => <option key={lmv.id} value={lmv.id}>{lmv.registrationNo}{lmv.label ? ` · ${lmv.label}` : ''} ({readableStatus(lmv.status)})</option>)}</select></div>
                <button type="submit" className="submit-btn button-wide" disabled={!eligiblePilots.length || !eligibleDrones.length || !eligibleLmvs.length}>{isAdmin && scheduleDraft.copilotId ? 'Schedule complete crew' : 'Reserve and request Copilot'}</button>
              </form>}
            </div>
          </aside>

          <section className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="calendar" /></span><h2>{t('calendar_title')}</h2></div><p>{t('calendar_help')}</p></div><label><input type="checkbox" checked={showTerminal} onChange={(event) => setShowTerminal(event.target.checked)} /> {t('calendar_show_terminal')}</label></div>
            <div className="panel-body"><div className="calendar-wrap"><div className="calendar-stage"><DnDCalendar localizer={localizer} events={events} date={calendarDate} view={calendarView} onNavigate={setCalendarDate} onView={setCalendarView} views={['month', 'week', 'day']} defaultView="month" popup selectable resizable onDrillDown={(date) => { setCalendarDate(date); setCalendarView('day'); }} onSelectSlot={({ start, end }) => { if (calendarView === 'month') { setCalendarDate(start); setCalendarView('day'); } else if (selectedLead) { setScheduleDraft((draft) => ({ ...draft, serviceWindowStart: localDateTimeValue(start), serviceWindowEnd: localDateTimeValue(end) })); } }} onSelectEvent={openAssignment} resources={pilots} resourceIdAccessor="id" resourceTitleAccessor="name" onEventDrop={handleEventDrop} onEventResize={handleEventResize} draggableAccessor={(event) => ['SCHEDULED', 'PILOT_ACCEPTED'].includes(event.assignment?.lead?.status)} resizableAccessor={(event) => ['SCHEDULED', 'PILOT_ACCEPTED'].includes(event.assignment?.lead?.status)} eventPropGetter={(event) => ({ style: { backgroundColor: event.assignment?.autoAssigned ? '#2e6b4d' : '#9a6920', border: 0 } })} tooltipAccessor={(event) => `${event.title} (${readableStatus(event.assignment?.lead?.status || event.status)})`} /></div></div></div>
          </section>
        </section>

        {selectedAssignment && editDraft && <section className="panel panel--raised" aria-label="Assignment editor">
          <div className="panel-header"><div className="panel-header__title"><h2>{t('calendar_assignment_details')}</h2><p>{selectedAssignment.lead?.farmerName} · {selectedAssignment.lead?.matchedCenter?.name || selectedAssignment.lead?.village || t('calendar_operating_center')}</p></div><button type="button" className="action-btn" onClick={() => setSelectedAssignment(null)}>{t('calendar_close')}</button></div>
          <form className="panel-body form-stack" onSubmit={saveAssignment}>
            <p>{t('calendar_origin')}: {selectedAssignment.autoAssigned ? t('auto_policy_automatic') : t('calendar_manual')} · {t('calendar_status')}: {readableStatus(selectedAssignment.lead?.status)}</p>
            <p>{t('calendar_weather')}: {selectedAssignment.weatherCheckedAt ? (selectedAssignment.weatherSuitable === true ? t('calendar_weather_suitable') : selectedAssignment.weatherSuitable === false ? t('calendar_weather_unsuitable') : t('calendar_weather_unavailable')) : t('calendar_weather_not_checked')}</p>
            <label className="input-group"><span>{t('calendar_service_start')}</span><input type="datetime-local" value={editDraft.serviceWindowStart} onChange={(event) => setEditDraft({ ...editDraft, serviceWindowStart: event.target.value })} required /></label>
            <label className="input-group"><span>{t('calendar_service_end')}</span><input type="datetime-local" value={editDraft.serviceWindowEnd} onChange={(event) => setEditDraft({ ...editDraft, serviceWindowEnd: event.target.value })} required /></label>
            <label className="input-group"><span>Primary Pilot</span><select value={editDraft.pilotId} onChange={(event) => setEditDraft({ ...editDraft, pilotId: event.target.value })}>{pilots.filter((pilot) => pilot.active && pilot.pilotAvailabilityState === 'AVAILABLE' && pilot.homeCenterId === selectedAssignment.lead?.matchedCenterId).map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}</select></label>
            {isAdmin ? <label className="input-group"><span>Copilot</span><select value={editDraft.copilotId} onChange={(event) => setEditDraft({ ...editDraft, copilotId: event.target.value })}><option value="">Await Primary Pilot selection</option>{pilots.filter((pilot) => pilot.active && pilot.pilotAvailabilityState === 'AVAILABLE' && pilot.homeCenterId === selectedAssignment.lead?.matchedCenterId && pilot.id !== editDraft.pilotId).map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name}</option>)}</select></label> : <p className="caption">Copilot: {selectedAssignment.copilot?.name || 'Awaiting the Primary Pilot\'s selection in the Pilot app.'}</p>}
            <label className="input-group"><span>Drone</span><select value={editDraft.droneId} onChange={(event) => setEditDraft({ ...editDraft, droneId: event.target.value })}>{drones.filter((drone) => drone.homeCenterId === selectedAssignment.lead?.matchedCenterId).map((drone) => <option key={drone.id} value={drone.id}>{drone.model} · {drone.serialNumber}</option>)}</select></label>
            <label className="input-group"><span>LMV</span><select value={editDraft.lmvId} onChange={(event) => setEditDraft({ ...editDraft, lmvId: event.target.value })}>{lmvs.filter((lmv) => lmv.homeCenterId === selectedAssignment.lead?.matchedCenterId).map((lmv) => <option key={lmv.id} value={lmv.id}>{lmv.registrationNo}</option>)}</select></label>
            <label className="input-group"><span>{t('calendar_daily_sequence')}</span><input type="number" min="1" value={editDraft.dailySequence} onChange={(event) => setEditDraft({ ...editDraft, dailySequence: event.target.value })} required /></label>
            <label className="input-group"><span>{t('calendar_change_reason')}</span><textarea minLength="3" maxLength="500" value={editDraft.reason} onChange={(event) => setEditDraft({ ...editDraft, reason: event.target.value })} required /></label>
            <button className="submit-btn" type="submit">{t('calendar_save')}</button>
          </form>
        </section>}
      </section>
      )}

      {activeSection === 'pilots' && (
        <section className="user-admin-grid">
          {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="users" /></span><h2>Registered Pilots</h2></div><p>{pilots.length} pilot(s).</p></div></div>
            <div className="data-stack">{pilots.map((pilot) => <div className="data-row" key={pilot.id}><div className="data-row__main"><span className="data-row__title">{pilot.name}</span><span className="data-row__meta">{pilot.email}</span><span className={`status-badge status-badge--${pilot.active && pilot.pilotAvailabilityState === 'AVAILABLE' ? 'success' : 'danger'}`}>{!pilot.active ? 'Account inactive' : pilot.pilotAvailabilityState === 'AVAILABLE' ? 'Available for work' : 'Pilot offline'}</span></div><div className="data-row__actions"><label className="input-group"><span>Operating center</span><select value={pilot.homeCenterId || ''} onChange={(event) => void updatePilotCenter(pilot.id, event.target.value)}><option value="" disabled>Select center</option>{centers.filter((center) => center.active).map((center) => <option key={center.id} value={center.id}>{center.name}</option>)}</select></label></div></div>)}</div>
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
      {cancelTarget && <div className="modal-backdrop" role="presentation"><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="cancel-request-title"><div className="modal-card__header"><div><p className="eyebrow">Remove unscheduled request</p><h2 id="cancel-request-title">Remove {cancelTarget.farmerName}'s request?</h2></div><button type="button" className="icon-button" aria-label="Close removal dialog" onClick={() => setCancelTarget(null)}>×</button></div><p className="muted">This clears the obsolete request from the manual scheduling queue and preserves its audit history. Scheduled or started missions cannot be removed here.</p><form className="form-stack" onSubmit={cancelRequest}><div className="input-group"><label htmlFor="cancel-request-reason">Reason</label><textarea id="cancel-request-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} minLength="3" maxLength="500" required /></div><div className="button-row button-row--end"><button type="button" className="action-btn" onClick={() => setCancelTarget(null)}>Keep request</button><button type="submit" className="danger-btn">Remove request</button></div></form></section></div>}
    </OperationsShell>
  );
}

export default FleetManagerDashboard;
