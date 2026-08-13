const userRepository = require('../src/repositories/userRepository');
const mobileSessionRepository = require('../src/repositories/mobileSessionRepository');
const mobileSessionService = require('../services/mobileSessionService');
const authAuditService = require('../services/authAuditService');
const {
  hashPassword,
  INVALID_ACCOUNT_PASSWORD_HASH,
  needsRehash,
  verifyPassword,
} = require('../services/passwordService');
const { normalizeEmail, validateEmail } = require('../services/identityService');

function safeProfile(user) {
  return {
    id: user.id,
    displayName: user.name,
    employeeCode: user.employeeCode,
    preferredLanguage: user.preferredLanguage,
    homeCenterId: user.homeCenterId,
    role: user.role,
  };
}

function capabilities(app, role) {
  if (app === 'PILOT_FIELD' && role === 'PILOT') {
    return ['PILOT_ASSIGNMENTS_READ', 'COPILOT_SELECT', 'MISSION_MUTATE', 'ISSUE_REPORT', 'FOREGROUND_LOCATION'];
  }
  const byRole = {
    ADMIN: ['OPERATIONS_OVERVIEW', 'SALES_INTAKE', 'FLEET_SCHEDULE', 'CREW_OVERRIDE'],
    FLEET_MANAGER: ['OPERATIONS_OVERVIEW', 'FLEET_SCHEDULE', 'CREW_OVERRIDE'],
    SALES: ['OPERATIONS_OVERVIEW', 'SALES_INTAKE'],
  };
  return byRole[role] || [];
}

function compareVersions(left, right) {
  const a = String(left || '').split('.').map(Number);
  const b = String(right || '').split('.').map(Number);
  if (a.length !== 3 || b.length !== 3 || [...a, ...b].some((part) => !Number.isInteger(part) || part < 0)) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function authError(res, req, error) {
  const status = error.status || 500;
  const genericAuthenticationFailure = status === 401
    && ['CREDENTIAL_STATE_CHANGED', 'INVALID_CREDENTIALS'].includes(error.code);
  return res.status(status).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: status >= 500
        ? 'Unable to complete mobile authentication'
        : genericAuthenticationFailure ? 'Invalid email or password' : error.message,
      retryable: status >= 500,
      requestId: req.requestId,
    },
  });
}

function validateLoginRequest(body) {
  const allowedFields = new Set(['email', 'password', 'installationKey', 'platform', 'appVersion', 'deviceLabel']);
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((field) => !allowedFields.has(field))) {
    throw new mobileSessionService.MobileAuthError('Login request is invalid', 'VALIDATION_FAILED', 400);
  }
  if (typeof body.email !== 'string'
    || typeof body.password !== 'string' || body.password.length < 12 || body.password.length > 128
    || typeof body.installationKey !== 'string' || body.installationKey.length < 32 || body.installationKey.length > 256) {
    throw new mobileSessionService.MobileAuthError('Login credentials are invalid', 'VALIDATION_FAILED', 400);
  }
  try {
    validateEmail(body.email);
  } catch (_error) {
    throw new mobileSessionService.MobileAuthError('Login credentials are invalid', 'VALIDATION_FAILED', 400);
  }
  if (!body || body.platform !== 'ANDROID') {
    throw new mobileSessionService.MobileAuthError('Android is the only supported platform', 'VALIDATION_FAILED', 400);
  }
  if (body.deviceLabel !== null
    && (typeof body.deviceLabel !== 'string' || !body.deviceLabel.trim() || body.deviceLabel.trim().length > 80)) {
    throw new mobileSessionService.MobileAuthError('Device label must contain 1 to 80 characters', 'VALIDATION_FAILED', 400);
  }
}

function login(app) {
  return async (req, res) => {
    try {
      const config = req.app.get('config');
      if (!config.mobile.enabled) throw new mobileSessionService.MobileAuthError('Mobile API is not enabled', 'MOBILE_API_DISABLED', 503);
      validateLoginRequest(req.body);
      const versionComparison = compareVersions(req.body.appVersion, config.mobile.minimumVersion);
      if (versionComparison === null) throw new mobileSessionService.MobileAuthError('A valid app version is required', 'VALIDATION_FAILED', 400);
      if (versionComparison < 0) throw new mobileSessionService.MobileAuthError('Install a supported app version before continuing', 'CLIENT_UPGRADE_REQUIRED', 426);
      const email = normalizeEmail(req.body.email);
      const user = email ? await userRepository.findByEmailForAuthentication(email) : null;
      const passwordValid = await verifyPassword(req.body.password, user?.passwordHash || INVALID_ACCOUNT_PASSWORD_HASH);
      if (!passwordValid) throw new mobileSessionService.MobileAuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      if (!mobileSessionService.APP_ROLES[app]?.has(user.role) || !user.active || user.archivedAt) {
        throw new mobileSessionService.MobileAuthError('Invalid email or password', 'INVALID_CREDENTIALS');
      }
      if (needsRehash(user.passwordHash)) {
        const updated = await userRepository.updatePasswordHashIfCurrent({
          id: user.id,
          expectedPasswordHash: user.passwordHash,
          expectedAuthVersion: user.authVersion,
          passwordHash: await hashPassword(req.body.password),
        });
        if (!updated) {
          throw new mobileSessionService.MobileAuthError(
            'Credentials changed during sign in',
            'CREDENTIAL_STATE_CHANGED',
            401,
          );
        }
      }
      const installation = await mobileSessionService.registerInstallation({
        user,
        app,
        installationKey: req.body.installationKey,
        label: req.body.deviceLabel,
        config,
      });
      const created = await mobileSessionService.createSession({ user, installation, config });
      await authAuditService.record({
        entityType: 'MobileSession',
        entityId: created.session.id,
        action: 'MOBILE_SESSION_CREATED',
        actorId: user.id,
        state: { userId: user.id, role: user.role, app, installationId: installation.id, status: 'ACTIVE' },
      });
      return res.json({
        success: true,
        session: {
          accessToken: created.accessToken,
          tokenType: 'Bearer',
          idleExpiresAt: created.session.idleExpiresAt.toISOString(),
          absoluteExpiresAt: created.session.absoluteExpiresAt.toISOString(),
        },
        installation: { id: installation.id, platform: 'ANDROID', appVersion: req.body.appVersion },
        profile: safeProfile(user),
      });
    } catch (error) {
      return authError(res, req, error);
    }
  };
}

async function logout(req, res) {
  await mobileSessionRepository.revokeSession(req.mobileSession.id, 'LOGOUT');
  await authAuditService.record({
    entityType: 'MobileSession', entityId: req.mobileSession.id, action: 'MOBILE_SESSION_REVOKED',
    actorId: req.auth.userId, reason: 'LOGOUT', state: { status: 'REVOKED' },
  });
  return res.json({ success: true });
}

async function logoutAll(req, res) {
  await mobileSessionRepository.revokeUserSessions(req.auth.userId, 'LOGOUT_ALL');
  await authAuditService.record({
    entityType: 'User', entityId: req.auth.userId, action: 'ALL_MOBILE_SESSIONS_REVOKED',
    actorId: req.auth.userId, reason: 'LOGOUT_ALL', state: { status: 'REVOKED' },
  });
  return res.json({ success: true });
}

async function revokeInstallation(req, res) {
  const revoked = await mobileSessionRepository.revokeInstallation(req.params.installationId, req.auth.userId, 'LOST_DEVICE');
  if (!revoked) return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Installation not found', retryable: false, requestId: req.requestId } });
  await authAuditService.record({
    entityType: 'MobileInstallation', entityId: req.params.installationId, action: 'MOBILE_INSTALLATION_REVOKED',
    actorId: req.auth.userId, reason: 'LOST_DEVICE', state: { status: 'REVOKED' },
  });
  return res.json({ success: true });
}

async function adminRevokeInstallation(req, res) {
  if (req.auth.role !== 'ADMIN') return res.status(403).json({ success: false, error: { code: 'ROLE_NOT_ALLOWED', message: 'Admin access is required', retryable: false, requestId: req.requestId } });
  const revoked = await mobileSessionRepository.revokeInstallationAsAdmin(req.params.installationId, 'ADMIN_LOST_DEVICE_REVOKE');
  if (!revoked) return res.status(404).json({ success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Installation not found', retryable: false, requestId: req.requestId } });
  await authAuditService.record({
    entityType: 'MobileInstallation', entityId: req.params.installationId, action: 'MOBILE_INSTALLATION_REVOKED',
    actorId: req.auth.userId, reason: 'ADMIN_LOST_DEVICE_REVOKE', state: { status: 'REVOKED' },
  });
  return res.json({ success: true });
}

async function bootstrap(req, res) {
  const config = req.app.get('config');
  const user = req.authUser;
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 14);
  return res.json({
    success: true,
    apiVersion: 'v1',
    serverTime: now.toISOString(),
    operatingTimeZone: config.operatingTimeZone,
    app: req.mobileSession.installation.app,
    profile: safeProfile(user),
    operatingCenter: user.homeCenter ? {
      id: user.homeCenter.id,
      code: user.homeCenter.code || user.homeCenter.id,
      displayName: user.homeCenter.name,
    } : null,
    capabilities: capabilities(req.mobileSession.installation.app, user.role),
    assignmentWindow: { from: from.toISOString(), to: to.toISOString() },
    assignments: [],
    featureFlags: { chat: false, foregroundLocation: false, issueReporting: false },
    appVersions: { minimum: config.mobile.minimumVersion, recommended: config.mobile.recommendedVersion },
    sync: { cursor: Buffer.from(JSON.stringify({ at: now.toISOString() })).toString('base64url') },
    policies: {
      offlineGraceSeconds: Math.floor(config.mobile.absoluteTimeoutMs / 1000),
      terminalCacheSeconds: 86400,
      locationIntervalSeconds: 60,
      locationAccuracyMetres: 100,
      backgroundLocationEnabled: false,
    },
  });
}

module.exports = { adminRevokeInstallation, bootstrap, login, logout, logoutAll, revokeInstallation };
