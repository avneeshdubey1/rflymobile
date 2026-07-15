const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.drone.create({ data, include: { homeCenter: true } }),
  findAll: (where = {}) => prisma.drone.findMany({ where, include: { homeCenter: true }, orderBy: { createdAt: 'desc' } }),
  findById: (id) => prisma.drone.findUnique({ where: { id }, include: { homeCenter: true } }),
  update: (id, data) => prisma.drone.update({ where: { id }, data, include: { homeCenter: true } }),
  deleteAll: () => prisma.drone.deleteMany(),
};
