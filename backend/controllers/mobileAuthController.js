const userRepository = require('../src/repositories/userRepository');
const mobileSessionRepository = require('../src/repositories/mobileSessionRepository');
const mobileSessionService = require('../services/mobileSessionService');
const authAuditService = require('../services/authAuditService');
const mobileAssignmentRepository = require('../src/repositories/mobileAssignmentRepository');
const pilotAvailabilityRepository = require('../src/repositories/pilotAvailabilityRepository');
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
    pilotAvailabilityState: user.pilotAvailabilityState,
  };
}

function capabilities(app, role) {
  if (app === 'PILOT_FIELD' && role === 'PILOT') {
    return ['PILOT_ASSIGNMENTS_READ', 'COPILOT_SELECT', 'MISSION_MUTATE', 'ISSUE_REPORT', 'FOREGROUND_LOCATION'];
  }
  const byRole = {
    ADMIN: ['OPERATIONS_OVERVIEW', 'CUSTOMER_READ', 'SALES_INTAKE', 'FLEET_SCHEDULE', 'CREW_OVERRIDE'],
    FLEET_MANAGER: ['OPERATIONS_OVERVIEW', 'CUSTOMER_READ', 'FLEET_SCHEDULE'],
    SALES: ['OPERATIONS_OVERVIEW', 'CUSTOMER_READ', 'SALES_INTAKE'],
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
      if (!mobileSessionService.APP_ROLES[app]?.has(user.role) || !user.active || user.archivedAt || ['FARMER', 'BUSINESS'].includes(user.role)) {
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
  try {
    const config = req.app.get('config');
    const user = req.authUser;
    const now = new Date();
    const from = new Date(now);
    from.setUTCDate(from.getUTCDate() - 1);
    const to = new Date(now);
    to.setUTCDate(to.getUTCDate() + 14);
    const assignments = req.mobileSession.installation.app === 'PILOT_FIELD'
      ? await mobileAssignmentRepository.listForPilot({ pilotId: user.id, from: from.toISOString(), to: to.toISOString(), now })
      : [];
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
    assignments,
    featureFlags: { chat: false, foregroundLocation: config.mobile.foregroundLocationEnabled, issueReporting: true },
    appVersions: { minimum: config.mobile.minimumVersion, recommended: config.mobile.recommendedVersion },
    sync: { cursor: await mobileAssignmentRepository.cursorForPilot(user.id, now) },
    policies: {
      offlineGraceSeconds: Math.floor(config.mobile.absoluteTimeoutMs / 1000),
      terminalCacheSeconds: 86400,
      locationIntervalSeconds: config.mobile.locationIntervalSeconds,
      locationAccuracyMetres: config.mobile.locationAccuracyMetres,
      backgroundLocationEnabled: false,
    },
    });
  } catch (error) {
    return authError(res, req, error);
  }
}

async function updatePilotAvailability(req, res) {
  try {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
      || Object.keys(req.body).some((field) => field !== 'state')) {
      throw new mobileSessionService.MobileAuthError('Availability request is invalid', 'VALIDATION_FAILED', 400);
    }
    const user = await pilotAvailabilityRepository.updateForPilot({
      pilotId: req.auth.userId,
      state: req.body.state,
    });
    return res.json({ success: true, profile: safeProfile(user) });
  } catch (error) {
    return authError(res, req, error);
  }
}


async function requestFarmerOtp(req, res) {
  try {
    const config = req.app.get('config');
    if (!config.mobile.enabled) throw new mobileSessionService.MobileAuthError('Mobile API is not enabled', 'MOBILE_API_DISABLED', 503);
    const result = await require('../services/phoneVerificationService').issueChallenge({
      phone: req.body.phone,
      purpose: require('../services/phoneVerificationService').PURPOSES.FARMER_MOBILE_AUTH,
    }, config);
    return res.status(202).json(result);
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const clientMessage = status >= 500
      ? 'Unable to request verification code'
      : error.message;
    return res.status(status).json({
        success: false,
        serverTime: new Date().toISOString(),
        operatingTimeZone: req.app.get('config').operatingTimeZone,
        requestId: req.requestId,
        error: {
          code: error.code || (status === 400 ? 'VALIDATION_FAILED' : 'OTP_REQUEST_FAILED'),
          message: clientMessage,
          retryable: status >= 500,
          requestId: req.requestId,
        },
    });
  }
}

async function resendFarmerOtp(req, res) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some((field) => field !== 'challengeId')
      || typeof body.challengeId !== 'string') {
      throw new mobileSessionService.MobileAuthError('Verification request is invalid', 'VALIDATION_FAILED', 400);
    }
    const result = await require('../services/phoneVerificationService').resendChallenge({
      challengeId: body.challengeId,
    }, req.app.get('config'));
    return res.status(202).json(result);
  } catch (error) {
    return authError(res, req, error);
  }
}

async function verifyFarmerOtp(req, res) {
  try {
    const config = req.app.get('config');
    if (!config.mobile.enabled) throw new mobileSessionService.MobileAuthError('Mobile API is not enabled', 'MOBILE_API_DISABLED', 503);
    
    // validate
    if (!req.body.installationKey || typeof req.body.installationKey !== 'string' || req.body.installationKey.length < 32 || req.body.installationKey.length > 256) {
      throw new mobileSessionService.MobileAuthError('Login credentials are invalid', 'VALIDATION_FAILED', 400);
    }

    const challenge = await require('../services/phoneVerificationService').verifyChallenge({
      challengeId: req.body.challengeId,
      code: req.body.code,
      purpose: require('../services/phoneVerificationService').PURPOSES.FARMER_MOBILE_AUTH,
      allowedRoles: new Set(['FARMER']),
    }, config);

    const user = challenge.userId ? await userRepository.findByPhoneForAuthentication([challenge.user.phone], 'FARMER') : null;
    if (!user || user.role !== 'FARMER' || user.active === false || user.archivedAt) {
      throw new mobileSessionService.MobileAuthError('This account cannot sign in', 'ROLE_NOT_ALLOWED', 403);
    }

    const installation = await mobileSessionService.registerInstallation({
      user,
      app: 'OPERATIONS',
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
      state: { userId: user.id, role: user.role, app: 'OPERATIONS', installationId: installation.id, status: 'ACTIVE' },
    });
    
    return res.json({
        success: true,
        serverTime: new Date().toISOString(),
        operatingTimeZone: config.operatingTimeZone,
        requestId: req.requestId,
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
    if (error.code && error.code.includes('OTP')) {
        error.status = error.status || 401;
    }
    return authError(res, req, error);
  }
}

async function businessLogin(req, res) {
  try {
    const config = req.app.get('config');
    if (!config.mobile.enabled) throw new mobileSessionService.MobileAuthError('Mobile API is not enabled', 'MOBILE_API_DISABLED', 503);
    validateLoginRequest(req.body);
    
    const versionComparison = compareVersions(req.body.appVersion, config.mobile.minimumVersion);
    if (versionComparison === null) throw new mobileSessionService.MobileAuthError('A valid app version is required', 'VALIDATION_FAILED', 400);
    if (versionComparison < 0) throw new mobileSessionService.MobileAuthError('Install a supported app version before continuing', 'CLIENT_UPGRADE_REQUIRED', 426);
    
    const email = require('../services/identityService').normalizeEmail(req.body.email);
    const user = email ? await userRepository.findByEmailForAuthentication(email) : null;
    const passwordValid = await require('../services/passwordService').verifyPassword(req.body.password, user?.passwordHash || require('../services/passwordService').INVALID_ACCOUNT_PASSWORD_HASH);
    
    if (!passwordValid) throw new mobileSessionService.MobileAuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    if (!user || user.role !== 'BUSINESS' || !user.active || user.archivedAt) {
      throw new mobileSessionService.MobileAuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const installation = await mobileSessionService.registerInstallation({
      user,
      app: 'OPERATIONS',
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
      state: { userId: user.id, role: user.role, app: 'OPERATIONS', installationId: installation.id, status: 'ACTIVE' },
    });
    
    return res.json({
        success: true,
        serverTime: new Date().toISOString(),
        operatingTimeZone: config.operatingTimeZone,
        requestId: req.requestId,
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
}

module.exports = {
  requestFarmerOtp,
  resendFarmerOtp,
  verifyFarmerOtp,
  businessLogin, adminRevokeInstallation, bootstrap, login, logout, logoutAll, revokeInstallation, updatePilotAvailability };
