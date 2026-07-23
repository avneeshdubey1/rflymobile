const prisma = require('../lib/prisma');

const challengeSelect = {
  id: true,
  userId: true,
  expectedAuthVersion: true,
  externalProofHash: true,
  identifierHash: true,
  channel: true,
  deliveryStatus: true,
  codeHash: true,
  attempts: true,
  maxAttempts: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
  createdAt: true,
  user: {
    select: {
      id: true,
      role: true,
      active: true,
      archivedAt: true,
      authVersion: true,
    },
  },
};

async function lockUser(transaction, userId) {
  const rows = await transaction.$queryRaw`
    SELECT "id"
    FROM "User"
    WHERE "id" = ${userId}
    FOR UPDATE
  `;
  return rows.length === 1;
}

function conflict() {
  const error = new Error('Recovery challenge is no longer valid');
  error.code = 'RECOVERY_CHALLENGE_CONFLICT';
  return error;
}

module.exports = {
  createReplacingOpenForUser: async (data, eligibleRoles) => {
    if (!data.userId) {
      const challenge = await prisma.passwordRecoveryChallenge.create({
        data: { ...data, expectedAuthVersion: null },
        select: challengeSelect,
      });
      return { ...challenge, replacedChallengeCount: 0 };
    }

    const roles = [...eligibleRoles];
    return prisma.$transaction(async (transaction) => {
      const userExists = await lockUser(transaction, data.userId);
      const user = userExists
        ? await transaction.user.findUnique({
          where: { id: data.userId },
          select: {
            id: true,
            role: true,
            active: true,
            archivedAt: true,
            authVersion: true,
          },
        })
        : null;
      const remainsEligible = Boolean(
        user
        && user.authVersion === data.expectedAuthVersion
        && user.active
        && !user.archivedAt
        && roles.includes(user.role),
      );

      if (!remainsEligible) {
        const challenge = await transaction.passwordRecoveryChallenge.create({
          data: {
            ...data,
            userId: null,
            expectedAuthVersion: null,
          },
          select: challengeSelect,
        });
        return { ...challenge, replacedChallengeCount: 0 };
      }

      const replaced = await transaction.passwordRecoveryChallenge.updateMany({
        where: { userId: user.id, usedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      const challenge = await transaction.passwordRecoveryChallenge.create({
        data: {
          ...data,
          expectedAuthVersion: user.authVersion,
        },
        select: challengeSelect,
      });
      return { ...challenge, replacedChallengeCount: replaced.count };
    });
  },
  findById: (id) => prisma.passwordRecoveryChallenge.findUnique({ where: { id }, select: challengeSelect }),
  updateDelivery: (id, channel, deliveryStatus) => prisma.passwordRecoveryChallenge.update({
    where: { id },
    data: { channel, deliveryStatus },
    select: challengeSelect,
  }),
  revokeById: (id, revokedAt = new Date()) => prisma.passwordRecoveryChallenge.updateMany({
    where: { id, usedAt: null, revokedAt: null },
    data: { revokedAt },
  }),
  recordFailedAttempt: (id, maxAttempts, now = new Date()) => prisma.$transaction(async (transaction) => {
    const incremented = await transaction.passwordRecoveryChallenge.updateMany({
      where: {
        id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
        attempts: { lt: maxAttempts },
      },
      data: { attempts: { increment: 1 } },
    });
    if (incremented.count !== 1) return null;
    const challenge = await transaction.passwordRecoveryChallenge.findUnique({ where: { id }, select: challengeSelect });
    if (challenge && challenge.attempts >= challenge.maxAttempts) {
      await transaction.passwordRecoveryChallenge.updateMany({
        where: { id, usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      challenge.revokedAt = now;
    }
    return challenge;
  }),
  consumeAndReset: (
    id,
    userId,
    expectedAuthVersion,
    expectedCodeHash,
    passwordHash,
    maxAttempts,
    eligibleRoles,
    usedAt = new Date(),
  ) => prisma.$transaction(async (transaction) => {
    if (!Number.isInteger(expectedAuthVersion)) throw conflict();
    const roles = [...eligibleRoles];
    if (!roles.length) throw conflict();

    const userExists = await lockUser(transaction, userId);
    if (!userExists) throw conflict();
    const currentUser = await transaction.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        active: true,
        archivedAt: true,
        authVersion: true,
      },
    });
    if (
      !currentUser
      || currentUser.authVersion !== expectedAuthVersion
      || !currentUser.active
      || currentUser.archivedAt
      || !roles.includes(currentUser.role)
    ) {
      throw conflict();
    }

    const consumed = await transaction.passwordRecoveryChallenge.updateMany({
      where: {
        id,
        userId,
        expectedAuthVersion,
        codeHash: expectedCodeHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: usedAt },
        attempts: { lt: maxAttempts },
      },
      data: { usedAt },
    });
    if (consumed.count !== 1) throw conflict();

    const changedUser = await transaction.user.updateMany({
      where: {
        id: userId,
        authVersion: expectedAuthVersion,
        active: true,
        archivedAt: null,
        role: { in: roles },
      },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    if (changedUser.count !== 1) throw conflict();
    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, active: true, archivedAt: true, authVersion: true },
    });
    await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: usedAt, revokeReason: 'PASSWORD_RECOVERY' },
    });
    const siblings = await transaction.passwordRecoveryChallenge.updateMany({
      where: {
        userId,
        id: { not: id },
        usedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: usedAt },
    });
    const challenge = await transaction.passwordRecoveryChallenge.findUnique({ where: { id }, select: challengeSelect });
    return { challenge, siblingsRevoked: siblings.count, user };
  }),
  deleteAll: () => prisma.passwordRecoveryChallenge.deleteMany(),
};
