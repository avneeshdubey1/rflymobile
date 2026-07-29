const prisma = require('../lib/prisma');

const leadSummarySelect = {
  id: true,
  acreage: true,
  cropType: true,
  farmerAddress: true,
  status: true,
  intakeChannel: true,
  preferredLanguage: true,
  createdAt: true,
  processedAt: true,
  matchedCenter: { select: { id: true, name: true } },
  assignment: {
    select: {
      id: true,
      scheduledDate: true,
      acceptedAt: true,
      startedAt: true,
      completedAt: true,
      actualAcreage: true,
      hasDiscrepancy: true,
    },
  },
};

module.exports = {
  findCustomerByFarmerUserId: (farmerUserId) => prisma.customer.findUnique({
    where: { farmerUserId },
    select: {
      id: true,
      displayName: true,
      preferredLanguage: true,
      village: true,
      district: true,
      createdAt: true,
    },
  }),
  findFarmerLeads: (customerId) => prisma.lead.findMany({
    where: { customerId },
    select: leadSummarySelect,
    orderBy: { createdAt: 'desc' },
  }),
  findBusinessMemberships: (userId) => prisma.businessMembership.findMany({
    where: {
      userId,
      active: true,
      organization: { active: true },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          gstNo: true,
          address: true,
          active: true,
          leads: {
            select: leadSummarySelect,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  }),
};
