const { verifyToken } = require('../middleware/auth');
const chatLifecycleService = require('../services/chatLifecycleService');

const roomFor = (sessionId) => `chat:${sessionId}`;

function socketError(error) {
  return { success: false, error: error.message || 'Chat request failed' };
}

function installChatSocket(io) {
  io.use((socket, next) => {
    try {
      socket.auth = verifyToken(socket.handshake.auth?.token);
      return next();
    } catch (error) { return next(error); }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.auth.userId}`);

    socket.on('chat:join', async ({ sessionId }, acknowledge) => {
      try {
        const session = await chatLifecycleService.requireParticipant(sessionId, socket.auth);
        socket.join(roomFor(session.id));
        if (typeof acknowledge === 'function') acknowledge({ success: true, session });
      } catch (error) { if (typeof acknowledge === 'function') acknowledge(socketError(error)); }
    });

    socket.on('chat:send', async ({ sessionId, content }, acknowledge) => {
      try {
        const message = await chatLifecycleService.sendMessage(sessionId, socket.auth, content);
        io.to(roomFor(sessionId)).emit('chat:message', message);
        if (typeof acknowledge === 'function') acknowledge({ success: true, message });
      } catch (error) { if (typeof acknowledge === 'function') acknowledge(socketError(error)); }
    });

    socket.on('chat:read', async ({ sessionId }, acknowledge) => {
      try {
        const result = await chatLifecycleService.markMessagesRead(sessionId, socket.auth);
        const payload = { sessionId, ...result, readBy: socket.auth.userId };
        if (result.messageIds.length) io.to(roomFor(sessionId)).emit('chat:read', payload);
        if (typeof acknowledge === 'function') acknowledge({ success: true, ...payload });
      } catch (error) { if (typeof acknowledge === 'function') acknowledge(socketError(error)); }
    });

    socket.on('chat:close', async ({ sessionId }, acknowledge) => {
      try {
        const result = await chatLifecycleService.closeSession(sessionId, socket.auth);
        io.to(roomFor(sessionId)).emit('chat:closed', result);
        if (typeof acknowledge === 'function') acknowledge({ success: true, ...result });
      } catch (error) { if (typeof acknowledge === 'function') acknowledge(socketError(error)); }
    });
  });
}

module.exports = { installChatSocket };
