const crypto = require('crypto');
const cookie = require('cookie');
const authSessionRepository = require('../src/repositories/authSessionRepository');

const DEVELOPMENT_SESSION_COOKIE = 'daas_session';
const DEVELOPMENT_CSRF_COOKIE = 'daas_csrf';
const PRODUCTION_SESSION_COOKIE = '__Host-daas_session';
const PRODUCTION_CSRF_COOKIE = '__Host-daas_csrf';

class SessionError extends Error {
  constructor(message = 'Authentication is required', code = 'AUTHENTICATION_REQUIRED') {
    super(message);
    this.name = 'SessionError';
    this.code = code;
    this.status = 401;
  }
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function cookieNames(config) {
  return config.isProduction
    ? { session: PRODUCTION_SESSION_COOKIE, csrf: PRODUCTION_CSRF_COOKIE }
    : { session: DEVELOPMENT_SESSION_COOKIE, csrf: DEVELOPMENT_CSRF_COOKIE };
}

function parseCookies(header) {
  try {
    return cookie.parse(String(header || ''));
  } catch {
    return {};
  }
}

function cookieOptions(config, { httpOnly, maxAge } = {}) {
  return {
    httpOnly: Boolean(httpOnly),
    secure: config.isProduction,
    sameSite: 'strict',
    path: '/',
    ...(Number.isFinite(maxAge) ? { maxAge } : {}),
  };
}

function setSessionCookies(res, config, sessionToken, csrfToken, maxAge) {
  const names = cookieNames(config);
  res.cookie(names.session, sessionToken, cookieOptions(config, { httpOnly: true, maxAge }));
  res.cookie(names.csrf, csrfToken, cookieOptions(config, { httpOnly: false, maxAge }));
}

function clearSessionCookies(res, config) {
  const names = cookieNames(config);
  res.clearCookie(names.session, cookieOptions(config, { httpOnly: true }));
  res.clearCookie(names.csrf, cookieOptions(config, { httpOnly: false }));
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: String(user.role || '').toLowerCase().replaceAll('_', '-'),
    preferredLanguage: user.preferredLanguage,
    preferences: user.preferences || {},
    village: user.village,
    district: user.district,
    businessName: user.businessName,
    gstNo: user.gstNo,
    contactPerson: user.contactPerson,
    address: user.address,
  };
}

function normalizedAllowedRoles(allowedRoles) {
  const roles = allowedRoles instanceof Set ? allowedRoles : new Set(allowedRoles || []);
  if (!roles.size) throw new SessionError('This account cannot sign in', 'ACCOUNT_NOT_ELIGIBLE');
  return roles;
}

function snapshotTime(value) {
  return value ? new Date(value).getTime() : null;
}

function credentialSnapshotMatches(identity, snapshot, allowedRoles) {
  return Boolean(identity
    && snapshot
    && Object.hasOwn(snapshot, 'role')
    && Object.hasOwn(snapshot, 'active')
    && Object.hasOwn(snapshot, 'archivedAt')
    && Number.isInteger(snapshot.authVersion)
    && identity.id === snapshot.id
    && identity.authVersion === snapshot.authVersion
    && identity.role === snapshot.role
    && identity.active === snapshot.active
    && snapshotTime(identity.archivedAt) === snapshotTime(snapshot.archivedAt)
    && allowedRoles.has(identity.role)
    && identity.active === true
    && !identity.archivedAt);
}

async function createSession(credentialSnapshot, config, { allowedRoles } = {}) {
  const roles = normalizedAllowedRoles(allowedRoles);
  if (!credentialSnapshotMatches(credentialSnapshot, credentialSnapshot, roles)) {
    throw new SessionError('Credentials or account state changed', 'CREDENTIAL_STATE_CHANGED');
  }
  const now = new Date();
  const absoluteExpiresAt = new Date(now.getTime() + config.session.absoluteTimeoutMs);
  const idleExpiresAt = new Date(Math.min(
    now.getTime() + config.session.idleTimeoutMs,
    absoluteExpiresAt.getTime(),
  ));
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const createdSession = await authSessionRepository.createForCredentialSnapshot({
    userId: credentialSnapshot.id,
    tokenHash: tokenHash(sessionToken),
    csrfTokenHash: tokenHash(csrfToken),
    authVersion: credentialSnapshot.authVersion,
    idleExpiresAt,
    absoluteExpiresAt,
  }, {
    authVersion: credentialSnapshot.authVersion,
    role: credentialSnapshot.role,
    active: credentialSnapshot.active,
    archivedAt: credentialSnapshot.archivedAt,
  });
  if (!createdSession) {
    throw new SessionError('Credentials or account state changed', 'CREDENTIAL_STATE_CHANGED');
  }
  // Re-resolve after creation so a concurrent password, role, archive, or
  // activation change cannot leave a newly-created session valid.
  const session = await resolveSessionToken(sessionToken, config, { touch: false });
  if (session.id !== createdSession.id || !credentialSnapshotMatches(session.user, credentialSnapshot, roles)) {
    await authSessionRepository.revokeById(createdSession.id, 'CREDENTIAL_STATE_CHANGED');
    throw new SessionError('Credentials or account state changed', 'CREDENTIAL_STATE_CHANGED');
  }
  return { session, sessionToken, csrfToken, identity: session.user };
}

async function establishSession(req, res, credentialSnapshot, options) {
  const config = req.app.get('config');
  const created = await createSession(credentialSnapshot, config, options);
  setSessionCookies(res, config, created.sessionToken, created.csrfToken, config.session.absoluteTimeoutMs);
  return created;
}

function readSessionToken(cookieHeader, config) {
  return parseCookies(cookieHeader)[cookieNames(config).session] || null;
}

function csrfTokensMatch(headerToken, cookieToken, storedHash) {
  if (!headerToken || !cookieToken || headerToken !== cookieToken) return false;
  const received = Buffer.from(tokenHash(headerToken));
  const stored = Buffer.from(String(storedHash || ''));
  return received.length === stored.length && crypto.timingSafeEqual(received, stored);
}

async function resolveSessionToken(rawToken, config, { touch = true } = {}) {
  if (!rawToken) throw new SessionError();
  const hash = tokenHash(rawToken);
  const session = await authSessionRepository.findByTokenHash(hash);
  if (!session || session.revokedAt) throw new SessionError();

  const now = new Date();
  const expired = session.idleExpiresAt <= now || session.absoluteExpiresAt <= now;
  const invalidUser = !session.user
    || session.user.active === false
    || Boolean(session.user.archivedAt)
    || session.user.authVersion !== session.authVersion;
  if (expired || invalidUser) {
    await authSessionRepository.revokeById(session.id, expired ? 'SESSION_EXPIRED' : 'IDENTITY_CHANGED');
    throw new SessionError(expired ? 'Authentication session has expired' : 'This account is inactive', expired ? 'SESSION_EXPIRED' : 'ACCOUNT_INACTIVE');
  }

  if (touch && now.getTime() - session.lastSeenAt.getTime() >= config.session.touchIntervalMs) {
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
  return session;
}

async function resolveRequestSession(req, options) {
  const config = req.app.get('config');
  const rawToken = readSessionToken(req.headers.cookie, config);
  const session = await resolveSessionToken(rawToken, config, options);
  return { config, rawToken, session };
}

function requireCsrf(req, session, config) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies[cookieNames(config).csrf];
  const csrfHeader = String(req.get('x-csrf-token') || '');
  if (!csrfTokensMatch(csrfHeader, csrfCookie, session.csrfTokenHash)) {
    const error = new Error('CSRF validation failed');
    error.status = 403;
    error.code = 'CSRF_VALIDATION_FAILED';
    throw error;
  }
}

async function revokeCurrent(req, reason = 'LOGOUT') {
  const config = req.app.get('config');
  const rawToken = readSessionToken(req.headers.cookie, config);
  if (rawToken) await authSessionRepository.revokeByTokenHash(tokenHash(rawToken), reason);
}

async function revokeAllForUser(userId, reason = 'LOGOUT_ALL') {
  return authSessionRepository.revokeAllAndBumpAuthVersion(userId, reason);
}

module.exports = {
  SessionError,
  clearSessionCookies,
  cookieNames,
  createSession,
  csrfTokensMatch,
  establishSession,
  parseCookies,
  publicUser,
  readSessionToken,
  requireCsrf,
  resolveRequestSession,
  resolveSessionToken,
  revokeAllForUser,
  revokeCurrent,
  setSessionCookies,
  tokenHash,
};
