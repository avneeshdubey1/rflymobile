const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEnvironment } = require('../config/environment');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../services/passwordService');
const otpDeliveryAdapter = require('../services/otpDeliveryAdapter');
const phoneVerificationService = require('../services/phoneVerificationService');

const runId = `${process.pid}-${Date.now()}`;
const config = loadEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  OTP_HASH_SECRET: crypto.randomBytes(48).toString('base64url'),
  OTP_DELIVERY_PROVIDER: 'test',
});
const userIds = new Set();

async function createFarmer(label) {
  const phone = `+9197${String(Date.now()).slice(-8)}`;
  const passwordHash = await hashPassword(`Otp-${crypto.randomBytes(24).toString('base64url')}`);
  const user = await prisma.user.create({
    data: {
      name: `OTP farmer ${label}`,
      email: `otp-farmer-${label}-${runId}@example.test`,
      phone,
      phoneVerifiedAt: new Date(),
      passwordHash,
      role: 'FARMER',
      village: 'Test village',
      district: 'Test district',
    },
  });
  userIds.add(user.id);
  await prisma.customer.create({
    data: {
      displayName: user.name,
      phone,
      farmerUserId: user.id,
      village: user.village,
      district: user.district,
      staffConfirmedAt: new Date(),
    },
  });
  return user;
}

test('farmer OTP issue hides raw code and consumes exactly once', async () => {
  const farmer = await createFarmer('consume-once');
  const issued = await phoneVerificationService.issueChallenge({
    phone: farmer.phone,
    purpose: phoneVerificationService.PURPOSES.FARMER_PORTAL_AUTH,
  }, config);
  assert.equal(issued.success, true);
  assert.equal(Object.hasOwn(issued, 'code'), false);

  const delivery = otpDeliveryAdapter.getLastMessageForTests(issued.challengeId);
  assert.equal(delivery.code.length, 6);

  const consumed = await phoneVerificationService.verifyChallenge({
    challengeId: issued.challengeId,
    code: delivery.code,
    purpose: phoneVerificationService.PURPOSES.FARMER_PORTAL_AUTH,
    allowedRoles: new Set(['FARMER']),
  }, config);
  assert.equal(consumed.userId, farmer.id);

  await assert.rejects(phoneVerificationService.verifyChallenge({
    challengeId: issued.challengeId,
    code: delivery.code,
    purpose: phoneVerificationService.PURPOSES.FARMER_PORTAL_AUTH,
    allowedRoles: new Set(['FARMER']),
  }, config), phoneVerificationService.OtpError);
});

test('OTP challenge enforces purpose and resend cooldown', async () => {
  const farmer = await createFarmer('purpose-cooldown');
  const issued = await phoneVerificationService.issueChallenge({
    phone: farmer.phone,
    purpose: phoneVerificationService.PURPOSES.FARMER_PORTAL_AUTH,
  }, config);
  const delivery = otpDeliveryAdapter.getLastMessageForTests(issued.challengeId);

  await assert.rejects(phoneVerificationService.verifyChallenge({
    challengeId: issued.challengeId,
    code: delivery.code,
    purpose: phoneVerificationService.PURPOSES.BUSINESS_RECOVERY,
    allowedRoles: new Set(['BUSINESS']),
  }, config), phoneVerificationService.OtpError);

  await assert.rejects(phoneVerificationService.resendChallenge({
    challengeId: issued.challengeId,
  }, config), /wait/i);
});

test.after(async () => {
  otpDeliveryAdapter.clearLastMessagesForTests();
  const trackedUserIds = [...userIds];
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: trackedUserIds } },
        { entityId: { in: trackedUserIds } },
      ],
    },
  });
  await prisma.otpDeliveryOutbox.deleteMany({
    where: { challenge: { userId: { in: trackedUserIds } } },
  });
  await prisma.verificationDeliveryAttempt.deleteMany({
    where: { challenge: { userId: { in: trackedUserIds } } },
  });
  await prisma.phoneVerificationChallenge.deleteMany({
    where: { userId: { in: trackedUserIds } },
  });
  await prisma.customer.deleteMany({ where: { farmerUserId: { in: trackedUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: trackedUserIds } } });
  await prisma.$disconnect();
});
