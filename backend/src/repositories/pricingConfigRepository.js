const prisma = require('../lib/prisma');

module.exports = {
  findByKey: (key) => prisma.pricingConfig.findUnique({ where: { key } }),
};
