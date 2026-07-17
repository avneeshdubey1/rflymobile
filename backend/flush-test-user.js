const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const testNumber = process.argv[2] || '+919999999999';

async function main() {
  console.log(`Searching for test user with phone: ${testNumber}...`);
  const users = await prisma.user.findMany({ where: { phone: testNumber } });

  if (users.length === 0) {
    console.log(`No user found with phone number ${testNumber}.`);
    return;
  }

  console.log(`Found ${users.length} user(s). Flushing...`);

  for (const user of users) {
    await prisma.authSession.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Successfully deleted user ID: ${user.id} (${user.name})`);
  }

  console.log('Flush complete! You can now register with this number again.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
