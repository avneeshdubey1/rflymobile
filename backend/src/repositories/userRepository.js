const prisma = require('../lib/prisma');

const safeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  preferredLanguage: true,
  createdAt: true,
  homeCenterId: true,
  pilotLicenseExpiry: true,
  homeCenter: true,
  active: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  archivedAt: true,
  village: true,
  district: true,
};

async function updateSecuritySensitive(id, data, revokeReason) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      where: { id },
      data: { ...data, authVersion: { increment: 1 } },
      select: safeSelect,
    });
    await transaction.authSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason },
    });
    return user;
  });
}

module.exports = {
  create: (data) => prisma.user.create({ data, select: safeSelect }),
  findAll: (where = {}) => prisma.user.findMany({ where, select: safeSelect, orderBy: { createdAt: 'desc' } }),
  findById: (id) => prisma.user.findUnique({ where: { id }, select: safeSelect }),
  findByEmail: (email) => prisma.user.findUnique({ where: { email }, select: safeSelect }),
  findByPhone: (phone) => prisma.user.findFirst({ where: { phone }, select: safeSelect }),
  findByEmailForAuthentication: (email) => prisma.user.findUnique({
    where: { email },
    select: { ...safeSelect, passwordHash: true, authVersion: true },
  }),
  findCredentialRecords: () => prisma.user.findMany({ select: { id: true, passwordHash: true } }),
  update: (id, data) => (Object.hasOwn(data, 'role') || Object.hasOwn(data, 'active') || Object.hasOwn(data, 'passwordHash'))
    ? updateSecuritySensitive(id, data, 'IDENTITY_CHANGED')
    : prisma.user.update({ where: { id }, data, select: safeSelect }),
  // Rehashing an unchanged password during login must not revoke the session
  // that is about to be created.
  updatePasswordHash: (id, passwordHash) => prisma.user.update({ where: { id }, data: { passwordHash }, select: safeSelect }),
  resetPassword: (id, passwordHash, reason = 'PASSWORD_CHANGED') => updateSecuritySensitive(id, { passwordHash }, reason),
  setActive: (id, active) => updateSecuritySensitive(id, {
    active,
    archivedAt: active ? null : new Date(),
  }, active ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_DEACTIVATED'),
  archive: (id) => updateSecuritySensitive(id, { active: false, archivedAt: new Date() }, 'ACCOUNT_ARCHIVED'),
  delete: (id) => updateSecuritySensitive(id, { active: false, archivedAt: new Date() }, 'ACCOUNT_ARCHIVED'),
  deleteAll: () => prisma.user.deleteMany(),
};
