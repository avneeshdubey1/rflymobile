const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const userRepository = require('../src/repositories/userRepository');
const userController = require('../controllers/userController');
const { hashPassword } = require('../services/passwordService');

const runId = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const emailSuffix = `phone-${runId}.example`;
const password = `Phone-test-${crypto.randomBytes(18).toString('base64url')}`;

function responseCapture() {
  const capture = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return capture;
}

async function invokeAddUser(admin, body) {
  const response = responseCapture();
  await userController.addUser({
    auth: { role: 'ADMIN', userId: admin.id },
    body,
  }, response);
  return response;
}

test.before(() => {
  assert.equal(process.env.NODE_ENV, 'test', 'Phone identity tests require the disposable backend test database');
});

test.after(async () => {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: `@${emailSuffix}` } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length) {
    await prisma.auditLog.deleteMany({ where: { entityType: 'User', entityId: { in: userIds } } });
    await prisma.passwordRecoveryChallenge.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

test('seeded and Admin-provisioned employees have a verified recovery email', async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@fieldops.example' } });
  console.log('ADMIN:', admin);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  const center = await prisma.operatingCenter.findFirst({ where: { active: true } });
  assert.ok(admin?.emailVerifiedAt, 'Seeded work email was not marked as provisioned and verified');
  assert.ok(center, 'The disposable seed did not create an active operating center');

  const created = await invokeAddUser(admin, {
    name: 'Canonical Phone Pilot',
    email: `admin-created@${emailSuffix}`,
    phone: '98765 00001',
    role: 'PILOT',
    password,
    homeCenterId: center.id,
    idProof: `ID-${runId}`,
    licenseId: `LIC-${runId}`,
    addressLine1: 'Test Address',
    state: 'Andhra Pradesh',
    city: 'Vijayawada',
    pincode: '520001'
  });
  assert.equal(created.statusCode, 201, JSON.stringify(created.body));
  assert.equal(created.body.user.phone, '+919876500001');

  const stored = await prisma.user.findUnique({ where: { email: `admin-created@${emailSuffix}` } });
  assert.ok(stored.emailVerifiedAt, 'Admin-provisioned work email was not marked verified');
});

test('semantic phone variants cannot create an ambiguous second account', async () => {
  const admin = await prisma.user.findUnique({ where: { email: 'admin@fieldops.example' } });
  console.log('ADMIN:', admin);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  const center = await prisma.operatingCenter.findFirst({ where: { active: true } });
  const duplicate = await invokeAddUser(admin, {
    name: 'Duplicate Phone Pilot',
    email: `duplicate@${emailSuffix}`,
    phone: '+91 98765-00001',
    role: 'PILOT',
    password,
    homeCenterId: center.id,
    idProof: `ID-${runId}-2`,
    licenseId: `LIC-${runId}-2`,
    addressLine1: 'Test Address',
    state: 'Andhra Pradesh',
    city: 'Vijayawada',
    pincode: '520001',
  });
  assert.equal(duplicate.statusCode, 409, JSON.stringify(duplicate.body));
  assert.match(duplicate.body.error, /email or mobile/i);
});

test('concurrent variant creation leaves one canonical identity and unique lookup binds to it', async () => {
  const passwordHash = await hashPassword(password);
  const attempts = await Promise.allSettled([
    userRepository.create({
      name: 'Concurrent Phone One',
      email: `concurrent-one@${emailSuffix}`,
      phone: '9876500002',
      role: 'PILOT',
      passwordHash,
      emailVerifiedAt: new Date(),
    }),
    userRepository.create({
      name: 'Concurrent Phone Two',
      email: `concurrent-two@${emailSuffix}`,
      phone: '+91 98765 00002',
      role: 'PILOT',
      passwordHash,
      emailVerifiedAt: new Date(),
    }),
  ]);
  assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const rejected = attempts.find((attempt) => attempt.status === 'rejected');
  assert.equal(rejected?.reason?.code, 'P2002');

  const created = attempts.find((attempt) => attempt.status === 'fulfilled').value;
  assert.equal(created.phone, '+919876500002');
  const authenticated = await userRepository.findByPhoneForAuthentication('+91 98765-00002', 'PILOT');
  assert.equal(authenticated?.id, created.id);
});
