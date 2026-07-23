const prisma = require('../lib/prisma');

const includeUser = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      preferredLanguage: true,
      preferences: true,
      active: true,
      authVersion: true,
      archivedAt: true,
      village: true,
      district: true,
      businessName: true,
      gstNo: true,
      contactPerson: true,
      address: true,
    },
  },
};

module.exports = {
  create: (data) => prisma.authSession.create({ data, include: includeUser }),
  createForCredentialSnapshot: (data, snapshot) => prisma.$transaction(async (transaction) => {
    // Serialize session creation with password, role, activation, and archive
    // mutations. A mutation that commits first makes the snapshot comparison
    // fail; a mutation that commits second revokes the just-created session.
    await transaction.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${data.userId} FOR SHARE`;
    const matchingUser = await transaction.user.findFirst({
      where: {
        id: data.userId,
        authVersion: snapshot.authVersion,
        role: snapshot.role,
        active: snapshot.active,
        archivedAt: snapshot.archivedAt,
      },
      select: { id: true },
    });
    if (!matchingUser) return null;
    return transaction.authSession.create({ data, include: includeUser });
  }),
  findByTokenHash: (tokenHash) => prisma.authSession.findUnique({ where: { tokenHash }, include: includeUser }),
  touch: async (id, data, now = new Date()) => {
    const result = await prisma.authSession.updateMany({
      where: {
        id,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      data,
    });
    if (result.count !== 1) return null;
    return prisma.authSession.findUnique({ where: { id }, include: includeUser });
  },
  revokeById: (id, revokeReason, revokedAt = new Date()) => prisma.authSession.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt, revokeReason },
  }),
  revokeByTokenHash: (tokenHash, revokeReason, revokedAt = new Date()) => prisma.authSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt, revokeReason },
  }),
  revokeAllAndBumpAuthVersion: (userId, revokeReason, revokedAt = new Date()) => prisma.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      where: { id: userId },
      data: { authVersion: { increment: 1 } },
      select: { id: true, authVersion: true },
    });
    const sessions = await transaction.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt, revokeReason },
    });
    return { user, sessions };
  }),
  deleteAll: () => prisma.authSession.deleteMany(),
};
