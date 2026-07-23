const bcrypt = require('bcryptjs');
const userRepository = require('../src/repositories/userRepository');
const prisma = require('../src/lib/prisma');
const { BCRYPT_COST } = require('../services/passwordService');

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('This development migration cannot run in production');
  const records = await userRepository.findCredentialRecords();
  let migrated = 0;
  for (const record of records) {
    if (/^\$2[aby]\$/.test(record.passwordHash)) continue;
    const passwordHash = await bcrypt.hash(record.passwordHash, BCRYPT_COST);
    await userRepository.resetPassword(record.id, passwordHash, 'DEVELOPMENT_PASSWORD_MIGRATION');
    migrated += 1;
  }
  console.log(`Migrated ${migrated} development account credential${migrated === 1 ? '' : 's'} to bcrypt.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
