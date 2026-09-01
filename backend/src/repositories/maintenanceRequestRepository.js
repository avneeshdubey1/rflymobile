const prisma = require('../lib/prisma');
const { sanitizeAuditReason, sanitizeAuditState } = require('./auditLogRepository');
const { setHistoryActor } = require('./historyActorRepository');

const include = {
  assignment: { select: { id: true, leadId: true, lead: { select: { farmerName: true, status: true } } } },
  drone: { select: { id: true, name: true, model: true, serialNumber: true, status: true, homeCenterId: true } },
  lmv: { select: { id: true, registrationNo: true, label: true, status: true, homeCenterId: true } },
  requestedBy: { select: { id: true, name: true, role: true } },
  processedBy: { select: { id: true, name: true, role: true } },
  resolvedBy: { select: { id: true, name: true, role: true } },
};

const assetLifecycle = {
  maintenance: { status: 'MAINTENANCE', operationalState: 'MAINTENANCE', availabilityState: 'UNAVAILABLE' },
  available: { status: 'AVAILABLE', operationalState: 'IN_SERVICE', availabilityState: 'AVAILABLE' },
};

function audit(transaction, data) {
  return transaction.auditLog.create({
    data: {
      ...data,
      beforeState: sanitizeAuditState(data.beforeState),
      afterState: sanitizeAuditState(data.afterState),
      reason: sanitizeAuditReason(data.reason),
    },
  });
}

async function quarantineAsset(transaction, request) {
  await setHistoryActor(transaction, request.requestedById);
  if (request.assetType === 'DRONE') {
    await transaction.drone.update({ where: { id: request.droneId }, data: assetLifecycle.maintenance });
  } else {
    await transaction.lMV.update({ where: { id: request.lmvId }, data: assetLifecycle.maintenance });
  }
}

async function createFromMission(transaction, {
  assignment,
  requestedById,
  assetType,
  reasonCode,
  reason,
}) {
  const assetId = assetType === 'DRONE' ? assignment.droneId : assignment.lmvId;
  if (!assetId) return null;
  const assetWhere = assetType === 'DRONE' ? { droneId: assetId } : { lmvId: assetId };
  const existing = await transaction.assetMaintenanceRequest.findFirst({
    where: { ...assetWhere, status: { in: ['PENDING', 'ACCEPTED'] } },
    include,
  });
  if (existing) return existing;
  const request = await transaction.assetMaintenanceRequest.create({
    data: {
      assetType,
      reasonCode,
      reason,
      assignmentId: assignment.id,
      requestedById,
      ...(assetType === 'DRONE' ? { droneId: assetId } : { lmvId: assetId }),
    },
    include,
  });
  await quarantineAsset(transaction, request);
  await audit(transaction, {
    entityType: 'AssetMaintenanceRequest',
    entityId: request.id,
    action: 'MAINTENANCE_REQUESTED',
    actorId: requestedById,
    afterState: request,
    reason,
  });
  return request;
}

async function createFromOperations({ assetType, assetId, requestedById, reasonCode, reason }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'MaintenanceAsset:' + assetType + ':' + assetId}))`;
    const assetWhere = assetType === 'DRONE' ? { droneId: assetId } : { lmvId: assetId };
    const existing = await transaction.assetMaintenanceRequest.findFirst({
      where: { ...assetWhere, status: { in: ['PENDING', 'ACCEPTED'] } },
      include,
    });
    if (existing) return { request: existing, created: false };

    const asset = assetType === 'DRONE'
      ? await transaction.drone.findUnique({ where: { id: assetId }, select: { id: true, archivedAt: true } })
      : await transaction.lMV.findUnique({ where: { id: assetId }, select: { id: true, archivedAt: true } });
    if (!asset) {
      const error = new Error(`${assetType === 'DRONE' ? 'Drone' : 'LMV'} not found`);
      error.statusCode = 404;
      throw error;
    }
    if (asset.archivedAt) {
      const error = new Error('A retired asset cannot enter maintenance');
      error.statusCode = 409;
      throw error;
    }
    const activeAssignment = await transaction.assignment.findFirst({
      where: {
        ...(assetType === 'DRONE' ? { droneId: assetId } : { lmvId: assetId }),
        completedAt: null,
        lead: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
      },
      select: { id: true },
    });
    if (activeAssignment) {
      const error = new Error('An asset with an active mission must be handled through the mission issue workflow');
      error.statusCode = 409;
      throw error;
    }

    const now = new Date();
    const request = await transaction.assetMaintenanceRequest.create({
      data: {
        assetType,
        reasonCode,
        reason,
        requestedById,
        processedById: requestedById,
        processedAt: now,
        processingNote: reason,
        status: 'ACCEPTED',
        ...(assetType === 'DRONE' ? { droneId: assetId } : { lmvId: assetId }),
      },
      include,
    });
    await quarantineAsset(transaction, request);
    await audit(transaction, {
      entityType: 'AssetMaintenanceRequest',
      entityId: request.id,
      action: 'MAINTENANCE_OPENED_BY_OPERATIONS',
      actorId: requestedById,
      afterState: request,
      reason,
    });
    return { request, created: true };
  });
}

function list({ status } = {}) {
  return prisma.assetMaintenanceRequest.findMany({
    where: status ? { status } : {},
    include,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 250,
  });
}

async function listActivity({ take = 250 } = {}) {
  const limit = Math.min(Math.max(Number(take) || 250, 1), 250);
  const rows = await prisma.auditLog.findMany({
    where: {
      entityType: { in: ['Drone', 'LMV'] },
      action: { in: ['STATUS_CHANGE', 'ARCHIVED'] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  const droneIds = rows.filter((row) => row.entityType === 'Drone').map((row) => row.entityId);
  const lmvIds = rows.filter((row) => row.entityType === 'LMV').map((row) => row.entityId);
  const actorIds = rows.map((row) => row.actorId).filter(Boolean);
  const [drones, lmvs, actors] = await Promise.all([
    prisma.drone.findMany({ where: { id: { in: droneIds } }, select: { id: true, name: true, model: true, serialNumber: true } }),
    prisma.lMV.findMany({ where: { id: { in: lmvIds } }, select: { id: true, registrationNo: true, label: true } }),
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } }),
  ]);
  const droneById = new Map(drones.map((asset) => [asset.id, asset]));
  const lmvById = new Map(lmvs.map((asset) => [asset.id, asset]));
  const actorById = new Map(actors.map((actor) => [actor.id, actor]));
  return rows.map((row) => ({
    id: row.id,
    assetType: row.entityType === 'Drone' ? 'DRONE' : 'LMV',
    assetId: row.entityId,
    eventType: row.action === 'ARCHIVED' ? 'RETIRED' : 'STATUS_CHANGED',
    asset: row.entityType === 'Drone' ? droneById.get(row.entityId) || null : lmvById.get(row.entityId) || null,
    actor: row.actorId ? actorById.get(row.actorId) || null : null,
    reason: row.reason || null,
    beforeStatus: row.beforeState?.status || null,
    afterStatus: row.afterState?.status || null,
    createdAt: row.createdAt,
  }));
}

async function transition({ id, actorId, action, note, returnToService = false }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'MaintenanceRequest:' + id}))`;
    const before = await transaction.assetMaintenanceRequest.findUnique({ where: { id }, include });
    if (!before) return null;
    const normalizedNote = String(note || '').trim();
    if (normalizedNote.length < 3 || normalizedNote.length > 500) {
      const error = new Error('A note of 3 to 500 characters is required');
      error.statusCode = 400;
      throw error;
    }
    const now = new Date();
    let data;
    if (action === 'ACCEPT') {
      if (before.status !== 'PENDING') {
        const error = new Error('Only a pending request can be accepted');
        error.statusCode = 409;
        throw error;
      }
      data = { status: 'ACCEPTED', processedById: actorId, processedAt: now, processingNote: normalizedNote };
    } else if (action === 'REJECT') {
      if (before.status !== 'PENDING') {
        const error = new Error('Only a pending request can be rejected');
        error.statusCode = 409;
        throw error;
      }
      data = { status: 'REJECTED', processedById: actorId, processedAt: now, processingNote: normalizedNote };
    } else if (action === 'RESOLVE') {
      if (!['PENDING', 'ACCEPTED'].includes(before.status)) {
        const error = new Error('Only an open request can be resolved');
        error.statusCode = 409;
        throw error;
      }
      data = {
        status: 'RESOLVED',
        processedById: before.processedById || actorId,
        processedAt: before.processedAt || now,
        processingNote: before.processingNote || normalizedNote,
        resolvedById: actorId,
        resolvedAt: now,
        resolutionNote: normalizedNote,
      };
      if (returnToService) {
        const activeAssignment = await transaction.assignment.findFirst({
          where: {
            ...(before.assetType === 'DRONE' ? { droneId: before.droneId } : { lmvId: before.lmvId }),
            completedAt: null,
            lead: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
          },
          select: { id: true },
        });
        if (activeAssignment) {
          const error = new Error('The asset still has an active mission and cannot return to service');
          error.statusCode = 409;
          throw error;
        }
        await setHistoryActor(transaction, actorId);
        if (before.assetType === 'DRONE') {
          await transaction.drone.update({ where: { id: before.droneId }, data: assetLifecycle.available });
        } else {
          await transaction.lMV.update({ where: { id: before.lmvId }, data: assetLifecycle.available });
        }
      }
    } else {
      const error = new Error('Unsupported maintenance action');
      error.statusCode = 400;
      throw error;
    }
    const updated = await transaction.assetMaintenanceRequest.update({ where: { id }, data, include });
    await audit(transaction, {
      entityType: 'AssetMaintenanceRequest',
      entityId: id,
      action: `MAINTENANCE_${action}`,
      actorId,
      beforeState: before,
      afterState: updated,
      reason: normalizedNote,
    });
    await transaction.notification.create({
      data: {
        type: 'MAINTENANCE_REQUEST_UPDATED',
        recipientId: before.requestedById,
        leadId: before.assignment?.leadId || null,
        message: `${before.assetType} maintenance request ${id} is now ${updated.status}. Processed by ${updated.processedBy?.name || updated.resolvedBy?.name || 'Operations'}.`,
      },
    });
    return updated;
  });
}

module.exports = { createFromMission, createFromOperations, include, list, listActivity, transition };
