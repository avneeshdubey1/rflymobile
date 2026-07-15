const { PrismaClient } = require('@prisma/client');

// A single client prevents each repository from opening its own pool.
const prisma = global.__fieldOperationsPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__fieldOperationsPrisma = prisma;
}

module.exports = prisma;
