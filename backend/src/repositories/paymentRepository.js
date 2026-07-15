const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.paymentRecord.create({ data }),
  findById: (id) => prisma.paymentRecord.findUnique({ where: { id }, include: { lead: true, assignment: true } }),
  findByAssignmentId: (assignmentId) => prisma.paymentRecord.findFirst({ where: { assignmentId }, include: { lead: true, assignment: true }, orderBy: { createdAt: 'desc' } }),
  findByLeadId: (leadId) => prisma.paymentRecord.findMany({ where: { leadId }, orderBy: { createdAt: 'asc' } }),
  findPending: () => prisma.paymentRecord.findMany({ where: { status: 'PENDING' }, include: { lead: true, assignment: true }, orderBy: { createdAt: 'asc' } }),
  update: (id, data) => prisma.paymentRecord.update({ where: { id }, data, include: { lead: true, assignment: true } }),
  deleteAll: () => prisma.paymentRecord.deleteMany(),
};
