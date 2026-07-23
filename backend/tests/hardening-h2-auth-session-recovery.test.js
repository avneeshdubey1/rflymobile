const crypto = require('node:crypto');
const http = require('node:http');
const test = require('node:test');
const assert = require('node:assert/strict');
const cookie = require('cookie');
const { Server } = require('socket.io');
const { io: createSocketClient } = require('socket.io-client');
const app = require('../app');
const { createApp } = require('../app');
const { loadEnvironment } = require('../config/environment');
const { installSocketAuthentication, issueToken } = require('../middleware/auth');
const { createSocketServerOptions, installSocketEventProtection } = require('../config/socketSecurity');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../services/passwordService');
const recoveryDeliveryService = require('../services/recoveryDeliveryService');
const { cookieNames, tokenHash } = require('../services/sessionService');

let server;
let io;
let baseUrl;
let startedAt;

const runId = `${process.pid}-${Date.now()}`;
const originalPassword = `Original-${crypto.randomBytes(18).toString('base64url')}`;
const adminResetPassword = `Admin-reset-${crypto.randomBytes(18).toString('base64url')}`;
const recoveredPassword = `Recovered-${crypto.randomBytes(18).toString('base64url')}`;
const fixtures = {};
const challengeIds = new Set();
const deliveries = new Map();
const sessions = {};

function setCookieLines(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const combined = response.headers.get('set-cookie');
  return combined ? [combined] : [];
}

function cookieLine(response, name) {
  return setCookieLines(response).find((line) => line.startsWith(`${name}=`));
}

function cookieValue(line, name) {
  if (!line) return null;
  return cookie.parse(line.split(';', 1)[0])[name] || null;
}

function assertCookieFlags(line, { httpOnly, secure }) {
  assert.ok(line, 'Expected Set-Cookie header was not present');
  assert.match(line, /;\s*Path=\//i);
  assert.match(line, /;\s*SameSite=Strict/i);
  assert.match(line, /;\s*Max-Age=\d+/i);
  assert.doesNotMatch(line, /;\s*Domain=/i);
  if (httpOnly) assert.match(line, /;\s*HttpOnly/i);
  else assert.doesNotMatch(line, /;\s*HttpOnly/i);
  if (secure) assert.match(line, /;\s*Secure/i);
  else assert.doesNotMatch(line, /;\s*Secure/i);
}

function readSession(response, config) {
  const names = cookieNames(config);
  const sessionLine = cookieLine(response, names.session);
  const csrfLine = cookieLine(response, names.csrf);
  const sessionToken = cookieValue(sessionLine, names.session);
  const csrfToken = cookieValue(csrfLine, names.csrf);
  assert.ok(sessionToken, 'Login did not set an opaque session cookie');
  assert.ok(csrfToken, 'Login did not set a CSRF cookie');
  return {
    cookie: `${names.session}=${sessionToken}; ${names.csrf}=${csrfToken}`,
    csrfToken,
    csrfLine,
    sessionLine,
    sessionToken,
  };
}

async function requestAt(origin, pathname, {
  method = 'GET', body, session, csrf = 'none', headers = {},
} = {}) {
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has('Content-Type')) requestHeaders.set('Content-Type', 'application/json');
  if (session) requestHeaders.set('Cookie', session.cookie);
  if (csrf === 'valid') requestHeaders.set('X-CSRF-Token', session.csrfToken);
  if (csrf === 'wrong') requestHeaders.set('X-CSRF-Token', `wrong-${session.csrfToken}`);
  const response = await fetch(`${origin}${pathname}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { data, response };
}

async function loginAt(origin, user, password = originalPassword, headers = {}) {
  return requestAt(origin, '/api/auth/login', {
    method: 'POST',
    headers,
    body: { email: user.email, password },
  });
}

async function businessLoginAt(origin, user, password = originalPassword) {
  return requestAt(origin, '/api/auth/business/login', {
    method: 'POST',
    body: { email: user.email, password },
  });
}

async function requestRecovery(identifier) {
  const result = await requestAt(baseUrl, '/api/auth/recovery/request', {
    method: 'POST',
    body: { identifier, channel: 'EMAIL' },
  });
  if (result.data.challengeId) challengeIds.add(result.data.challengeId);
  await recoveryDeliveryService.waitForIdleForTests();
  return result;
}

async function completeRecovery(challengeId, code, newPassword = recoveredPassword) {
  return requestAt(baseUrl, '/api/auth/recovery/complete', {
    method: 'POST',
    body: { challengeId, code, newPassword },
  });
}

function differentCode(code) {
  return code === '000000' ? '111111' : '000000';
}

async function closeServer(instance) {
  if (!instance?.listening) return;
  await new Promise((resolve, reject) => {
    instance.close((error) => (error ? reject(error) : resolve()));
    instance.closeIdleConnections?.();
    instance.closeAllConnections?.();
  });
}

function connectSocketWithSession(session) {
  return new Promise((resolve, reject) => {
    const socket = createSocketClient(baseUrl, {
      extraHeaders: { Cookie: session.cookie },
      forceNew: true,
      reconnection: false,
      timeout: 3000,
      transports: ['websocket'],
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error('Timed out waiting for the authenticated socket connection'));
    }, 4000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
}

function waitForSocketDisconnect(socket) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for the revoked session socket to disconnect'));
    }, 4000);
    socket.once('disconnect', (reason) => {
      clearTimeout(timer);
      resolve(reason);
    });
  });
}

test.before(async () => {
  assert.equal(process.env.NODE_ENV, 'test', 'H2 integration tests require the disposable test runner');
  startedAt = new Date();
  recoveryDeliveryService.setTestAdapter(async (message) => {
    deliveries.set(message.challengeId, message);
    return { status: 'SENT' };
  });

  const passwordHash = await hashPassword(originalPassword);
  [
    fixtures.employee,
    fixtures.inactive,
    fixtures.archived,
    fixtures.business,
    fixtures.admin,
    fixtures.socketPilot,
    fixtures.passwordTarget,
    fixtures.deactivationTarget,
    fixtures.recovery,
  ] = await Promise.all([
    prisma.user.create({ data: { name: 'H2 Employee', email: `h2-employee-${runId}@example.test`, passwordHash, role: 'SALES' } }),
    prisma.user.create({ data: { name: 'H2 Inactive', email: `h2-inactive-${runId}@example.test`, passwordHash, role: 'PILOT', active: false } }),
    prisma.user.create({ data: { name: 'H2 Archived', email: `h2-archived-${runId}@example.test`, passwordHash, role: 'SALES', archivedAt: new Date() } }),
    prisma.user.create({ data: { name: 'H2 Business', email: `h2-business-${runId}@example.test`, passwordHash, role: 'BUSINESS', active: true } }),
    prisma.user.create({ data: { name: 'H2 Admin', email: `h2-admin-${runId}@example.test`, passwordHash, role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'H2 Socket Pilot', email: `h2-socket-${runId}@example.test`, passwordHash, role: 'PILOT' } }),
    prisma.user.create({ data: { name: 'H2 Password Target', email: `h2-password-${runId}@example.test`, passwordHash, role: 'SALES' } }),
    prisma.user.create({ data: { name: 'H2 Deactivation Target', email: `h2-deactivate-${runId}@example.test`, passwordHash, role: 'PILOT' } }),
    prisma.user.create({
      data: {
        name: 'H2 Recovery User',
        email: `h2-recovery-${runId}@example.test`,
        emailVerifiedAt: new Date(),
        passwordHash,
        role: 'FLEET_MANAGER',
      },
    }),
  ]);

  server = http.createServer(app);
  io = new Server(server, createSocketServerOptions(app.get('config')));
  app.set('io', io);
  installSocketAuthentication(io, app.get('config'));
  installSocketEventProtection(io, app.get('config'));
  server.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('employee login sets opaque cookie credentials and /me authenticates from the cookie', async () => {
  const login = await loginAt(baseUrl, fixtures.employee);
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  assert.equal(login.data.success, true);
  assert.equal(login.data.user.id, fixtures.employee.id);
  assert.equal(login.data.user.role, 'sales');
  assert.equal(Object.hasOwn(login.data, 'token'), false);

  sessions.employee = readSession(login.response, app.get('config'));
  assertCookieFlags(sessions.employee.sessionLine, { httpOnly: true, secure: false });
  assertCookieFlags(sessions.employee.csrfLine, { httpOnly: false, secure: false });
  assert.equal(JSON.stringify(login.data).includes(sessions.employee.sessionToken), false);

  const stored = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(sessions.employee.sessionToken) },
  });
  assert.ok(stored);
  assert.notEqual(stored.tokenHash, sessions.employee.sessionToken);
  assert.equal(stored.userId, fixtures.employee.id);

  const me = await requestAt(baseUrl, '/api/auth/me', { session: sessions.employee });
  assert.equal(me.response.status, 200, JSON.stringify(me.data));
  assert.equal(me.data.user.id, fixtures.employee.id);
  assert.equal(Object.hasOwn(me.data.user, 'passwordHash'), false);
  assert.equal(Object.hasOwn(me.data.user, 'authVersion'), false);
});

test('employee login rejects inactive, archived, and BUSINESS accounts without setting a session', async () => {
  for (const user of [fixtures.inactive, fixtures.archived, fixtures.business]) {
    const result = await loginAt(baseUrl, user);
    assert.equal(result.response.status, 401, `${user.role}: ${JSON.stringify(result.data)}`);
    assert.deepEqual(result.data, { error: 'Invalid email or password' });
    assert.equal(setCookieLines(result.response).length, 0);
  }
});

test('BUSINESS accounts use only the business login endpoint and inactive or archived accounts are rejected', async () => {
  const login = await businessLoginAt(baseUrl, fixtures.business);
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  assert.equal(login.data.success, true);
  assert.equal(login.data.user.id, fixtures.business.id);
  assert.equal(login.data.user.role, 'business');
  assert.equal(Object.hasOwn(login.data, 'token'), false);
  const session = readSession(login.response, app.get('config'));
  assertCookieFlags(session.sessionLine, { httpOnly: true, secure: false });

  try {
    await prisma.user.update({
      where: { id: fixtures.business.id },
      data: { active: false },
    });
    const inactive = await businessLoginAt(baseUrl, fixtures.business);
    assert.equal(inactive.response.status, 401, JSON.stringify(inactive.data));
    assert.deepEqual(inactive.data, { error: 'Invalid email or password' });
    assert.equal(setCookieLines(inactive.response).length, 0);

    await prisma.user.update({
      where: { id: fixtures.business.id },
      data: { active: true, archivedAt: new Date() },
    });
    const archived = await businessLoginAt(baseUrl, fixtures.business);
    assert.equal(archived.response.status, 401, JSON.stringify(archived.data));
    assert.deepEqual(archived.data, { error: 'Invalid email or password' });
    assert.equal(setCookieLines(archived.response).length, 0);
  } finally {
    await prisma.user.update({
      where: { id: fixtures.business.id },
      data: { active: true, archivedAt: null },
    });
  }
});

test('protected mutations reject missing and wrong CSRF proof and accept the matching proof', async () => {
  const login = await loginAt(baseUrl, fixtures.admin);
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  sessions.admin = readSession(login.response, app.get('config'));
  const body = { h2CsrfProbe: runId };

  const missing = await requestAt(baseUrl, '/api/users/preferences', {
    method: 'PUT', body, session: sessions.admin,
  });
  assert.equal(missing.response.status, 403, JSON.stringify(missing.data));
  assert.equal(missing.data.code, 'CSRF_VALIDATION_FAILED');

  const wrong = await requestAt(baseUrl, '/api/users/preferences', {
    method: 'PUT', body, session: sessions.admin, csrf: 'wrong',
  });
  assert.equal(wrong.response.status, 403, JSON.stringify(wrong.data));
  assert.equal(wrong.data.code, 'CSRF_VALIDATION_FAILED');

  const valid = await requestAt(baseUrl, '/api/users/preferences', {
    method: 'PUT', body, session: sessions.admin, csrf: 'valid',
  });
  assert.equal(valid.response.status, 200, JSON.stringify(valid.data));
  assert.equal(valid.data.preferences.h2CsrfProbe, runId);
});

test('logout revokes the current session and clears both cookies', async () => {
  const logout = await requestAt(baseUrl, '/api/auth/logout', {
    method: 'POST', session: sessions.employee, csrf: 'valid', body: {},
  });
  assert.equal(logout.response.status, 200, JSON.stringify(logout.data));
  assert.equal(logout.data.success, true);

  const names = cookieNames(app.get('config'));
  const clearedSession = cookieLine(logout.response, names.session);
  const clearedCsrf = cookieLine(logout.response, names.csrf);
  assert.match(clearedSession, /(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/i);
  assert.match(clearedCsrf, /(?:Max-Age=0|Expires=Thu, 01 Jan 1970)/i);

  const stored = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(sessions.employee.sessionToken) },
  });
  assert.ok(stored.revokedAt);
  assert.equal(stored.revokeReason, 'LOGOUT');

  const stale = await requestAt(baseUrl, '/api/auth/me', { session: sessions.employee });
  assert.equal(stale.response.status, 401, JSON.stringify(stale.data));
});

test('idle expiry rejects the cookie and records a SESSION_EXPIRED revocation', async () => {
  const login = await loginAt(baseUrl, fixtures.employee);
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  const session = readSession(login.response, app.get('config'));
  const stored = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(session.sessionToken) },
  });
  assert.ok(stored);
  await prisma.authSession.update({
    where: { id: stored.id },
    data: { idleExpiresAt: new Date(Date.now() - 1000) },
  });

  const expired = await requestAt(baseUrl, '/api/auth/me', { session });
  assert.equal(expired.response.status, 401, JSON.stringify(expired.data));
  assert.equal(expired.data.code, 'SESSION_EXPIRED');
  const revoked = await prisma.authSession.findUnique({ where: { id: stored.id } });
  assert.ok(revoked.revokedAt);
  assert.equal(revoked.revokeReason, 'SESSION_EXPIRED');
});

test('cookie-authenticated Socket.IO sessions disconnect on logout and cannot reconnect', async () => {
  const login = await loginAt(baseUrl, fixtures.socketPilot);
  assert.equal(login.response.status, 200, JSON.stringify(login.data));
  const session = readSession(login.response, app.get('config'));
  const stored = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(session.sessionToken) },
  });
  assert.ok(stored);

  const socket = await connectSocketWithSession(session);
  const serverSocket = io.sockets.sockets.get(socket.id);
  assert.ok(serverSocket, 'The cookie-authenticated socket did not reach the server connection state');
  assert.equal(serverSocket.auth.userId, fixtures.socketPilot.id);
  assert.equal(serverSocket.auth.role, 'PILOT');
  assert.equal(serverSocket.auth.sessionId, stored.id);
  assert.equal(Object.hasOwn(serverSocket.data, 'rawSessionToken'), false);
  assert.equal(serverSocket.data.sessionTokenHash, tokenHash(session.sessionToken));
  assert.equal(serverSocket.request.headers.cookie, undefined);
  assert.equal(serverSocket.handshake.headers.cookie, undefined);

  const disconnected = waitForSocketDisconnect(socket);
  const logout = await requestAt(baseUrl, '/api/auth/logout', {
    method: 'POST', session, csrf: 'valid', body: {},
  });
  assert.equal(logout.response.status, 200, JSON.stringify(logout.data));
  assert.equal(await disconnected, 'io server disconnect');
  assert.equal(socket.connected, false);

  const revoked = await prisma.authSession.findUnique({ where: { id: stored.id } });
  assert.ok(revoked.revokedAt);
  assert.equal(revoked.revokeReason, 'LOGOUT');
  await assert.rejects(() => connectSocketWithSession(session), /Authentication is required/);
});

test('logout-all disconnects every cookie-authenticated socket for the user', async () => {
  const [firstLogin, secondLogin] = await Promise.all([
    loginAt(baseUrl, fixtures.socketPilot),
    loginAt(baseUrl, fixtures.socketPilot),
  ]);
  assert.equal(firstLogin.response.status, 200, JSON.stringify(firstLogin.data));
  assert.equal(secondLogin.response.status, 200, JSON.stringify(secondLogin.data));
  const firstSession = readSession(firstLogin.response, app.get('config'));
  const secondSession = readSession(secondLogin.response, app.get('config'));
  const [firstSocket, secondSocket] = await Promise.all([
    connectSocketWithSession(firstSession),
    connectSocketWithSession(secondSession),
  ]);

  const firstDisconnected = waitForSocketDisconnect(firstSocket);
  const secondDisconnected = waitForSocketDisconnect(secondSocket);
  const logout = await requestAt(baseUrl, '/api/auth/logout-all', {
    method: 'POST', session: firstSession, csrf: 'valid', body: {},
  });
  assert.equal(logout.response.status, 200, JSON.stringify(logout.data));
  assert.deepEqual(await Promise.all([firstDisconnected, secondDisconnected]), [
    'io server disconnect',
    'io server disconnect',
  ]);

  const activeSessions = await prisma.authSession.count({
    where: { userId: fixtures.socketPilot.id, revokedAt: null },
  });
  assert.equal(activeSessions, 0);
  const stale = await requestAt(baseUrl, '/api/auth/me', { session: secondSession });
  assert.equal(stale.response.status, 401, JSON.stringify(stale.data));
  await assert.rejects(() => connectSocketWithSession(secondSession), /Authentication is required/);
});

test('Admin password reset and deactivation each revoke the target account session', async () => {
  const passwordLogin = await loginAt(baseUrl, fixtures.passwordTarget);
  assert.equal(passwordLogin.response.status, 200, JSON.stringify(passwordLogin.data));
  const passwordSession = readSession(passwordLogin.response, app.get('config'));
  const passwordVersion = fixtures.passwordTarget.authVersion;

  const reset = await requestAt(baseUrl, '/api/users/edit-password', {
    method: 'POST',
    session: sessions.admin,
    csrf: 'valid',
    body: { id: fixtures.passwordTarget.id, newPassword: adminResetPassword },
  });
  assert.equal(reset.response.status, 200, JSON.stringify(reset.data));
  const passwordUser = await prisma.user.findUnique({ where: { id: fixtures.passwordTarget.id } });
  assert.equal(passwordUser.authVersion, passwordVersion + 1);
  const passwordRow = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(passwordSession.sessionToken) },
  });
  assert.ok(passwordRow.revokedAt);
  assert.equal(passwordRow.revokeReason, 'PASSWORD_CHANGED_BY_ADMIN');
  const passwordMe = await requestAt(baseUrl, '/api/auth/me', { session: passwordSession });
  assert.equal(passwordMe.response.status, 401, JSON.stringify(passwordMe.data));

  const deactivationLogin = await loginAt(baseUrl, fixtures.deactivationTarget);
  assert.equal(deactivationLogin.response.status, 200, JSON.stringify(deactivationLogin.data));
  const deactivationSession = readSession(deactivationLogin.response, app.get('config'));
  const deactivationVersion = fixtures.deactivationTarget.authVersion;
  const deactivate = await requestAt(baseUrl, '/api/users/toggle-active', {
    method: 'POST',
    session: sessions.admin,
    csrf: 'valid',
    body: { userId: fixtures.deactivationTarget.id },
  });
  assert.equal(deactivate.response.status, 200, JSON.stringify(deactivate.data));
  const deactivatedUser = await prisma.user.findUnique({ where: { id: fixtures.deactivationTarget.id } });
  assert.equal(deactivatedUser.active, false);
  assert.ok(deactivatedUser.archivedAt);
  assert.equal(deactivatedUser.authVersion, deactivationVersion + 1);
  const deactivationRow = await prisma.authSession.findUnique({
    where: { tokenHash: tokenHash(deactivationSession.sessionToken) },
  });
  assert.ok(deactivationRow.revokedAt);
  assert.equal(deactivationRow.revokeReason, 'ACCOUNT_DEACTIVATED');
  const deactivationMe = await requestAt(baseUrl, '/api/auth/me', { session: deactivationSession });
  assert.equal(deactivationMe.response.status, 401, JSON.stringify(deactivationMe.data));
});

test('production login uses Secure __Host cookies and production rejects the test bearer path', async () => {
  const productionOrigin = 'https://h2.example.test';
  const config = loadEnvironment({
    NODE_ENV: 'production',
    CORS_ALLOWED_ORIGINS: productionOrigin,
    TRUST_PROXY_HOPS: '1',
    ENFORCE_HTTPS: 'true',
    RECOVERY_HASH_SECRET: crypto.randomBytes(48).toString('base64url'),
    RATE_LIMIT_GENERAL_MAX: '1000',
    RATE_LIMIT_LOGIN_MAX: '100',
  });
  const productionServer = http.createServer(createApp({ config }));
  productionServer.listen(0, '127.0.0.1');
  await new Promise((resolve) => productionServer.once('listening', resolve));
  const productionUrl = `http://127.0.0.1:${productionServer.address().port}`;
  const forwardedHeaders = { Origin: productionOrigin, 'X-Forwarded-Proto': 'https' };

  try {
    const login = await loginAt(productionUrl, fixtures.admin, originalPassword, forwardedHeaders);
    assert.equal(login.response.status, 200, JSON.stringify(login.data));
    assert.equal(Object.hasOwn(login.data, 'token'), false);
    const productionSession = readSession(login.response, config);
    assertCookieFlags(productionSession.sessionLine, { httpOnly: true, secure: true });
    assertCookieFlags(productionSession.csrfLine, { httpOnly: false, secure: true });
    assert.match(productionSession.sessionLine, /^__Host-daas_session=/);
    assert.match(productionSession.csrfLine, /^__Host-daas_csrf=/);

    const bearer = await requestAt(productionUrl, '/api/auth/me', {
      headers: {
        ...forwardedHeaders,
        Authorization: `Bearer ${issueToken(fixtures.admin)}`,
      },
    });
    assert.equal(bearer.response.status, 401, JSON.stringify(bearer.data));
    assert.equal(bearer.data.code, 'AUTHENTICATION_REQUIRED');
  } finally {
    await closeServer(productionServer);
  }
});

test('recovery request has the same generic response shape for existing and nonexistent accounts', async () => {
  const existing = await requestRecovery(fixtures.recovery.email);
  const nonexistent = await requestRecovery(`missing-${runId}@example.test`);
  assert.equal(existing.response.status, 202, JSON.stringify(existing.data));
  assert.equal(nonexistent.response.status, 202, JSON.stringify(nonexistent.data));
  assert.deepEqual(Object.keys(existing.data).sort(), Object.keys(nonexistent.data).sort());
  assert.equal(existing.data.success, true);
  assert.equal(nonexistent.data.success, true);
  assert.equal(existing.data.message, nonexistent.data.message);
  assert.ok(existing.data.challengeId);
  assert.ok(nonexistent.data.challengeId);
  assert.ok(deliveries.has(existing.data.challengeId));
  assert.equal(deliveries.has(nonexistent.data.challengeId), false);
});

test('recovery rejects wrong, expired, and already-used proof', async () => {
  const wrongChallenge = await requestRecovery(fixtures.recovery.email);
  const wrongDelivery = deliveries.get(wrongChallenge.data.challengeId);
  assert.ok(wrongDelivery);
  const wrong = await completeRecovery(
    wrongChallenge.data.challengeId,
    differentCode(wrongDelivery.code),
  );
  assert.equal(wrong.response.status, 400, JSON.stringify(wrong.data));
  assert.equal(wrong.data.code, 'RECOVERY_CHALLENGE_INVALID');

  const expiredChallenge = await requestRecovery(fixtures.recovery.email);
  const expiredDelivery = deliveries.get(expiredChallenge.data.challengeId);
  assert.ok(expiredDelivery);
  await prisma.passwordRecoveryChallenge.update({
    where: { id: expiredChallenge.data.challengeId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const expired = await completeRecovery(expiredChallenge.data.challengeId, expiredDelivery.code);
  assert.equal(expired.response.status, 400, JSON.stringify(expired.data));
  assert.equal(expired.data.code, 'RECOVERY_CHALLENGE_INVALID');

  const usableChallenge = await requestRecovery(fixtures.recovery.email);
  const usableDelivery = deliveries.get(usableChallenge.data.challengeId);
  assert.ok(usableDelivery);
  const used = await completeRecovery(usableChallenge.data.challengeId, usableDelivery.code);
  assert.equal(used.response.status, 200, JSON.stringify(used.data));
  const reused = await completeRecovery(
    usableChallenge.data.challengeId,
    usableDelivery.code,
    `Second-${crypto.randomBytes(18).toString('base64url')}`,
  );
  assert.equal(reused.response.status, 400, JSON.stringify(reused.data));
  assert.equal(reused.data.code, 'RECOVERY_CHALLENGE_INVALID');

  // Restore the fixture password so the dedicated revocation test starts with
  // two sessions created from a known credential.
  await prisma.user.update({
    where: { id: fixtures.recovery.id },
    data: { passwordHash: await hashPassword(originalPassword) },
  });
});

test('successful recovery is one-time and revokes every existing session', async () => {
  const firstLogin = await loginAt(baseUrl, fixtures.recovery);
  const secondLogin = await loginAt(baseUrl, fixtures.recovery);
  assert.equal(firstLogin.response.status, 200, JSON.stringify(firstLogin.data));
  assert.equal(secondLogin.response.status, 200, JSON.stringify(secondLogin.data));
  const firstSession = readSession(firstLogin.response, app.get('config'));
  const secondSession = readSession(secondLogin.response, app.get('config'));
  const before = await prisma.user.findUnique({ where: { id: fixtures.recovery.id } });

  const recovery = await requestRecovery(fixtures.recovery.email);
  const delivery = deliveries.get(recovery.data.challengeId);
  assert.ok(delivery);
  const completed = await completeRecovery(recovery.data.challengeId, delivery.code, recoveredPassword);
  assert.equal(completed.response.status, 200, JSON.stringify(completed.data));
  assert.equal(completed.data.success, true);

  for (const staleSession of [firstSession, secondSession]) {
    const me = await requestAt(baseUrl, '/api/auth/me', { session: staleSession });
    assert.equal(me.response.status, 401, JSON.stringify(me.data));
  }

  const rows = await prisma.authSession.findMany({ where: { userId: fixtures.recovery.id } });
  assert.ok(rows.length >= 2);
  assert.equal(rows.every((row) => row.revokedAt && row.revokeReason === 'PASSWORD_RECOVERY'), true);
  const after = await prisma.user.findUnique({ where: { id: fixtures.recovery.id } });
  assert.equal(after.authVersion, before.authVersion + 1);
  const challenge = await prisma.passwordRecoveryChallenge.findUnique({
    where: { id: recovery.data.challengeId },
  });
  assert.ok(challenge.usedAt);

  const oldPassword = await loginAt(baseUrl, fixtures.recovery, originalPassword);
  assert.equal(oldPassword.response.status, 401, JSON.stringify(oldPassword.data));
  const newPassword = await loginAt(baseUrl, fixtures.recovery, recoveredPassword);
  assert.equal(newPassword.response.status, 200, JSON.stringify(newPassword.data));

  const reused = await completeRecovery(
    recovery.data.challengeId,
    delivery.code,
    `Again-${crypto.randomBytes(18).toString('base64url')}`,
  );
  assert.equal(reused.response.status, 400, JSON.stringify(reused.data));
  assert.equal(reused.data.code, 'RECOVERY_CHALLENGE_INVALID');
});

test.after(async () => {
  recoveryDeliveryService.clearTestAdapter();
  const userIds = Object.values(fixtures).map((user) => user.id);
  const trackedChallengeIds = [...challengeIds];
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: userIds } },
        { entityId: { in: [...userIds, ...trackedChallengeIds] } },
        { createdAt: { gte: startedAt }, entityType: { in: ['AuthSession', 'PasswordRecoveryChallenge'] } },
      ],
    },
  });
  await prisma.passwordRecoveryChallenge.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        ...(trackedChallengeIds.length ? [{ id: { in: trackedChallengeIds } }] : []),
      ],
    },
  });
  await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await new Promise((resolve) => io.close(resolve));
  await closeServer(server);
  await prisma.$disconnect();
});
