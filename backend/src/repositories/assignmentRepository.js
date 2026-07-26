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
};
const defaultInclude = { lead: true, pilot: { select: pilotSelect }, drone: true, lmv: true, rescheduleHistory: true };

module.exports = {
  create: (data) => prisma.assignment.create({ data, include: defaultInclude }),
  findAll: (where = {}) => prisma.assignment.findMany({ where, include: defaultInclude, orderBy: { scheduledDate: 'asc' } }),
  findById: (id) => prisma.assignment.findUnique({ where: { id }, include: defaultInclude }),
  findSalesAlerts: () => prisma.assignment.findMany({
    where: { OR: [{ hasDiscrepancy: true }, { decommissionedMidMission: true }] },
    include: defaultInclude,
    orderBy: { createdAt: 'desc' },
  }),
  update: (id, data) => prisma.assignment.update({ where: { id }, data, include: defaultInclude }),
  delete: (id) => prisma.assignment.delete({ where: { id } }),
  findScheduledForPilotOnDate: (pilotId, start, end) => prisma.assignment.findMany({
    where: { pilotId, scheduledDate: { gte: start, lt: end }, lead: { status: { in: ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'] } } },
    include: defaultInclude,
  }),
  findScheduledForLmvOnDate: (lmvId, start, end) => prisma.assignment.findMany({
    where: { lmvId, scheduledDate: { gte: start, lt: end }, lead: { status: { in: ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'] } } },
    include: defaultInclude,
  }),
  findActiveForLmv: (lmvId) => prisma.assignment.findMany({
    where: { lmvId, lead: { status: { in: ['SCHEDULED', 'PILOT_ACCEPTED', 'IN_PROGRESS'] } } },
    include: defaultInclude,
  }),
  countForPilotBetween: (pilotId, start, end) => prisma.assignment.count({ where: { pilotId, scheduledDate: { gte: start, lt: end } } }),
  deleteAll: () => prisma.assignment.deleteMany(),
  createScheduleChange: (data) => prisma.scheduleChangeLog.create({ data }),
};
