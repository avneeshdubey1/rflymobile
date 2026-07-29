const assignmentRepository = require('../src/repositories/assignmentRepository');
const leadRepository = require('../src/repositories/leadRepository');
const droneRepository = require('../src/repositories/droneRepository');
const lmvRepository = require('../src/repositories/lmvRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const notificationEscalationRepository = require('../src/repositories/notificationEscalationRepository');
const notificationCascadeService = require('./notificationCascadeService');
const whatsappService = require('./whatsappService');

async function getAssignedMission(assignmentId, actorId) {
  const assignment = await assignmentRepository.findById(assignmentId);
  if (!assignment) throw new Error('Assignment not found');
  if (assignment.pilotId !== actorId) throw new Error('Only the assigned pilot can change this mission');
  return assignment;
}

async function transition(assignment, leadStatus, assignmentData, action, actorId, reason = null) {
  const beforeLead = assignment.lead;
  const updatedAssignment = await assignmentRepository.update(assignment.id, assignmentData);
  const updatedLead = await leadRepository.update(assignment.leadId, { status: leadStatus });
  await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action, actorId, beforeState: assignment, afterState: updatedAssignment, reason });
  await auditLogRepository.create({ entityType: 'Lead', entityId: assignment.leadId, action: 'STATUS_CHANGE', actorId, beforeState: beforeLead, afterState: updatedLead, reason });
  return { assignment: updatedAssignment, lead: updatedLead };
}

async function accept(assignmentId, actorId) {
  const assignment = await getAssignedMission(assignmentId, actorId);
  if (assignment.lead.status !== 'SCHEDULED') throw new Error('Only scheduled missions can be accepted');
  const result = await transition(assignment, 'PILOT_ACCEPTED', { acceptedAt: new Date() }, 'PILOT_ACCEPTED', actorId);
  await notificationEscalationRepository.closeByAssignmentId(assignment.id);
  return result;
}

async function start(assignmentId, actorId) {
  const assignment = await getAssignedMission(assignmentId, actorId);
  if (assignment.lead.status !== 'PILOT_ACCEPTED') throw new Error('A mission must be accepted before it can start');
  const result = await transition(assignment, 'IN_PROGRESS', { startedAt: new Date() }, 'MISSION_STARTED', actorId);
  await whatsappService.sendForStatus(result.lead, 'IN_PROGRESS');
  return result;
}

async function complete(assignmentId, actorId, actualAcreage) {
  const assignment = await getAssignedMission(assignmentId, actorId);
  if (assignment.lead.status !== 'IN_PROGRESS') throw new Error('Only an in-progress mission can be completed');
  if (!Number.isFinite(Number(actualAcreage)) || Number(actualAcreage) <= 0) throw new Error('A positive actual acreage is required');
  const result = await transition(assignment, 'COMPLETED', { completedAt: new Date(), actualAcreage: Number(actualAcreage) }, 'MISSION_COMPLETED', actorId);
  await droneRepository.update(assignment.droneId, { status: 'AVAILABLE' });
  if (assignment.lmvId) await lmvRepository.update(assignment.lmvId, { status: 'AVAILABLE' });
  await whatsappService.sendMissionCompleted(result.lead, Number(actualAcreage));
  return result;
}

async function decommission(assignmentId, actorId, reason) {
  const assignment = await getAssignedMission(assignmentId, actorId);
  if (!['PILOT_ACCEPTED', 'IN_PROGRESS'].includes(assignment.lead.status)) throw new Error('Only an accepted or in-progress mission can be decommissioned');
  if (!reason) throw new Error('A decommission reason is required');
  const result = await transition(assignment, 'FLAGGED', { decommissionedMidMission: true, decommissionReason: reason }, 'DRONE_DECOMMISSIONED', actorId, reason);
  await droneRepository.update(assignment.droneId, { status: 'MAINTENANCE' });
  if (assignment.lmvId) await lmvRepository.update(assignment.lmvId, { status: 'AVAILABLE' });
  await notificationEscalationRepository.closeByAssignmentId(assignment.id);
  await notificationCascadeService.createFleetNotifications('DRONE_DECOMMISSIONED', assignment.leadId, `Drone ${assignment.droneId} was decommissioned during assignment ${assignment.id}: ${reason}`);
  return result;
}

module.exports = { accept, start, complete, decommission };
