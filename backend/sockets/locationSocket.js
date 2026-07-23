const locationService = require('../services/locationService');
const { installSocketAuthentication } = require('../middleware/auth');

const roomFor = (assignmentId) => `location:${assignmentId}`;
const socketError = (error) => ({ success: false, error: error.message || 'Location request failed' });

function requirePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Socket payload must be an object');
  }
  return payload;
}

function requireAssignmentId(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 128) {
    throw new Error('assignmentId must be a valid identifier');
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

function installLocationSocket(io, config) {
  installSocketAuthentication(io, config);
  io.on('connection', (socket) => {
    socket.on('location:watch', safeSocketHandler(async (payload) => {
      const assignmentId = requireAssignmentId(payload.assignmentId);
      const location = await locationService.getLocation(assignmentId, socket.auth);
      await socket.join(roomFor(assignmentId));
      return { location };
    }));

    socket.on('location:ping', safeSocketHandler(async (payload) => {
      const assignmentId = requireAssignmentId(payload.assignmentId);
      const location = await locationService.recordLocation(
        assignmentId,
        socket.auth,
        payload.latitude,
        payload.longitude,
      );
      io.to(roomFor(assignmentId)).emit('location:update', location);
      return { location };
    }));
  });
}

module.exports = { installLocationSocket, roomFor };
