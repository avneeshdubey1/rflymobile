const prisma = require('../lib/prisma');
const { createWithClient } = require('./auditLogRepository');
const { setHistoryActor } = require('./historyActorRepository');

class CashCollectionError extends Error {
  constructor(message, code = 'VALIDATION_FAILED', status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function project(collection) {
  return {
    id: collection.id,
    assignmentId: collection.assignmentId,
    amount: `${collection.amountMinor / 100n}.${String(collection.amountMinor % 100n).padStart(2, '0')}`,
    currencyCode: collection.currencyCode,
    method: 'CASH',
    reviewStatus: collection.reviewStatus,
    recordedAt: collection.createdAt.toISOString(),
    ...(collection.recordedBy ? { recordedBy: { id: collection.recordedBy.id, displayName: collection.recordedBy.name } } : {}),
    ...(collection.assignment ? {
      assignment: {
        id: collection.assignment.id,
        farmerDisplayName: collection.assignment.lead.farmerName,
        actualAcreage: collection.assignment.actualAcreage === null ? null : Number(collection.assignment.actualAcreage).toFixed(2),
      },
    } : {}),
  };
}

async function recordForPilot({ assignmentId, actorId, clientActionId, amountMinor, currencyCode }) {
  return prisma.$transaction(async (transaction) => {
    await setHistoryActor(transaction, actorId);
    const lockKey = `B2cCashCollection:${assignmentId}`;
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS locked`;

    const actionReplay = await transaction.b2cCashCollection.findUnique({
      where: { clientActionId },
      include: { recordedBy: { select: { id: true, name: true } } },
    });
    if (actionReplay) {
      if (actionReplay.assignmentId !== assignmentId
        || actionReplay.recordedById !== actorId
        || actionReplay.amountMinor !== amountMinor
        || actionReplay.currencyCode !== currencyCode) {
        throw new CashCollectionError('This action identifier was already used for another cash report', 'ACTION_ID_REUSED', 409);
      }
      return { collection: project(actionReplay), outcome: 'ALREADY_RECORDED' };
    }

    const assignment = await transaction.assignment.findUnique({
      where: { id: assignmentId },
      include: { lead: { select: { status: true, requestType: true } } },
    });
    if (!assignment || ![assignment.pilotId, assignment.copilotId].includes(actorId)) {
      throw new CashCollectionError('Assignment not found', 'RESOURCE_NOT_FOUND', 404);
    }
    if (assignment.lead.requestType !== 'B2C') {
      throw new CashCollectionError('Cash collection in Pilot Field is available only for B2C work', 'COLLECTION_NOT_ALLOWED', 409);
    }
    if (assignment.lead.status !== 'COMPLETED' || !assignment.completedAt) {
      throw new CashCollectionError('Complete the mission before recording customer cash', 'MISSION_STATE_CONFLICT', 409);
    }

    const existing = await transaction.b2cCashCollection.findUnique({
      where: { assignmentId },
      include: { recordedBy: { select: { id: true, name: true } } },
    });
    if (existing) {
      throw new CashCollectionError('Cash was already reported for this assignment. Admin must reconcile any correction.', 'COLLECTION_ALREADY_RECORDED', 409);
    }

    const collection = await transaction.b2cCashCollection.create({
      data: { assignmentId, amountMinor, currencyCode, clientActionId, recordedById: actorId },
      include: { recordedBy: { select: { id: true, name: true } } },
    });
    await createWithClient(transaction, {
      entityType: 'B2cCashCollection',
      entityId: collection.id,
      action: 'B2C_CASH_REPORTED_BY_PILOT',
      actorId,
      afterState: {
        assignmentId,
        amountMinor: amountMinor.toString(),
        currencyCode,
        method: 'CASH',
        reviewStatus: collection.reviewStatus,
      },
    });
    return { collection: project(collection), outcome: 'RECORDED' };
  }, { isolationLevel: 'Serializable' });
}

async function listForAdmin({ limit = 100 } = {}) {
  const boundedLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const rows = await prisma.b2cCashCollection.findMany({
    include: {
      recordedBy: { select: { id: true, name: true } },
      assignment: { select: { id: true, actualAcreage: true, lead: { select: { farmerName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: boundedLimit,
  });
  return rows.map(project);
}

module.exports = { CashCollectionError, listForAdmin, project, recordForPilot };
