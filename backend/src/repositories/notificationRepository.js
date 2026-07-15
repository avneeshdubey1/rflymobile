const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.notification.create({ data }),
  findForRecipient: (recipientId) => prisma.notification.findMany({ where: { recipientId }, orderBy: { createdAt: 'desc' } }),
  markRead: (id) => prisma.notification.update({ where: { id }, data: { readAt: new Date() } }),
  deleteAll: () => prisma.notification.deleteMany(),
};
