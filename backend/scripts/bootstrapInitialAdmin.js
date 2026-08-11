const { PrismaClient } = require('@prisma/client');
const { hashPassword, validatePassword } = require('../services/passwordService');

const prisma = new PrismaClient();

const CONFIRMATION = 'RESET_TO_INITIAL_ADMIN';

function requireValue(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new Error('INITIAL_ADMIN_EMAIL must be a valid email address');
  }
  return normalized;
}

async function wipeOperationalData() {
  await prisma.otpDeliveryOutbox.deleteMany();
  await prisma.verificationDeliveryAttempt.deleteMany();
  await prisma.phoneVerificationChallenge.deleteMany();
  await prisma.passwordRecoveryChallenge.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.declinedEnquiry.deleteMany();
  await prisma.leadSprayPurpose.deleteMany();
  await prisma.paymentRecord.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.scheduleChangeLog.deleteMany();
  await prisma.notificationEscalation.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.historicalServiceRecord.deleteMany();
  await prisma.villageVisit.deleteMany();
  await prisma.sourceRecord.deleteMany();
  await prisma.customerLanguagePreference.deleteMany();
  await prisma.customerSeasonalCrop.deleteMany();
  await prisma.customerSubscription.deleteMany();
  await prisma.farmLocation.deleteMany();
  await prisma.businessMembership.deleteMany();
  await prisma.businessOrganization.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.drone.deleteMany();
  await prisma.lMV.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pricingConfig.deleteMany();
  await prisma.operatingCenter.deleteMany();
  await prisma.language.deleteMany();
  await prisma.crop.deleteMany();
  await prisma.location.deleteMany();
}

async function main() {
  if (process.env.CONFIRM_DATABASE_WIPE !== CONFIRMATION) {
    throw new Error(`Refusing to wipe data. Set CONFIRM_DATABASE_WIPE=${CONFIRMATION} to continue.`);
  }

  const name = requireValue('INITIAL_ADMIN_NAME');
  const email = normalizeEmail(requireValue('INITIAL_ADMIN_EMAIL'));
  const password = requireValue('INITIAL_ADMIN_PASSWORD');
  validatePassword(password);

  console.log('Resetting database to initial Admin-only state...');
  await wipeOperationalData();

  const admin = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
      active: true,
    },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });

  console.log(`Initial Admin created: ${admin.email}`);
  console.log('Database now contains no demo users, leads, declined enquiries, drones, centers, pricing rows, assignments, chats, or payments.');
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
