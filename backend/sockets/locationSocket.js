const locationService = require('../services/locationService');

const roomFor = (assignmentId) => `location:${assignmentId}`;
const socketError = (error) => ({ success: false, error: error.message || 'Location request failed' });

function installLocationSocket(io) {
  io.on('connection', (socket) => {
    socket.on('location:watch', async ({ assignmentId }, acknowledge) => {
      try {
        const location = await locationService.getLocation(assignmentId, socket.auth);
        socket.join(roomFor(assignmentId));
        if (typeof acknowledge === 'function') acknowledge({ success: true, location });
      } catch (error) { if (typeof acknowledge === 'function') acknowledge(socketError(error)); }
    });

    socket.on('location:ping', async ({ assignmentId, latitude, longitude }, acknowledge) => {
      try {
        const location = await locationService.recordLocation(assignmentId, socket.auth, latitude, longitude);
        io.to(roomFor(assignmentId)).emit('location:update', location);
        if (typeof acknowledge === 'function') acknowledge({ success: true, location });
      } catch (error) { if (typeof acknowledge === 'function') acknowledge(socketError(error)); }
    });
  });
}

module.exports = { installLocationSocket, roomFor };
