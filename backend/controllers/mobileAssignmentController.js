const crewFormationRepository = require('../src/repositories/crewFormationRepository');
const mobileAssignmentRepository = require('../src/repositories/mobileAssignmentRepository');
const mobileMutationService = require('../services/mobileMutationService');
const locationService = require('../services/locationService');
const cashCollectionRepository = require('../src/repositories/cashCollectionRepository');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mobileError(res, req, error) {
  const knownStatus = {
    ASSIGNMENT_NOT_FOUND: 404,
    RESOURCE_NOT_FOUND: 404,
    PRIMARY_PILOT_REQUIRED: 403,
    CREW_OVERRIDE_FORBIDDEN: 403,
    ASSIGNMENT_REVISION_CONFLICT: 409,
    CREW_FORMATION_NOT_PENDING: 409,
    COPILOT_REPLACEMENT_CLOSED: 409,
    COPILOT_SELECTION_DEADLINE_PASSED: 409,
    COPILOT_NOT_ELIGIBLE: 409,
    COPILOT_SELF_SELECTION: 409,
    COPILOT_CROSS_CENTRE: 409,
    COPILOT_LICENCE_EXPIRED: 409,
    COPILOT_SCHEDULE_CONFLICT: 409,
    LEGACY_CREW_REVIEW_REQUIRED: 409,
    CREW_FORMATION_RETRY_EXHAUSTED: 503,
    LOCATION_NOT_ALLOWED: 409,
    LOCATION_INVALID: 400,
    RATE_LIMITED: 429,
    ACTIVE_ASSIGNMENT_BLOCKS_OFFLINE: 409,
    COLLECTION_NOT_ALLOWED: 409,
    COLLECTION_ALREADY_RECORDED: 409,
    ACTION_ID_REUSED: 409,
  };
  const status = error.status || knownStatus[error.code] || 500;
  const publicCode = {
    ASSIGNMENT_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    CREW_OVERRIDE_FORBIDDEN: 'ROLE_NOT_ALLOWED',
    CREW_OVERRIDE_REASON_REQUIRED: 'VALIDATION_FAILED',
    ASSIGNMENT_REVISION_REQUIRED: 'VALIDATION_FAILED',
    CREW_FORMATION_RETRY_EXHAUSTED: 'RETRY_LATER',
  }[error.code] || error.code || 'INTERNAL_ERROR';
  return res.status(status).json({
    success: false,
    error: {
      code: publicCode,
      message: status >= 500 ? 'Unable to complete the assignment request' : error.message,
      retryable: status === 503,
      requestId: req.requestId,
      ...(error.details ? { details: error.details } : {}),
    },
  });
}

function requireUuid(value, name) {
  if (!UUID_PATTERN.test(String(value || ''))) {
    throw mobileAssignmentRepository.mobileAssignmentError(`${name} must be a valid identifier`);
  }
  return value;
}

function requireBody(body, fields) {
  const allowed = new Set(fields);
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((field) => !allowed.has(field))) {
    throw mobileAssignmentRepository.mobileAssignmentError('Request body is invalid');
  }
}

async function list(req, res) {
  try {
    const allowedQuery = new Set(['from', 'to']);
    if (Object.keys(req.query).some((field) => !allowedQuery.has(field))) {
      throw mobileAssignmentRepository.mobileAssignmentError('Assignment query is invalid');
    }
    const assignments = await mobileAssignmentRepository.listForPilot({
      pilotId: req.auth.userId,
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ success: true, assignments });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function detail(req, res) {
  try {
    const assignment = await mobileAssignmentRepository.findForPilot({
      assignmentId: requireUuid(req.params.assignmentId, 'assignmentId'),
      pilotId: req.auth.userId,
    });
    return res.json({ success: true, assignment });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function eligibleCopilots(req, res) {
  try {
    const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
    await mobileAssignmentRepository.findForPilot({ assignmentId, pilotId: req.auth.userId });
    const candidates = await crewFormationRepository.listEligibleCopilots({
      assignmentId,
      actorId: req.auth.userId,
    });
    return res.json({ success: true, assignmentId, candidates });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

function parseAmountMinor(value) {
  const normalized = String(value || '').trim();
  const match = /^(0|[1-9]\d{0,8})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) {
    throw mobileAssignmentRepository.mobileAssignmentError('Enter a positive cash amount with no more than two decimal places');
  }
  const amountMinor = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0') || '0');
  if (amountMinor <= 0n) {
    throw mobileAssignmentRepository.mobileAssignmentError('Cash amount must be greater than zero');
  }
  return amountMinor;
}

async function eligibleCopilotsForOperations(req, res) {
  try {
    const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
    const candidates = await crewFormationRepository.listEligibleCopilotsForStaff({
      assignmentId,
      actorId: req.auth.userId,
    });
    return res.json({ success: true, assignmentId, candidates });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function selectCopilot(req, res) {
  try {
    requireBody(req.body, ['candidateId', 'expectedRevision']);
    const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
    const candidateId = requireUuid(req.body.candidateId, 'candidateId');
    await mobileAssignmentRepository.findForPilot({ assignmentId, pilotId: req.auth.userId });
    await crewFormationRepository.selectCopilot({
      assignmentId,
      candidateId,
      actorId: req.auth.userId,
      expectedRevision: req.body.expectedRevision,
    });
    const assignment = await mobileAssignmentRepository.findForPilot({ assignmentId, pilotId: req.auth.userId });
    return res.json({ success: true, assignment });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function overrideCopilot(req, res) {
  try {
    requireBody(req.body, ['candidateId', 'expectedRevision', 'reason']);
    const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
    const candidateId = requireUuid(req.body.candidateId, 'candidateId');
    if (typeof req.body.reason !== 'string' || !req.body.reason.trim() || req.body.reason.trim().length > 500) {
      throw mobileAssignmentRepository.mobileAssignmentError('Override reason must contain 1 to 500 characters');
    }
    const updated = await crewFormationRepository.overrideCopilot({
      assignmentId,
      candidateId,
      actorId: req.auth.userId,
      expectedRevision: req.body.expectedRevision,
      reason: req.body.reason,
    });
    return res.json({
      success: true,
      assignment: {
        id: updated.id,
        revision: updated.revision,
        crewFormationState: updated.crewFormationState,
        primaryPilot: { id: updated.pilot.id, displayName: updated.pilot.name },
        copilot: { id: updated.copilot.id, displayName: updated.copilot.name },
      },
    });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function mutate(req, res) {
  try {
    requireBody(req.body, ['clientActionId', 'action', 'expectedRevision', 'actualAcreage', 'issueCategory', 'issueNote', 'maintenanceReasonCode']);
    const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
    await mobileAssignmentRepository.findForPilot({ assignmentId, pilotId: req.auth.userId });
    const receipt = await mobileMutationService.mutate({
      installationId: req.mobileSession.installationId,
      actorId: req.auth.userId,
      assignmentId,
      clientActionId: req.body.clientActionId,
      action: req.body.action,
      expectedRevision: req.body.expectedRevision,
      actualAcreage: req.body.actualAcreage,
      issueCategory: req.body.issueCategory,
      issueNote: req.body.issueNote,
      maintenanceReasonCode: req.body.maintenanceReasonCode,
    });
    return res.json({ success: true, receipt });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function recordLocation(req, res) {
  try {
    requireBody(req.body, ['latitude', 'longitude', 'accuracyMetres', 'capturedAt']);
    const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
    await mobileAssignmentRepository.findForPilot({ assignmentId, pilotId: req.auth.userId });
    const config = req.app.get('config');
    if (!config.mobile.foregroundLocationEnabled) {
      throw locationService.locationError('Foreground location is not enabled for this deployment');
    }
    const location = await locationService.recordLocation(
      assignmentId,
      req.auth,
      req.body.latitude,
      req.body.longitude,
      {
        accuracyMetres: req.body.accuracyMetres,
        capturedAt: req.body.capturedAt,
        intervalSeconds: config.mobile.locationIntervalSeconds,
        maximumAccuracyMetres: config.mobile.locationAccuracyMetres,
      },
    );
    const io = req.app.get('io');
    if (io) io.to(`location:${assignmentId}`).emit('location:update', location);
    return res.json({
      success: true,
      location: { assignmentId: location.assignmentId, acceptedAt: location.lastPingAt.toISOString() },
    });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function collectCash(req, res) {
  try {
    requireBody(req.body, ['clientActionId', 'amount']);
    const assignmentId = requireUuid(req.params.assignmentId, 'assignmentId');
    const clientActionId = requireUuid(req.body.clientActionId, 'clientActionId');
    const config = req.app.get('config');
    if (!config.b2cCashCollection.enabled) {
      const error = mobileAssignmentRepository.mobileAssignmentError(
        'B2C cash collection is not enabled for this deployment',
        'COLLECTION_NOT_ALLOWED',
        409,
      );
      throw error;
    }
    const result = await cashCollectionRepository.recordForPilot({
      assignmentId,
      actorId: req.auth.userId,
      clientActionId,
      amountMinor: parseAmountMinor(req.body.amount),
      currencyCode: config.b2cCashCollection.currencyCode,
    });
    return res.status(result.outcome === 'RECORDED' ? 201 : 200).json({ success: true, ...result });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function changes(req, res) {
  try {
    const allowedQuery = new Set(['cursor', 'limit']);
    if (Object.keys(req.query).some((field) => !allowedQuery.has(field)) || typeof req.query.cursor !== 'string') {
      throw mobileAssignmentRepository.mobileAssignmentError('Sync query is invalid');
    }
    const result = await mobileAssignmentRepository.changesForPilot({
      pilotId: req.auth.userId,
      cursor: req.query.cursor,
      limit: typeof req.query.limit === 'undefined' ? 100 : Number(req.query.limit),
    });
    return res.json({ success: true, serverTime: new Date().toISOString(), ...result });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

async function sync(req, res) {
  try {
    requireBody(req.body, ['cursor', 'mutations']);
    if (typeof req.body.cursor !== 'string' || !Array.isArray(req.body.mutations)
      || req.body.mutations.length < 1 || req.body.mutations.length > 20) {
      throw mobileAssignmentRepository.mobileAssignmentError('Sync requires 1 to 20 ordered mutations and a cursor');
    }
    const actionIds = new Set();
    for (const mutation of req.body.mutations) {
      requireBody(mutation, ['assignmentId', 'clientActionId', 'action', 'expectedRevision', 'actualAcreage', 'issueCategory', 'issueNote', 'maintenanceReasonCode']);
      requireUuid(mutation.assignmentId, 'assignmentId');
      requireUuid(mutation.clientActionId, 'clientActionId');
      mobileMutationService.validateMutation(mutation);
      if (actionIds.has(mutation.clientActionId)) {
        throw mobileAssignmentRepository.mobileAssignmentError('A sync batch cannot repeat a clientActionId');
      }
      actionIds.add(mutation.clientActionId);
      await mobileAssignmentRepository.findForPilot({ assignmentId: mutation.assignmentId, pilotId: req.auth.userId });
    }
    const mutationReceipts = [];
    for (const mutation of req.body.mutations) {
      mutationReceipts.push(await mobileMutationService.mutate({
        installationId: req.mobileSession.installationId,
        actorId: req.auth.userId,
        assignmentId: mutation.assignmentId,
        clientActionId: mutation.clientActionId,
        action: mutation.action,
        expectedRevision: mutation.expectedRevision,
        actualAcreage: mutation.actualAcreage,
        issueCategory: mutation.issueCategory,
        issueNote: mutation.issueNote,
        maintenanceReasonCode: mutation.maintenanceReasonCode,
      }));
    }
    const changesResult = await mobileAssignmentRepository.changesForPilot({
      pilotId: req.auth.userId,
      cursor: req.body.cursor,
    });
    return res.json({
      success: true,
      serverTime: new Date().toISOString(),
      mutationReceipts,
      ...changesResult,
    });
  } catch (error) {
    return mobileError(res, req, error);
  }
}

module.exports = { changes, collectCash, detail, eligibleCopilots, eligibleCopilotsForOperations, list, mobileError, mutate, overrideCopilot, recordLocation, selectCopilot, sync };
