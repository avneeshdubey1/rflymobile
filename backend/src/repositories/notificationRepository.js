const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.notification.create({ data }),
  findForRecipient: (recipientId, take) => prisma.notification.findMany({
    where: { recipientId },
    orderBy: { createdAt: 'desc' },
    ...(Number.isInteger(take) ? { take } : {}),
  }),
  markRead: (id) => prisma.notification.update({ where: { id }, data: { readAt: new Date() } }),
  closePilotAssignmentNotifications: (recipientId, leadId) => prisma.notification.updateMany({
    where: {
      recipientId,
      leadId,
      readAt: null,
      type: { in: ['PILOT_ASSIGNMENT', 'PILOT_SMS'] },
    },
    data: { readAt: new Date() },
  }),
  deleteAll: () => prisma.notification.deleteMany(),
};
