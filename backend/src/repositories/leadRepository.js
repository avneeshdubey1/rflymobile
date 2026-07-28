const prisma = require('../lib/prisma');

const defaultInclude = { matchedCenter: true, assignment: true, customer: true };

module.exports = {
  create: (data) => prisma.lead.create({ data, include: defaultInclude }),
  findAll: (where = {}) => prisma.lead.findMany({ where, include: defaultInclude, orderBy: { createdAt: 'desc' } }),
  findById: (id) => prisma.lead.findUnique({ where: { id }, include: defaultInclude }),
  update: (id, data) => prisma.lead.update({ where: { id }, data, include: defaultInclude }),
  delete: (id) => prisma.lead.delete({ where: { id } }),
  deleteAll: () => prisma.lead.deleteMany(),
};
