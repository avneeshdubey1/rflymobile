const crypto = require('node:crypto');
const assignmentOperationRepository = require('../src/repositories/assignmentOperationRepository');
const mobileMutationRepository = require('../src/repositories/mobileMutationRepository');
const prisma = require('../src/lib/prisma');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIONS = Object.freeze({ ACCEPT: 'accept', START: 'start', COMPLETE: 'complete', REPORT_ISSUE: 'reportIssue' });
const ISSUE_CATEGORIES = new Set(['DRONE_MALFUNCTION', 'SAFETY_HAZARD', 'WEATHER_BLOCKER', 'CUSTOMER_BLOCKER', 'OTHER']);

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
    issueCategory: input.issueCategory || null,
    issueNote: input.issueNote || null,
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
  if (error.code === 'ISSUE_REJECTED'
    || /Only scheduled missions|must be accepted before|Only an in-progress mission|Only an accepted or in-progress mission|Select an eligible Copilot|Crew formation must|Another job using|Complete job \d+ before|positive actual acreage/i.test(error.message || '')) {
    return 'REJECTED';
  }
  return null;
}

async function currentRevision(assignmentId) {
  return (await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { revision: true } }))?.revision || 1;
}

function validateMutation({ clientActionId, action, expectedRevision, actualAcreage, issueCategory, issueNote }) {
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
  if (action !== 'COMPLETE' && typeof actualAcreage !== 'undefined') {
    throw new MobileMutationError('actualAcreage is allowed only for COMPLETE');
  }
  if (action === 'REPORT_ISSUE') {
    const normalizedNote = String(issueNote || '').trim();
    const resemblesExactLocation = /-?\d{1,2}\.\d{3,}\s*[,/]\s*-?\d{1,3}\.\d{3,}/.test(normalizedNote)
      || /\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}\b/i.test(normalizedNote);
    if (!ISSUE_CATEGORIES.has(issueCategory) || !normalizedNote || normalizedNote.length > 500 || resemblesExactLocation) {
      throw new MobileMutationError('Use an approved issue category and a coordinate-free note of 1 to 500 characters', 'ISSUE_REJECTED');
    }
  } else if (typeof issueCategory !== 'undefined' || typeof issueNote !== 'undefined') {
    throw new MobileMutationError('Issue fields are allowed only for REPORT_ISSUE');
  }
}

async function mutate({ installationId, actorId, assignmentId, clientActionId, action, expectedRevision, actualAcreage, issueCategory, issueNote }) {
  validateMutation({ clientActionId, action, expectedRevision, actualAcreage, issueCategory, issueNote });
  const input = { assignmentId, clientActionId, action, expectedRevision, actualAcreage, issueCategory, issueNote };
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
          issueCategory,
          reason: typeof issueNote === 'string' ? issueNote.trim() : undefined,
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

module.exports = { MobileMutationError, mutate, validateMutation };
