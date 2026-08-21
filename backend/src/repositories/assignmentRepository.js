const prisma = require('../lib/prisma');

const pilotSelect = {
    id: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    preferredLanguage: true,
    homeCenterId: true,
    pilotLicenseExpiry: true,
    active: true,
    pilotAvailabilityState: true,
    archivedAt: true,
    assignedDrone: true
};
// const defaultInclude = { lead: true, pilot: { select: pilotSelect }, copilot: { select: pilotSelect }, drone: true, lmv: true, rescheduleHistory: true };
const defaultInclude = {
    lead: true,
    pilot: {
        select: pilotSelect
    },
    copilot: {
        select: pilotSelect
    },
    drone: true,
    copilotDrone: true,
    lmv: true,
    rescheduleHistory: true
};
const activeStatuses = ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'];

module.exports = {
    findAll: (where = {}) => prisma.assignment.findMany({ where, include: defaultInclude, orderBy: [{ scheduledDate: 'asc' }, { dailySequence: 'asc' }] }),
    findById: (id) => prisma.assignment.findUnique({ where: { id }, include: defaultInclude }),
    findByLeadId: (leadId) => prisma.assignment.findUnique({ where: { leadId }, include: defaultInclude }),
    findSalesAlerts: () => prisma.assignment.findMany({
        where: { OR: [{ hasDiscrepancy: true }, { decommissionedMidMission: true }] },
        include: defaultInclude,
        orderBy: { createdAt: 'desc' },
    }),
    update: (id, data) => prisma.assignment.update({ where: { id }, data, include: defaultInclude }),
    findScheduledForPilotOnDate: (pilotId, start, end) => prisma.assignment.findMany({
        where: { OR: [{ pilotId }, { copilotId: pilotId }], scheduledDate: { gte: start, lt: end }, lead: { status: { in: activeStatuses } } },
        include: defaultInclude,
    }),
    findScheduledForLmvOnDate: (lmvId, start, end) => prisma.assignment.findMany({
        where: { lmvId, scheduledDate: { gte: start, lt: end }, lead: { status: { in: activeStatuses } } },
        include: defaultInclude,
    }),
    findActiveForLmv: (lmvId) => prisma.assignment.findMany({
        where: { lmvId, completedAt: null, lead: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } } },
        include: defaultInclude,
    }),
    findActiveForDrone: (droneId) => prisma.assignment.findMany({
        where: { droneId, completedAt: null, lead: { status: { notIn: ['COMPLETED', 'CANCELLED', 'REJECTED'] } } },
        include: defaultInclude,
    }),
    findActiveForPilot: (pilotId) => prisma.assignment.findMany({
        where: { OR: [{ pilotId }, { copilotId: pilotId }], lead: { status: { in: activeStatuses } } },
        include: defaultInclude,
    }),
    countForPilotBetween: (pilotId, start, end) => prisma.assignment.count({ where: { OR: [{ pilotId }, { copilotId: pilotId }], scheduledDate: { gte: start, lt: end } } }),
    findCrewDay: ({ pilotId, copilotId, droneId, lmvId, start, end }) => prisma.assignment.findMany({
        where: {
            pilotId,
            copilotId,
            droneId,
            lmvId,
            scheduledDate: { gte: start, lt: end },
            lead: { status: { in: activeStatuses } },
        },
        include: defaultInclude,
        orderBy: { dailySequence: 'asc' },
    }),
    findInProgressConflicts: ({ id, pilotId, copilotId, droneId, lmvId }) => prisma.assignment.findMany({
        where: {
            id: { not: id },
            lead: { status: 'IN_PROGRESS' },
            OR: [
                { pilotId: { in: [pilotId, copilotId].filter(Boolean) } },
                { copilotId: { in: [pilotId, copilotId].filter(Boolean) } },
                { droneId },
                ...(lmvId ? [{ lmvId }] : []),
            ],
        },
        include: defaultInclude,
    }),
    findEarlierIncomplete: (assignment, start, end) => prisma.assignment.findMany({
        where: {
            id: { not: assignment.id },
            pilotId: assignment.pilotId,
            copilotId: assignment.copilotId,
            droneId: assignment.droneId,
            lmvId: assignment.lmvId,
            scheduledDate: { gte: start, lt: end },
            dailySequence: { lt: assignment.dailySequence },
            lead: { status: { in: activeStatuses } },
        },
        include: defaultInclude,
        orderBy: { dailySequence: 'asc' },
    }),
    deleteAll: () => prisma.assignment.deleteMany(),
};
