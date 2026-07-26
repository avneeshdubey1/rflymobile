const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.declinedEnquiry.create({ data }),
  count: (where = {}) => prisma.declinedEnquiry.count({ where }),
  findById: (id) => prisma.declinedEnquiry.findUnique({ where: { id } }),
  deleteExpired: (now) => prisma.declinedEnquiry.deleteMany({ where: { expiresAt: { lte: now } } }),
  deleteAll: () => prisma.declinedEnquiry.deleteMany(),
};
