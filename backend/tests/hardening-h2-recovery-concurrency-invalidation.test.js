const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEnvironment } = require('../config/environment');
const prisma = require('../src/lib/prisma');
const userRepository = require('../src/repositories/userRepository');
const { hashPassword } = require('../services/passwordService');
const recoveryDeliveryService = require('../services/recoveryDeliveryService');
const {
  EMPLOYEE_ROLES,
  GENERIC_MESSAGE,
  RecoveryError,
  completeRecovery,
  createBusinessPhoneGrant,
  requestEmployeeRecovery,
} = require('../services/recoveryService');

const runId = `${process.pid}-${Date.now()}`;
const config = loadEnvironment({
  ...process.env,
  NODE_ENV: 'test',
  RECOVERY_HASH_SECRET: crypto.randomBytes(48).toString('base64url'),
});
const deliveries = new Map();
const challengeIds = new Set();
const userIds = new Set();
let adapterDelayMs = 0;
let passwordHash;

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function proofHash(challengeId, proof) {
  return crypto
    .createHmac('sha256', config.recovery.hashSecret)
    .update(`${challengeId}:${proof}`)
    .digest('hex');
}

async function createUser(label, data = {}) {
  const user = await prisma.user.create({
    data: {
      name: `Recovery concurrency ${label}`,
      email: `recovery-concurrency-${label}-${runId}@example.test`,
      emailVerifiedAt: new Date(),
      passwordHash,
      role: 'SALES',
      ...data,
    },
  });
  userIds.add(user.id);
  return user;
}

async function requestFor(identifier) {
  const result = await requestEmployeeRecovery({
    identifier,
    requestedChannel: 'EMAIL',
  }, config);
  challengeIds.add(result.challengeId);
  return result;
}

async function issueFor(user) {
  const result = await requestFor(user.email);
  await recoveryDeliveryService.waitForIdleForTests();
  const delivery = deliveries.get(result.challengeId);
  assert.ok(delivery, 'Expected an eligible recovery delivery');
  return { challengeId: result.challengeId, code: delivery.code, result };
}

test.before(async () => {
  assert.equal(process.env.NODE_ENV, 'test', 'Recovery concurrency tests require the disposable test runner');
  passwordHash = await hashPassword(`Original-${crypto.randomBytes(24).toString('base64url')}`);
  recoveryDeliveryService.setTestAdapter(async (message) => {
    const delay = adapterDelayMs;
    if (delay) await sleep(delay);
    deliveries.set(message.challengeId, message);
    return { status: 'SENT' };
  });
});

test('employee recovery response does not wait for eligible-account provider delivery', async () => {
  const user = await createUser('timing');
  adapterDelayMs = 800;

  const existingStartedAt = Date.now();
  const existing = await requestFor(user.email);
  const existingElapsed = Date.now() - existingStartedAt;
  const missingStartedAt = Date.now();
  const missing = await requestFor(`missing-${runId}@example.test`);
  const missingElapsed = Date.now() - missingStartedAt;

  assert.deepEqual(Object.keys(existing).sort(), Object.keys(missing).sort());
  assert.equal(existing.success, true);
  assert.equal(missing.success, true);
  assert.equal(existing.message, GENERIC_MESSAGE);
  assert.equal(missing.message, GENERIC_MESSAGE);
  assert.equal(deliveries.has(existing.challengeId), false);
  assert.ok(existingElapsed < 600, `Eligible response waited ${existingElapsed}ms for an 800ms provider`);
  assert.ok(missingElapsed < 600, `Nonexistent response unexpectedly took ${missingElapsed}ms`);

  await recoveryDeliveryService.waitForIdleForTests();
  adapterDelayMs = 0;
  assert.ok(deliveries.has(existing.challengeId));
  assert.equal(deliveries.has(missing.challengeId), false);
});

test('concurrent issuance serializes replacement and leaves one usable user-bound challenge', async () => {
  const user = await createUser('issue-race');
  const responses = await Promise.all(
    Array.from({ length: 8 }, () => requestFor(user.email)),
  );
  await recoveryDeliveryService.waitForIdleForTests();

  for (const response of responses) {
    assert.equal(response.success, true);
    assert.equal(response.message, GENERIC_MESSAGE);
  }
  const rows = await prisma.passwordRecoveryChallenge.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });
  const usable = rows.filter((row) => (
    !row.usedAt
    && !row.revokedAt
    && row.expiresAt.getTime() > Date.now()
  ));
  assert.equal(rows.length, responses.length);
  assert.equal(usable.length, 1);
  assert.equal(rows.filter((row) => row.revokedAt).length, responses.length - 1);
  assert.equal(usable[0].expectedAuthVersion, user.authVersion);
});

test('password, role, active, and archive mutations revoke open challenges atomically', async () => {
  const [passwordUser, roleUser, activeUser, archiveUser] = await Promise.all([
    createUser('password-change'),
    createUser('role-change'),
    createUser('active-change'),
    createUser('archive-change'),
  ]);
  const issued = await Promise.all([
    issueFor(passwordUser),
    issueFor(roleUser),
    issueFor(activeUser),
    issueFor(archiveUser),
  ]);

  await userRepository.resetPassword(
    passwordUser.id,
    await hashPassword(`Changed-${crypto.randomBytes(24).toString('base64url')}`),
  );
  await userRepository.update(roleUser.id, { role: 'PILOT' });
  await userRepository.setActive(activeUser.id, false);
  await userRepository.archive(archiveUser.id);

  const rows = await prisma.passwordRecoveryChallenge.findMany({
    where: { id: { in: issued.map((entry) => entry.challengeId) } },
  });
  assert.equal(rows.length, 4);
  assert.equal(rows.every((row) => row.revokedAt && !row.usedAt), true);
});

test('completion rejects a stale authVersion and a freshly ineligible account', async () => {
  const staleUser = await createUser('stale-version');
  const stale = await issueFor(staleUser);
  await prisma.user.update({
    where: { id: staleUser.id },
    data: { authVersion: { increment: 1 } },
  });
  await assert.rejects(
    completeRecovery({
      challengeId: stale.challengeId,
      code: stale.code,
      newPassword: `Stale-${crypto.randomBytes(24).toString('base64url')}`,
      allowedRoles: EMPLOYEE_ROLES,
    }, config),
    RecoveryError,
  );

  const inactiveUser = await createUser('fresh-ineligible');
  const inactive = await issueFor(inactiveUser);
  // This direct write intentionally bypasses the repository to prove the
  // completion transaction independently re-checks current eligibility.
  await prisma.user.update({
    where: { id: inactiveUser.id },
    data: { active: false },
  });
  await assert.rejects(
    completeRecovery({
      challengeId: inactive.challengeId,
      code: inactive.code,
      newPassword: `Inactive-${crypto.randomBytes(24).toString('base64url')}`,
      allowedRoles: EMPLOYEE_ROLES,
    }, config),
    RecoveryError,
  );

  const rows = await prisma.passwordRecoveryChallenge.findMany({
    where: { id: { in: [stale.challengeId, inactive.challengeId] } },
  });
  assert.equal(rows.every((row) => !row.usedAt), true);
});

test('concurrent sibling completion permits one reset and revokes every sibling', async () => {
  const user = await createUser('consume-race');
  const codes = ['314159', '271828'];
  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  ids.forEach((id) => challengeIds.add(id));
  await Promise.all(ids.map((id, index) => prisma.passwordRecoveryChallenge.create({
    data: {
      id,
      userId: user.id,
      expectedAuthVersion: user.authVersion,
      identifierHash: crypto.randomBytes(32).toString('hex'),
      channel: 'EMAIL',
      deliveryStatus: 'SENT',
      codeHash: proofHash(id, codes[index]),
      maxAttempts: config.recovery.maxAttempts,
      expiresAt: new Date(Date.now() + config.recovery.codeTtlMs),
    },
  })));

  const results = await Promise.allSettled(ids.map((id, index) => completeRecovery({
    challengeId: id,
    code: codes[index],
    newPassword: `Concurrent-${index}-${crypto.randomBytes(24).toString('base64url')}`,
    allowedRoles: EMPLOYEE_ROLES,
  }, config)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.ok(results.find((result) => result.status === 'rejected').reason instanceof RecoveryError);

  const rows = await prisma.passwordRecoveryChallenge.findMany({
    where: { id: { in: ids } },
  });
  assert.equal(rows.filter((row) => row.usedAt).length, 1);
  assert.equal(rows.filter((row) => row.revokedAt).length, 1);
});

test('a Firebase external proof can create at most one business recovery grant', async () => {
  const phone = `+9198${String(Date.now()).slice(-8)}`;
  const user = await createUser('business-proof', {
    phone,
    phoneVerifiedAt: new Date(),
    role: 'BUSINESS',
  });
  const externalProofHash = crypto.randomBytes(32).toString('hex');
  const first = await createBusinessPhoneGrant({ phone, externalProofHash }, config);
  challengeIds.add(first.challengeId);

  await assert.rejects(
    createBusinessPhoneGrant({ phone, externalProofHash }, config),
    RecoveryError,
  );
  const rows = await prisma.passwordRecoveryChallenge.findMany({
    where: { userId: user.id, externalProofHash },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, first.challengeId);
  assert.equal(rows[0].revokedAt, null);
});

test.after(async () => {
  await recoveryDeliveryService.waitForIdleForTests();
  recoveryDeliveryService.clearTestAdapter();
  const trackedUserIds = [...userIds];
  const trackedChallengeIds = [...challengeIds];
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: trackedUserIds } },
        { entityId: { in: [...trackedUserIds, ...trackedChallengeIds] } },
      ],
    },
  });
  await prisma.passwordRecoveryChallenge.deleteMany({
    where: {
      OR: [
        { userId: { in: trackedUserIds } },
        { id: { in: trackedChallengeIds } },
      ],
    },
  });
  await prisma.authSession.deleteMany({ where: { userId: { in: trackedUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: trackedUserIds } } });
  await prisma.$disconnect();
});
