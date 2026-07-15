const prisma = require('../lib/prisma');

const includeUser = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      authVersion: true,
      archivedAt: true,
    },
  },
};

module.exports = {
  create: (data) => prisma.authSession.create({ data, include: includeUser }),
  findByTokenHash: (tokenHash) => prisma.authSession.findUnique({ where: { tokenHash }, include: includeUser }),
  touch: (id, data) => prisma.authSession.update({ where: { id }, data, include: includeUser }),
  revokeById: (id, revokeReason, revokedAt = new Date()) => prisma.authSession.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt, revokeReason },
  }),
  revokeAllForUser: (userId, revokeReason, revokedAt = new Date()) => prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt, revokeReason },
  }),
  deleteAll: () => prisma.authSession.deleteMany(),
};
