const prisma = require('../lib/prisma');

const sessionUserSelect = {
  id: true,
  name: true,
  role: true,
  employeeCode: true,
  preferredLanguage: true,
  homeCenterId: true,
  pilotAvailabilityState: true,
  authVersion: true,
  active: true,
  archivedAt: true,
  homeCenter: { select: { id: true, code: true, name: true, active: true } },
};

async function registerInstallation({ userId, app, installationKeyHash, label, maxInstallations }) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'MobileInstallation:' + userId + ':' + app}, 0))::text AS locked`;
    const existing = await transaction.mobileInstallation.findUnique({ where: { installationKeyHash } });
    if (existing && (existing.userId !== userId || existing.app !== app)) {
      return { kind: 'KEY_OWNED_BY_ANOTHER_IDENTITY' };
    }
    if (existing) {
      const installation = await transaction.mobileInstallation.update({
        where: { id: existing.id },
        data: { label, revokedAt: null, revokeReason: null, lastSeenAt: new Date() },
      });
      return { kind: 'REGISTERED', installation };
    }
    const activeCount = await transaction.mobileInstallation.count({
      where: { userId, app, revokedAt: null },
    });
    if (activeCount >= maxInstallations) return { kind: 'LIMIT_REACHED' };
    const installation = await transaction.mobileInstallation.create({
      data: { userId, app, installationKeyHash, label },
    });
    return { kind: 'REGISTERED', installation };
  });
}

async function createSession({
  installationId,
  userId,
  app,
  expectedAuthVersion,
  expectedRole,
  tokenHash,
  idleExpiresAt,
  absoluteExpiresAt,
}) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'MobileSession:' + userId}, 0))::text AS locked`;
    const [user, installation] = await Promise.all([
      transaction.user.findUnique({
        where: { id: userId },
        select: { authVersion: true, role: true, active: true, archivedAt: true },
      }),
      transaction.mobileInstallation.findUnique({ where: { id: installationId } }),
    ]);
    if (!user
      || !user.active
      || user.archivedAt
      || user.authVersion !== expectedAuthVersion
      || user.role !== expectedRole
      || !installation
      || installation.revokedAt
      || installation.userId !== userId
      || installation.app !== app) {
      return null;
    }
    const now = new Date();
    await transaction.mobileSession.updateMany({
      where: { installationId, revokedAt: null },
      data: { revokedAt: now, revokeReason: 'REAUTHENTICATED' },
    });
    await transaction.mobileInstallation.update({ where: { id: installationId }, data: { lastSeenAt: now } });
    return transaction.mobileSession.create({
      data: {
        installationId,
        userId,
        tokenHash,
        authVersion: expectedAuthVersion,
        idleExpiresAt,
        absoluteExpiresAt,
      },
    });
  });
}

function findSessionByTokenHash(tokenHash) {
  return prisma.mobileSession.findUnique({
    where: { tokenHash },
    include: {
      installation: true,
      user: { select: sessionUserSelect },
    },
  });
}

function touchSession(id, now, idleExpiresAt) {
  return prisma.mobileSession.updateMany({
    where: { id, revokedAt: null, idleExpiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
    data: { lastSeenAt: now, idleExpiresAt },
  });
}

function revokeSession(id, reason) {
  return prisma.mobileSession.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}

function revokeUserSessions(userId, reason) {
  return prisma.mobileSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: reason },
  });
}

function revokeInstallation(installationId, userId, reason) {
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const installation = await transaction.mobileInstallation.updateMany({
      where: { id: installationId, userId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    if (installation.count) {
      await transaction.mobileSession.updateMany({
        where: { installationId, revokedAt: null },
        data: { revokedAt: now, revokeReason: reason },
      });
    }
    return installation.count;
  });
}

function revokeInstallationAsAdmin(installationId, reason) {
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const installation = await transaction.mobileInstallation.updateMany({
      where: { id: installationId, revokedAt: null },
      data: { revokedAt: now, revokeReason: reason },
    });
    if (installation.count) {
      await transaction.mobileSession.updateMany({
        where: { installationId, revokedAt: null },
        data: { revokedAt: now, revokeReason: reason },
      });
    }
    return installation.count;
  });
}

module.exports = {
  createSession,
  findSessionByTokenHash,
  registerInstallation,
  revokeInstallation,
  revokeInstallationAsAdmin,
  revokeSession,
  revokeUserSessions,
  touchSession,
};
