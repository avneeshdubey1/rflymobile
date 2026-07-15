const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.outOfRangeAppeal.create({ data, include: { lead: true } }),
  findByLeadId: (leadId) => prisma.outOfRangeAppeal.findUnique({ where: { leadId }, include: { lead: true } }),
  update: (id, data) => prisma.outOfRangeAppeal.update({ where: { id }, data, include: { lead: true } }),
};
