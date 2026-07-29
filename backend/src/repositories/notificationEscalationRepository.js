const prisma = require('../lib/prisma');

const include = {
  assignment: {
    include: {
      lead: true,
      pilot: { select: { id: true, name: true, email: true, phone: true, role: true, preferredLanguage: true, homeCenterId: true, pilotLicenseExpiry: true } },
      drone: true,
    },
  },
};

module.exports = {
  create: (data) => prisma.notificationEscalation.create({ data, include }),
  startForAssignment: (data) => prisma.notificationEscalation.upsert({
    where: { assignmentId: data.assignmentId },
    create: data,
    update: {
      stage: data.stage,
      nextActionAt: data.nextActionAt,
      reassignCount: 0,
      closedAt: null,
    },
    include,
  }),
  findDue: (now) => prisma.notificationEscalation.findMany({ where: { closedAt: null, nextActionAt: { lte: now } }, include, orderBy: { nextActionAt: 'asc' } }),
  findByAssignmentId: (assignmentId) => prisma.notificationEscalation.findUnique({ where: { assignmentId }, include }),
  update: (id, data) => prisma.notificationEscalation.update({ where: { id }, data, include }),
  closeByAssignmentId: (assignmentId) => prisma.notificationEscalation.updateMany({ where: { assignmentId, closedAt: null }, data: { closedAt: new Date() } }),
  deleteByAssignmentId: (assignmentId) => prisma.notificationEscalation.deleteMany({ where: { assignmentId } }),
  deleteAll: () => prisma.notificationEscalation.deleteMany(),
};
