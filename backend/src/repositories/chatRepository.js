const prisma = require('../lib/prisma');

const participantSelect = { id: true, name: true, email: true, phone: true, role: true };
const sessionInclude = {
  participants: { select: participantSelect },
  messages: { orderBy: { sentAt: 'asc' } },
  lead: { select: { id: true, farmerName: true, status: true } }
};

module.exports = {
  createSession: (data, participantIds) => prisma.chatSession.create({ 
    data: { 
      ...data, 
      participants: { connect: participantIds.map(id => ({ id })) } 
    }, 
    include: sessionInclude 
  }),
  findSessionById: (id) => prisma.chatSession.findUnique({ where: { id }, include: sessionInclude }),
  findOpenByLead: (leadId) => prisma.chatSession.findFirst({ where: { leadId, status: 'OPEN' }, include: sessionInclude, orderBy: { createdAt: 'desc' } }),
  findOpenDirect: (userIdA, userIdB) => prisma.chatSession.findFirst({ 
    where: { 
      status: 'OPEN', 
      leadId: null,
      AND: [
        { participants: { some: { id: userIdA } } },
        { participants: { some: { id: userIdB } } }
      ]
    }, 
    include: sessionInclude, 
    orderBy: { createdAt: 'desc' } 
  }),
  findForParticipant: (userId) => prisma.chatSession.findMany({
    where: { participants: { some: { id: userId } } },
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
  archiveSession: (id, archivedAt) => prisma.chatSession.update({ where: { id }, data: { archivedAt } }),
};
