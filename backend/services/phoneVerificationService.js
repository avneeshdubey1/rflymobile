const crypto = require('crypto');
const phoneVerificationRepository = require('../src/repositories/phoneVerificationRepository');
const userRepository = require('../src/repositories/userRepository');
const customerRepository = require('../src/repositories/customerRepository');
const { normalizePhone, phoneVariants } = require('./identityService');
const otpCrypto = require('./otpCryptoService');
const otpDeliveryAdapter = require('./otpDeliveryAdapter');
const otpDeliveryWorker = require('./otpDeliveryWorkerService');
const authAuditService = require('./authAuditService');

const GENERIC_MESSAGE = 'If the account is eligible, a verification code has been sent.';
const PURPOSES = Object.freeze({
  FARMER_PORTAL_AUTH: 'FARMER_PORTAL_AUTH',
  FARMER_MOBILE_AUTH: 'FARMER_MOBILE_AUTH',
  FARMER_PHONE_LINK: 'FARMER_PHONE_LINK',
  BUSINESS_RECOVERY: 'BUSINESS_RECOVERY',
});

class OtpError extends Error {
  constructor(message = 'The verification challenge is invalid or has expired', code = 'OTP_CHALLENGE_INVALID', status = 400) {
    super(message);
    this.name = 'OtpError';
    this.code = code;
    this.status = status;
  }
}

function ensurePurpose(purpose) {
  if (!Object.values(PURPOSES).includes(purpose)) throw new OtpError('Unsupported verification purpose', 'OTP_PURPOSE_INVALID', 400);
  return purpose;
}

function eligible(user, role) {
  return Boolean(user && user.role === role && user.active !== false && !user.archivedAt);
}

function recipientLast4(phone) {
  return phone.replace(/\D/g, '').slice(-4);
}

function channelFor(config) {
  return otpDeliveryAdapter.providerToChannel(config.otp.deliveryProvider);
}

async function findUserForPurpose(phone, purpose) {
  if (purpose === PURPOSES.FARMER_PORTAL_AUTH || purpose === PURPOSES.FARMER_MOBILE_AUTH) {
    return userRepository.findByPhoneForAuthentication(phoneVariants(phone), 'FARMER');
  }
  if (purpose === PURPOSES.BUSINESS_RECOVERY) {
    return userRepository.findByPhoneForAuthentication(phoneVariants(phone), 'BUSINESS');
  }
  return null;
}

async function audit(challenge, action, state, reason) {
  await authAuditService.record({
    entityType: 'PhoneVerificationChallenge',
    entityId: challenge.id,
    action,
    actorId: challenge.userId || null,
    reason,
    state,
  });
}

async function issueChallenge({ phone, purpose }, config) {
  const verifiedPurpose = ensurePurpose(purpose);
  const normalizedPhone = normalizePhone(phone);
  const candidate = await findUserForPurpose(normalizedPhone, verifiedPurpose);
  const role = verifiedPurpose === PURPOSES.BUSINESS_RECOVERY ? 'BUSINESS' : 'FARMER';
  const user = eligible(candidate, role) ? candidate : null;
  const customer = user?.role === 'FARMER' ? await customerRepository.findByFarmerUserId(user.id).catch(() => null) : null;
  const id = crypto.randomUUID();
  const code = otpCrypto.generateCode();
  const now = Date.now();
  const deliveryChannel = channelFor(config);
  const { challenge, outbox, replacedChallengeCount } = await phoneVerificationRepository.createReplacingOpen({
    id,
    userId: user?.id || null,
    customerId: customer?.id || null,
    phoneHash: otpCrypto.phoneHash(config, normalizedPhone),
    recipientLast4: recipientLast4(normalizedPhone),
    purpose: verifiedPurpose,
    codeHash: otpCrypto.codeHash(config, id, code),
    maxAttempts: config.otp.maxAttempts,
    expiresAt: new Date(now + config.otp.codeTtlMs),
    resendAvailableAt: new Date(now + config.otp.resendCooldownMs),
  }, {
    channel: deliveryChannel,
    idempotencyKey: `${id}:initial`,
  });

  await audit(challenge, 'OTP_CHALLENGE_CREATED', {
    purpose: challenge.purpose,
    channel: deliveryChannel,
    deliveryStatus: 'QUEUED',
    accountBound: Boolean(challenge.userId),
    replacedChallengesRevoked: replacedChallengeCount,
    status: 'OPEN',
  });
  await otpDeliveryWorker.processOne(outbox, user ? code : null);
  return { success: true, message: GENERIC_MESSAGE, challengeId: challenge.id, resendAvailableAt: challenge.resendAvailableAt };
}

async function resendChallenge({ challengeId }, config) {
  const challenge = challengeId ? await phoneVerificationRepository.findById(String(challengeId)) : null;
  if (!challenge || challenge.consumedAt || challenge.revokedAt) throw new OtpError();
  const now = new Date();
  if (challenge.expiresAt.getTime() <= now.getTime()) {
    await phoneVerificationRepository.revokeById(challenge.id, now);
    await audit(challenge, 'OTP_CHALLENGE_EXPIRED', { status: 'REVOKED' }, 'EXPIRED');
    throw new OtpError();
  }
  if (challenge.resendAvailableAt.getTime() > now.getTime()) {
    throw new OtpError('Please wait before requesting another OTP', 'OTP_RESEND_COOLDOWN', 429);
  }
  const code = otpCrypto.generateCode();
  const rotated = await phoneVerificationRepository.rotateCodeAndEnqueueResend(challenge.id, {
    codeHash: otpCrypto.codeHash(config, challenge.id, code),
    resendAvailableAt: new Date(now.getTime() + config.otp.resendCooldownMs),
    channel: channelFor(config),
    idempotencyKey: `${challenge.id}:resend:${now.getTime()}`,
  }, now);
  if (!rotated) throw new OtpError('Please wait before requesting another OTP', 'OTP_RESEND_COOLDOWN', 429);
  await audit(rotated.challenge, 'OTP_RESEND_REQUESTED', { purpose: challenge.purpose, status: 'OPEN' });
  await otpDeliveryWorker.processOne(rotated.outbox, challenge.userId ? code : null);
  return { success: true, message: GENERIC_MESSAGE };
}

async function failChallenge(challenge, reason) {
  const updated = await phoneVerificationRepository.recordFailedAttempt(challenge.id, challenge.maxAttempts);
  await audit(challenge, 'OTP_ATTEMPT_FAILED', {
    attempts: updated?.attempts ?? challenge.attempts,
    status: updated?.revokedAt ? 'REVOKED' : 'OPEN',
  }, reason);
  throw new OtpError();
}

async function verifyChallenge({ challengeId, code, purpose, allowedRoles }, config) {
  const verifiedPurpose = ensurePurpose(purpose);
  const challenge = challengeId ? await phoneVerificationRepository.findById(String(challengeId)) : null;
  if (!challenge || challenge.consumedAt || challenge.revokedAt || challenge.purpose !== verifiedPurpose) throw new OtpError();
  if (challenge.expiresAt.getTime() <= Date.now()) {
    await phoneVerificationRepository.revokeById(challenge.id);
    await audit(challenge, 'OTP_CHALLENGE_EXPIRED', { status: 'REVOKED' }, 'EXPIRED');
    throw new OtpError();
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    await phoneVerificationRepository.revokeById(challenge.id);
    throw new OtpError();
  }
  const suppliedHash = otpCrypto.codeHash(config, challenge.id, code);
  if (!otpCrypto.hashesMatch(suppliedHash, challenge.codeHash)) await failChallenge(challenge, 'INVALID_CODE');
  try {
    const consumed = await phoneVerificationRepository.consume(
      challenge.id,
      challenge.codeHash,
      verifiedPurpose,
      allowedRoles,
    );
    await audit(consumed, 'OTP_CHALLENGE_CONSUMED', {
      purpose: consumed.purpose,
      status: 'CONSUMED',
    });
    return consumed;
  } catch (error) {
    if (error.code) await failChallenge(challenge, error.code);
    throw error;
  }
}

module.exports = {
  GENERIC_MESSAGE,
  OtpError,
  PURPOSES,
  issueChallenge,
  resendChallenge,
  verifyChallenge,
};
