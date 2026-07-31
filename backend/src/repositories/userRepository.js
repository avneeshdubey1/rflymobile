const prisma = require('../lib/prisma');
const { normalizePhone } = require('../../services/identityService');

const safeSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  preferredLanguage: true,
  preferences: true,
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
  businessName: true,
  gstNo: true,
  contactPerson: true,
  address: true,
};

const identitySelect = {
  ...safeSelect,
  authVersion: true,
};

const authenticationSelect = {
  ...identitySelect,
  passwordHash: true,
};

function normalizedUserData(data) {
  if (!Object.hasOwn(data, 'phone')) return data;
  const rawPhone = data.phone;
  return {
    ...data,
    phone: rawPhone === null || rawPhone === undefined || String(rawPhone).trim() === ''
      ? null
      : normalizePhone(rawPhone),
  };
}

function canonicalPhone(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return normalizePhone(candidate);
}

function roleMatches(user, roles) {
  if (!roles) return true;
  const allowedRoles = new Set(Array.isArray(roles) ? roles : [roles]);
  return allowedRoles.has(user.role);
}

async function findUniqueByPhone(phones, select, roles) {
  const user = await prisma.user.findUnique({
    where: { phone: canonicalPhone(phones) },
    select,
  });
  return user && roleMatches(user, roles) ? user : null;
}

async function updateSecuritySensitive(id, data, revokeReason) {
  return prisma.$transaction(async (transaction) => {
    const changedAt = new Date();
    const user = await transaction.user.update({
      where: { id },
      data: { ...normalizedUserData(data), authVersion: { increment: 1 } },
      select: safeSelect,
    });
    await transaction.authSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: changedAt, revokeReason },
    });
    await transaction.passwordRecoveryChallenge.updateMany({
      where: { userId: id, usedAt: null, revokedAt: null },
      data: { revokedAt: changedAt },
    });
    return user;
  });
}

module.exports = {
  create: (data) => prisma.user.create({ data: normalizedUserData(data), select: safeSelect }),
  findAll: (where = {}) => prisma.user.findMany({ where, select: safeSelect, orderBy: { createdAt: 'desc' } }),
  findById: (id) => prisma.user.findUnique({ where: { id }, select: safeSelect }),
  findIdentityById: (id) => prisma.user.findUnique({ where: { id }, select: identitySelect }),
  findByEmail: (email) => prisma.user.findUnique({ where: { email }, select: safeSelect }),
  findIdentityByEmail: (email) => prisma.user.findUnique({ where: { email }, select: identitySelect }),
  findByPhone: (phone) => findUniqueByPhone(phone, safeSelect),
  findIdentityByPhone: (phones, roles) => findUniqueByPhone(phones, identitySelect, roles),
  findByEmailForAuthentication: (email) => prisma.user.findUnique({
    where: { email },
    select: authenticationSelect,
  }),
  findByPhoneForAuthentication: (phones, roles) => findUniqueByPhone(phones, authenticationSelect, roles),
  findCredentialRecords: () => prisma.user.findMany({ select: { id: true, passwordHash: true } }),
  getPreferences: (id) => prisma.user.findUnique({ where: { id }, select: { id: true, preferences: true } }),
  updatePreferences: (id, preferences) => prisma.user.update({ where: { id }, data: { preferences }, select: { id: true, preferences: true } }),
  update: (id, data) => {
    const normalizedData = normalizedUserData(data);
    return (
      Object.hasOwn(normalizedData, 'role')
      || Object.hasOwn(normalizedData, 'active')
      || Object.hasOwn(normalizedData, 'archivedAt')
      || Object.hasOwn(normalizedData, 'passwordHash')
    )
      ? updateSecuritySensitive(id, normalizedData, 'IDENTITY_CHANGED')
      : prisma.user.update({ where: { id }, data: normalizedData, select: safeSelect });
  },
  // A login-time cost upgrade is valid only for the credential record that
  // was actually verified. This cannot overwrite a concurrent password reset.
  updatePasswordHashIfCurrent: async ({
    id,
    expectedPasswordHash,
    expectedAuthVersion,
    passwordHash,
  }) => {
    const result = await prisma.user.updateMany({
      where: {
        id,
        passwordHash: expectedPasswordHash,
        authVersion: expectedAuthVersion,
      },
      data: { passwordHash },
    });
    return result.count === 1;
  },
  resetPassword: (id, passwordHash, reason = 'PASSWORD_CHANGED') => updateSecuritySensitive(id, { passwordHash }, reason),
  setActive: (id, active) => updateSecuritySensitive(id, {
    active,
    archivedAt: active ? null : new Date(),
  }, active ? 'ACCOUNT_REACTIVATED' : 'ACCOUNT_DEACTIVATED'),
  archive: (id) => updateSecuritySensitive(id, { active: false, archivedAt: new Date() }, 'ACCOUNT_ARCHIVED'),
  delete: (id) => updateSecuritySensitive(id, { active: false, archivedAt: new Date() }, 'ACCOUNT_ARCHIVED'),
  hardDelete: (id) => prisma.user.delete({ where: { id }, select: safeSelect }),
  count: (where = {}) => prisma.user.count({ where }),
  deleteAll: () => prisma.user.deleteMany(),
};
