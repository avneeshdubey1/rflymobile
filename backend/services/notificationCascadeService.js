const notificationRepository = require('../src/repositories/notificationRepository');
const notificationEscalationRepository = require('../src/repositories/notificationEscalationRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogRepository = require('../src/repositories/auditLogRepository');

function timers() {
  const configured = (process.env.NOTIFICATION_CASCADE_TIMERS_MS || '').split(',').map(Number).filter(Number.isFinite);
  return configured.length === 4 ? configured : [0, 15 * 60_000, 45 * 60_000, 2 * 60 * 60_000];
}

async function createRoleNotifications(role, type, leadId, message) {
  const recipients = await userRepository.findAll({ role });
  await Promise.all(recipients.map((recipient) => notificationRepository.create({ type, recipientId: recipient.id, leadId, message })));
}

async function createFleetNotifications(type, leadId, message) {
  return createRoleNotifications('FLEET_MANAGER', type, leadId, message);
}

async function createSalesNotifications(type, leadId, message) {
  return createRoleNotifications('SALES', type, leadId, message);
}

async function closePilotAssignmentNotifications(pilotId, leadId) {
  return notificationRepository.closePilotAssignmentNotifications(pilotId, leadId);
}

async function start(assignment) {
  const [, smsAt] = timers();
  await notificationRepository.create({ type: 'PILOT_ASSIGNMENT', recipientId: assignment.pilotId, leadId: assignment.leadId, message: `New assignment ${assignment.id} scheduled for ${assignment.scheduledDate.toISOString()}.` });
  const escalation = await notificationEscalationRepository.startForAssignment({
    assignmentId: assignment.id,
    stage: 'PUSH_SENT',
    nextActionAt: new Date(Date.now() + smsAt),
  });
  await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'PILOT_PUSH_SENT', afterState: { escalationId: escalation.id } });
  return escalation;
}

async function sendSms(escalation, now) {
  const [, smsAt, callAt] = timers();
  await notificationRepository.create({ type: 'PILOT_SMS', recipientId: escalation.assignment.pilotId, leadId: escalation.assignment.leadId, message: `SMS fallback: please accept assignment ${escalation.assignment.id}.` });
  await auditLogRepository.create({ entityType: 'Assignment', entityId: escalation.assignment.id, action: 'PILOT_SMS_SENT' });
  return notificationEscalationRepository.update(escalation.id, { stage: 'SMS_SENT', nextActionAt: new Date(now.getTime() + (callAt - smsAt)) });
}

async function createCallTask(escalation, now) {
  const [, , callAt, reassignAt] = timers();
  await createFleetNotifications('DISPATCH_CALL_TASK', escalation.assignment.leadId, `Call ${escalation.assignment.pilot.name} about unaccepted assignment ${escalation.assignment.id}. This is a human dispatch task, not an automated call.`);
  await auditLogRepository.create({ entityType: 'Assignment', entityId: escalation.assignment.id, action: 'DISPATCH_CALL_TASK_CREATED' });
  return notificationEscalationRepository.update(escalation.id, { stage: 'CALL_TASK_CREATED', nextActionAt: new Date(now.getTime() + (reassignAt - callAt)) });
}

module.exports = {
  timers,
  start,
  sendSms,
  createCallTask,
  createFleetNotifications,
  createSalesNotifications,
  closePilotAssignmentNotifications,
};
