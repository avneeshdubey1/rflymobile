const prisma = require('../lib/prisma');

const include = { homeCenter: true };

module.exports = {
  create: (data) => prisma.lMV.create({ data, include }),
  findAll: (where = {}) => prisma.lMV.findMany({ where, include, orderBy: [{ createdAt: 'desc' }] }),
  findById: (id) => prisma.lMV.findUnique({ where: { id }, include }),
  findEligibleForCenter: (homeCenterId) => prisma.lMV.findMany({ where: { homeCenterId, status: 'AVAILABLE' }, include, orderBy: [{ createdAt: 'asc' }] }),
  update: (id, data) => prisma.lMV.update({ where: { id }, data, include }),
  deleteAll: () => prisma.lMV.deleteMany(),
};
