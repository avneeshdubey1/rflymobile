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
  archivedAt: true,
};
const defaultInclude = { lead: true, pilot: { select: pilotSelect }, copilot: { select: pilotSelect }, drone: true, lmv: true, rescheduleHistory: true };
const activeStatuses = ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'];

async function startExclusive(assignmentId, actorId) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const assignment = await transaction.assignment.findUnique({ where: { id: assignmentId }, include: defaultInclude });
        if (!assignment) throw new Error('Assignment not found');
        if (![assignment.pilotId, assignment.copilotId].filter(Boolean).includes(actorId)) throw new Error('Only an assigned crew member can change this mission');
        if (assignment.lead.status !== 'PILOT_ACCEPTED') throw new Error('A mission must be accepted before it can start');
        if (!assignment.pilot.active || assignment.pilot.archivedAt || (assignment.copilot && (!assignment.copilot.active || assignment.copilot.archivedAt))) throw new Error('Every assigned crew member must have an active account');
        if (['MAINTENANCE', 'OUT_OF_SERVICE'].includes(assignment.drone.status)) throw new Error('The assigned drone is not operational');
        if (assignment.lmv && ['MAINTENANCE', 'OUT_OF_SERVICE'].includes(assignment.lmv.status)) throw new Error('The assigned LMV is not operational');

        const crewIds = [assignment.pilotId, assignment.copilotId].filter(Boolean);
        const conflicts = await transaction.assignment.findFirst({
          where: {
            id: { not: assignment.id },
            lead: { status: 'IN_PROGRESS' },
            OR: [
              { pilotId: { in: crewIds } },
              { copilotId: { in: crewIds } },
              { droneId: assignment.droneId },
              ...(assignment.lmvId ? [{ lmvId: assignment.lmvId }] : []),
            ],
          },
          select: { id: true },
        });
        if (conflicts) throw new Error('Another job using this crew, drone, or LMV is already in progress');

        const dayStart = new Date(assignment.scheduledDate); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
        const earlier = await transaction.assignment.findFirst({
          where: {
            id: { not: assignment.id },
            pilotId: assignment.pilotId,
            copilotId: assignment.copilotId,
            droneId: assignment.droneId,
            lmvId: assignment.lmvId,
            scheduledDate: { gte: dayStart, lt: dayEnd },
            dailySequence: { lt: assignment.dailySequence },
            lead: { status: { in: activeStatuses } },
          },
          orderBy: { dailySequence: 'asc' },
          select: { dailySequence: true },
        });
        if (earlier) throw new Error(`Complete job ${earlier.dailySequence} before starting this job`);

        const startedAt = new Date();
        const updatedAssignment = await transaction.assignment.update({
          where: { id: assignment.id },
          data: { startedAt },
          include: defaultInclude,
        });
        const updatedLead = await transaction.lead.update({ where: { id: assignment.leadId }, data: { status: 'IN_PROGRESS' } });
        await transaction.auditLog.create({
          data: {
            entityType: 'Assignment',
            entityId: assignment.id,
            action: 'MISSION_STARTED',
            actorId,
            beforeState: { status: assignment.lead.status, dailySequence: assignment.dailySequence },
            afterState: { status: 'IN_PROGRESS', dailySequence: assignment.dailySequence, startedAt },
          },
        });
        await transaction.auditLog.create({
          data: {
            entityType: 'Lead',
            entityId: assignment.leadId,
            action: 'STATUS_CHANGE',
            actorId,
            beforeState: { status: assignment.lead.status },
            afterState: { status: 'IN_PROGRESS' },
          },
        });
        return { assignment: updatedAssignment, lead: updatedLead };
      }, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (error.code === 'P2034' && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error('Mission start could not be serialized');
}

module.exports = {
  create: (data) => prisma.assignment.create({ data, include: defaultInclude }),
  findAll: (where = {}) => prisma.assignment.findMany({ where, include: defaultInclude, orderBy: [{ scheduledDate: 'asc' }, { dailySequence: 'asc' }] }),
  findById: (id) => prisma.assignment.findUnique({ where: { id }, include: defaultInclude }),
  findSalesAlerts: () => prisma.assignment.findMany({
    where: { OR: [{ hasDiscrepancy: true }, { decommissionedMidMission: true }] },
    include: defaultInclude,
    orderBy: { createdAt: 'desc' },
  }),
  update: (id, data) => prisma.assignment.update({ where: { id }, data, include: defaultInclude }),
  delete: (id) => prisma.assignment.delete({ where: { id } }),
  findScheduledForPilotOnDate: (pilotId, start, end) => prisma.assignment.findMany({
    where: { OR: [{ pilotId }, { copilotId: pilotId }], scheduledDate: { gte: start, lt: end }, lead: { status: { in: activeStatuses } } },
    include: defaultInclude,
  }),
  findScheduledForLmvOnDate: (lmvId, start, end) => prisma.assignment.findMany({
    where: { lmvId, scheduledDate: { gte: start, lt: end }, lead: { status: { in: activeStatuses } } },
    include: defaultInclude,
  }),
  findActiveForLmv: (lmvId) => prisma.assignment.findMany({
    where: { lmvId, lead: { status: { in: activeStatuses } } },
    include: defaultInclude,
  }),
  findActiveForDrone: (droneId) => prisma.assignment.findMany({
    where: { droneId, lead: { status: { in: activeStatuses } } },
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
  nextDailySequence: async ({ pilotId, copilotId, droneId, lmvId, start, end, excludeId }) => {
    const latest = await prisma.assignment.findFirst({
      where: { ...(excludeId ? { id: { not: excludeId } } : {}), pilotId, copilotId, droneId, lmvId, scheduledDate: { gte: start, lt: end } },
      orderBy: { dailySequence: 'desc' },
      select: { dailySequence: true },
    });
    return (latest?.dailySequence || 0) + 1;
  },
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
  resequenceDay: async (assignmentId, desiredSequence) => prisma.$transaction(async (transaction) => {
    const assignment = await transaction.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) return null;
    const start = new Date(assignment.scheduledDate); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const dayAssignments = await transaction.assignment.findMany({
      where: {
        pilotId: assignment.pilotId,
        copilotId: assignment.copilotId,
        droneId: assignment.droneId,
        lmvId: assignment.lmvId,
        scheduledDate: { gte: start, lt: end },
      },
      orderBy: [{ dailySequence: 'asc' }, { createdAt: 'asc' }],
    });
    const reordered = dayAssignments.filter((item) => item.id !== assignmentId);
    const targetIndex = Math.max(0, Math.min(Number(desiredSequence) - 1, reordered.length));
    reordered.splice(targetIndex, 0, assignment);
    await Promise.all(reordered.map((item, index) => transaction.assignment.update({
      where: { id: item.id },
      data: { dailySequence: index + 1 },
    })));
    return transaction.assignment.findUnique({ where: { id: assignmentId }, include: defaultInclude });
  }),
  startExclusive,
  deleteAll: () => prisma.assignment.deleteMany(),
  createScheduleChange: (data) => prisma.scheduleChangeLog.create({ data }),
};
