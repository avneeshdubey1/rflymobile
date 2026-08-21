const prisma = require('../lib/prisma');

const orderBy = [{ sortOrder: 'asc' }, { displayName: 'asc' }, { id: 'asc' }];

module.exports = {
  listClusters: (activeOnly = true) => prisma.cluster.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy,
  }),
  findClusterById: (id) => prisma.cluster.findUnique({ where: { id } }),
  createCluster: (data) => prisma.cluster.create({ data }),
  updateCluster: (id, data) => prisma.cluster.update({ where: { id }, data }),
  listValues: (category, activeOnly = true) => prisma.masterDataValue.findMany({
    where: { category, ...(activeOnly ? { active: true } : {}) },
    orderBy,
  }),
  findValue: (category, code) => prisma.masterDataValue.findUnique({
    where: { category_code: { category, code } },
  }),
  createValue: (data) => prisma.masterDataValue.create({ data }),
  updateValue: (id, data) => prisma.masterDataValue.update({ where: { id }, data }),
  listCrops: () => prisma.crop.findMany({
    where: { active: true },
    select: { id: true, code: true, displayName: true },
    orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
  }),
  listAllCrops: () => prisma.crop.findMany({ orderBy: [{ displayName: 'asc' }, { id: 'asc' }] }),
  createCrop: (data) => prisma.crop.create({ data }),
  updateCrop: (id, data) => prisma.crop.update({ where: { id }, data }),
};
