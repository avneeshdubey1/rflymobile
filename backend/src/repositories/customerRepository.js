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

function searchableWhere(query) {
  const value = String(query || '').trim();
  if (!value) return {};
  return {
    OR: [
      { displayName: { contains: value, mode: 'insensitive' } },
      { phone: { contains: value } },
      { village: { contains: value, mode: 'insensitive' } },
      { district: { contains: value, mode: 'insensitive' } },
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
  deleteMany: (where = {}) => prisma.customer.deleteMany({ where }),
};
