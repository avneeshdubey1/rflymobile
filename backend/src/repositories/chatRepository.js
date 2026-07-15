const prisma = require('../lib/prisma');

const participantSelect = { id: true, name: true, email: true, role: true };
const sessionInclude = {
  admin: { select: participantSelect },
  pilot: { select: participantSelect },
  messages: { orderBy: { sentAt: 'asc' } },
};

module.exports = {
  createSession: (data) => prisma.chatSession.create({ data, include: sessionInclude }),
  findSessionById: (id) => prisma.chatSession.findUnique({ where: { id }, include: sessionInclude }),
  findOpenByParticipants: (adminId, pilotId) => prisma.chatSession.findFirst({ where: { adminId, pilotId, status: 'OPEN' }, include: sessionInclude, orderBy: { createdAt: 'desc' } }),
  findForParticipant: (userId) => prisma.chatSession.findMany({
    where: { OR: [{ adminId: userId }, { pilotId: userId }] },
    include: { ...sessionInclude, messages: { orderBy: { sentAt: 'desc' }, take: 1 } },
    orderBy: { lastActivityAt: 'desc' },
  }),
  createMessage: (data) => prisma.chatMessage.create({ data }),
  touch: (id, data = {}) => prisma.chatSession.update({ where: { id }, data: { lastActivityAt: new Date(), ...data }, include: sessionInclude }),
  unreadForRecipient: (sessionId, recipientId) => prisma.chatMessage.findMany({ where: { sessionId, senderId: { not: recipientId }, readAt: null }, select: { id: true } }),
  markRead: (messageIds, readAt) => prisma.chatMessage.updateMany({ where: { id: { in: messageIds } }, data: { readAt } }),
  findExpiredOpen: (before) => prisma.chatSession.findMany({
    where: {
      status: 'OPEN',
      firstResponseReadAt: { not: null },
      lastActivityAt: { lt: before },
      messages: { none: { readAt: null } },
    },
    include: sessionInclude,
  }),
  closeIfOpen: (id, closedAt) => prisma.chatSession.updateMany({ where: { id, status: 'OPEN' }, data: { status: 'CLOSED', closedAt } }),
};
