const crypto = require('crypto');
const passwordRecoveryRepository = require('../src/repositories/passwordRecoveryRepository');
const userRepository = require('../src/repositories/userRepository');
const { hashPassword, validatePassword } = require('./passwordService');
const { normalizeEmail, normalizePhone, phoneVariants } = require('./identityService');
const recoveryDeliveryService = require('./recoveryDeliveryService');
const authAuditService = require('./authAuditService');

let developmentHashSecret;
const GENERIC_MESSAGE = 'If the account is eligible, recovery instructions have been sent.';
const EMPLOYEE_ROLES = new Set(['ADMIN', 'SALES', 'FLEET_MANAGER', 'PILOT']);

class RecoveryError extends Error {
  constructor(message = 'The recovery challenge is invalid or has expired', code = 'RECOVERY_CHALLENGE_INVALID') {
    super(message);
    this.name = 'RecoveryError';
    this.code = code;
    this.status = 400;
  }
}

function secret(config) {
  if (config.recovery.hashSecret) return config.recovery.hashSecret;
  if (!developmentHashSecret) developmentHashSecret = crypto.randomBytes(48).toString('base64url');
  return developmentHashSecret;
}

function hmac(config, value) {
  return crypto.createHmac('sha256', secret(config)).update(String(value)).digest('hex');
}

function codeHash(config, challengeId, code) {
  return hmac(config, `${challengeId}:${String(code || '')}`);
}

function hashesMatch(left, right) {
  const first = Buffer.from(String(left || ''));
  const second = Buffer.from(String(right || ''));
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

function eligible(user, roles) {
  return Boolean(user && roles.has(user.role) && user.active !== false && !user.archivedAt);
}

async function findEmployee(identifier) {
  if (identifier.includes('@')) return userRepository.findIdentityByEmail(normalizeEmail(identifier));
  try {
    return userRepository.findIdentityByPhone(phoneVariants(identifier), [...EMPLOYEE_ROLES]);
  } catch {
    return null;
  }
}

function normalizedIdentifier(identifier) {
  if (String(identifier).includes('@')) return `email:${normalizeEmail(identifier)}`;
  try { return `phone:${normalizePhone(identifier)}`; } catch { return 'invalid'; }
}

function deliveryCandidates(user, requestedChannel) {
  const available = [];
  if (user?.phone && user.phoneVerifiedAt) {
    available.push({ channel: 'WHATSAPP', destination: user.phone });
    available.push({ channel: 'SMS', destination: user.phone });
  }
  if (user?.email && user.emailVerifiedAt) available.push({ channel: 'EMAIL', destination: user.email });
  const requested = String(requestedChannel || '').trim().toUpperCase();
  if (!requested) return available;
  return [...available].sort((left, right) => Number(right.channel === requested) - Number(left.channel === requested));
}

async function auditChallenge(challenge, action, state, reason) {
  await authAuditService.record({
    entityType: 'PasswordRecoveryChallenge',
    entityId: challenge.id,
    action,
    reason,
    state,
  });
}

function enqueueEmployeeDelivery({
  challenge: issuedChallenge,
  code,
  requestedChannel,
  user,
}) {
  recoveryDeliveryService.enqueue(async () => {
    let deliveryStatus = 'UNAVAILABLE';
    let channel = 'NONE';
    for (const candidateDelivery of deliveryCandidates(user, requestedChannel)) {
      channel = candidateDelivery.channel;
      try {
        const result = await recoveryDeliveryService.deliver({
          challengeId: issuedChallenge.id,
          channel,
          destination: candidateDelivery.destination,
          code,
          expiresAt: issuedChallenge.expiresAt,
        });
        deliveryStatus = ['SENT', 'MOCKED'].includes(result?.status) ? result.status : 'UNAVAILABLE';
      } catch {
        deliveryStatus = 'FAILED';
      }
      if (['SENT', 'MOCKED'].includes(deliveryStatus)) break;
    }
    const challenge = await passwordRecoveryRepository.updateDelivery(
      issuedChallenge.id,
      channel,
      deliveryStatus,
    );
    await auditChallenge(challenge, 'RECOVERY_DELIVERY_ATTEMPTED', {
      channel,
      deliveryStatus,
      status: challenge.revokedAt ? 'REVOKED' : 'OPEN',
    });
  });
}

async function requestEmployeeRecovery({ identifier, requestedChannel }, config) {
  const rawIdentifier = String(identifier || '').trim();
  const candidate = rawIdentifier ? await findEmployee(rawIdentifier) : null;
  const user = eligible(candidate, EMPLOYEE_ROLES) ? candidate : null;

  const challengeId = crypto.randomUUID();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const challenge = await passwordRecoveryRepository.createReplacingOpenForUser({
    id: challengeId,
    userId: user?.id || null,
    expectedAuthVersion: user?.authVersion ?? null,
    identifierHash: hmac(config, normalizedIdentifier(rawIdentifier)),
    channel: 'NONE',
    deliveryStatus: 'UNAVAILABLE',
    codeHash: codeHash(config, challengeId, code),
    maxAttempts: config.recovery.maxAttempts,
    expiresAt: new Date(Date.now() + config.recovery.codeTtlMs),
  }, EMPLOYEE_ROLES);

  await auditChallenge(challenge, 'RECOVERY_CHALLENGE_CREATED', {
    channel: 'PENDING',
    deliveryStatus: 'QUEUED',
    replacedChallengesRevoked: challenge.replacedChallengeCount,
    status: 'OPEN',
  });
  const boundUser = challenge.userId ? user : null;
  enqueueEmployeeDelivery({
    challenge,
    code,
    requestedChannel,
    user: boundUser,
  });
  return { success: true, message: GENERIC_MESSAGE, challengeId };
}

async function createBusinessPhoneGrant({ phone, externalProofHash }, config) {
  if (!String(externalProofHash || '').trim()) throw new RecoveryError();
  const candidate = await userRepository.findIdentityByPhone(phoneVariants(phone), 'BUSINESS');
  const user = eligible(candidate, new Set(['BUSINESS'])) ? candidate : null;
  const businessRoles = new Set(['BUSINESS']);

  const challengeId = crypto.randomUUID();
  const resetToken = crypto.randomBytes(48).toString('base64url');
  let challenge;
  try {
    challenge = await passwordRecoveryRepository.createReplacingOpenForUser({
      id: challengeId,
      userId: user?.id || null,
      expectedAuthVersion: user?.authVersion ?? null,
      externalProofHash: String(externalProofHash).trim(),
      identifierHash: hmac(config, `phone:${normalizePhone(phone)}`),
      channel: 'FIREBASE_PHONE',
      deliveryStatus: 'VERIFIED',
      codeHash: codeHash(config, challengeId, resetToken),
      maxAttempts: config.recovery.maxAttempts,
      expiresAt: new Date(Date.now() + config.recovery.codeTtlMs),
    }, businessRoles);
  } catch (error) {
    if (error.code === 'P2002') throw new RecoveryError();
    throw error;
  }
  await auditChallenge(challenge, 'RECOVERY_PHONE_VERIFIED', { channel: challenge.channel, status: 'OPEN' });
  return { success: true, challengeId, resetToken };
}

async function failChallenge(challenge, reason) {
  const updated = await passwordRecoveryRepository.recordFailedAttempt(challenge.id, challenge.maxAttempts);
  await auditChallenge(challenge, 'RECOVERY_ATTEMPT_FAILED', {
    attempts: updated?.attempts ?? challenge.attempts,
    status: updated?.revokedAt ? 'REVOKED' : 'OPEN',
  }, reason);
  throw new RecoveryError();
}

async function completeRecovery({ challengeId, code, newPassword, allowedRoles }, config) {
  validatePassword(newPassword);
  const challenge = challengeId ? await passwordRecoveryRepository.findById(String(challengeId)) : null;
  if (!challenge || challenge.usedAt || challenge.revokedAt) throw new RecoveryError();
  if (challenge.expiresAt.getTime() <= Date.now()) {
    await passwordRecoveryRepository.revokeById(challenge.id);
    await auditChallenge(challenge, 'RECOVERY_CHALLENGE_EXPIRED', { status: 'REVOKED' }, 'EXPIRED');
    throw new RecoveryError();
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    await passwordRecoveryRepository.revokeById(challenge.id);
    throw new RecoveryError();
  }

  const suppliedHash = codeHash(config, challenge.id, code);
  if (!hashesMatch(suppliedHash, challenge.codeHash)) await failChallenge(challenge, 'INVALID_PROOF');
  const roles = allowedRoles || EMPLOYEE_ROLES;
  if (!challenge.userId || !eligible(challenge.user, roles)) await failChallenge(challenge, 'INELIGIBLE_ACCOUNT');

  const passwordHash = await hashPassword(newPassword);
  let result;
  try {
    result = await passwordRecoveryRepository.consumeAndReset(
      challenge.id,
      challenge.userId,
      challenge.expectedAuthVersion,
      challenge.codeHash,
      passwordHash,
      challenge.maxAttempts,
      roles,
    );
  } catch (error) {
    if (error.code === 'RECOVERY_CHALLENGE_CONFLICT') throw new RecoveryError();
    throw error;
  }
  await auditChallenge(result.challenge, 'RECOVERY_CHALLENGE_CONSUMED', {
    status: 'USED',
    sessionsRevoked: true,
    siblingChallengesRevoked: result.siblingsRevoked,
  });
  await authAuditService.record({
    entityType: 'User',
    entityId: result.user.id,
    action: 'PASSWORD_RECOVERED',
    actorId: result.user.id,
    reason: 'PASSWORD_RECOVERY',
    state: { sessionsRevoked: true },
  });
  return { userId: result.user.id };
}

module.exports = {
  EMPLOYEE_ROLES,
  GENERIC_MESSAGE,
  RecoveryError,
  completeRecovery,
  createBusinessPhoneGrant,
  requestEmployeeRecovery,
};
