const assignmentRepository = require('../src/repositories/assignmentRepository');
const leadRepository = require('../src/repositories/leadRepository');
const droneRepository = require('../src/repositories/droneRepository');
const lmvRepository = require('../src/repositories/lmvRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const notificationCascadeService = require('../services/notificationCascadeService');
const missionStateService = require('../services/missionStateService');
const whatsappService = require('../services/whatsappService');
const locationService = require('../services/locationService');
const { ServiceAreaValidationError, revalidateForScheduling } = require('../services/leadServiceAreaService');

function dayBounds(date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

exports.getPilotMissions = async (req, res) => {
  try {
    const pilotId = req.auth?.role === 'PILOT' ? req.auth.userId : req.query.pilotId;
    if (!pilotId) return res.status(400).json({ error: 'pilotId is required' });
    res.json({ success: true, missions: await assignmentRepository.findAll({ OR: [{ pilotId }, { copilotId: pilotId }] }) });
  } catch { res.status(500).json({ error: 'Failed to fetch missions' }); }
};
exports.getAllAssignments = async (_req, res) => { try { res.json({ success: true, missions: await assignmentRepository.findAll() }); } catch { res.status(500).json({ error: 'Failed to fetch assignments' }); } };
exports.getSalesAlerts = async (_req, res) => { try { res.json({ success: true, alerts: await assignmentRepository.findSalesAlerts() }); } catch { res.status(500).json({ error: 'Failed to fetch operational alerts' }); } };

exports.createManualAssignment = async (req, res) => {
  try {
    const leadId = req.body.leadId || req.body.lead?.id;
    const pilotId = req.body.pilotId || req.body.pilot?.id;
    const copilotId = req.body.copilotId || req.body.copilot?.id;
    const droneId = req.body.droneId;
    const lmvId = req.body.lmvId;
    const [storedLead, pilot, copilot, drone, lmv] = await Promise.all([leadRepository.findById(leadId), userRepository.findById(pilotId), userRepository.findById(copilotId), droneRepository.findById(droneId), lmvId ? lmvRepository.findById(lmvId) : null]);
    if (!storedLead) return res.status(400).json({ error: 'A valid lead is required' });
    let lead = storedLead;
    if (!['PROCESSED', 'NEEDS_MANUAL_SCHEDULING'].includes(lead.status)) return res.status(409).json({ error: 'Only processed or manual-scheduling leads can be assigned' });
    lead = await revalidateForScheduling(lead, { actorId: req.auth.userId });
    if (!pilot || !copilot || !drone || !lmv) return res.status(400).json({ error: 'A valid primary Pilot, Copilot, drone, and LMV are required' });
    if (pilot.id === copilot.id) return res.status(409).json({ error: 'Primary Pilot and Copilot must be different people' });
    if (pilot.role !== 'PILOT' || !pilot.active || pilot.archivedAt || pilot.homeCenterId !== lead.matchedCenterId) {
      return res.status(409).json({ error: 'Primary Pilot must be active and belong to the lead operating centre' });
    }
    if (copilot.role !== 'PILOT' || !copilot.active || copilot.archivedAt || copilot.homeCenterId !== lead.matchedCenterId) {
      return res.status(409).json({ error: 'Copilot must be active and belong to the lead operating centre' });
    }
    if (!['AVAILABLE', 'ASSIGNED'].includes(drone.status) || drone.homeCenterId !== lead.matchedCenterId) return res.status(409).json({ error: 'Drone must be schedulable at the lead operating centre' });
    if (!['AVAILABLE', 'ASSIGNED'].includes(lmv.status) || lmv.homeCenterId !== lead.matchedCenterId) return res.status(409).json({ error: 'LMV must be schedulable at the lead operating centre' });
    const scheduledDate = req.body.scheduledDate ? new Date(req.body.scheduledDate) : new Date();
    if (Number.isNaN(scheduledDate.valueOf())) return res.status(400).json({ error: 'Valid scheduledDate is required' });
    if (pilot.pilotLicenseExpiry && pilot.pilotLicenseExpiry <= scheduledDate) return res.status(409).json({ error: 'Primary Pilot licence is expired for the scheduled date' });
    if (copilot.pilotLicenseExpiry && copilot.pilotLicenseExpiry <= scheduledDate) return res.status(409).json({ error: 'Copilot licence is expired for the scheduled date' });
    const { start, end } = dayBounds(scheduledDate);
    const [pilotAssignments, copilotAssignments] = await Promise.all([
      assignmentRepository.findScheduledForPilotOnDate(pilot.id, start, end),
      assignmentRepository.findScheduledForPilotOnDate(copilot.id, start, end),
    ]);
    const sameUnit = (item) => item.pilotId === pilot.id && item.copilotId === copilot.id && item.droneId === drone.id && item.lmvId === lmv.id;
    if ([...pilotAssignments, ...copilotAssignments].some((item) => !sameUnit(item))) return res.status(409).json({ error: 'A crew member is already scheduled with another operational unit that day' });
    const lmvAssignments = await assignmentRepository.findScheduledForLmvOnDate(lmv.id, start, end);
    if (lmvAssignments.some((item) => !sameUnit(item))) return res.status(409).json({ error: 'LMV is already scheduled with another crew that day' });
    const droneAssignments = (await assignmentRepository.findActiveForDrone(drone.id)).filter((item) => item.scheduledDate >= start && item.scheduledDate < end);
    if (droneAssignments.some((item) => !sameUnit(item))) return res.status(409).json({ error: 'Drone is already scheduled with another crew that day' });
    const dailySequence = await assignmentRepository.nextDailySequence({ pilotId, copilotId, droneId, lmvId, start, end });
    const assignment = await assignmentRepository.create({ leadId, pilotId, copilotId, droneId, lmvId, scheduledDate, dailySequence, expectedAcreage: lead.acreage, autoAssigned: false });
    const scheduledLead = await leadRepository.update(lead.id, { status: 'SCHEDULED' });
    await droneRepository.update(drone.id, { status: 'ASSIGNED' });
    await lmvRepository.update(lmv.id, { status: 'ASSIGNED' });
    await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'MANUAL_ASSIGNMENT_CREATED', actorId: req.auth.userId, afterState: assignment });
    await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'STATUS_CHANGE', actorId: req.auth.userId, beforeState: lead, afterState: scheduledLead });
    await whatsappService.sendMissionScheduled(scheduledLead, assignment.scheduledDate);
    await notificationCascadeService.start(assignment);
    res.status(201).json({ success: true, mission: assignment });
  } catch (error) {
    if (error instanceof ServiceAreaValidationError) return res.status(409).json({ code: error.code });
    return res.status(400).json({ error: error.message || 'Failed to create assignment' });
  }
};

function stateHandler(action) {
  return async (req, res) => {
    try {
      const result = await missionStateService[action](req.params.id || req.body.id, req.auth.userId, req.body.actualAcreage ?? req.body.enteredAcres ?? req.body.reason);
      res.json({ success: true, ...result });
    } catch (error) { res.status(409).json({ error: error.message }); }
  };
}

exports.acceptMission = stateHandler('accept');
exports.startMission = stateHandler('start');
exports.completeMission = stateHandler('complete');
exports.decommissionMission = stateHandler('decommission');

exports.recordLocation = async (req, res) => {
  try {
    const location = await locationService.recordLocation(req.params.id, req.auth, req.body.latitude, req.body.longitude);
    req.app.get('io')?.to(`location:${req.params.id}`).emit('location:update', location);
    res.json({ success: true, location });
  } catch (error) { res.status(409).json({ error: error.message || 'Failed to record location' }); }
};

exports.getLocation = async (req, res) => {
  try { res.json({ success: true, location: await locationService.getLocation(req.params.id, req.auth) }); }
  catch (error) { res.status(409).json({ error: error.message || 'Failed to fetch location' }); }
};

exports.rescheduleAssignment = async (req, res) => {
  try {
    const before = await assignmentRepository.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Assignment not found' });
    if (!['SCHEDULED', 'PILOT_ACCEPTED'].includes(before.lead.status)) return res.status(409).json({ error: 'Only scheduled or accepted assignments can be rescheduled' });
    await revalidateForScheduling(before.lead, { actorId: req.auth.userId });
    const scheduledDate = new Date(req.body.scheduledDate);
    if (Number.isNaN(scheduledDate.valueOf())) return res.status(400).json({ error: 'Valid scheduledDate is required' });
    const { start, end } = dayBounds(scheduledDate);
    
    const newPilotId = req.body.pilotId || before.pilotId;
    const newCopilotId = req.body.copilotId || before.copilotId;
    const newLmvId = req.body.lmvId || before.lmvId;
    if (!newCopilotId || !newLmvId) return res.status(400).json({ error: 'Copilot and LMV are required for rescheduling' });
    if (newPilotId === newCopilotId) return res.status(409).json({ error: 'Primary Pilot and Copilot must be different people' });
    const [pilot, copilot, lmv] = await Promise.all([
      userRepository.findById(newPilotId),
      userRepository.findById(newCopilotId),
      lmvRepository.findById(newLmvId),
    ]);
    if (!pilot || pilot.role !== 'PILOT' || !pilot.active || pilot.archivedAt
      || pilot.homeCenterId !== before.lead.matchedCenterId) {
      return res.status(409).json({ error: 'Pilot must be active and belong to the lead operating centre' });
    }
    if (!copilot || copilot.role !== 'PILOT' || !copilot.active || copilot.archivedAt
      || copilot.homeCenterId !== before.lead.matchedCenterId) {
      return res.status(409).json({ error: 'Copilot must be active and belong to the lead operating centre' });
    }
    if (pilot.pilotLicenseExpiry && pilot.pilotLicenseExpiry <= scheduledDate) return res.status(409).json({ error: 'Primary Pilot licence is expired for the scheduled date' });
    if (copilot.pilotLicenseExpiry && copilot.pilotLicenseExpiry <= scheduledDate) return res.status(409).json({ error: 'Copilot licence is expired for the scheduled date' });
    if (!lmv || lmv.homeCenterId !== before.lead.matchedCenterId) return res.status(409).json({ error: 'LMV must belong to the lead operating centre' });
    if (newLmvId !== before.lmvId && lmv.status !== 'AVAILABLE') return res.status(409).json({ error: 'LMV must be available at the lead operating centre' });
    
    const [primaryAssignments, copilotAssignments] = await Promise.all([
      assignmentRepository.findScheduledForPilotOnDate(newPilotId, start, end),
      assignmentRepository.findScheduledForPilotOnDate(newCopilotId, start, end),
    ]);
    const sameUnit = (item) => item.id === before.id || (item.pilotId === newPilotId && item.copilotId === newCopilotId && item.droneId === before.droneId && item.lmvId === newLmvId);
    if ([...primaryAssignments, ...copilotAssignments].some((item) => !sameUnit(item))) return res.status(409).json({ error: 'A crew member is already scheduled with another operational unit that day' });
    const conflictingLmvs = await assignmentRepository.findScheduledForLmvOnDate(newLmvId, start, end);
    if (conflictingLmvs.some((item) => !sameUnit(item))) return res.status(409).json({ error: 'LMV is already scheduled with another crew that day' });
    const staysInSameCrewDay = before.scheduledDate >= start && before.scheduledDate < end
      && before.pilotId === newPilotId && before.copilotId === newCopilotId && before.lmvId === newLmvId;
    const dailySequence = staysInSameCrewDay
      ? before.dailySequence
      : await assignmentRepository.nextDailySequence({ pilotId: newPilotId, copilotId: newCopilotId, droneId: before.droneId, lmvId: newLmvId, start, end, excludeId: before.id });
    const assignment = await assignmentRepository.update(before.id, { scheduledDate, pilotId: newPilotId, copilotId: newCopilotId, lmvId: newLmvId, dailySequence, acceptedAt: null });
    if (before.lmvId && before.lmvId !== newLmvId) await lmvRepository.update(before.lmvId, { status: 'AVAILABLE' });
    if (before.lmvId !== newLmvId) await lmvRepository.update(newLmvId, { status: 'ASSIGNED' });
    const lead = await leadRepository.update(before.leadId, { status: 'SCHEDULED' });
    await assignmentRepository.createScheduleChange({ assignmentId: assignment.id, oldDate: before.scheduledDate, newDate: scheduledDate, changedBy: req.auth.userId, reason: req.body.reason });
    await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'RESCHEDULE', actorId: req.auth.userId, beforeState: before, afterState: assignment, reason: req.body.reason });
    await notificationCascadeService.createSalesNotifications('RESCHEDULE', before.leadId, `Assignment for ${before.lead.farmerName} was rescheduled from ${before.scheduledDate.toISOString()} to ${scheduledDate.toISOString()}.`);
    
    // Notify Farmer and Pilot of Reschedule
    try {
      await whatsappService.sendMissionScheduled(lead, assignment.scheduledDate);
      if (newPilotId !== before.pilotId) {
        await notificationCascadeService.closePilotAssignmentNotifications(before.pilotId, before.leadId);
      }
      if (before.copilotId && newCopilotId !== before.copilotId) {
        await notificationCascadeService.closePilotAssignmentNotifications(before.copilotId, before.leadId);
      }
      await notificationCascadeService.start(assignment);
    } catch(err) {
      console.error("Reschedule notifications failed:", err);
    }

    res.json({ success: true, mission: assignment, lead });
  } catch (error) {
    if (error instanceof ServiceAreaValidationError) return res.status(409).json({ code: error.code });
    return res.status(400).json({ error: error.message || 'Failed to reschedule assignment' });
  }
};

exports.resequenceAssignment = async (req, res) => {
  try {
    const sequence = Number(req.body.dailySequence);
    if (!Number.isInteger(sequence) || sequence < 1) return res.status(400).json({ error: 'dailySequence must be a positive whole number' });
    const before = await assignmentRepository.findById(req.params.id);
    if (!before) return res.status(404).json({ error: 'Assignment not found' });
    if (!['SCHEDULED', 'PILOT_ACCEPTED'].includes(before.lead.status)) return res.status(409).json({ error: 'Only queued missions can be reordered' });
    const assignment = await assignmentRepository.resequenceDay(before.id, sequence);
    await auditLogRepository.create({
      entityType: 'Assignment',
      entityId: before.id,
      action: 'DAILY_SEQUENCE_CHANGED',
      actorId: req.auth.userId,
      beforeState: { dailySequence: before.dailySequence },
      afterState: { dailySequence: assignment.dailySequence },
    });
    return res.json({ success: true, mission: assignment });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to reorder assignment' });
  }
};
