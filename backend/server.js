require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const { loadEnvironment } = require('./config/environment');
const app = require('./app');
const { startNotificationEscalationJob } = require('./jobs/notificationEscalationJob');
const { startChatAutoCloseJob } = require('./jobs/chatAutoCloseJob');
const { startGoogleFormSyncJob } = require('./jobs/googleFormSync');
const { installChatSocket } = require('./sockets/chatSocket');
const { installLocationSocket } = require('./sockets/locationSocket');
const { assertAuthConfiguration } = require('./middleware/auth');
const { createSocketServerOptions, installSocketEventProtection } = require('./config/socketSecurity');

const config = loadEnvironment();
assertAuthConfiguration();

const server = http.createServer(app);
const io = new Server(server, createSocketServerOptions(config));

app.set('io', io);
installSocketEventProtection(io, config);
installChatSocket(io);
installLocationSocket(io);

server.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

const notificationEscalationJob = startNotificationEscalationJob();
const chatAutoCloseJob = startChatAutoCloseJob();
const googleFormSyncJob = startGoogleFormSyncJob();
process.on('SIGTERM', () => {
  clearInterval(notificationEscalationJob);
  clearInterval(chatAutoCloseJob);
});
