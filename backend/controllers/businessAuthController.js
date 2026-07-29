const userRepository = require('../src/repositories/userRepository');
const { hashPassword, INVALID_ACCOUNT_PASSWORD_HASH, needsRehash, verifyPassword } = require('../services/passwordService');
const { normalizeEmail } = require('../services/identityService');
const { establishSession, publicUser, SessionError } = require('../services/sessionService');
const recoveryService = require('../services/recoveryService');
const authAuditService = require('../services/authAuditService');
const { disconnectUserSockets } = require('../middleware/auth');

const BUSINESS_ROLES = new Set(['BUSINESS']);

function canLogin(user) {
  return Boolean(user && BUSINESS_ROLES.has(user.role) && user.active !== false && !user.archivedAt);
}

exports.businessLogin = async (req, res) => {
  try {
    const identifier = normalizeEmail(req.body.email);
    const user = identifier ? await userRepository.findByEmailForAuthentication(identifier) : null;
    const validPassword = await verifyPassword(req.body.password, user?.passwordHash || INVALID_ACCOUNT_PASSWORD_HASH);
    if (!validPassword || !canLogin(user)) return res.status(401).json({ error: 'Invalid email or password' });
    if (needsRehash(user.passwordHash)) {
      const updated = await userRepository.updatePasswordHashIfCurrent({
        id: user.id,
        expectedPasswordHash: user.passwordHash,
        expectedAuthVersion: user.authVersion,
        passwordHash: await hashPassword(req.body.password),
      });
      if (!updated) throw new SessionError('Credentials changed during sign in', 'CREDENTIAL_STATE_CHANGED');
    }
    const created = await establishSession(req, res, user, { allowedRoles: BUSINESS_ROLES });
    await authAuditService.record({
      entityType: 'AuthSession',
      entityId: created.session.id,
      action: 'SESSION_CREATED',
      actorId: created.session.userId,
      state: { userId: created.session.userId, role: created.session.user.role, status: 'ACTIVE' },
    });
    return res.json({ success: true, user: publicUser(created.session.user) });
  } catch (error) {
    console.error('Business login failed', { error: error.name, code: error.code });
    return res.status(error.status || 500).json({ error: error.status === 401 ? 'Invalid email or password' : 'Login failed' });
  }
};

exports.requestRecoveryOtp = async (req, res) => {
  try {
    const result = await recoveryService.requestBusinessPhoneRecovery({
      phone: req.body.phone || req.body.mobile,
    }, req.app.get('config'));
    return res.status(202).json(result);
  } catch (error) {
    console.error('Business recovery OTP request failed', { error: error.name, code: error.code });
    const status = /phone/i.test(error.message || '') ? 400 : error.status || 500;
    return res.status(status).json({ error: status === 400 ? error.message : 'Unable to request verification code' });
  }
};

exports.completeRecovery = async (req, res) => {
  try {
    const result = await recoveryService.completeBusinessOtpRecovery({
      otpChallengeId: req.body.otpChallengeId || req.body.challengeId,
      code: req.body.code,
      newPassword: req.body.newPassword,
    }, req.app.get('config'));
    disconnectUserSockets(req.app.get('io'), result.userId);
    return res.json({ success: true, message: 'Password updated successfully. Please sign in again.' });
  } catch (error) {
    const isValidation = /between|required/i.test(error.message || '');
    return res.status(isValidation ? 400 : error.status || 500).json({
      error: isValidation ? error.message : error.status ? 'The recovery challenge is invalid or has expired' : 'Password reset failed',
      ...(error.code ? { code: error.code } : {}),
    });
  }
};
