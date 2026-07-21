const assignmentRepository = require('../src/repositories/assignmentRepository');
const leadRepository = require('../src/repositories/leadRepository');
const droneRepository = require('../src/repositories/droneRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const notificationCascadeService = require('../services/notificationCascadeService');
const missionStateService = require('../services/missionStateService');
const whatsappService = require('../services/whatsappService');
const locationService = require('../services/locationService');

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
    res.json({ success: true, missions: await assignmentRepository.findAll({ pilotId }) });
  } catch { res.status(500).json({ error: 'Failed to fetch missions' }); }
};
exports.getAllAssignments = async (_req, res) => { try { res.json({ success: true, missions: await assignmentRepository.findAll() }); } catch { res.status(500).json({ error: 'Failed to fetch assignments' }); } };
exports.getSalesAlerts = async (_req, res) => { try { res.json({ success: true, alerts: await assignmentRepository.findSalesAlerts() }); } catch { res.status(500).json({ error: 'Failed to fetch operational alerts' }); } };

exports.createManualAssignment = async (req, res) => {
  try {
    const leadId = req.body.leadId || req.body.lead?.id;
    const pilotId = req.body.pilotId || req.body.pilot?.id;
    const droneId = req.body.droneId;
    const [lead, pilot, drone] = await Promise.all([leadRepository.findById(leadId), userRepository.findById(pilotId), droneRepository.findById(droneId)]);
    if (!lead || !pilot || !drone) return res.status(400).json({ error: 'A valid lead, pilot, and drone are required' });
    if (!['PROCESSED', 'NEEDS_MANUAL_SCHEDULING'].includes(lead.status)) return res.status(409).json({ error: 'Only processed or manual-scheduling leads can be assigned' });
    if (pilot.role !== 'PILOT' || pilot.homeCenterId !== lead.matchedCenterId) return res.status(409).json({ error: 'Pilot must belong to the lead operating centre' });
    if (drone.status !== 'AVAILABLE' || drone.homeCenterId !== lead.matchedCenterId) return res.status(409).json({ error: 'Drone must be available at the lead operating centre' });
    const scheduledDate = req.body.scheduledDate ? new Date(req.body.scheduledDate) : new Date();
    if (Number.isNaN(scheduledDate.valueOf())) return res.status(400).json({ error: 'Valid scheduledDate is required' });
    const { start, end } = dayBounds(scheduledDate);
    const pilotAssignments = await assignmentRepository.findScheduledForPilotOnDate(pilot.id, start, end);
    if (pilotAssignments.length) return res.status(409).json({ error: 'Pilot already has a scheduled mission that day' });
    const assignment = await assignmentRepository.create({ leadId, pilotId, droneId, scheduledDate, expectedAcreage: lead.acreage, autoAssigned: false });
    const scheduledLead = await leadRepository.update(lead.id, { status: 'SCHEDULED' });
    await droneRepository.update(drone.id, { status: 'ASSIGNED' });
    await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'MANUAL_ASSIGNMENT_CREATED', actorId: req.auth.userId, afterState: assignment });
    await auditLogRepository.create({ entityType: 'Lead', entityId: lead.id, action: 'STATUS_CHANGE', actorId: req.auth.userId, beforeState: lead, afterState: scheduledLead });
    await whatsappService.sendMissionScheduled(scheduledLead, assignment.scheduledDate);
    await notificationCascadeService.start(assignment);
    res.status(201).json({ success: true, mission: assignment });
  } catch (error) { res.status(400).json({ error: error.message || 'Failed to create assignment' }); }
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
exports.updateMissionStatus = async (_req, res) => res.status(400).json({ error: 'Use /:id/accept or /:id/start; status cannot be set directly' });
exports.resolveAlert = async (_req, res) => res.status(501).json({ error: 'Alert resolution is implemented with Admin workflows' });

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
    const scheduledDate = new Date(req.body.scheduledDate);
    if (Number.isNaN(scheduledDate.valueOf())) return res.status(400).json({ error: 'Valid scheduledDate is required' });
    const { start, end } = dayBounds(scheduledDate);
    
    const newPilotId = req.body.pilotId || before.pilotId;
    
    const conflictingAssignments = await assignmentRepository.findScheduledForPilotOnDate(newPilotId, start, end);
    if (conflictingAssignments.some((item) => item.id !== before.id)) return res.status(409).json({ error: 'Pilot already has a scheduled mission that day' });
    const assignment = await assignmentRepository.update(before.id, { scheduledDate, pilotId: newPilotId, acceptedAt: null });
    const lead = await leadRepository.update(before.leadId, { status: 'SCHEDULED' });
    await assignmentRepository.createScheduleChange({ assignmentId: assignment.id, oldDate: before.scheduledDate, newDate: scheduledDate, changedBy: req.auth.userId, reason: req.body.reason });
    await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'RESCHEDULE', actorId: req.auth.userId, beforeState: before, afterState: assignment, reason: req.body.reason });
    await notificationCascadeService.createSalesNotifications('RESCHEDULE', before.leadId, `Assignment for ${before.lead.farmerName} was rescheduled from ${before.scheduledDate.toISOString()} to ${scheduledDate.toISOString()}.`);
    
    // Notify Farmer and Pilot of Reschedule
    try {
      await whatsappService.sendMissionScheduled(lead, assignment.scheduledDate);
      if (newPilotId !== before.pilotId) {
        // Stop old pilot notifications? We should ideally stop it, but for now we just start new ones.
        await notificationCascadeService.start(assignment);
      } else {
        await notificationCascadeService.start(assignment);
      }
    } catch(err) {
      console.error("Reschedule notifications failed:", err);
    }

    res.json({ success: true, mission: assignment, lead });
  } catch (error) { res.status(400).json({ error: error.message || 'Failed to reschedule assignment' }); }
};
