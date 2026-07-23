const crypto = require('node:crypto');
const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Server } = require('socket.io');
const { io: createSocketClient } = require('socket.io-client');
const { loadEnvironment } = require('../config/environment');
const { createSocketServerOptions, installSocketEventProtection } = require('../config/socketSecurity');
const {
  disconnectSessionSockets,
  installSocketAuthentication,
  issueToken,
} = require('../middleware/auth');
const { installChatSocket } = require('../sockets/chatSocket');
const { installLocationSocket } = require('../sockets/locationSocket');
const { hashPassword } = require('../services/passwordService');
const {
  cookieNames,
  createSession,
  tokenHash,
} = require('../services/sessionService');
const authSessionRepository = require('../src/repositories/authSessionRepository');
const prisma = require('../src/lib/prisma');

const config = loadEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  RATE_LIMITS_ENABLED: 'false',
});
const clients = new Set();
const createdSessionIds = new Set();
let server;
let io;
let baseUrl;
let fixture;

function startClient(options) {
  const socket = createSocketClient(baseUrl, {
    forceNew: true,
    reconnection: false,
    timeout: 3000,
    transports: ['websocket'],
    ...options,
  });
  clients.add(socket);
  const outcome = new Promise((resolve) => {
    socket.once('connect', () => resolve({ connected: true, socket }));
    socket.once('connect_error', (error) => resolve({ connected: false, error, socket }));
  });
  return { outcome, socket };
}

async function connectClient(options) {
  const started = startClient(options);
  const outcome = await started.outcome;
  if (!outcome.connected) {
    started.socket.close();
    throw outcome.error;
  }
  return started.socket;
}

function emitWithAck(socket, event, payload, { omitPayload = false } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event} acknowledgement`)), 3000);
    const acknowledge = (response) => {
      clearTimeout(timer);
      resolve(response);
    };
    if (omitPayload) socket.emit(event, acknowledge);
    else socket.emit(event, payload, acknowledge);
  });
}

function waitForDisconnect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for socket disconnect')), 3000);
    socket.once('disconnect', (reason) => {
      clearTimeout(timer);
      resolve(reason);
    });
  });
}

function withTimeout(promise, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 3000)),
  ]);
}

async function createCookieSession() {
  const created = await createSession(fixture, config, { allowedRoles: new Set([fixture.role]) });
  createdSessionIds.add(created.session.id);
  const name = cookieNames(config).session;
  return {
    ...created,
    cookie: `${name}=${created.sessionToken}`,
  };
}

async function closeServer(instance) {
  if (!instance?.listening) return;
  await new Promise((resolve, reject) => {
    instance.close((error) => (error ? reject(error) : resolve()));
    instance.closeIdleConnections?.();
    instance.closeAllConnections?.();
  });
}

test.before(async () => {
  assert.equal(process.env.NODE_ENV, 'test', 'Socket hardening tests require the disposable test runner');
  fixture = await prisma.user.create({
    data: {
      name: 'Socket hardening fixture',
      email: `socket-hardening-${process.pid}-${Date.now()}@example.test`,
      passwordHash: await hashPassword(`Socket-${crypto.randomBytes(24).toString('base64url')}`),
      role: 'ADMIN',
    },
  });

  server = http.createServer();
  io = new Server(server, createSocketServerOptions(config));
  installSocketAuthentication(io, config);
  installSocketEventProtection(io, config);
  installChatSocket(io, config);
  installLocationSocket(io, config);
  server.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('every supported socket event safely acknowledges non-object payloads', async () => {
  const rawTestToken = issueToken(fixture);
  const socket = await connectClient({ auth: { token: rawTestToken } });
  const serverSocket = io.sockets.sockets.get(socket.id);
  assert.ok(serverSocket);
  assert.equal(Object.hasOwn(serverSocket.data, 'rawSessionToken'), false);
  assert.equal(Object.hasOwn(serverSocket.handshake.auth, 'token'), false);

  const events = [
    'chat:join',
    'chat:send',
    'chat:read',
    'chat:close',
    'location:watch',
    'location:ping',
  ];
  const payloads = [undefined, null, 'not-an-object', []];

  for (const event of events) {
    const omitted = await emitWithAck(socket, event, undefined, { omitPayload: true });
    assert.deepEqual(omitted, { success: false, error: 'Socket payload must be an object' }, `${event}: omitted`);
    assert.equal(socket.connected, true, `${event}: omitted payload disconnected the socket`);

    for (const payload of payloads) {
      const response = await emitWithAck(socket, event, payload);
      assert.deepEqual(response, { success: false, error: 'Socket payload must be an object' }, `${event}: ${String(payload)}`);
      assert.equal(socket.connected, true, `${event}: malformed payload disconnected the socket`);
    }
  }
});

test('cookie sockets retain only a hash and still revalidate on every packet', async () => {
  const created = await createCookieSession();
  const socket = await connectClient({ extraHeaders: { Cookie: created.cookie } });
  const serverSocket = io.sockets.sockets.get(socket.id);
  assert.ok(serverSocket);
  assert.equal(Object.hasOwn(serverSocket.data, 'rawSessionToken'), false);
  assert.equal(serverSocket.data.sessionTokenHash, tokenHash(created.sessionToken));
  assert.equal(serverSocket.request.headers.cookie, undefined);
  assert.equal(serverSocket.handshake.headers.cookie, undefined);

  await authSessionRepository.revokeById(created.session.id, 'SOCKET_PACKET_REVALIDATION_TEST');
  const disconnected = waitForDisconnect(socket);
  socket.emit('chat:join', null, () => undefined);
  assert.equal(await disconnected, 'io server disconnect');
});

test('logout during post-join authentication cannot publish a stale socket', async () => {
  const created = await createCookieSession();
  const targetHash = tokenHash(created.sessionToken);
  const originalFind = authSessionRepository.findByTokenHash;
  let targetReads = 0;
  let releaseSecondRead;
  const secondReadReleased = new Promise((resolve) => { releaseSecondRead = resolve; });
  let announceSecondRead;
  const secondReadCaptured = new Promise((resolve) => { announceSecondRead = resolve; });

  authSessionRepository.findByTokenHash = async (hash) => {
    const session = await originalFind(hash);
    if (hash === targetHash) {
      targetReads += 1;
      if (targetReads === 2) {
        announceSecondRead();
        await secondReadReleased;
      }
    }
    return session;
  };

  const started = startClient({ extraHeaders: { Cookie: created.cookie } });
  try {
    await withTimeout(secondReadCaptured, 'The post-join session revalidation did not run');
    await authSessionRepository.revokeById(created.session.id, 'LOGOUT');
    disconnectSessionSockets(io, created.session.id);
    releaseSecondRead();

    const outcome = await withTimeout(started.outcome, 'The raced socket did not settle');
    assert.equal(outcome.connected, false);
    assert.match(outcome.error.message, /no longer valid|Authentication is required/i);
    assert.equal(io.sockets.sockets.has(started.socket.id), false);
  } finally {
    releaseSecondRead();
    authSessionRepository.findByTokenHash = originalFind;
    started.socket.close();
  }
});

test.after(async () => {
  for (const socket of clients) socket.close();
  await prisma.authSession.deleteMany({ where: { id: { in: [...createdSessionIds] } } });
  await prisma.user.delete({ where: { id: fixture.id } });
  await new Promise((resolve) => io.close(resolve));
  await closeServer(server);
  await prisma.$disconnect();
});
