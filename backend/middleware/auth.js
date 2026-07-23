const crypto = require('crypto');
const { loadEnvironment } = require('../config/environment');
const authSessionRepository = require('../src/repositories/authSessionRepository');
const userRepository = require('../src/repositories/userRepository');
const {
  SessionError,
  clearSessionCookies,
  publicUser,
  readSessionToken,
  requireCsrf,
  resolveSessionToken,
  tokenHash,
} = require('../services/sessionService');

let testSecret;
const SOCKET_AUTH_INSTALLED = Symbol.for('daas.socket-auth-installed');
const SOCKET_PENDING_AUTH = Symbol.for('daas.socket-pending-auth');
const pendingSocketRecords = new WeakMap();
const revokedPendingSockets = new WeakSet();

function assertTestMode() {
  if (String(process.env.NODE_ENV).toLowerCase() !== 'test') {
    throw new Error('Stateless authentication tokens are available only in tests');
  }
}

function getTestSecret() {
  assertTestMode();
  if (!testSecret) testSecret = crypto.randomBytes(48);
  return testSecret;
}

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const signTestPayload = (payload) => crypto.createHmac('sha256', getTestSecret()).update(payload).digest('base64url');

// Kept solely so the existing isolated integration tests can authenticate
// without creating cookie sessions. Application code never calls this.
function issueToken(user) {
  const payload = encode({ sub: user.id, exp: Date.now() + 8 * 60 * 60_000 });
  return `${payload}.${signTestPayload(payload)}`;
}

function verifyToken(token) {
  assertTestMode();
  if (!token || typeof token !== 'string') throw new SessionError();
  const [payload, receivedSignature, extra] = token.split('.');
  const expectedSignature = payload ? signTestPayload(payload) : '';
  if (!payload || !receivedSignature || extra
    || receivedSignature.length !== expectedSignature.length
    || !crypto.timingSafeEqual(Buffer.from(receivedSignature), Buffer.from(expectedSignature))) {
    throw new SessionError('Invalid authentication token', 'INVALID_TEST_TOKEN');
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!claims.sub || !Number.isFinite(claims.exp) || claims.exp <= Date.now()) {
      throw new SessionError('Authentication token has expired', 'SESSION_EXPIRED');
    }
    return { userId: claims.sub, expiresAt: new Date(claims.exp) };
  } catch (error) {
    if (error instanceof SessionError) throw error;
    throw new SessionError('Invalid authentication token', 'INVALID_TEST_TOKEN');
  }
}

async function resolveTestAuthentication(token, config) {
  if (config.nodeEnv !== 'test') throw new SessionError();
  const claims = verifyToken(token);
  const user = await userRepository.findIdentityById(claims.userId);
  if (!user || user.active === false || user.archivedAt) {
    throw new SessionError('This account is inactive', 'ACCOUNT_INACTIVE');
  }
  return {
    auth: { userId: user.id, role: user.role, sessionId: null },
    expiresAt: claims.expiresAt,
    session: null,
    user,
  };
}

function bearerToken(headers = {}) {
  const [scheme, token] = String(headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function resolveHttpAuthentication(req) {
  const config = req.app.get('config');
  const rawToken = readSessionToken(req.headers.cookie, config);
  if (rawToken) {
    const session = await resolveSessionToken(rawToken, config);
    requireCsrf(req, session, config);
    return {
      auth: { userId: session.userId, role: session.user.role, sessionId: session.id },
      session,
      user: session.user,
    };
  }

  const testToken = bearerToken(req.headers);
  if (config.nodeEnv === 'test' && testToken) return resolveTestAuthentication(testToken, config);
  throw new SessionError();
}

async function authenticate(req, res, next) {
  const config = req.app.get('config');
  try {
    const resolved = await resolveHttpAuthentication(req);
    req.auth = resolved.auth;
    req.authSession = resolved.session;
    req.authUser = resolved.user;
    return next();
  } catch (error) {
    if (!(error instanceof SessionError) && error.code !== 'CSRF_VALIDATION_FAILED') return next(error);
    if (error instanceof SessionError && readSessionToken(req.headers.cookie, config)) clearSessionCookies(res, config);
    const status = error.status === 403 ? 403 : 401;
    return res.status(status).json({
      error: status === 403 ? 'CSRF validation failed' : (error.message || 'Authentication is required'),
      code: error.code || (status === 403 ? 'CSRF_VALIDATION_FAILED' : 'AUTHENTICATION_REQUIRED'),
    });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Authentication is required' });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ error: 'You do not have permission to perform this action' });
    return next();
  };
}

function resolvedSocketSession(session, sessionTokenHash) {
  return {
    auth: { userId: session.userId, role: session.user.role, sessionId: session.id },
    expiresAt: new Date(Math.min(session.idleExpiresAt.getTime(), session.absoluteExpiresAt.getTime())),
    session,
    sessionTokenHash,
  };
}

async function resolveSocketSessionHash(sessionTokenHash, config) {
  const session = await authSessionRepository.findByTokenHash(sessionTokenHash);
  if (!session || session.revokedAt) throw new SessionError();

  const now = new Date();
  const expired = session.idleExpiresAt <= now || session.absoluteExpiresAt <= now;
  const invalidUser = !session.user
    || session.user.active === false
    || Boolean(session.user.archivedAt)
    || session.user.authVersion !== session.authVersion;
  if (expired || invalidUser) {
    await authSessionRepository.revokeById(session.id, expired ? 'SESSION_EXPIRED' : 'IDENTITY_CHANGED');
    throw new SessionError(
      expired ? 'Authentication session has expired' : 'This account is inactive',
      expired ? 'SESSION_EXPIRED' : 'ACCOUNT_INACTIVE',
    );
  }

  if (now.getTime() - session.lastSeenAt.getTime() < config.session.touchIntervalMs) return session;
  const idleExpiresAt = new Date(Math.min(
    now.getTime() + config.session.idleTimeoutMs,
    session.absoluteExpiresAt.getTime(),
  ));
  const touched = await authSessionRepository.touch(session.id, { lastSeenAt: now, idleExpiresAt }, now);
  if (!touched
    || touched.revokedAt
    || !touched.user
    || touched.user.active === false
    || touched.user.archivedAt
    || touched.user.authVersion !== touched.authVersion) {
    throw new SessionError('Authentication session is no longer valid', 'SESSION_REVOKED');
  }
  return touched;
}

async function resolveStoredTestAuthentication(stored, config) {
  if (config.nodeEnv !== 'test'
    || !stored?.userId
    || !Number.isFinite(stored.expiresAt)
    || stored.expiresAt <= Date.now()) {
    throw new SessionError('Authentication token has expired', 'SESSION_EXPIRED');
  }
  const user = await userRepository.findIdentityById(stored.userId);
  if (!user || user.active === false || user.archivedAt) {
    throw new SessionError('This account is inactive', 'ACCOUNT_INACTIVE');
  }
  return {
    auth: { userId: user.id, role: user.role, sessionId: null },
    expiresAt: new Date(stored.expiresAt),
    session: null,
    testAuthentication: stored,
    user,
  };
}

async function resolveSocketAuthentication(socket, config, { initial = false } = {}) {
  if (socket.data.sessionTokenHash) {
    const session = await resolveSocketSessionHash(socket.data.sessionTokenHash, config);
    return resolvedSocketSession(session, socket.data.sessionTokenHash);
  }
  if (socket.data.testAuthentication) {
    return resolveStoredTestAuthentication(socket.data.testAuthentication, config);
  }
  if (!initial) throw new SessionError();

  const rawToken = readSessionToken(socket.request.headers.cookie, config);
  if (rawToken) {
    const sessionTokenHash = tokenHash(rawToken);
    const session = await resolveSessionToken(rawToken, config);
    return resolvedSocketSession(session, sessionTokenHash);
  }
  if (config.nodeEnv === 'test' && socket.handshake.auth?.token) {
    const resolved = await resolveTestAuthentication(socket.handshake.auth.token, config);
    return {
      ...resolved,
      testAuthentication: {
        userId: resolved.auth.userId,
        expiresAt: resolved.expiresAt.getTime(),
      },
    };
  }
  throw new SessionError();
}

function scheduleSocketExpiry(socket, expiresAt) {
  if (socket.data.authExpiryTimer) clearTimeout(socket.data.authExpiryTimer);
  const remaining = Math.max(0, expiresAt.getTime() - Date.now());
  socket.data.authExpiryTimer = setTimeout(() => socket.disconnect(true), Math.min(remaining + 25, 2_147_483_647));
}

function sanitizeSocketCredentials(socket) {
  if (socket.request?.headers) delete socket.request.headers.cookie;
  if (socket.handshake?.headers) delete socket.handshake.headers.cookie;
  if (socket.handshake?.auth && Object.hasOwn(socket.handshake.auth, 'token')) {
    delete socket.handshake.auth.token;
  }
}

async function applySocketAuthentication(socket, resolved) {
  socket.auth = resolved.auth;
  if (resolved.sessionTokenHash) socket.data.sessionTokenHash = resolved.sessionTokenHash;
  if (resolved.testAuthentication) socket.data.testAuthentication = resolved.testAuthentication;
  if (resolved.auth.sessionId) await socket.join(`auth-session:${resolved.auth.sessionId}`);
  await socket.join(`auth-user:${resolved.auth.userId}`);
  scheduleSocketExpiry(socket, resolved.expiresAt);
}

function pendingSocketIndex(io) {
  if (!io[SOCKET_PENDING_AUTH]) {
    io[SOCKET_PENDING_AUTH] = {
      sessions: new Map(),
      users: new Map(),
    };
  }
  return io[SOCKET_PENDING_AUTH];
}

function addPendingSocket(map, key, socket) {
  if (!key) return;
  const sockets = map.get(key) || new Set();
  sockets.add(socket);
  map.set(key, sockets);
}

function removePendingSocket(map, key, socket) {
  if (!key) return;
  const sockets = map.get(key);
  if (!sockets) return;
  sockets.delete(socket);
  if (!sockets.size) map.delete(key);
}

function trackPendingSocket(io, socket, auth) {
  const record = { sessionId: auth.sessionId, userId: auth.userId };
  pendingSocketRecords.set(socket, record);
  const index = pendingSocketIndex(io);
  addPendingSocket(index.sessions, record.sessionId, socket);
  addPendingSocket(index.users, record.userId, socket);
}

function untrackPendingSocket(io, socket) {
  const record = pendingSocketRecords.get(socket);
  if (!record) return;
  const index = pendingSocketIndex(io);
  removePendingSocket(index.sessions, record.sessionId, socket);
  removePendingSocket(index.users, record.userId, socket);
  pendingSocketRecords.delete(socket);
}

function markPendingSocketsRevoked(sockets) {
  if (!sockets) return;
  for (const socket of sockets) revokedPendingSockets.add(socket);
}

function installSocketAuthentication(io, config = loadEnvironment()) {
  if (io[SOCKET_AUTH_INSTALLED]) return;
  io[SOCKET_AUTH_INSTALLED] = true;

  io.use(async (socket, next) => {
    try {
      const initial = await resolveSocketAuthentication(socket, config, { initial: true });
      trackPendingSocket(io, socket, initial.auth);
      socket.conn.once('close', () => untrackPendingSocket(io, socket));
      await applySocketAuthentication(socket, initial);
      sanitizeSocketCredentials(socket);

      // The socket is already in the revocation rooms before this second
      // database read. Pending-socket tracking closes the remaining window
      // before Socket.IO publishes the connection in its namespace map.
      const revalidated = await resolveSocketAuthentication(socket, config);
      if (revokedPendingSockets.has(socket)) {
        throw new SessionError('Authentication session is no longer valid', 'SESSION_REVOKED');
      }
      await applySocketAuthentication(socket, revalidated);
      if (revokedPendingSockets.has(socket)) {
        throw new SessionError('Authentication session is no longer valid', 'SESSION_REVOKED');
      }
      return next();
    } catch (error) {
      untrackPendingSocket(io, socket);
      if (socket.data.authExpiryTimer) clearTimeout(socket.data.authExpiryTimer);
      return next(new Error(error.message || 'Authentication is required'));
    }
  });

  io.on('connection', (socket) => {
    // Namespace connection callbacks run only after Socket.IO has published
    // the socket, so room-based disconnects are reliable after this point.
    untrackPendingSocket(io, socket);
    socket.on('disconnect', () => {
      untrackPendingSocket(io, socket);
      if (socket.data.authExpiryTimer) clearTimeout(socket.data.authExpiryTimer);
    });
    socket.use(async (_packet, next) => {
      try {
        const resolved = await resolveSocketAuthentication(socket, config);
        if (!socket.connected) throw new SessionError('Authentication session is no longer valid', 'SESSION_REVOKED');
        await applySocketAuthentication(socket, resolved);
        if (!socket.connected) throw new SessionError('Authentication session is no longer valid', 'SESSION_REVOKED');
        return next();
      } catch (error) {
        socket.disconnect(true);
        return next(new Error(error.message || 'Authentication is required'));
      }
    });
  });
}

function disconnectSessionSockets(io, sessionId) {
  if (!io || !sessionId) return;
  markPendingSocketsRevoked(pendingSocketIndex(io).sessions.get(sessionId));
  io.in(`auth-session:${sessionId}`).disconnectSockets(true);
}

function disconnectUserSockets(io, userId) {
  if (!io || !userId) return;
  markPendingSocketsRevoked(pendingSocketIndex(io).users.get(userId));
  io.in(`auth-user:${userId}`).disconnectSockets(true);
}

module.exports = {
  authenticate,
  authorize,
  disconnectSessionSockets,
  disconnectUserSockets,
  installSocketAuthentication,
  issueToken,
  publicUser,
  verifyToken,
};
