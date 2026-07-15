const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Server } = require('socket.io');
const { io: createClient } = require('socket.io-client');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const { installChatSocket } = require('../sockets/chatSocket');
const { closeInactiveSessions } = require('../services/chatLifecycleService');

let server;
let io;
let baseUrl;
let admin;
let pilot;
let sales;
let adminSocket;
let pilotSocket;
let sessionId;
const runId = `${process.pid}-${Date.now()}`;
const ids = { users: [], sessions: [], messages: [] };

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

function connect(user) {
  return new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, { auth: { token: issueToken(user) }, transports: ['websocket'] });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function acknowledge(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => result?.success ? resolve(result) : reject(new Error(result?.error || 'Socket request failed')));
  });
}

function nextEvent(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}

test.before(async () => {
  server = http.createServer(app);
  io = new Server(server, { cors: { origin: '*' } });
  installChatSocket(io);
  server.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  [admin, pilot, sales] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 6 Admin', email: `phase6-admin-${runId}@example.test`, passwordHash: 'test', role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'Phase 6 Pilot', email: `phase6-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT' } }),
    prisma.user.create({ data: { name: 'Phase 6 Sales', email: `phase6-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
  ]);
  ids.users.push(admin.id, pilot.id, sales.id);
});

test('Admin and Pilot exchange Socket.io messages with a persisted read receipt', async () => {
  const createdResponse = await fetch(`${baseUrl}/api/chat/sessions`, {
    method: 'POST', headers: auth(admin), body: JSON.stringify({ participantId: pilot.id }),
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201);
  sessionId = created.session.id;
  ids.sessions.push(sessionId);

  const salesResponse = await fetch(`${baseUrl}/api/chat/sessions`, { headers: auth(sales) });
  assert.equal(salesResponse.status, 403);

  adminSocket = await connect(admin);
  pilotSocket = await connect(pilot);
  await Promise.all([
    acknowledge(adminSocket, 'chat:join', { sessionId }),
    acknowledge(pilotSocket, 'chat:join', { sessionId }),
  ]);
  const incoming = nextEvent(pilotSocket, 'chat:message');
  const sent = await acknowledge(adminSocket, 'chat:send', { sessionId, content: 'Please confirm the drone battery status.' });
  ids.messages.push(sent.message.id);
  const broadcast = await incoming;
  assert.equal(broadcast.id, sent.message.id);
  assert.equal(broadcast.content, 'Please confirm the drone battery status.');

  const readBroadcast = nextEvent(adminSocket, 'chat:read');
  const read = await acknowledge(pilotSocket, 'chat:read', { sessionId });
  const notified = await readBroadcast;
  assert.deepEqual(read.messageIds, [sent.message.id]);
  assert.deepEqual(notified.messageIds, [sent.message.id]);
  const [message, session] = await Promise.all([
    prisma.chatMessage.findUnique({ where: { id: sent.message.id } }),
    prisma.chatSession.findUnique({ where: { id: sessionId } }),
  ]);
  assert.ok(message.readAt);
  assert.ok(session.firstResponseReadAt);
});

test('read chats auto-close, unread chats stay open, and only Admin can close manually', async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/chat/sessions`, {
    method: 'POST', headers: auth(pilot), body: JSON.stringify({ participantId: pilot.id }),
  });
  assert.equal(invalidResponse.status, 403);

  process.env.CHAT_AUTO_CLOSE_AFTER_MS = '5';
  await prisma.chatSession.update({ where: { id: sessionId }, data: { lastActivityAt: new Date(Date.now() - 1000) } });
  const closed = await closeInactiveSessions(new Date());
  assert.equal(closed.some((session) => session.id === sessionId), true);
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  assert.equal(session.status, 'CLOSED');
  await assert.rejects(() => acknowledge(adminSocket, 'chat:send', { sessionId, content: 'This should not send.' }), /closed/);

  const unreadResponse = await fetch(`${baseUrl}/api/chat/sessions`, {
    method: 'POST', headers: auth(admin), body: JSON.stringify({ participantId: pilot.id }),
  });
  const unreadCreated = await unreadResponse.json();
  assert.equal(unreadResponse.status, 201);
  const unreadSessionId = unreadCreated.session.id;
  ids.sessions.push(unreadSessionId);
  await Promise.all([
    acknowledge(adminSocket, 'chat:join', { sessionId: unreadSessionId }),
    acknowledge(pilotSocket, 'chat:join', { sessionId: unreadSessionId }),
  ]);
  const unreadMessage = await acknowledge(adminSocket, 'chat:send', { sessionId: unreadSessionId, content: 'This message must remain available until it is read.' });
  ids.messages.push(unreadMessage.message.id);
  await prisma.chatSession.update({ where: { id: unreadSessionId }, data: { lastActivityAt: new Date(Date.now() - 1000) } });
  const unreadCloseAttempt = await closeInactiveSessions(new Date());
  assert.equal(unreadCloseAttempt.some((item) => item.id === unreadSessionId), false);
  assert.equal((await prisma.chatSession.findUnique({ where: { id: unreadSessionId } })).status, 'OPEN');

  await assert.rejects(() => acknowledge(pilotSocket, 'chat:close', { sessionId: unreadSessionId }), /Only an Admin/);
  const closedBroadcast = nextEvent(pilotSocket, 'chat:closed');
  const manualClose = await acknowledge(adminSocket, 'chat:close', { sessionId: unreadSessionId });
  const pilotNotified = await closedBroadcast;
  assert.equal(manualClose.status, 'CLOSED');
  assert.equal(pilotNotified.sessionId, unreadSessionId);
  assert.equal((await prisma.chatSession.findUnique({ where: { id: unreadSessionId } })).status, 'CLOSED');
  assert.ok(await prisma.auditLog.findFirst({ where: { entityId: unreadSessionId, action: 'CHAT_SESSION_ADMIN_CLOSED' } }));
  delete process.env.CHAT_AUTO_CLOSE_AFTER_MS;
});

test.after(async () => {
  delete process.env.CHAT_AUTO_CLOSE_AFTER_MS;
  adminSocket?.disconnect();
  pilotSocket?.disconnect();
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.sessions, ...ids.messages] } } });
  await prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids.sessions } } });
  await prisma.chatSession.deleteMany({ where: { id: { in: ids.sessions } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
