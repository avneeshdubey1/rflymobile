const assignmentOperationRepository = require('../src/repositories/assignmentOperationRepository');
const whatsappService = require('./whatsappService');
const logger = require('./loggerService');

async function deliverAfterCommit(deliver, context) {
  try {
    await deliver();
  } catch (error) {
    logger.error('assignment.post_commit_delivery_failed', { ...context, error: error.message });
  }
}

async function accept(assignmentId, actorId) {
  return assignmentOperationRepository.transitionMission({ assignmentId, actorId, action: 'accept' });
}

async function start(assignmentId, actorId) {
  const result = await assignmentOperationRepository.transitionMission({ assignmentId, actorId, action: 'start' });
  await deliverAfterCommit(
    () => whatsappService.sendForStatus(result.lead, 'IN_PROGRESS'),
    { assignmentId, action: 'MISSION_STARTED' },
  );
  return result;
}

async function complete(assignmentId, actorId, actualAcreage) {
  const result = await assignmentOperationRepository.transitionMission({ assignmentId, actorId, action: 'complete', actualAcreage });
  await deliverAfterCommit(
    () => whatsappService.sendMissionCompleted(result.lead, Number(actualAcreage)),
    { assignmentId, action: 'MISSION_COMPLETED' },
  );
  return result;
}

async function decommission(assignmentId, actorId, reason) {
  return assignmentOperationRepository.transitionMission({ assignmentId, actorId, action: 'decommission', reason });
}

module.exports = { accept, start, complete, decommission };
