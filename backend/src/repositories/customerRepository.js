const prisma = require('../lib/prisma');

const includeRecentLeads = {
  leads: {
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      id: true,
      status: true,
      acreage: true,
      cropType: true,
      intakeChannel: true,
      createdAt: true,
      matchedCenter: { select: { id: true, name: true } },
    },
  },
};

const includeRecentLeadsAndPortalUser = {
  ...includeRecentLeads,
  farmerPortalUser: {
    select: {
      id: true,
      role: true,
      active: true,
      archivedAt: true,
      phone: true,
    },
  },
};

function searchableWhere(query) {
  const value = String(query || '').trim();
  if (!value) return {};
  return {
    OR: [
      { displayName: { contains: value, mode: 'insensitive' } },
      { phone: { contains: value } },
      { village: { contains: value, mode: 'insensitive' } },
      { mandal: { contains: value, mode: 'insensitive' } },
      { district: { contains: value, mode: 'insensitive' } },
      { state: { contains: value, mode: 'insensitive' } },
      { subscriptionCardNumber: { contains: value, mode: 'insensitive' } },
      { kharifCrop: { contains: value, mode: 'insensitive' } },
      { rabiCrop: { contains: value, mode: 'insensitive' } },
      { summerCrop: { contains: value, mode: 'insensitive' } },
    ],
  };
}

module.exports = {
  create: (data) => prisma.customer.create({ data }),
  findById: (id) => prisma.customer.findUnique({ where: { id }, include: includeRecentLeads }),
  findByFarmerUserId: (farmerUserId) => prisma.customer.findUnique({ where: { farmerUserId }, include: includeRecentLeads }),
  findByPhone: (phone) => prisma.customer.findUnique({ where: { phone }, include: includeRecentLeads }),
  search: ({ query, take = 25 } = {}) => prisma.customer.findMany({
    where: searchableWhere(query),
    include: includeRecentLeads,
    orderBy: { updatedAt: 'desc' },
    take,
  }),
  update: (id, data) => prisma.customer.update({ where: { id }, data, include: includeRecentLeads }),
  enableFarmerPortalAccess: (customerId, createUserData) => prisma.$transaction(async (transaction) => {
    const customer = await transaction.customer.findUnique({
      where: { id: customerId },
      include: includeRecentLeadsAndPortalUser,
    });
    if (!customer) return null;
    if (customer.farmerUserId) return { customer, createdUser: false, linkedExistingUser: true };

    const existingUser = await transaction.user.findUnique({
      where: { phone: customer.phone },
      select: {
        id: true,
        role: true,
        active: true,
        archivedAt: true,
      },
    });
    if (existingUser) {
      if (existingUser.role !== 'FARMER' || !existingUser.active || existingUser.archivedAt) {
        const error = new Error('This phone number belongs to an account that cannot be linked as a Farmer portal user');
        error.code = 'PORTAL_PHONE_ACCOUNT_CONFLICT';
        error.status = 409;
        throw error;
      }
      const updated = await transaction.customer.update({
        where: { id: customerId },
        data: { farmerUserId: existingUser.id },
        include: includeRecentLeadsAndPortalUser,
      });
      return { customer: updated, createdUser: false, linkedExistingUser: true };
    }

    const user = await transaction.user.create({
      data: createUserData,
      select: { id: true },
    });
    const updated = await transaction.customer.update({
      where: { id: customerId },
      data: { farmerUserId: user.id },
      include: includeRecentLeadsAndPortalUser,
    });
    return { customer: updated, createdUser: true, linkedExistingUser: false };
  }),
  deleteMany: (where = {}) => prisma.customer.deleteMany({ where }),
};
