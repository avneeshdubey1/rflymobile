const chatRepository = require('../src/repositories/chatRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogService = require('./auditLogService');

const roleRank = Object.freeze({
  ADMIN: 4,
  FLEET_MANAGER: 3,
  SALES: 2,
  PILOT: 1,
});

function isParticipant(session, userId) {
  return session.participants.some(p => p.id === userId);
}

async function requireParticipant(sessionId, actor) {
  const session = await chatRepository.findSessionById(sessionId);
  if (!session) throw new Error('Chat session not found');
  if (!isParticipant(session, actor.userId) && actor.role !== 'ADMIN') throw new Error('You are not a participant in this chat');
  return session;
}

async function createOrFindDirectSession(actor, targetUserId) {
  const participant = await userRepository.findById(targetUserId);
  if (!participant || participant.active === false || participant.archivedAt || !roleRank[participant.role]) {
    throw new Error('Chat participant not found');
  }
  if (!roleRank[actor.role] || roleRank[actor.role] <= roleRank[participant.role]) {
    throw new Error('A chat must be started by a higher-authority operational role');
  }

  const existing = await chatRepository.findOpenDirect(actor.userId, targetUserId);
  if (existing) return { session: existing, created: false };

  const session = await chatRepository.createSession({}, [actor.userId, targetUserId]);
  await auditLogService.record({ entityType: 'ChatSession', entityId: session.id, action: 'CHAT_SESSION_OPENED', actorId: actor.userId, afterState: { type: 'DIRECT', participants: [actor.userId, targetUserId], status: session.status } });
  return { session, created: true };
}

async function listSessions(actor) {
  return actor.role === 'ADMIN'
    ? chatRepository.findAll()
    : chatRepository.findForParticipant(actor.userId);
}

async function listParticipants(actor) {
  const actorRank = roleRank[actor.role];
  if (!actorRank) return [];
  const users = await userRepository.findAll({ active: true, archivedAt: null });
  return users.filter((user) => roleRank[user.role] && roleRank[user.role] < actorRank);
}

async function listMessages(sessionId, actor) {
  const session = await requireParticipant(sessionId, actor);
  return { session, messages: session.messages };
}

async function sendMessage(sessionId, actor, content) {
  const session = await requireParticipant(sessionId, actor);
  if (session.status !== 'OPEN') throw new Error('This chat session is closed');
  const actorRank = roleRank[actor.role];
  const superiorIds = session.participants
    .filter((participant) => roleRank[participant.role] > actorRank)
    .map((participant) => participant.id);
  if (superiorIds.length && !session.messages.some((message) => superiorIds.includes(message.senderId))) {
    throw new Error("Wait for your supervisor's first message before replying");
  }
  const normalized = String(content || '').trim();
  if (!normalized) throw new Error('A message cannot be empty');
  if (normalized.length > 4000) throw new Error('A message must be 4000 characters or fewer');
  const message = await chatRepository.createMessage({ sessionId, senderId: actor.userId, content: normalized });
  await chatRepository.touch(sessionId);
  await auditLogService.record({ entityType: 'ChatMessage', entityId: message.id, action: 'CHAT_MESSAGE_SENT', actorId: actor.userId, afterState: { sessionId, contentLength: normalized.length } });
  return message;
}

async function markMessagesRead(sessionId, actor) {
  const session = await requireParticipant(sessionId, actor);
  const unreadMessages = await chatRepository.unreadForRecipient(session.id, actor.userId);
  if (!unreadMessages.length) return { messageIds: [], readAt: null };
  const readAt = new Date();
  const messageIds = unreadMessages.map((message) => message.id);
  await chatRepository.markRead(messageIds, readAt);
  const firstRead = session.firstResponseReadAt ? {} : { firstResponseReadAt: readAt };
  await chatRepository.touch(session.id, firstRead);
  await auditLogService.record({ entityType: 'ChatSession', entityId: session.id, action: 'CHAT_MESSAGES_READ', actorId: actor.userId, afterState: { count: messageIds.length } });
  return { messageIds, readAt };
}

async function closeSession(sessionId, actor, closedAt = new Date()) {
  if (actor.role !== 'ADMIN') throw new Error('Only an Admin can close a chat');
  const session = await requireParticipant(sessionId, actor);
  if (session.status !== 'OPEN') {
    return { sessionId: session.id, status: session.status, closedAt: session.closedAt, alreadyClosed: true };
  }

  const result = await chatRepository.closeIfOpen(session.id, closedAt);
  if (!result.count) {
    const current = await chatRepository.findSessionById(session.id);
    return { sessionId: session.id, status: current.status, closedAt: current.closedAt, alreadyClosed: true };
  }

  await auditLogService.record({
    entityType: 'ChatSession',
    entityId: session.id,
    action: 'CHAT_SESSION_ADMIN_CLOSED',
    actorId: actor.userId,
    beforeState: { status: 'OPEN' },
    afterState: { status: 'CLOSED', closedAt },
  });
  
  return { sessionId: session.id, status: 'CLOSED', closedAt, alreadyClosed: false };
}

module.exports = {
  createOrFindDirectSession,
  listSessions,
  listParticipants,
  listMessages,
  sendMessage,
  markMessagesRead,
  closeSession,
  requireParticipant,
};
