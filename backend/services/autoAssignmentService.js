const leadRepository = require('../src/repositories/leadRepository');
const assignmentRepository = require('../src/repositories/assignmentRepository');
const assignmentOperationRepository = require('../src/repositories/assignmentOperationRepository');
const autoAssignmentPolicyRepository = require('../src/repositories/autoAssignmentPolicyRepository');
const weatherService = require('./weatherService');
const whatsappService = require('./whatsappService');
const logger = require('./loggerService');
const auditLogService = require('./auditLogService');
const { loadEnvironment } = require('../config/environment');
const { workingDayForOffset } = require('./schedulingTimeService');

const reasons = Object.freeze({
  SUCCESS: 'AUTO_ASSIGNMENT_SUCCESS',
  DISABLED: 'AUTO_ASSIGNMENT_POLICY_DISABLED',
  UNAVAILABLE: 'AUTO_ASSIGNMENT_POLICY_UNAVAILABLE',
  NOT_PROCESSED: 'LEAD_NOT_PROCESSED',
  WEATHER_REVIEW: 'WEATHER_REVIEW_REQUIRED',
  NO_CAPACITY: 'NO_CAPACITY_IN_HORIZON',
});

async function moveToManualScheduling(lead, message, reasonCode, notificationType = 'NEEDS_MANUAL_SCHEDULING', actorId = null, policyRevision = null) {
  const result = await assignmentOperationRepository.moveToManualScheduling({
    leadId: lead.id,
    reason: message,
    reasonCode,
    notificationType,
    actorId,
    policyRevision,
  });
  logger.warn('assignment.manual_scheduling_required', { leadId: lead.id, notificationType, reasonCode, policyRevision });
  return result;
}

async function readPolicyOrDefer(lead, actorId) {
  const policy = await autoAssignmentPolicyRepository.findCompanyPolicy();
  if (policy) return { policy };
  return {
    result: await moveToManualScheduling(
      lead,
      'Automatic assignment policy is unavailable; Fleet review is required.',
      reasons.UNAVAILABLE,
      'NEEDS_MANUAL_SCHEDULING',
      actorId,
    ),
  };
}

async function autoAssignProcessedLead(leadId, {
  excludePilotIds = [], now = new Date(), actorId = null, operatingTimeZone, trigger = 'AUTOMATIC',
} = {}) {
  const existing = await assignmentRepository.findByLeadId(leadId);
  if (existing) {
    return { outcome: 'SCHEDULED', reasonCode: reasons.SUCCESS, assignment: existing, lead: existing.lead, idempotent: true };
  }
  const lead = await leadRepository.findById(leadId);
  if (!lead) {
    const error = new Error('Lead not found');
    error.code = 'NOT_FOUND';
    throw error;
  }
  if (trigger === 'OPERATOR_RETRY') {
    await auditLogService.record({
      entityType: 'Lead', entityId: lead.id, action: 'AUTO_ASSIGNMENT_RETRY_REQUESTED', actorId,
      afterState: { status: lead.status }, reason: 'OPERATOR_RETRY',
    });
  }
  if (lead.status !== 'PROCESSED') return { outcome: 'SKIPPED', reasonCode: reasons.NOT_PROCESSED, lead };

  const policyDecision = await readPolicyOrDefer(lead, actorId);
  if (policyDecision.result) return policyDecision.result;
  const { policy } = policyDecision;
  if (!policy.enabled) {
    return moveToManualScheduling(
      lead,
      'Automatic assignment is paused by company policy.',
      reasons.DISABLED,
      'NEEDS_MANUAL_SCHEDULING',
      actorId,
      policy.revision,
    );
  }

  const timeZone = operatingTimeZone || loadEnvironment().operatingTimeZone;
  const days = [];
  for (let offset = 0; offset < policy.searchHorizonDays; offset += 1) {
    days.push(workingDayForOffset(now, offset, policy, timeZone));
  }
  const horizonStart = days[0].start;
  const horizonEnd = days[days.length - 1].end;
  let capacityReasonCode = reasons.NO_CAPACITY;

  for (const day of days) {
    const weather = await weatherService.checkSuitability(lead.latitude, lead.longitude, day.start);
    if (weather.suitable === false) continue;
    if (weather.suitable === null && policy.weatherUnavailableAction === 'MANUAL_REVIEW') {
      return moveToManualScheduling(
        lead,
        'Weather data is unavailable; Fleet review is required.',
        reasons.WEATHER_REVIEW,
        'WEATHER_RISK',
        actorId,
        policy.revision,
      );
    }
    const result = await assignmentOperationRepository.autoAssign({
      leadId,
      dayStart: day.start,
      dayEnd: day.end,
      horizonStart,
      horizonEnd,
      weather,
      excludePilotIds,
      actorId,
      expectedPolicyRevision: policy.revision,
    });
    if (result.outcome === 'SCHEDULED') {
      try {
        await whatsappService.sendMissionScheduled(result.lead, result.assignment.scheduledDate);
      } catch (error) {
        logger.error('assignment.post_commit_delivery_failed', { leadId, assignmentId: result.assignment.id, action: 'MISSION_SCHEDULED', error: error.message });
      }
      logger.info('assignment.auto_assigned', {
        leadId,
        assignmentId: result.assignment.id,
        pilotId: result.assignment.pilotId,
        copilotId: result.assignment.copilotId,
        droneId: result.assignment.droneId,
        lmvId: result.assignment.lmvId,
        policyRevision: policy.revision,
        reasonCode: reasons.SUCCESS,
      });
      return { ...result, reasonCode: reasons.SUCCESS, policyRevision: policy.revision };
    }
    if (result.outcome === 'POLICY_CHANGED') {
      return moveToManualScheduling(
        lead,
        'Automatic assignment policy changed during scheduling; Fleet retry is required.',
        reasons.UNAVAILABLE,
        'NEEDS_MANUAL_SCHEDULING',
        actorId,
        result.policyRevision,
      );
    }
    if (result.reasonCode) capacityReasonCode = result.reasonCode;
  }
  const capacityMessages = {
    NO_ELIGIBLE_PRIMARY_PILOT: 'No eligible Primary Pilot is available; inactive accounts and expired licences are excluded.',
    NO_ELIGIBLE_PILOT_PAIR: 'No eligible two-person Pilot/Copilot crew is available; inactive accounts and expired licences are excluded.',
    NO_ELIGIBLE_DRONE: 'No eligible in-service and airworthy drone is available in the matched operating centre.',
    NO_ELIGIBLE_LMV: 'No eligible in-service LMV is available in the matched operating centre.',
    NO_CAPACITY_IN_HORIZON: 'No eligible Primary Pilot, drone, and LMV reservation is available in the scheduling horizon.',
  };
  return moveToManualScheduling(
    lead,
    capacityMessages[capacityReasonCode] || capacityMessages.NO_CAPACITY_IN_HORIZON,
    capacityReasonCode,
    'NEEDS_MANUAL_SCHEDULING',
    actorId,
    policy.revision,
  );
}

async function reassignUnacceptedAssignment(assignment, now) {
  const released = await assignmentOperationRepository.unassignForReassignment({ assignmentId: assignment.id });
  if (!released) return { outcome: 'SKIPPED', reasonCode: 'ASSIGNMENT_NOT_FOUND' };
  return autoAssignProcessedLead(released.lead.id, { excludePilotIds: [released.assignment.pilotId], now, trigger: 'TIMEOUT_REASSIGNMENT' });
}

module.exports = { autoAssignProcessedLead, moveToManualScheduling, reassignUnacceptedAssignment, reasons };
