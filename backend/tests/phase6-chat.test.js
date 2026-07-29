const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Server } = require('socket.io');
const { io: createClient } = require('socket.io-client');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const { installChatSocket } = require('../sockets/chatSocket');

let server;
let io;
let baseUrl;
let admin;
let fleet;
let sales;
let pilot;
const sockets = [];
const runId = `${process.pid}-${Date.now()}`;
const ids = { users: [], sessions: [], messages: [] };

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

function connect(user) {
  return new Promise((resolve, reject) => {
    const socket = createClient(baseUrl, { auth: { token: issueToken(user) }, transports: ['websocket'] });
    socket.once('connect', () => {
      sockets.push(socket);
      resolve(socket);
    });
    socket.once('connect_error', reject);
  });
}

function acknowledge(socket, event, payload) {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (result) => result?.success
      ? resolve(result)
      : reject(new Error(result?.error || 'Socket request failed')));
  });
}

async function json(response) {
  return { status: response.status, body: await response.json() };
}

test.before(async () => {
  server = http.createServer(app);
  io = new Server(server, { cors: { origin: '*' } });
  installChatSocket(io);
  server.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  [admin, fleet, sales, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 6 Admin', email: `phase6-admin-${runId}@example.test`, passwordHash: 'test', role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'Phase 6 Fleet', email: `phase6-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'Phase 6 Sales', email: `phase6-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
    prisma.user.create({ data: { name: 'Phase 6 Pilot', email: `phase6-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT' } }),
  ]);
  ids.users.push(admin.id, fleet.id, sales.id, pilot.id);
});

test('participant lists and chat initiation follow Admin > Fleet > Sales > Pilot', async () => {
  const participantResponses = await Promise.all([admin, fleet, sales, pilot].map((user) => (
    fetch(`${baseUrl}/api/chat/participants`, { headers: auth(user) }).then(json)
  )));
  assert.deepEqual(
    participantResponses.map(({ status }) => status),
    [200, 200, 200, 200],
  );
  const rankedActors = [admin, fleet, sales, pilot];
  const rank = { ADMIN: 4, FLEET_MANAGER: 3, SALES: 2, PILOT: 1 };
  participantResponses.forEach(({ body }, index) => {
    const actor = rankedActors[index];
    assert.equal(body.participants.every((participant) => rank[participant.role] < rank[actor.role]), true);
    const returnedIds = new Set(body.participants.map((participant) => participant.id));
    [admin, fleet, sales, pilot].forEach((candidate) => {
      assert.equal(
        returnedIds.has(candidate.id),
        rank[candidate.role] < rank[actor.role],
        `${actor.role} participant visibility was wrong for ${candidate.role}`,
      );
    });
  });

  const forbidden = await Promise.all([
    [pilot, admin],
    [sales, fleet],
    [fleet, admin],
  ].map(([actor, target]) => fetch(`${baseUrl}/api/chat/sessions`, {
    method: 'POST',
    headers: auth(actor),
    body: JSON.stringify({ participantId: target.id }),
  })));
  assert.deepEqual(forbidden.map((response) => response.status), [403, 403, 403]);
});

test('a subordinate can reply only after the supervisor sends the first message', async () => {
  const createdResponse = await fetch(`${baseUrl}/api/chat/sessions`, {
    method: 'POST',
    headers: auth(sales),
    body: JSON.stringify({ participantId: pilot.id }),
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  ids.sessions.push(created.session.id);

  const [salesSocket, pilotSocket] = await Promise.all([connect(sales), connect(pilot)]);
  await Promise.all([
    acknowledge(salesSocket, 'chat:join', { sessionId: created.session.id }),
    acknowledge(pilotSocket, 'chat:join', { sessionId: created.session.id }),
  ]);
  await assert.rejects(
    () => acknowledge(pilotSocket, 'chat:send', { sessionId: created.session.id, content: 'Trying to start upward.' }),
    /supervisor's first message/,
  );

  const opened = await acknowledge(salesSocket, 'chat:send', {
    sessionId: created.session.id,
    content: 'Please confirm the field arrival time.',
  });
  ids.messages.push(opened.message.id);
  const reply = await acknowledge(pilotSocket, 'chat:send', {
    sessionId: created.session.id,
    content: 'Arrival confirmed.',
  });
  ids.messages.push(reply.message.id);
  assert.equal(reply.message.senderId, pilot.id);
});

test('Fleet can start downward, but only Admin can close any chat', async () => {
  const createdResponse = await fetch(`${baseUrl}/api/chat/sessions`, {
    method: 'POST',
    headers: auth(fleet),
    body: JSON.stringify({ participantId: pilot.id }),
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  ids.sessions.push(created.session.id);

  const [adminSocket, fleetSocket, pilotSocket] = await Promise.all([
    connect(admin),
    connect(fleet),
    connect(pilot),
  ]);
  await Promise.all([
    acknowledge(adminSocket, 'chat:join', { sessionId: created.session.id }),
    acknowledge(fleetSocket, 'chat:join', { sessionId: created.session.id }),
    acknowledge(pilotSocket, 'chat:join', { sessionId: created.session.id }),
  ]);

  await assert.rejects(
    () => acknowledge(fleetSocket, 'chat:close', { sessionId: created.session.id }),
    /Only an Admin/,
  );
  await assert.rejects(
    () => acknowledge(pilotSocket, 'chat:close', { sessionId: created.session.id }),
    /Only an Admin/,
  );

  const adminSessions = await fetch(`${baseUrl}/api/chat/sessions`, { headers: auth(admin) }).then(json);
  assert.equal(adminSessions.status, 200);
  assert.equal(adminSessions.body.sessions.some((session) => session.id === created.session.id), true);

  const closed = await acknowledge(adminSocket, 'chat:close', { sessionId: created.session.id });
  assert.equal(closed.status, 'CLOSED');
  assert.equal((await prisma.chatSession.findUnique({ where: { id: created.session.id } })).status, 'CLOSED');
  assert.ok(await prisma.auditLog.findFirst({
    where: { entityId: created.session.id, action: 'CHAT_SESSION_ADMIN_CLOSED', actorId: admin.id },
  }));
});

test.after(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.sessions, ...ids.messages] } } });
  await prisma.chatMessage.deleteMany({ where: { sessionId: { in: ids.sessions } } });
  await prisma.chatSession.deleteMany({ where: { id: { in: ids.sessions } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await new Promise((resolve) => io.close(resolve));
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
