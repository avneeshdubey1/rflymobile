const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.operatingCenter.create({ data }),
  findAll: (where = {}) => prisma.operatingCenter.findMany({ where, orderBy: { createdAt: 'asc' } }),
  findById: (id) => prisma.operatingCenter.findUnique({ where: { id } }),
  update: (id, data) => prisma.operatingCenter.update({ where: { id }, data }),
  deleteAll: () => prisma.operatingCenter.deleteMany(),
};
