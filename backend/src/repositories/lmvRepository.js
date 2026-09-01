const prisma = require('../lib/prisma');
const { setHistoryActor } = require('./historyActorRepository');
const { sanitizeAuditState } = require('./auditLogRepository');

const include = {
  homeCenter: true,
  preferredByPilots: { select: { id: true, name: true } },
};

module.exports = {
  create: (data, options = {}) => prisma.$transaction(async (transaction) => {
    await setHistoryActor(transaction, options.actorId);
    return transaction.lMV.create({ data, include });
  }),
  findAll: (where = {}) => prisma.lMV.findMany({ where, include, orderBy: [{ createdAt: 'desc' }] }),
  findById: (id) => prisma.lMV.findUnique({ where: { id }, include }),
  findEligibleForCenter: (homeCenterId) => prisma.lMV.findMany({
    where: {
      homeCenterId,
      status: 'AVAILABLE',
      operationalState: 'IN_SERVICE',
      availabilityState: 'AVAILABLE',
      archivedAt: null,
    },
    include,
    orderBy: [{ createdAt: 'asc' }],
  }),
  update: (id, data, options = {}) => prisma.$transaction(async (transaction) => {
    await setHistoryActor(transaction, options.actorId);
    await transaction.lMV.update({ where: { id }, data });
    if (options.clearIncompatiblePreferences && data.homeCenterId) {
      await transaction.user.updateMany({
        where: { assignedLmvId: id, homeCenterId: { not: data.homeCenterId } },
        data: { assignedLmvId: null },
      });
    }
    return transaction.lMV.findUnique({ where: { id }, include });
  }),
  retire: (id, actorId, reason) => prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'AssignmentResource:lmv:' + id}))`;
    await setHistoryActor(transaction, actorId);
    const before = await transaction.lMV.findUnique({ where: { id }, include });
    if (!before) return null;
    if (before.archivedAt) return { lmv: before, changed: false };
    const activeAssignment = await transaction.assignment.findFirst({
      where: {
        lmvId: id,
        completedAt: null,
        lead: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
      },
      select: { id: true },
    });
    if (activeAssignment) {
      const error = new Error('An assigned LMV cannot be retired while active missions exist');
      error.statusCode = 409;
      throw error;
    }
    const lmv = await transaction.lMV.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        status: 'OUT_OF_SERVICE',
        operationalState: 'OUT_OF_SERVICE',
        availabilityState: 'UNAVAILABLE',
      },
      include,
    });
    await transaction.user.updateMany({ where: { assignedLmvId: id }, data: { assignedLmvId: null } });
    await transaction.auditLog.create({
      data: {
        entityType: 'LMV',
        entityId: id,
        action: 'ARCHIVED',
        actorId,
        beforeState: sanitizeAuditState(before),
        afterState: sanitizeAuditState(lmv),
        reason,
      },
    });
    return { lmv, changed: true };
  }),
  deleteAll: () => prisma.lMV.deleteMany(),
};
