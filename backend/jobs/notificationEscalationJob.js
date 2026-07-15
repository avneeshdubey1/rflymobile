const notificationEscalationRepository = require('../src/repositories/notificationEscalationRepository');
const notificationCascadeService = require('../services/notificationCascadeService');
const autoAssignmentService = require('../services/autoAssignmentService');
const auditLogRepository = require('../src/repositories/auditLogRepository');
const logger = require('../services/loggerService');
const heartbeat = require('../services/jobHeartbeatService');

async function processDueEscalations(now = new Date()) {
  const due = await notificationEscalationRepository.findDue(now);
  for (const escalation of due) {
    const { assignment } = escalation;
    if (assignment.acceptedAt || assignment.lead.status !== 'SCHEDULED') {
      await notificationEscalationRepository.update(escalation.id, { closedAt: now });
      await auditLogRepository.create({ entityType: 'Assignment', entityId: assignment.id, action: 'NOTIFICATION_CASCADE_CLOSED' });
      continue;
    }
    if (escalation.stage === 'PUSH_SENT') await notificationCascadeService.sendSms(escalation, now);
    else if (escalation.stage === 'SMS_SENT') await notificationCascadeService.createCallTask(escalation, now);
    else if (escalation.stage === 'CALL_TASK_CREATED') await autoAssignmentService.reassignUnacceptedAssignment(assignment, now);
  }
  return due.length;
}

function startNotificationEscalationJob() {
  const intervalMs = Number(process.env.NOTIFICATION_ESCALATION_POLL_MS) || 5 * 60_000;
  const run = async () => {
    try { const processed = await processDueEscalations(); heartbeat.record('notification-escalation', 'ok', { processed }); logger.info('job.notification_escalation.completed', { processed }); }
    catch (error) { heartbeat.record('notification-escalation', 'error'); logger.error('job.notification_escalation.failed', { message: error.message }); }
  };
  void run();
  return setInterval(() => { void run(); }, intervalMs);
}

module.exports = { processDueEscalations, startNotificationEscalationJob };
