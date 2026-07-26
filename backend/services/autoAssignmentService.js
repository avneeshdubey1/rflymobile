const assignmentRepository = require('../src/repositories/assignmentRepository');
const droneRepository = require('../src/repositories/droneRepository');
const leadRepository = require('../src/repositories/leadRepository');
const lmvRepository = require('../src/repositories/lmvRepository');
const notificationEscalationRepository = require('../src/repositories/notificationEscalationRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const weatherService = require('./weatherService');
const notificationCascadeService = require('./notificationCascadeService');
const whatsappService = require('./whatsappService');
const logger = require('./loggerService');
const { revalidateForScheduling } = require('./leadServiceAreaService');

function startOfDay(date) { const result = new Date(date); result.setHours(0, 0, 0, 0); return result; }
function endOfDay(date) { const result = startOfDay(date); result.setDate(result.getDate() + 1); return result; }
function startOfWeek(date) { const result = startOfDay(date); result.setDate(result.getDate() - result.getDay()); return result; }
function hasExpired(expiry, now) { return expiry && expiry <= now; }

async function moveToManualScheduling(lead, reason, notificationType = 'NEEDS_MANUAL_SCHEDULING') {
  const schedulingNote = `[Scheduling] ${reason}`;
  const updated = await leadRepository.update(lead.id, { status: 'NEEDS_MANUAL_SCHEDULING', notes: lead.notes ? `${lead.notes}\n${schedulingNote}` : schedulingNote });
  await notificationCascadeService.createFleetNotifications(notificationType, lead.id, `Manual scheduling required for lead ${lead.id}: ${reason}`);
  await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'NEEDS_MANUAL_SCHEDULING', beforeState: lead, afterState: updated, reason });
  logger.warn('assignment.manual_scheduling_required', { leadId: lead.id, notificationType, reason });
  return { outcome: 'MANUAL_SCHEDULING', lead: updated, reason };
}

async function selectWeatherDate(lead, now) {
  for (let offset = 0; offset < 5; offset += 1) {
    const date = startOfDay(now);
    date.setDate(date.getDate() + offset);
    date.setHours(9, 0, 0, 0); // Schedule for 9 AM instead of midnight
    const weather = await weatherService.checkSuitability(lead.latitude, lead.longitude, date);
    if (weather.suitable !== false) return { date, weather };
  }
  return null;
}

async function autoAssignProcessedLead(leadId, { excludePilotIds = [], now = new Date() } = {}) {
  let lead = await leadRepository.findById(leadId);
  if (!lead) throw new Error('Lead not found');
  if (lead.status !== 'PROCESSED') return { outcome: 'SKIPPED', reason: `Lead is ${lead.status}, not PROCESSED` };
  lead = await revalidateForScheduling(lead);

  const weatherWindow = await selectWeatherDate(lead, now);
  if (!weatherWindow) return moveToManualScheduling(lead, 'No suitable weather day was found in the next five days.', 'WEATHER_RISK');

  const pilots = (await userRepository.findAll({ role: 'PILOT', homeCenterId: lead.matchedCenterId }))
    .filter((pilot) => !excludePilotIds.includes(pilot.id) && !hasExpired(pilot.pilotLicenseExpiry, now));
  const drones = (await droneRepository.findAll({ status: 'AVAILABLE', homeCenterId: lead.matchedCenterId }))
    .filter((drone) => !hasExpired(drone.airworthinessExpiry, now));
  const lmvs = await lmvRepository.findEligibleForCenter(lead.matchedCenterId);
  const dayStart = startOfDay(weatherWindow.date);
  const dayEnd = endOfDay(weatherWindow.date);
  const availablePilots = [];
  for (const pilot of pilots) {
    const conflicts = await assignmentRepository.findScheduledForPilotOnDate(pilot.id, dayStart, dayEnd);
    if (conflicts.length === 0) availablePilots.push(pilot);
  }
  const availableLmvs = [];
  for (const lmv of lmvs) {
    const conflicts = await assignmentRepository.findScheduledForLmvOnDate(lmv.id, dayStart, dayEnd);
    if (conflicts.length === 0) availableLmvs.push(lmv);
  }
  if (availablePilots.length === 0 || drones.length === 0 || availableLmvs.length === 0) {
    const reason = availablePilots.length === 0
      ? 'No eligible pilot is available; expired licences are excluded.'
      : drones.length === 0
        ? 'No eligible drone is available; expired airworthiness is excluded.'
        : 'No eligible LMV is available at the lead operating centre.';
    return moveToManualScheduling(lead, reason);
  }

  const weekStart = startOfWeek(weatherWindow.date);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const scoredPilots = await Promise.all(availablePilots.map(async (pilot) => ({ pilot, workload: await assignmentRepository.countForPilotBetween(pilot.id, weekStart, weekEnd) })));
  scoredPilots.sort((a, b) => a.workload - b.workload || a.pilot.createdAt - b.pilot.createdAt);
  const pilot = scoredPilots[0].pilot;
  const drone = drones[0];
  const lmv = availableLmvs[0];
  const assignment = await assignmentRepository.create({
    leadId: lead.id, pilotId: pilot.id, droneId: drone.id, lmvId: lmv.id, scheduledDate: weatherWindow.date, autoAssigned: true, expectedAcreage: lead.acreage,
    weatherCheckedAt: new Date(), weatherSuitable: weatherWindow.weather.suitable, weatherNote: weatherWindow.weather.note,
  });
  const scheduledLead = await leadRepository.update(lead.id, { status: 'SCHEDULED' });
  await droneRepository.update(drone.id, { status: 'ASSIGNED' });
  await lmvRepository.update(lmv.id, { status: 'ASSIGNED' });
  await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'AUTO_ASSIGNED', beforeState: lead, afterState: scheduledLead, reason: `Pilot ${pilot.id}, drone ${drone.id}, LMV ${lmv.id}, date ${weatherWindow.date.toISOString()}` });
  await whatsappService.sendMissionScheduled(scheduledLead, assignment.scheduledDate);
  if (weatherWindow.weather.suitable === null) await notificationCascadeService.createFleetNotifications('WEATHER_RISK', lead.id, `Weather data was unavailable for automatically scheduled lead ${lead.id}; manual review is required.`);
  await notificationCascadeService.start(assignment);
  logger.info('assignment.auto_assigned', { leadId: lead.id, assignmentId: assignment.id, pilotId: pilot.id, droneId: drone.id, lmvId: lmv.id, weatherSuitable: weatherWindow.weather.suitable });
  return { outcome: 'SCHEDULED', lead: scheduledLead, assignment };
}

async function reassignUnacceptedAssignment(assignment, now) {
  await notificationEscalationRepository.deleteByAssignmentId(assignment.id);
  await droneRepository.update(assignment.droneId, { status: 'AVAILABLE' });
  if (assignment.lmvId) await lmvRepository.update(assignment.lmvId, { status: 'AVAILABLE' });
  await assignmentRepository.delete(assignment.id);
  const lead = await leadRepository.update(assignment.leadId, { status: 'PROCESSED' });
  await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'AUTO_REASSIGNMENT_STARTED', beforeState: assignment });
  return autoAssignProcessedLead(lead.id, { excludePilotIds: [assignment.pilotId], now });
}

module.exports = { autoAssignProcessedLead, moveToManualScheduling, reassignUnacceptedAssignment };
