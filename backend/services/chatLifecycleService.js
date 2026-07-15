const chatRepository = require('../src/repositories/chatRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogService = require('./auditLogService');

const CHAT_AUTO_CLOSE_MS = 24 * 60 * 60_000;

function autoCloseAfterMs() {
  const configured = Number(process.env.CHAT_AUTO_CLOSE_AFTER_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : CHAT_AUTO_CLOSE_MS;
}

function isParticipant(session, userId) {
  return session.adminId === userId || session.pilotId === userId;
}

async function requireParticipant(sessionId, actor) {
  const session = await chatRepository.findSessionById(sessionId);
  if (!session) throw new Error('Chat session not found');
  if (!isParticipant(session, actor.userId)) throw new Error('You are not a participant in this chat');
  return session;
}

async function createOrFindSession(actor, participantId) {
  if (!['ADMIN', 'PILOT'].includes(actor.role)) throw new Error('Only Admins and Pilots can use chat');
  const participant = await userRepository.findById(participantId);
  if (!participant) throw new Error('Chat participant not found');
  const isAdminInitiated = actor.role === 'ADMIN' && participant.role === 'PILOT';
  const isPilotInitiated = actor.role === 'PILOT' && participant.role === 'ADMIN';
  if (!isAdminInitiated && !isPilotInitiated) throw new Error('Chat sessions must be between one Admin and one Pilot');

  const adminId = actor.role === 'ADMIN' ? actor.userId : participant.id;
  const pilotId = actor.role === 'PILOT' ? actor.userId : participant.id;
  const existing = await chatRepository.findOpenByParticipants(adminId, pilotId);
  if (existing) return { session: existing, created: false };

  const session = await chatRepository.createSession({ adminId, pilotId });
  await auditLogService.record({ entityType: 'ChatSession', entityId: session.id, action: 'CHAT_SESSION_OPENED', actorId: actor.userId, afterState: { adminId, pilotId, status: session.status } });
  return { session, created: true };
}

async function listSessions(actor) {
  if (!['ADMIN', 'PILOT'].includes(actor.role)) throw new Error('Only Admins and Pilots can use chat');
  return chatRepository.findForParticipant(actor.userId);
}

async function listParticipants(actor) {
  if (actor.role === 'ADMIN') return userRepository.findAll({ role: 'PILOT' });
  if (actor.role === 'PILOT') return userRepository.findAll({ role: 'ADMIN' });
  throw new Error('Only Admins and Pilots can use chat');
}

async function listMessages(sessionId, actor) {
  const session = await requireParticipant(sessionId, actor);
  return { session, messages: session.messages };
}

async function sendMessage(sessionId, actor, content) {
  const session = await requireParticipant(sessionId, actor);
  if (session.status !== 'OPEN') throw new Error('This chat session is closed');
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

async function closeInactiveSessions(now = new Date()) {
  const cutoff = new Date(now.getTime() - autoCloseAfterMs());
  const expired = await chatRepository.findExpiredOpen(cutoff);
  const closed = [];
  for (const session of expired) {
    const result = await chatRepository.closeIfOpen(session.id, now);
    if (!result.count) continue;
    await auditLogService.record({ entityType: 'ChatSession', entityId: session.id, action: 'CHAT_SESSION_AUTO_CLOSED', beforeState: { status: 'OPEN', lastActivityAt: session.lastActivityAt }, afterState: { status: 'CLOSED', closedAt: now } });
    closed.push(session);
  }
  return closed;
}

module.exports = { autoCloseAfterMs, createOrFindSession, listSessions, listParticipants, listMessages, sendMessage, markMessagesRead, closeSession, closeInactiveSessions, requireParticipant };
