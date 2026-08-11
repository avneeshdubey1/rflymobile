const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const { createApp } = require('../app');
const { loadEnvironment } = require('../config/environment');
const { issueToken } = require('../middleware/auth');
const { validateTimeZone, workingDayForOffset } = require('../services/schedulingTimeService');

const runId = `${process.pid}-${Date.now()}`;
const users = {};
let server;
let baseUrl;
let originalPolicy;

function headers(user, json = false) {
  return {
    Authorization: `Bearer ${issueToken(user)}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function request(path, { user, method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: user ? headers(user, body !== undefined) : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { response, data: await response.json() };
}

test.before(async () => {
  for (const role of ['ADMIN', 'FLEET_MANAGER', 'SALES', 'PILOT', 'FARMER', 'BUSINESS']) {
    users[role] = await prisma.user.create({
      data: {
        name: `Phase 27 ${role}`,
        email: `phase27-${role.toLowerCase()}-${runId}@example.test`,
        passwordHash: 'not-a-real-password-hash',
        role,
      },
    });
  }
  originalPolicy = await prisma.autoAssignmentPolicy.findUnique({ where: { singletonKey: 'COMPANY' } });
  server = createApp({ config: loadEnvironment({ NODE_ENV: 'test', OPERATING_TIME_ZONE: 'UTC' }) }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test('policy API enforces the complete role matrix and exposes only a safe Sales summary', async () => {
  assert.equal((await request('/api/auto-assignment-policy/summary')).response.status, 401);
  for (const role of ['FARMER', 'BUSINESS', 'PILOT']) {
    assert.equal((await request('/api/auto-assignment-policy/summary', { user: users[role] })).response.status, 403);
  }
  const salesSummary = await request('/api/auto-assignment-policy/summary', { user: users.SALES });
  assert.equal(salesSummary.response.status, 200);
  assert.deepEqual(Object.keys(salesSummary.data.policy).sort(), ['enabled', 'mode', 'revision']);
  assert.equal((await request('/api/auto-assignment-policy', { user: users.SALES })).response.status, 403);
  assert.equal((await request('/api/auto-assignment-policy', { user: users.FLEET_MANAGER })).response.status, 200);
  assert.equal((await request('/api/auto-assignment-policy', { user: users.ADMIN })).response.status, 200);
  assert.equal((await request('/api/auto-assignment-policy', {
    user: users.FLEET_MANAGER,
    method: 'PUT',
    body: { expectedRevision: originalPolicy.revision, enabled: false },
  })).response.status, 403);
  assert.equal((await request('/api/assignments/auto-assign', {
    user: users.SALES,
    method: 'POST',
    body: { leadId: 'not-a-real-lead' },
  })).response.status, 403);
  assert.equal((await request('/api/leads/not-a-real-lead/auto-assign', {
    user: users.FLEET_MANAGER,
    method: 'POST',
    body: {},
  })).response.status, 404);
});

test('Admin policy updates are revision protected and responses contain no private scheduling inputs', async () => {
  const current = await request('/api/auto-assignment-policy', { user: users.ADMIN });
  const updated = await request('/api/auto-assignment-policy', {
    user: users.ADMIN,
    method: 'PUT',
    body: { expectedRevision: current.data.policy.revision, searchHorizonDays: 6 },
  });
  assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
  assert.equal(updated.data.policy.searchHorizonDays, 6);
  assert.equal(updated.data.policy.revision, current.data.policy.revision + 1);
  assert.doesNotMatch(JSON.stringify(updated.data), /latitude|longitude|farmerPhone|passwordHash|secret/i);

  const stale = await request('/api/auto-assignment-policy', {
    user: users.ADMIN,
    method: 'PUT',
    body: { expectedRevision: current.data.policy.revision, enabled: false },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.code, 'POLICY_REVISION_CONFLICT');
  assert.equal(stale.data.currentRevision, updated.data.policy.revision);
});

test('operating timezone validation and local working windows are host-timezone independent', () => {
  assert.equal(validateTimeZone('Asia/Kolkata'), 'Asia/Kolkata');
  assert.throws(() => validateTimeZone('Not/A_Zone'), (error) => error.code === 'OPERATING_TIME_ZONE_INVALID');
  const policy = { workingDayStartMinutes: 540, workingDayEndMinutes: 1080 };
  const india = workingDayForOffset(new Date('2026-08-11T12:00:00.000Z'), 0, policy, 'Asia/Kolkata');
  assert.equal(india.start.toISOString(), '2026-08-11T03:30:00.000Z');
  assert.equal(india.end.toISOString(), '2026-08-11T12:30:00.000Z');

  const spring = workingDayForOffset(new Date('2026-03-08T12:00:00.000Z'), 0, policy, 'America/New_York');
  assert.equal(spring.start.toISOString(), '2026-03-08T13:00:00.000Z');
  assert.equal(spring.end.toISOString(), '2026-03-08T22:00:00.000Z');
  const fall = workingDayForOffset(new Date('2026-11-01T12:00:00.000Z'), 0, policy, 'America/New_York');
  assert.equal(fall.start.toISOString(), '2026-11-01T14:00:00.000Z');
  assert.equal(fall.end.toISOString(), '2026-11-01T23:00:00.000Z');
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (originalPolicy) {
    await prisma.autoAssignmentPolicy.update({
      where: { id: originalPolicy.id },
      data: {
        enabled: originalPolicy.enabled,
        searchHorizonDays: originalPolicy.searchHorizonDays,
        workingDayStartMinutes: originalPolicy.workingDayStartMinutes,
        workingDayEndMinutes: originalPolicy.workingDayEndMinutes,
        defaultJobDurationMinutes: originalPolicy.defaultJobDurationMinutes,
        turnaroundMinutes: originalPolicy.turnaroundMinutes,
        maxJobsPerUnitPerDay: originalPolicy.maxJobsPerUnitPerDay,
        maxAcreagePerUnitPerDay: originalPolicy.maxAcreagePerUnitPerDay,
        weatherUnavailableAction: originalPolicy.weatherUnavailableAction,
        revision: originalPolicy.revision,
        updatedByUserId: originalPolicy.updatedByUserId,
      },
    });
    await prisma.auditLog.deleteMany({ where: { entityType: 'AutoAssignmentPolicy', actorId: users.ADMIN.id } });
  }
  await prisma.user.deleteMany({ where: { id: { in: Object.values(users).map(({ id }) => id) } } });
  await prisma.$disconnect();
});
