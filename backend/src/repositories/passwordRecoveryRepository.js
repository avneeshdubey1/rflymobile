const prisma = require('../lib/prisma');

module.exports = {
  create: (data) => prisma.passwordRecoveryChallenge.create({ data }),
  findById: (id) => prisma.passwordRecoveryChallenge.findUnique({ where: { id }, include: { user: true } }),
  recordFailedAttempt: (id, attempts, revokedAt = null) => prisma.passwordRecoveryChallenge.update({
    where: { id },
    data: { attempts, ...(revokedAt ? { revokedAt } : {}) },
  }),
  consumeAndReset: (id, userId, passwordHash, usedAt = new Date()) => prisma.$transaction(async (transaction) => {
    const challenge = await transaction.passwordRecoveryChallenge.update({ where: { id }, data: { usedAt } });
    const user = await transaction.user.update({
      where: { id: userId },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: usedAt, revokeReason: 'PASSWORD_RECOVERY' },
    });
    return { challenge, user };
  }),
  revokeOpenForUser: (userId, revokedAt = new Date()) => prisma.passwordRecoveryChallenge.updateMany({
    where: { userId, usedAt: null, revokedAt: null },
    data: { revokedAt },
  }),
  deleteAll: () => prisma.passwordRecoveryChallenge.deleteMany(),
};
