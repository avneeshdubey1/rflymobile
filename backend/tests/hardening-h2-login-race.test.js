const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { createApp } = require('../app');
const { loadEnvironment } = require('../config/environment');
const prisma = require('../src/lib/prisma');
const authSessionRepository = require('../src/repositories/authSessionRepository');
const userRepository = require('../src/repositories/userRepository');
const { BCRYPT_COST, hashPassword } = require('../services/passwordService');
const { createSession } = require('../services/sessionService');

const runId = `${process.pid}-${Date.now()}`;
const verifiedPassword = crypto.randomBytes(24).toString('base64url');
const replacementPassword = crypto.randomBytes(24).toString('base64url');
const fixtures = {};
let server;
let baseUrl;
let config;

async function requestLogin(pathname, user, password = verifiedPassword) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password }),
  });
  return { response, data: await response.json().catch(() => ({})) };
}

function assertGenericRaceRejection(result) {
  assert.equal(result.response.status, 401, JSON.stringify(result.data));
  assert.deepEqual(result.data, { error: 'Invalid email or password' });
  assert.equal(result.response.headers.get('set-cookie'), null);
}

async function interceptSessionCreation(userId, mutation, operation) {
  const original = authSessionRepository.createForCredentialSnapshot;
  let intercepted = false;
  authSessionRepository.createForCredentialSnapshot = async (data, snapshot) => {
    if (!intercepted && data.userId === userId) {
      intercepted = true;
      await mutation();
    }
    return original(data, snapshot);
  };
  try {
    const result = await operation();
    assert.equal(intercepted, true);
    return result;
  } finally {
    authSessionRepository.createForCredentialSnapshot = original;
  }
}

async function interceptRehash(userId, concurrentPasswordHash, operation) {
  const original = userRepository.updatePasswordHashIfCurrent;
  let intercepted = false;
  userRepository.updatePasswordHashIfCurrent = async (input) => {
    if (!intercepted && input.id === userId) {
      intercepted = true;
      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: concurrentPasswordHash,
          authVersion: { increment: 1 },
        },
      });
    }
    return original(input);
  };
  try {
    const result = await operation();
    assert.equal(intercepted, true);
    return result;
  } finally {
    userRepository.updatePasswordHashIfCurrent = original;
  }
}

test.before(async () => {
  config = loadEnvironment({ NODE_ENV: 'test' });
  const application = createApp({ config });
  server = application.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const currentHash = await hashPassword(verifiedPassword);
  const legacyHash = await bcrypt.hash(verifiedPassword, Math.max(4, BCRYPT_COST - 2));
  const definitions = [
    ['employeeVersion', 'SALES', currentHash],
    ['employeeRole', 'SALES', currentHash],
    ['businessState', 'BUSINESS', currentHash],
    ['employeeRehash', 'SALES', legacyHash],
    ['businessRehash', 'BUSINESS', legacyHash],
    ['employeeUpgrade', 'SALES', legacyHash],
    ['farmer', 'FARMER', currentHash],
  ];
  for (const [key, role, passwordHash] of definitions) {
    fixtures[key] = await prisma.user.create({
      data: {
        name: `Login Race ${key}`,
        email: `login-race-${key.toLowerCase()}-${runId}@example.test`,
        phone: key === 'farmer' ? `+919${String(Date.now()).slice(-9)}` : null,
        passwordHash,
        role,
      },
    });
  }
});

test('employee login rejects an auth-version change after password verification', async () => {
  const beforeVersion = fixtures.employeeVersion.authVersion;
  const result = await interceptSessionCreation(
    fixtures.employeeVersion.id,
    () => prisma.user.update({
      where: { id: fixtures.employeeVersion.id },
      data: { authVersion: { increment: 1 } },
    }),
    () => requestLogin('/api/auth/login', fixtures.employeeVersion),
  );

  assertGenericRaceRejection(result);
  const stored = await prisma.user.findUnique({ where: { id: fixtures.employeeVersion.id } });
  assert.equal(stored.authVersion, beforeVersion + 1);
  assert.equal(await prisma.authSession.count({ where: { userId: fixtures.employeeVersion.id } }), 0);
});

test('employee login rejects an exact role-snapshot change even when both roles use the endpoint', async () => {
  const result = await interceptSessionCreation(
    fixtures.employeeRole.id,
    () => prisma.user.update({
      where: { id: fixtures.employeeRole.id },
      // Deliberately keep authVersion unchanged to prove the role itself is
      // part of the credential snapshot.
      data: { role: 'PILOT' },
    }),
    () => requestLogin('/api/auth/login', fixtures.employeeRole),
  );

  assertGenericRaceRejection(result);
  assert.equal(await prisma.authSession.count({ where: { userId: fixtures.employeeRole.id } }), 0);
});

test('business login rejects an account-state change after password verification', async () => {
  const result = await interceptSessionCreation(
    fixtures.businessState.id,
    () => prisma.user.update({
      where: { id: fixtures.businessState.id },
      // Deliberately keep authVersion unchanged to exercise the state match.
      data: { active: false, archivedAt: new Date() },
    }),
    () => requestLogin('/api/auth/business/login', fixtures.businessState),
  );

  assertGenericRaceRejection(result);
  assert.equal(await prisma.authSession.count({ where: { userId: fixtures.businessState.id } }), 0);
});

test('employee and business cost upgrades never overwrite a concurrent password change', async () => {
  const concurrentHash = await hashPassword(replacementPassword);
  const cases = [
    ['/api/auth/login', fixtures.employeeRehash],
    ['/api/auth/business/login', fixtures.businessRehash],
  ];

  for (const [pathname, user] of cases) {
    const result = await interceptRehash(
      user.id,
      concurrentHash,
      () => requestLogin(pathname, user),
    );
    assertGenericRaceRejection(result);
    const stored = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(stored.passwordHash, concurrentHash);
    assert.equal(stored.authVersion, user.authVersion + 1);
    assert.equal(await prisma.authSession.count({ where: { userId: user.id } }), 0);
  }
});

test('an uncontested password cost upgrade remains usable and does not revoke itself', async () => {
  const result = await requestLogin('/api/auth/login', fixtures.employeeUpgrade);
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.match(result.response.headers.get('set-cookie') || '', /daas_session=/);

  const stored = await prisma.user.findUnique({ where: { id: fixtures.employeeUpgrade.id } });
  assert.equal(bcrypt.getRounds(stored.passwordHash), BCRYPT_COST);
  assert.equal(stored.authVersion, fixtures.employeeUpgrade.authVersion);
  assert.equal(await prisma.authSession.count({
    where: { userId: fixtures.employeeUpgrade.id, revokedAt: null },
  }), 1);
});

test('farmer session creation keeps an explicit FARMER-only role constraint', async () => {
  const snapshot = await userRepository.findByEmailForAuthentication(fixtures.farmer.email);
  await assert.rejects(
    createSession(snapshot, config),
    (error) => error.status === 401 && error.code === 'ACCOUNT_NOT_ELIGIBLE',
  );
  await assert.rejects(
    createSession(snapshot, config, { allowedRoles: new Set(['BUSINESS']) }),
    (error) => error.status === 401 && error.code === 'CREDENTIAL_STATE_CHANGED',
  );

  const created = await createSession(snapshot, config, { allowedRoles: new Set(['FARMER']) });
  assert.equal(created.session.user.id, fixtures.farmer.id);
  assert.equal(created.session.user.role, 'FARMER');
});

test.after(async () => {
  const userIds = Object.values(fixtures).map((user) => user.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.authSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  });
  await prisma.$disconnect();
});
