const crypto = require('crypto');
const userRepository = require('../src/repositories/userRepository');
const authSessionRepository = require('../src/repositories/authSessionRepository');
const { hashPassword, INVALID_ACCOUNT_PASSWORD_HASH, needsRehash, verifyPassword } = require('../services/passwordService');
const { verifiedFirebasePhone } = require('../services/firebasePhoneService');
const { normalizeEmail, phoneVariants } = require('../services/identityService');
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
    const phone = await verifiedFirebasePhone(req.body.idToken);
    const user = await userRepository.findByPhoneForAuthentication(phoneVariants(phone), 'FARMER');
    if (!user) {
      return res.status(404).json({ error: 'No Farmer account is registered for this phone number', code: 'FARMER_NOT_REGISTERED' });
    }
    if (!accountCanLogin(user, FARMER_ROLES)) {
      return res.status(401).json({ error: 'This account cannot sign in' });
    }
    const created = await establishSession(req, res, user, { allowedRoles: FARMER_ROLES });
    await recordSessionCreated(created.session);
    return res.json({ success: true, user: publicUser(created.session.user) });
  } catch (error) {
    console.error('Farmer login failed', { error: error.name, code: error.code });
    const status = error.status === 503 ? 503 : 401;
    return res.status(status).json({ error: status === 503 ? error.message : 'Invalid or expired phone verification' });
  }
};

exports.completeFarmerSignup = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const village = String(req.body.village || '').trim();
    const district = String(req.body.district || '').trim();
    if (!req.body.idToken || !name || !village || !district) {
      return res.status(400).json({ error: 'Name, village and district are required' });
    }
    const phone = await verifiedFirebasePhone(req.body.idToken);
    if (await userRepository.findByPhoneForAuthentication(phoneVariants(phone))) {
      return res.status(409).json({ error: 'A user is already registered with this phone number', code: 'PHONE_ALREADY_REGISTERED' });
    }

    const user = await userRepository.create({
      name,
      phone,
      village,
      district,
      role: 'FARMER',
      email: `${phone.slice(1)}@farmer.local`,
      passwordHash: await hashPassword(crypto.randomBytes(48).toString('base64url')),
      phoneVerifiedAt: new Date(),
    });
    const credentialSnapshot = await userRepository.findIdentityById(user.id);
    const created = await establishSession(req, res, credentialSnapshot, { allowedRoles: FARMER_ROLES });
    await recordSessionCreated(created.session);
    return res.status(201).json({ success: true, user: publicUser(created.session.user) });
  } catch (error) {
    console.error('Farmer signup failed', { error: error.name, code: error.code });
    const status = error.status || (error.code === 'P2002' ? 409 : 500);
    return res.status(status).json({ error: status === 503 ? error.message : status === 409 ? 'This phone number is already registered' : 'Signup failed' });
  }
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
