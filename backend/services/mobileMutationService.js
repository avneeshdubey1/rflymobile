const crypto = require('node:crypto');
const assignmentOperationRepository = require('../src/repositories/assignmentOperationRepository');
const mobileMutationRepository = require('../src/repositories/mobileMutationRepository');
const prisma = require('../src/lib/prisma');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = Object.freeze({ ACCEPT: 'accept', START: 'start', COMPLETE: 'complete' });

class MobileMutationError extends Error {
  constructor(message, code = 'VALIDATION_FAILED', status = 400, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function canonicalRequest(input) {
  return JSON.stringify({
    action: input.action,
    actualAcreage: typeof input.actualAcreage === 'undefined' ? null : String(input.actualAcreage),
    assignmentId: input.assignmentId,
    expectedRevision: input.expectedRevision,
  });
}

function hashRequest(input) {
  return crypto.createHash('sha256').update(canonicalRequest(input)).digest('hex');
}

function receiptProjection(receipt, outcome = receipt.outcome) {
  const result = receipt.safeResult || {};
  return {
    clientActionId: receipt.actionId,
    assignmentId: receipt.assignmentId,
    action: receipt.operation,
    outcome,
    resultingRevision: result.resultingRevision,
    receivedAt: receipt.createdAt.toISOString(),
  };
}

function classify(error) {
  if (error.code === 'ASSIGNMENT_REVISION_CONFLICT') return 'CONFLICT';
  if (error.code === 'P2034' || error.code === 'SCHEDULING_RETRY_EXHAUSTED') return 'RETRY_LATER';
  if (/Only scheduled missions|must be accepted before|Only an in-progress mission|Select an eligible Copilot|Crew formation must|Another job using|Complete job \d+ before|positive actual acreage/i.test(error.message || '')) {
    return 'REJECTED';
  }
  return null;
}

async function currentRevision(assignmentId) {
  return (await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { revision: true } }))?.revision || 1;
}

async function mutate({ installationId, actorId, assignmentId, clientActionId, action, expectedRevision, actualAcreage }) {
  if (!UUID_PATTERN.test(String(clientActionId || ''))) {
    throw new MobileMutationError('clientActionId must be a valid generated identifier');
  }
  if (!ACTIONS[action]) throw new MobileMutationError('Action is not supported');
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
    throw new MobileMutationError('expectedRevision must be a positive integer');
  }
  if (action === 'COMPLETE' && (!Number.isFinite(Number(actualAcreage)) || Number(actualAcreage) <= 0)) {
    throw new MobileMutationError('A positive actual acreage is required');
  }
  const input = { assignmentId, clientActionId, action, expectedRevision, actualAcreage };
  const locked = await mobileMutationRepository.executeLocked({
    installationId,
    actionId: clientActionId,
    requestHash: hashRequest(input),
    execute: async () => {
      try {
        const result = await assignmentOperationRepository.transitionMission({
          assignmentId,
          actorId,
          action: ACTIONS[action],
          expectedRevision,
          actualAcreage,
        });
        return {
          assignmentId,
          operation: action,
          outcome: 'APPLIED',
          safeResult: { resultingRevision: result.assignment.revision },
        };
      } catch (error) {
        if (/assigned crew member/i.test(error.message || '')) {
          throw new MobileMutationError('Assignment was reassigned', 'ASSIGNMENT_REASSIGNED', 409);
        }
        if (/Assignment not found/i.test(error.message || '')) {
          throw new MobileMutationError('Assignment not found', 'RESOURCE_NOT_FOUND', 404);
        }
        const outcome = classify(error);
        if (!outcome) throw error;
        return {
          assignmentId,
          operation: action,
          outcome,
          safeResult: {
            resultingRevision: error.details?.currentRevision || await currentRevision(assignmentId),
            errorCode: error.code || 'MISSION_STATE_CONFLICT',
          },
        };
      }
    },
  });
  if (locked.kind === 'ACTION_ID_REUSED') {
    throw new MobileMutationError('clientActionId was already used for different input', 'VALIDATION_FAILED', 409);
  }
  if (locked.kind === 'REPLAY') {
    return receiptProjection(locked.receipt, locked.receipt.outcome === 'APPLIED' ? 'ALREADY_APPLIED' : locked.receipt.outcome);
  }
  return receiptProjection(locked.receipt);
}

module.exports = { MobileMutationError, mutate };
