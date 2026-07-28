const userRepository = require('../src/repositories/userRepository');
const authSessionRepository = require('../src/repositories/authSessionRepository');
const { hashPassword, INVALID_ACCOUNT_PASSWORD_HASH, needsRehash, verifyPassword } = require('../services/passwordService');
const phoneVerificationService = require('../services/phoneVerificationService');
const { normalizeEmail } = require('../services/identityService');
const authAuditService = require('../services/authAuditService');
const {
  clearSessionCookies,
  establishSession,
  publicUser,
  revokeAllForUser,
  SessionError,
} = require('../services/sessionService');
const { disconnectSessionSockets, disconnectUserSockets } = require('../middleware/auth');

const EMPLOYEE_ROLES = new Set(['ADMIN', 'SALES', 'FLEET_MANAGER', 'PILOT']);
const FARMER_ROLES = new Set(['FARMER']);

function accountCanLogin(user, allowedRoles) {
  return Boolean(user
    && allowedRoles.has(user.role)
    && user.active !== false
    && !user.archivedAt);
}

async function recordSessionCreated(session) {
  await authAuditService.record({
    entityType: 'AuthSession',
    entityId: session.id,
    action: 'SESSION_CREATED',
    actorId: session.userId,
    state: { userId: session.userId, role: session.user.role, status: 'ACTIVE' },
  });
}

exports.login = async (req, res) => {
  try {
    const identifier = normalizeEmail(req.body.email || req.body.employeeId);
    const user = identifier ? await userRepository.findByEmailForAuthentication(identifier) : null;
    const validPassword = await verifyPassword(req.body.password, user?.passwordHash || INVALID_ACCOUNT_PASSWORD_HASH);
    if (!validPassword || !accountCanLogin(user, EMPLOYEE_ROLES)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (needsRehash(user.passwordHash)) {
      const updated = await userRepository.updatePasswordHashIfCurrent({
        id: user.id,
        expectedPasswordHash: user.passwordHash,
        expectedAuthVersion: user.authVersion,
        passwordHash: await hashPassword(req.body.password),
      });
      if (!updated) throw new SessionError('Credentials changed during sign in', 'CREDENTIAL_STATE_CHANGED');
    }
    const created = await establishSession(req, res, user, { allowedRoles: EMPLOYEE_ROLES });
    await recordSessionCreated(created.session);
    return res.json({ success: true, user: publicUser(created.session.user) });
  } catch (error) {
    console.error('Employee login failed', { error: error.name, code: error.code });
    return res.status(error.status || 500).json({ error: error.status === 401 ? 'Invalid email or password' : 'Login failed' });
  }
};

exports.farmerLogin = async (req, res) => {
  try {
    const challenge = await phoneVerificationService.verifyChallenge({
      challengeId: req.body.challengeId,
      code: req.body.code,
      purpose: phoneVerificationService.PURPOSES.FARMER_PORTAL_AUTH,
      allowedRoles: FARMER_ROLES,
    }, req.app.get('config'));
    const user = challenge.userId ? await userRepository.findByPhoneForAuthentication([challenge.user.phone], 'FARMER') : null;
    if (!accountCanLogin(user, FARMER_ROLES)) {
      return res.status(401).json({ error: 'This account cannot sign in' });
    }
    const created = await establishSession(req, res, user, { allowedRoles: FARMER_ROLES });
    await recordSessionCreated(created.session);
    return res.json({ success: true, user: publicUser(created.session.user) });
  } catch (error) {
    console.error('Farmer login failed', { error: error.name, code: error.code });
    return res.status(error.status === 429 ? 429 : 401).json({ error: 'Invalid or expired phone verification', ...(error.code ? { code: error.code } : {}) });
  }
};

exports.requestFarmerOtp = async (req, res) => {
  try {
    const result = await phoneVerificationService.issueChallenge({
      phone: req.body.phone,
      purpose: phoneVerificationService.PURPOSES.FARMER_PORTAL_AUTH,
    }, req.app.get('config'));
    return res.status(202).json(result);
  } catch (error) {
    const status = /phone/i.test(error.message || '') ? 400 : error.status || 500;
    return res.status(status).json({ error: status === 400 ? error.message : 'Unable to request verification code' });
  }
};

exports.resendFarmerOtp = async (req, res) => {
  try {
    const result = await phoneVerificationService.resendChallenge({
      challengeId: req.body.challengeId,
    }, req.app.get('config'));
    return res.status(202).json(result);
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'Unable to resend verification code', ...(error.code ? { code: error.code } : {}) });
  }
};

exports.completeFarmerSignup = async (req, res) => {
  return res.status(410).json({
    error: 'Farmer self-registration is retired. Sales or Admin must create or link farmer access.',
    code: 'FARMER_SELF_REGISTRATION_RETIRED',
  });
};

exports.me = async (req, res) => res.json({ success: true, user: publicUser(req.authUser) });

exports.logout = async (req, res) => {
  const config = req.app.get('config');
  const sessionId = req.authSession?.id;
  if (sessionId) await authSessionRepository.revokeById(sessionId, 'LOGOUT');
  clearSessionCookies(res, config);
  disconnectSessionSockets(req.app.get('io'), sessionId);
  if (sessionId) {
    await authAuditService.record({
      entityType: 'AuthSession',
      entityId: sessionId,
      action: 'SESSION_REVOKED',
      actorId: req.auth.userId,
      reason: 'LOGOUT',
      state: { userId: req.auth.userId, status: 'REVOKED' },
    });
  }
  return res.json({ success: true, message: 'Signed out successfully' });
};

exports.logoutAll = async (req, res) => {
  const config = req.app.get('config');
  await revokeAllForUser(req.auth.userId, 'LOGOUT_ALL');
  clearSessionCookies(res, config);
  disconnectUserSockets(req.app.get('io'), req.auth.userId);
  await authAuditService.record({
    entityType: 'User',
    entityId: req.auth.userId,
    action: 'ALL_SESSIONS_REVOKED',
    actorId: req.auth.userId,
    reason: 'LOGOUT_ALL',
    state: { userId: req.auth.userId, status: 'REVOKED' },
  });
  return res.json({ success: true, message: 'Signed out on all devices' });
};
