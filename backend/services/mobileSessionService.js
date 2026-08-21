const crypto = require('node:crypto');
const mobileSessionRepository = require('../src/repositories/mobileSessionRepository');

const APP_ROLES = Object.freeze({
  PILOT_FIELD: new Set(['PILOT']),
  OPERATIONS: new Set(['ADMIN', 'FLEET_MANAGER', 'SALES']),
});

class MobileAuthError extends Error {
  constructor(message, code = 'AUTHENTICATION_REQUIRED', status = 401) {
    super(message);
    this.name = 'MobileAuthError';
    this.code = code;
    this.status = status;
  }
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function randomToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function validateInstallationKey(value) {
  if (typeof value !== 'string' || value.length < 32 || value.length > 256) {
    throw new MobileAuthError('A valid app installation key is required', 'VALIDATION_FAILED', 400);
  }
  return value;
}

function assertAppRole(app, user) {
  if (!APP_ROLES[app] || !user || !APP_ROLES[app].has(user.role) || !user.active || user.archivedAt) {
    throw new MobileAuthError('This account cannot use this application', 'ROLE_NOT_ALLOWED', 403);
  }
}

async function registerInstallation({ user, app, installationKey, label, config }) {
  assertAppRole(app, user);
  const installationKeyHash = hash(validateInstallationKey(installationKey));
  const result = await mobileSessionRepository.registerInstallation({
    userId: user.id,
    app,
    installationKeyHash,
    label: typeof label === 'string' && label.trim() ? label.trim() : null,
    maxInstallations: config.mobile.maxInstallationsPerApp,
  });
  if (result.kind === 'KEY_OWNED_BY_ANOTHER_IDENTITY') {
    throw new MobileAuthError('This app installation cannot be registered', 'INSTALLATION_NOT_ALLOWED', 403);
  }
  if (result.kind === 'LIMIT_REACHED') {
    throw new MobileAuthError('The active installation limit has been reached', 'INSTALLATION_LIMIT_REACHED', 409);
  }
  return result.installation;
}

async function createSession({ user, installation, config }) {
  const now = new Date();
  const absoluteExpiresAt = new Date(now.getTime() + config.mobile.absoluteTimeoutMs);
  const idleExpiresAt = new Date(Math.min(now.getTime() + config.mobile.idleTimeoutMs, absoluteExpiresAt.getTime()));
  const accessToken = randomToken();
  const session = await mobileSessionRepository.createSession({
    installationId: installation.id,
    userId: user.id,
    app: installation.app,
    tokenHash: hash(accessToken),
    expectedAuthVersion: user.authVersion,
    expectedRole: user.role,
    idleExpiresAt,
    absoluteExpiresAt,
  });
  if (!session) {
    throw new MobileAuthError('Credentials changed during sign in', 'CREDENTIAL_STATE_CHANGED', 401);
  }
  return { accessToken, session };
}

function readBearerToken(header) {
  const match = /^Bearer\s+([^\s]+)$/i.exec(String(header || '').trim());
  return match?.[1] || null;
}

async function resolve(rawToken, config, { touch = true } = {}) {
  if (!rawToken) throw new MobileAuthError();
  const session = await mobileSessionRepository.findSessionByTokenHash(hash(rawToken));
  if (!session || session.revokedAt || session.installation.revokedAt) throw new MobileAuthError('Session was revoked', 'SESSION_REVOKED');
  const now = new Date();
  if (session.idleExpiresAt <= now || session.absoluteExpiresAt <= now) {
    await mobileSessionRepository.revokeSession(session.id, 'SESSION_EXPIRED');
    throw new MobileAuthError('Session expired', 'SESSION_EXPIRED');
  }
  if (!session.user.active || session.user.archivedAt || session.user.authVersion !== session.authVersion) {
    await mobileSessionRepository.revokeSession(session.id, 'IDENTITY_CHANGED');
    throw new MobileAuthError('Session was revoked', 'SESSION_REVOKED');
  }
  assertAppRole(session.installation.app, session.user);
  if (touch && now.getTime() - session.lastSeenAt.getTime() >= config.mobile.touchIntervalMs) {
    const idleExpiresAt = new Date(Math.min(now.getTime() + config.mobile.idleTimeoutMs, session.absoluteExpiresAt.getTime()));
    if ((await mobileSessionRepository.touchSession(session.id, now, idleExpiresAt)).count !== 1) {
      throw new MobileAuthError('Session was revoked', 'SESSION_REVOKED');
    }
    session.lastSeenAt = now;
    session.idleExpiresAt = idleExpiresAt;
  }
  return session;
}

module.exports = {
  APP_ROLES,
  MobileAuthError,
  createSession,
  readBearerToken,
  registerInstallation,
  resolve,
};
