const prisma = require('../lib/prisma');

const challengeSelect = {
  id: true,
  userId: true,
  customerId: true,
  phoneHash: true,
  recipientLast4: true,
  purpose: true,
  codeHash: true,
  attempts: true,
  maxAttempts: true,
  expiresAt: true,
  resendAvailableAt: true,
  consumedAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      role: true,
      phone: true,
      active: true,
      archivedAt: true,
      authVersion: true,
    },
  },
};

const outboxSelect = {
  id: true,
  challengeId: true,
  channel: true,
  status: true,
  idempotencyKey: true,
  attempts: true,
  nextAttemptAt: true,
  processedAt: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  challenge: { select: challengeSelect },
};

function conflict(code = 'OTP_CHALLENGE_CONFLICT') {
  const error = new Error('Phone verification challenge is no longer valid');
  error.code = code;
  return error;
}

module.exports = {
  createReplacingOpen: async (data, delivery) => prisma.$transaction(async (transaction) => {
    const now = new Date();
    const replaced = await transaction.phoneVerificationChallenge.updateMany({
      where: {
        phoneHash: data.phoneHash,
        purpose: data.purpose,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: now },
    });
    const challenge = await transaction.phoneVerificationChallenge.create({
      data,
      select: challengeSelect,
    });
    const outbox = await transaction.otpDeliveryOutbox.create({
      data: {
        challengeId: challenge.id,
        channel: delivery.channel,
        idempotencyKey: delivery.idempotencyKey,
      },
      select: outboxSelect,
    });
    return { challenge, outbox, replacedChallengeCount: replaced.count };
  }),
  findById: (id) => prisma.phoneVerificationChallenge.findUnique({ where: { id }, select: challengeSelect }),
  findDueOutbox: (now = new Date(), take = 25) => prisma.otpDeliveryOutbox.findMany({
    where: {
      status: 'QUEUED',
      nextAttemptAt: { lte: now },
      processedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    take,
    select: outboxSelect,
  }),
  markOutboxAttempted: (id, { status, lastError, processedAt = new Date() }) => prisma.otpDeliveryOutbox.update({
    where: { id },
    data: {
      status,
      attempts: { increment: 1 },
      lastError: lastError || null,
      processedAt: ['SENT', 'MOCKED', 'DISABLED', 'DEAD_LETTER'].includes(status) ? processedAt : null,
      nextAttemptAt: ['FAILED'].includes(status) ? new Date(processedAt.getTime() + 60_000) : processedAt,
    },
    select: outboxSelect,
  }),
  recordDeliveryAttempt: (data) => prisma.verificationDeliveryAttempt.create({ data }),
  rotateCodeAndEnqueueResend: (id, { codeHash, resendAvailableAt, channel, idempotencyKey }, now = new Date()) => prisma.$transaction(async (transaction) => {
    const updated = await transaction.phoneVerificationChallenge.updateMany({
      where: {
        id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        resendAvailableAt: { lte: now },
      },
      data: { codeHash, resendAvailableAt },
    });
    if (updated.count !== 1) return null;
    const challenge = await transaction.phoneVerificationChallenge.findUnique({ where: { id }, select: challengeSelect });
    const outbox = await transaction.otpDeliveryOutbox.create({
      data: { challengeId: id, channel, idempotencyKey },
      select: outboxSelect,
    });
    return { challenge, outbox };
  }),
  revokeById: (id, revokedAt = new Date()) => prisma.phoneVerificationChallenge.updateMany({
    where: { id, consumedAt: null, revokedAt: null },
    data: { revokedAt },
  }),
  recordFailedAttempt: (id, maxAttempts, now = new Date()) => prisma.$transaction(async (transaction) => {
    const incremented = await transaction.phoneVerificationChallenge.updateMany({
      where: {
        id,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });
    if (incremented.count !== 1) return null;
    const challenge = await transaction.phoneVerificationChallenge.findUnique({ where: { id }, select: challengeSelect });
    if (challenge && challenge.attempts >= challenge.maxAttempts) {
      await transaction.phoneVerificationChallenge.updateMany({
        where: { id, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      challenge.revokedAt = now;
    }
    return challenge;
  }),
  consume: (id, expectedCodeHash, purpose, allowedRoles, consumedAt = new Date()) => prisma.$transaction(async (transaction) => {
    const challenge = await transaction.phoneVerificationChallenge.findUnique({ where: { id }, select: challengeSelect });
    if (!challenge) throw conflict();
    const roles = [...allowedRoles];
    const remainsEligible = Boolean(
      challenge.user
      && roles.includes(challenge.user.role)
      && challenge.user.active
      && !challenge.user.archivedAt,
    );
    if (!remainsEligible) throw conflict('OTP_ACCOUNT_INELIGIBLE');
    const consumed = await transaction.phoneVerificationChallenge.updateMany({
      where: {
        id,
        purpose,
        codeHash: expectedCodeHash,
        consumedAt: null,
        revokedAt: null,
        expiresAt: { gt: consumedAt },
        attempts: { lt: challenge.maxAttempts },
      },
      data: { consumedAt },
    });
    if (consumed.count !== 1) throw conflict();
    const consumedChallenge = await transaction.phoneVerificationChallenge.findUnique({ where: { id }, select: challengeSelect });
    return consumedChallenge;
  }),
  deleteAll: () => prisma.phoneVerificationChallenge.deleteMany(),
};
