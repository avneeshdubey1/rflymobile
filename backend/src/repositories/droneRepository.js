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
        return transaction.drone.create({ data, include });
    }),
    findAll: (where = {}) => prisma.drone.findMany({ where, include, orderBy: { createdAt: 'desc' } }),
    findById: (id) => prisma.drone.findUnique({ where: { id }, include }),
    findByUin: (uin) =>
        prisma.drone.findUnique({
            where: { uin }
        }),
    update: (id, data, options = {}) => prisma.$transaction(async (transaction) => {
        await setHistoryActor(transaction, options.actorId);
        await transaction.drone.update({ where: { id }, data });
        if (options.clearIncompatiblePreferences && data.homeCenterId) {
            await transaction.user.updateMany({
                where: { assignedDroneId: id, homeCenterId: { not: data.homeCenterId } },
                data: { assignedDroneId: null },
            });
        }
        return transaction.drone.findUnique({ where: { id }, include });
    }),
    retire: (id, actorId, reason) => prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'AssignmentResource:drone:' + id}))`;
        await setHistoryActor(transaction, actorId);
        const before = await transaction.drone.findUnique({ where: { id }, include });
        if (!before) return null;
        if (before.archivedAt) return { drone: before, changed: false };
        const activeAssignment = await transaction.assignment.findFirst({
            where: {
                droneId: id,
                completedAt: null,
                lead: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } },
            },
            select: { id: true },
        });
        if (activeAssignment) {
            const error = new Error('An assigned drone cannot be retired while active missions exist');
            error.statusCode = 409;
            throw error;
        }
        const drone = await transaction.drone.update({
            where: { id },
            data: {
                archivedAt: new Date(),
                status: 'OUT_OF_SERVICE',
                operationalState: 'OUT_OF_SERVICE',
                availabilityState: 'UNAVAILABLE',
            },
            include,
        });
        await transaction.user.updateMany({ where: { assignedDroneId: id }, data: { assignedDroneId: null } });
        await transaction.auditLog.create({
            data: {
                entityType: 'Drone',
                entityId: id,
                action: 'ARCHIVED',
                actorId,
                beforeState: sanitizeAuditState(before),
                afterState: sanitizeAuditState(drone),
                reason,
            },
        });
        return { drone, changed: true };
    }),
    deleteAll: () => prisma.drone.deleteMany(),
};
