const auditLogRepository = require('../src/repositories/auditLogRepository');

async function record({ entityType, entityId, action, actorId, reason, state }) {
  try {
    await auditLogRepository.create({
      entityType,
      entityId,
      action,
      actorId: actorId || null,
      reason,
      afterState: state,
    });
  } catch (error) {
    // Authentication must remain deterministic even if the audit store has a
    // transient failure. Log only non-secret identifiers and the action.
    console.error('Authentication audit write failed', { entityType, entityId, action, error: error.name });
  }
}

module.exports = { record };
