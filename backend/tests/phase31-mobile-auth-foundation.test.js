const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const userRepository = require('../src/repositories/userRepository');
const mobileSessionService = require('../services/mobileSessionService');
const { hashPassword } = require('../services/passwordService');

const runId = `${process.pid}-${Date.now()}`;
const ids = { users: [], centers: [], installations: [] };
let server;
let baseUrl;
let center;
let pilot;
let admin;
let racePilot;
const password = 'phase31-password-strong';
const pilotInstallKey = crypto.randomBytes(48).toString('base64url');

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json().catch(() => ({})) };
}

function loginBody(user, installationKey = crypto.randomBytes(48).toString('base64url')) {
  return {
    email: user.email,
    password,
    installationKey,
    platform: 'ANDROID',
    appVersion: '1.0.0',
    deviceLabel: 'Phase 31 synthetic device',
  };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  center = await prisma.operatingCenter.create({
    data: { name: `Phase 31 Centre ${runId}`, code: `P31-${runId}`, latitude: 11, longitude: 77 },
  });
  ids.centers.push(center.id);
  const passwordHash = await hashPassword(password);
  [pilot, admin, racePilot] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Phase 31 Pilot', email: `phase31-pilot-${runId}@example.test`, employeeCode: `P31-P-${runId}`,
        passwordHash, role: 'PILOT', homeCenterId: center.id, preferredLanguage: 'en',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Phase 31 Admin', email: `phase31-admin-${runId}@example.test`, employeeCode: `P31-A-${runId}`,
        passwordHash, role: 'ADMIN', preferredLanguage: 'en',
      },
    }),
    prisma.user.create({
      data: {
        name: 'Phase 31 Race Pilot', email: `phase31-race-pilot-${runId}@example.test`, employeeCode: `P31-R-${runId}`,
        passwordHash, role: 'PILOT', homeCenterId: center.id, preferredLanguage: 'en',
      },
    }),
  ]);
  ids.users.push(pilot.id, admin.id, racePilot.id);
});

test('Pilot login creates an installation-bound opaque session and capability bootstrap', async () => {
  const result = await request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(pilot, pilotInstallKey) });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.response.headers.get('set-cookie'), null);
  assert.equal(result.data.profile.role, 'PILOT');
  assert.equal(result.data.profile.employeeCode, pilot.employeeCode);
  assert.equal(result.data.profile.pilotAvailabilityState, 'AVAILABLE');
  ids.installations.push(result.data.installation.id);
  const stored = await prisma.mobileSession.findFirst({
    where: { installationId: result.data.installation.id },
    include: { installation: true },
  });
  assert.ok(stored);
  assert.notEqual(stored.tokenHash, result.data.session.accessToken);
  assert.equal(stored.installation.installationKeyHash.includes(result.data.session.accessToken), false);

  const bootstrap = await request('/api/mobile/v1/pilot/bootstrap', { token: result.data.session.accessToken });
  assert.equal(bootstrap.response.status, 200, JSON.stringify(bootstrap.data));
  assert.equal(bootstrap.data.app, 'PILOT_FIELD');
  assert.deepEqual(bootstrap.data.capabilities, [
    'PILOT_ASSIGNMENTS_READ', 'COPILOT_SELECT', 'MISSION_MUTATE', 'ISSUE_REPORT', 'FOREGROUND_LOCATION',
  ]);
  assert.equal(bootstrap.data.profile.email, undefined);
  assert.equal(bootstrap.data.profile.phone, undefined);
  assert.equal(bootstrap.data.featureFlags.foregroundLocation, true);
  assert.equal(bootstrap.data.policies.backgroundLocationEnabled, false);
});

test('application roles are isolated and login stays generic', async () => {
  const wrongApp = await request('/api/mobile/v1/operations/auth/login', { method: 'POST', body: loginBody(pilot) });
  assert.equal(wrongApp.response.status, 401);
  assert.equal(wrongApp.data.error.code, 'INVALID_CREDENTIALS');
  const unknown = await request('/api/mobile/v1/pilot/auth/login', {
    method: 'POST',
    body: { ...loginBody(pilot), email: `missing-${runId}@example.test` },
  });
  assert.equal(unknown.response.status, 401);
  assert.equal(unknown.data.error.code, 'INVALID_CREDENTIALS');
  const oldClient = await request('/api/mobile/v1/pilot/auth/login', {
    method: 'POST', body: { ...loginBody(pilot), appVersion: '0.9.0' },
  });
  assert.equal(oldClient.response.status, 426);
  assert.equal(oldClient.data.error.code, 'CLIENT_UPGRADE_REQUIRED');

  const wrongPlatform = await request('/api/mobile/v1/pilot/auth/login', {
    method: 'POST', body: { ...loginBody(pilot), platform: 'IOS' },
  });
  assert.equal(wrongPlatform.response.status, 400);
  assert.equal(wrongPlatform.data.error.code, 'VALIDATION_FAILED');
  const oversizedLabel = await request('/api/mobile/v1/pilot/auth/login', {
    method: 'POST', body: { ...loginBody(pilot), deviceLabel: 'x'.repeat(81) },
  });
  assert.equal(oversizedLabel.response.status, 400);
  assert.equal(oversizedLabel.data.error.code, 'VALIDATION_FAILED');
});

test('concurrent registration enforces the installation cap and stale identity snapshots cannot create sessions', async () => {
  const attempts = await Promise.all([
    request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(racePilot) }),
    request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(racePilot) }),
    request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(racePilot) }),
  ]);
  const statuses = attempts.map(({ response }) => response.status).sort();
  assert.deepEqual(statuses, [200, 200, 409]);
  for (const attempt of attempts) {
    if (attempt.response.status === 200) ids.installations.push(attempt.data.installation.id);
  }
  assert.equal(await prisma.mobileInstallation.count({
    where: { userId: racePilot.id, app: 'PILOT_FIELD', revokedAt: null },
  }), 2);

  const staleUser = await userRepository.findByEmailForAuthentication(racePilot.email);
  const staleInstallation = await prisma.mobileInstallation.findFirst({ where: { userId: racePilot.id } });
  await userRepository.resetPassword(racePilot.id, await hashPassword('phase31-race-new-password'));
  await assert.rejects(
    mobileSessionService.createSession({
      user: staleUser,
      installation: staleInstallation,
      config: app.get('config'),
    }),
    (error) => error.code === 'CREDENTIAL_STATE_CHANGED',
  );
});

test('logout, password reset, installation limits and Admin lost-device revocation are enforced', async () => {
  const first = await request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(pilot, pilotInstallKey) });
  assert.equal(first.response.status, 200);
  ids.installations.push(first.data.installation.id);
  const logout = await request('/api/mobile/v1/auth/logout', { method: 'POST', token: first.data.session.accessToken });
  assert.equal(logout.response.status, 200);
  assert.equal((await request('/api/mobile/v1/pilot/bootstrap', { token: first.data.session.accessToken })).response.status, 401);

  const secondKey = crypto.randomBytes(48).toString('base64url');
  const second = await request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(pilot, secondKey) });
  assert.equal(second.response.status, 200);
  ids.installations.push(second.data.installation.id);
  const limit = await request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(pilot) });
  assert.equal(limit.response.status, 409);
  assert.equal(limit.data.error.code, 'INSTALLATION_LIMIT_REACHED');

  const adminLogin = await request('/api/mobile/v1/operations/auth/login', { method: 'POST', body: loginBody(admin) });
  assert.equal(adminLogin.response.status, 200, JSON.stringify(adminLogin.data));
  ids.installations.push(adminLogin.data.installation.id);
  const revoked = await request(`/api/mobile/v1/operations/installations/${second.data.installation.id}`, {
    method: 'DELETE', token: adminLogin.data.session.accessToken,
  });
  assert.equal(revoked.response.status, 200);
  assert.equal((await request('/api/mobile/v1/pilot/bootstrap', { token: second.data.session.accessToken })).response.status, 401);

  const reusable = await request('/api/mobile/v1/pilot/auth/login', { method: 'POST', body: loginBody(pilot, secondKey) });
  assert.equal(reusable.response.status, 200);
  await userRepository.resetPassword(pilot.id, await hashPassword('phase31-new-password-strong'));
  const afterReset = await request('/api/mobile/v1/pilot/bootstrap', { token: reusable.data.session.accessToken });
  assert.equal(afterReset.response.status, 401);
  assert.equal(afterReset.data.error.code, 'SESSION_REVOKED');
});

test.after(async () => {
  await prisma.mobileSession.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.mobileMutationReceipt.deleteMany({ where: { installationId: { in: ids.installations } } });
  await prisma.mobileInstallation.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  });
  await prisma.$disconnect();
});
