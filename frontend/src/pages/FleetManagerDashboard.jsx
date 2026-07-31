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
import BhumeetLogbook from '../components/BhumeetLogbook';
import AcreageTrend from '../components/AcreageTrend';
import { API_URL as API } from '../config';

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { 'en-US': enUS } });
const withDragAndDrop = dragAndDropModule.default ?? dragAndDropModule;
const DnDCalendar = withDragAndDrop(Calendar);
const readableStatus = (status) => (status || 'UNKNOWN').replaceAll('_', ' ').toLowerCase();

function FleetManagerDashboard() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('schedule');
  const [leads, setLeads] = useState([]);
  const [pilots, setPilots] = useState([]);
  const [drones, setDrones] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState('month');
  const [draggedLead, setDraggedLead] = useState(null);
  const [selectedPilotId, setSelectedPilotId] = useState('');
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [centers, setCenters] = useState([]);
  const [newPilot, setNewPilot] = useState({ name: '', email: '', password: '', homeCenterId: '' });
  const [newDrone, setNewDrone] = useState({ model: '', serialNumber: '', homeCenterId: '' });

  const showNotice = useCallback((kind, message) => setNotice({ kind, message }), []);
  const request = useCallback(async (url, options) => {
    const response = await fetch(`${API}${url}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) throw new Error(data.error || 'The request could not be completed');
    return data;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [leadData, pilotData, droneData, assignmentData, centerData] = await Promise.all([
        request('/api/leads/pending'), request('/api/users/pilots'), request('/api/drones/all'), request('/api/assignments/all'), request('/api/centers/all')
      ]);
      setLeads(leadData.leads || []);
      setPilots(pilotData.pilots || []);
      setDrones(droneData.drones || []);
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

  const getAvailableDrone = useCallback((lead) => drones.find((drone) => drone.status === 'AVAILABLE' && drone.homeCenterId === lead.matchedCenterId), [drones]);
  const createAssignment = useCallback(async (lead, pilot, scheduledDate) => {
    if (!pilot) { showNotice('error', 'Drop the request onto a pilot column, or choose a pilot first.'); return; }
    const drone = getAvailableDrone(lead);
    if (!drone) { showNotice('error', `No available drone is at ${lead.matchedCenter?.name || 'this lead’s operating centre'}.`); return; }
    try {
      await request('/api/assignments/manual', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, droneId: drone.id, scheduledDate }) });
      setDraggedLead(null);
      showNotice('success', `${lead.farmerName} is scheduled with ${pilot.name}. The pilot was notified.`);
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  }, [fetchData, getAvailableDrone, request, showNotice]);

  const handleDropFromOutside = useCallback(({ start, resourceId }) => {
    if (!draggedLead) return;
    const targetPilotId = resourceId || selectedPilotId;
    void createAssignment(draggedLead, pilots.find((pilot) => pilot.id === targetPilotId), start);
  }, [createAssignment, draggedLead, pilots, selectedPilotId]);

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

  const scheduleSelectedLead = useCallback((lead) => {
    const scheduledDate = new Date(calendarDate);
    scheduledDate.setHours(9, 0, 0, 0);
    void createAssignment(lead, pilots.find((pilot) => pilot.id === selectedPilotId), scheduledDate);
  }, [calendarDate, createAssignment, pilots, selectedPilotId]);

  const selectSection = (id) => {
    setActiveSection(id);
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };
  
  const handleAddPilot = async (e) => {
    e.preventDefault();
    try {
      await request('/api/users/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newPilot, role: 'PILOT' }) });
      setNewPilot({ name: '', email: '', password: '', homeCenterId: '' });
      showNotice('success', 'Pilot added. Requires admin approval to activate.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };

  const handleAddDrone = async (e) => {
    e.preventDefault();
    try {
      await request('/api/drones/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newDrone) });
      setNewDrone({ model: '', serialNumber: '', homeCenterId: '' });
      showNotice('success', 'Drone registered.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };

  const handleResolveMaintenance = async (droneId, action) => {
    try {
      await request('/api/drones/resolve-maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ droneId, action }) });
      showNotice('success', action === 'approve' ? 'Maintenance approved.' : 'Maintenance rejected.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };
  
  const requestMaintenance = async (droneId) => {
    try {
      await request('/api/drones/request-maintenance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ droneId, reason: 'Fleet manager request' }) });
      showNotice('success', 'Maintenance requested.');
      await fetchData();
    } catch (error) { showNotice('error', error.message); }
  };

  const navItems = [
    { id: 'schedule', label: 'Scheduling board', icon: 'calendar', badge: manualQueue.length || null },
    { id: 'pilots', label: 'Pilots', icon: 'users' },
    { id: 'drones', label: 'Drones', icon: 'drone' },
    { id: 'location', label: 'Live Pilot GPS', icon: 'location' },
    { id: 'bhumeet', label: 'Bhumeet Logs', icon: 'list' },
    { id: 'acreage', label: 'Acreage Trend', icon: 'database' },
  ];

  return (
    <OperationsShell roleLabel="Fleet operations" navItems={navItems} activeTab={activeSection} onTabChange={selectSection} user={user}  onLogout={logout}>
      {activeSection === 'schedule' && (
      <section id="schedule">
        <header className="page-header">
          <div className="page-header__copy"><p className="eyebrow">Fleet manager</p><h1>Exception scheduling calendar</h1><p>Resolve requests that need a human scheduling decision and monitor current allocations.</p></div>
          <div className="page-header__actions"><button type="button" className="action-btn" onClick={() => void fetchData()}><OpsIcon name="refresh" /> Refresh board</button></div>
        </header>

        {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}

        <section className="metric-grid" aria-label="Scheduling summary">
          <article className="metric-card metric-card--accent"><div className="metric-card__top"><span>Manual queue</span><span className="metric-card__icon"><OpsIcon name="alert" /></span></div><strong className="metric-card__value">{manualQueue.length}</strong></article>
          <article className="metric-card"><div className="metric-card__top"><span>Pilots</span><span className="metric-card__icon"><OpsIcon name="users" /></span></div><strong className="metric-card__value">{pilots.length}</strong></article>
          <article className="metric-card metric-card--info"><div className="metric-card__top"><span>Available drones</span><span className="metric-card__icon"><OpsIcon name="drone" /></span></div><strong className="metric-card__value">{availableDrones.length}</strong></article>
          <article className="metric-card"><div className="metric-card__top"><span>Assignments</span><span className="metric-card__icon"><OpsIcon name="calendar" /></span></div><strong className="metric-card__value">{assignments.length}</strong></article>
        </section>

        <section className="fleet-layout">
          <aside className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="clipboard" /></span><h2>Manual scheduling queue</h2></div><p>Drag a request onto a pilot’s day or use the picker.</p></div></div>
            <div className="panel-body">
              <div className="input-group"><label htmlFor="pilot-picker">Alternative pilot picker</label><select id="pilot-picker" value={selectedPilotId} onChange={(event) => setSelectedPilotId(event.target.value)}><option value="">Choose a pilot</option>{pilots.map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name} — {pilot.homeCenter?.name || 'no centre'}</option>)}</select></div>
              <div className="section-gap">
                {loading && <div className="empty-state"><strong>Loading scheduling data…</strong><span>Checking people, aircraft, and assignments.</span></div>}
                {!loading && !manualQueue.length && <div className="empty-state"><strong>No scheduling exceptions</strong><span>All verified requests have an assignment path.</span></div>}
                {manualQueue.map((lead) => <article key={lead.id} className="queue-card" draggable onDragStart={() => setDraggedLead({ ...lead, title: lead.farmerName })}><strong>{lead.farmerName}</strong><p className="caption">{lead.village || 'Location pending'} · {lead.acreage} acres</p><p className="queue-card__warning">{lead.notes || 'No automatic match was available.'}</p><button type="button" className="submit-btn button-wide" onClick={() => scheduleSelectedLead(lead)}>Schedule on selected date</button></article>)}
              </div>
            </div>
          </aside>

          <section className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="calendar" /></span><h2>Pilot calendar</h2></div><p>Click a date for day view. Drag an assignment to reschedule it.</p></div></div>
            <div className="panel-body"><div className="calendar-wrap"><div className="calendar-stage"><DnDCalendar localizer={localizer} events={events} date={calendarDate} view={calendarView} onNavigate={setCalendarDate} onView={setCalendarView} views={['month', 'week', 'day']} defaultView="month" popup selectable onDrillDown={(date) => { setCalendarDate(date); setCalendarView('day'); }} onSelectSlot={({ start }) => { if (calendarView === 'month') { setCalendarDate(start); setCalendarView('day'); } }} resources={pilots} resourceIdAccessor="id" resourceTitleAccessor="name" onDropFromOutside={handleDropFromOutside} dragFromOutsideItem={() => draggedLead ? { ...draggedLead, start: new Date(), end: addHours(new Date(), 2) } : null} onDragOver={(event) => event.preventDefault()} onEventDrop={handleEventDrop} draggableAccessor={(event) => ['SCHEDULED', 'PILOT_ACCEPTED'].includes(event.assignment?.lead?.status)} eventPropGetter={(event) => ({ style: { backgroundColor: event.assignment?.autoAssigned ? '#2e6b4d' : '#9a6920', border: 0 } })} tooltipAccessor={(event) => `${event.title} (${readableStatus(event.assignment?.lead?.status || event.status)})`} /></div></div></div>
          </section>
        </section>
      </section>
      )}

      {activeSection === 'pilots' && (
        <section className="user-admin-grid">
          {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="users" /></span><h2>Registered Pilots</h2></div><p>{pilots.length} pilot(s).</p></div></div>
            <div className="data-stack">{pilots.map((pilot) => <div className="data-row" key={pilot.id}><div className="data-row__main"><span className="data-row__title">{pilot.name}</span><span className="data-row__meta">{pilot.email} | Center: {pilot.homeCenter?.name || 'N/A'}</span><span className={`status-badge status-badge--${pilot.active ? 'success' : 'danger'}`}>{pilot.active ? 'Active' : 'Pending Admin Approval'}</span></div></div>)}</div>
          </div>
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Add Pilot</h2></div><p>Register a new pilot. Requires admin activation.</p></div></div>
            <form className="panel-body form-stack" onSubmit={handleAddPilot}>
              <div className="input-group"><label>Full Name</label><input type="text" value={newPilot.name} onChange={(e) => setNewPilot({ ...newPilot, name: e.target.value })} required /></div>
              <div className="input-group"><label>Email</label><input type="email" value={newPilot.email} onChange={(e) => setNewPilot({ ...newPilot, email: e.target.value })} required /></div>
              <div className="input-group"><label>Temporary Password</label><input type="password" value={newPilot.password} onChange={(e) => setNewPilot({ ...newPilot, password: e.target.value })} minLength={12} required /></div>
              <div className="input-group"><label>Home Center</label><select value={newPilot.homeCenterId} onChange={(e) => setNewPilot({ ...newPilot, homeCenterId: e.target.value })} required><option value="">Select Center</option>{centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="form-actions"><button type="submit" className="submit-btn">Add Pilot</button></div>
            </form>
          </div>
        </section>
      )}

      {activeSection === 'drones' && (
        <section className="user-admin-grid">
          {notice && <div role="alert" className={`notice notice--${notice.kind}`}><span>{notice.message}</span><button type="button" className="notice__close" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="drone" /></span><h2>Fleet Aircraft</h2></div><p>{drones.length} drone(s).</p></div></div>
            <div className="data-stack">{drones.map((drone) => <div className="data-row" key={drone.id}><div className="data-row__main"><span className="data-row__title">{drone.model} - {drone.serialNumber}</span><span className="data-row__meta">Center: {drone.homeCenter?.name || 'N/A'}</span><span className="status-badge">{readableStatus(drone.status)}</span></div><div className="data-row__actions">{drone.status === 'AVAILABLE' && <button className="action-btn" type="button" onClick={() => requestMaintenance(drone.id)}>Request Maintenance</button>}{drone.status === 'MAINTENANCE' && drone.maintenanceRequest && <button className="action-btn" type="button" onClick={() => handleResolveMaintenance(drone.id, 'approve')}>Approve Maintenance</button>}</div></div>)}</div>
          </div>
          <div className="panel panel--raised">
            <div className="panel-header"><div className="panel-header__title"><div className="panel-title-row"><span className="panel-title-icon"><OpsIcon name="plus" /></span><h2>Add Drone</h2></div><p>Register new aircraft.</p></div></div>
            <form className="panel-body form-stack" onSubmit={handleAddDrone}>
              <div className="input-group"><label>Model Name</label><input type="text" value={newDrone.model} onChange={(e) => setNewDrone({ ...newDrone, model: e.target.value })} required /></div>
              <div className="input-group"><label>Serial Number</label><input type="text" value={newDrone.serialNumber} onChange={(e) => setNewDrone({ ...newDrone, serialNumber: e.target.value })} required /></div>
              <div className="input-group"><label>Home Center</label><select value={newDrone.homeCenterId} onChange={(e) => setNewDrone({ ...newDrone, homeCenterId: e.target.value })} required><option value="">Select Center</option>{centers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="form-actions"><button type="submit" className="submit-btn">Register Drone</button></div>
            </form>
          </div>
        </section>
      )}

      {activeSection === 'location' && <section id="location" className="section-gap"><LiveLocationPanel /></section>}
      {activeSection === 'bhumeet' && <section id="bhumeet" className="section-gap"><BhumeetLogbook /></section>}
      {activeSection === 'acreage' && <section id="acreage" className="section-gap"><AcreageTrend /></section>}
    </OperationsShell>
  );
}

export default FleetManagerDashboard;
