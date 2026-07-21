const chatRepository = require('../src/repositories/chatRepository');
const userRepository = require('../src/repositories/userRepository');
const auditLogService = require('./auditLogService');
const prisma = require('../src/lib/prisma');

const CHAT_AUTO_CLOSE_MS = 24 * 60 * 60_000;

function autoCloseAfterMs() {
  const configured = Number(process.env.CHAT_AUTO_CLOSE_AFTER_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : CHAT_AUTO_CLOSE_MS;
}

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
  if (!participant) throw new Error('Chat participant not found');

  if (actor.role === 'ADMIN' || (actor.role === 'FLEET_MANAGER' && participant.role === 'PILOT') || (actor.role === 'PILOT' && participant.role === 'ADMIN')) {
      // Allowed
  } else {
      throw new Error('You do not have permission to start a direct chat with this user.');
  }

  const existing = await chatRepository.findOpenDirect(actor.userId, targetUserId);
  if (existing) return { session: existing, created: false };

  const session = await chatRepository.createSession({}, [actor.userId, targetUserId]);
  await auditLogService.record({ entityType: 'ChatSession', entityId: session.id, action: 'CHAT_SESSION_OPENED', actorId: actor.userId, afterState: { type: 'DIRECT', participants: [actor.userId, targetUserId], status: session.status } });
  return { session, created: true };
}

async function createOrFindLeadSession(actor, leadId) {
  if (actor.role !== 'FARMER' && actor.role !== 'ADMIN') {
      throw new Error('Only Farmers (or Admins) can initiate a lead context chat.');
  }
  
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { assignment: true } });
  if (!lead) throw new Error('Lead not found');
  
  const participantIds = [actor.userId];
  if (lead.assignment) {
      participantIds.push(lead.assignment.pilotId);
  }
  
  const existing = await chatRepository.findOpenByLead(leadId);
  if (existing) {
     if (!isParticipant(existing, actor.userId) && actor.role !== 'ADMIN') {
         throw new Error('Not authorized for this chat.');
     }
     return { session: existing, created: false };
  }

  const session = await chatRepository.createSession({ leadId }, participantIds);
  await auditLogService.record({ entityType: 'ChatSession', entityId: session.id, action: 'CHAT_SESSION_OPENED', actorId: actor.userId, afterState: { type: 'LEAD', leadId, participants: participantIds, status: session.status } });
  return { session, created: true };
}

async function listSessions(actor) {
  const sessions = await chatRepository.findForParticipant(actor.userId);
  if (actor.role === 'FARMER') {
      // Filter out archived ones for farmers
      return sessions.filter(s => !s.archivedAt);
  }
  return sessions;
}

async function listParticipants(actor) {
  if (actor.role === 'ADMIN') return userRepository.findAll({}); // Admin sees everyone
  if (actor.role === 'FLEET_MANAGER') return userRepository.findAll({ role: 'PILOT' });
  if (actor.role === 'PILOT') return userRepository.findAll({ role: 'ADMIN' });
  return [];
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
  
  // If it's a lead chat, schedule it for archiving (auto-hide for farmer in 1 week)
  if (session.leadId) {
     const archiveDate = new Date(closedAt.getTime() + 7 * 24 * 60 * 60_1000);
     await chatRepository.archiveSession(session.id, archiveDate);
  }

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
    
    if (session.leadId) {
        const archiveDate = new Date(now.getTime() + 7 * 24 * 60 * 60_1000);
        await chatRepository.archiveSession(session.id, archiveDate);
    }
    
    closed.push(session);
  }
  return closed;
}

module.exports = { autoCloseAfterMs, createOrFindDirectSession, createOrFindLeadSession, listSessions, listParticipants, listMessages, sendMessage, markMessagesRead, closeSession, closeInactiveSessions, requireParticipant };
