const { installSocketAuthentication } = require('../middleware/auth');
const chatLifecycleService = require('../services/chatLifecycleService');

const roomFor = (sessionId) => `chat:${sessionId}`;

function socketError(error) {
  return { success: false, error: error.message || 'Chat request failed' };
}

function requirePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Socket payload must be an object');
  }
  return payload;
}

function requireId(value, name) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    throw new Error(`${name} must be a valid identifier`);
  }
  return value;
}

function safeSocketHandler(handler) {
  return async (payload, acknowledge) => {
    const reply = typeof acknowledge === 'function'
      ? acknowledge
      : (typeof payload === 'function' ? payload : null);
    try {
      const result = await handler(requirePayload(payload));
      if (reply) reply({ success: true, ...result });
    } catch (error) {
      if (reply) reply(socketError(error));
    }
  };
}

function installChatSocket(io, config) {
  installSocketAuthentication(io, config);

  io.on('connection', (socket) => {
    socket.join(`user:${socket.auth.userId}`);

    socket.on('chat:join', safeSocketHandler(async (payload) => {
      const sessionId = requireId(payload.sessionId, 'sessionId');
      const session = await chatLifecycleService.requireParticipant(sessionId, socket.auth);
      await socket.join(roomFor(session.id));
      return { session };
    }));

    socket.on('chat:send', safeSocketHandler(async (payload) => {
      const sessionId = requireId(payload.sessionId, 'sessionId');
      const message = await chatLifecycleService.sendMessage(sessionId, socket.auth, payload.content);
      io.to(roomFor(sessionId)).emit('chat:message', message);
      return { message };
    }));

    socket.on('chat:read', safeSocketHandler(async (payload) => {
      const sessionId = requireId(payload.sessionId, 'sessionId');
      const result = await chatLifecycleService.markMessagesRead(sessionId, socket.auth);
      const eventPayload = { sessionId, ...result, readBy: socket.auth.userId };
      if (result.messageIds.length) io.to(roomFor(sessionId)).emit('chat:read', eventPayload);
      return eventPayload;
    }));

    socket.on('chat:close', safeSocketHandler(async (payload) => {
      const sessionId = requireId(payload.sessionId, 'sessionId');
      const result = await chatLifecycleService.closeSession(sessionId, socket.auth);
      io.to(roomFor(sessionId)).emit('chat:closed', result);
      return result;
    }));
  });
}

module.exports = { installChatSocket };
