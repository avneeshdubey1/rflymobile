const systemRepository = require('../src/repositories/systemRepository');
const prisma = require('../src/lib/prisma');

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development demo preparation is disabled in production');
  const result = await systemRepository.prepareDevelopmentDemo();
  console.log(`Removed ${result.removedUsers} test account fixture${result.removedUsers === 1 ? '' : 's'} and refreshed demo configuration.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
