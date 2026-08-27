const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../services/passwordService');

const runId = `${process.pid}-${Date.now()}`;
const password = 'phase35-password-strong';
const ids = { users: [], installations: [], organizations: [], memberships: [], leads: [], notifications: [] };
let server;
let baseUrl;
let users;
let tokens;

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

function loginBody(user) {
  return {
    email: user.email,
    password,
    installationKey: crypto.randomBytes(48).toString('base64url'),
    platform: 'ANDROID',
    appVersion: '1.0.0',
    deviceLabel: 'Phase 35 synthetic device',
  };
}

async function login(user, endpoint = '/api/mobile/v1/operations/auth/login') {
  const result = await request(endpoint, { method: 'POST', body: loginBody(user) });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.profile.id, user.id);
  assert.equal(typeof result.data.session.accessToken, 'string');
  ids.installations.push(result.data.installation.id);
  return result.data.session.accessToken;
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const passwordHash = await hashPassword(password);
  const [admin, fleet, sales, pilot, farmer, business] = await Promise.all([
    prisma.user.create({ data: { name: 'P35 Admin', email: `p35-admin-${runId}@example.test`, passwordHash, role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'P35 Fleet', email: `p35-fleet-${runId}@example.test`, passwordHash, role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'P35 Sales', email: `p35-sales-${runId}@example.test`, passwordHash, role: 'SALES' } }),
    prisma.user.create({ data: { name: 'P35 Pilot', email: `p35-pilot-${runId}@example.test`, passwordHash, role: 'PILOT' } }),
    prisma.user.create({ data: { name: 'P35 Farmer', email: `p35-farmer-${runId}@example.test`, phone: '+919350000001', passwordHash, role: 'FARMER' } }),
    prisma.user.create({ data: { name: 'P35 Business', email: `p35-business-${runId}@example.test`, passwordHash, role: 'BUSINESS' } }),
  ]);
  users = { admin, fleet, sales, pilot, farmer, business };
  ids.users.push(...Object.values(users).map((user) => user.id));

  const [linkedOrganization, unlinkedOrganization] = await Promise.all([
    prisma.businessOrganization.create({ data: { name: `P35 Linked ${runId}`, active: true } }),
    prisma.businessOrganization.create({ data: { name: `P35 Unlinked ${runId}`, active: true } }),
  ]);
  ids.organizations.push(linkedOrganization.id, unlinkedOrganization.id);
  const membership = await prisma.businessMembership.create({
    data: { organizationId: linkedOrganization.id, userId: business.id, active: true },
  });
  ids.memberships.push(membership.id);
  const [linkedLead, unlinkedLead] = await Promise.all([
    prisma.lead.create({
      data: {
        businessOrganizationId: linkedOrganization.id,
        farmerName: 'P35 Linked Farmer', farmerPhone: '+919350000002', acreage: 4,
        cropType: 'Paddy', intakeChannel: 'MANUAL_SALES', status: 'SCHEDULED',
      },
    }),
    prisma.lead.create({
      data: {
        businessOrganizationId: unlinkedOrganization.id,
        farmerName: 'P35 Private Farmer', farmerPhone: '+919350000003', acreage: 7,
        cropType: 'Cotton', intakeChannel: 'MANUAL_SALES', status: 'SCHEDULED',
      },
    }),
  ]);
  ids.leads.push(linkedLead.id, unlinkedLead.id);
  const notification = await prisma.notification.create({
    data: {
      recipientId: business.id,
      leadId: linkedLead.id,
      type: 'PILOT_ASSIGNMENT',
      message: 'A linked request changed state.',
    },
  });
  ids.notifications.push(notification.id);

  tokens = {
    admin: await login(admin),
    fleet: await login(fleet),
    sales: await login(sales),
    pilot: await login(pilot, '/api/mobile/v1/pilot/auth/login'),
    business: await login(business, '/api/mobile/v1/operations/auth/business/login'),
  };
});

test('staff authentication is installation-bound and rejects Farmer/Business on the staff route', async () => {
  for (const user of [users.farmer, users.business]) {
    const result = await request('/api/mobile/v1/operations/auth/login', { method: 'POST', body: loginBody(user) });
    assert.equal(result.response.status, 401);
    assert.equal(result.data.error.message, 'Invalid email or password');
  }
  const malformed = await request('/api/mobile/v1/operations/auth/login', {
    method: 'POST',
    body: { email: users.admin.email, password, platform: 'android', appVersion: '1.0.0', installationKey: 'short' },
  });
  assert.equal(malformed.response.status, 400);
});

test('Farmer OTP request returns a challenge while malformed resend fails closed', async () => {
  const issued = await request('/api/mobile/v1/operations/auth/farmer/request-otp', {
    method: 'POST', body: { phone: users.farmer.phone },
  });
  assert.equal(issued.response.status, 202, JSON.stringify(issued.data));
  assert.match(issued.data.challengeId, /^[0-9a-f-]{36}$/i);

  const malformed = await request('/api/mobile/v1/operations/auth/farmer/resend-otp', {
    method: 'POST', body: { challengeId: 42, phone: users.farmer.phone },
  });
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.data.error.code, 'VALIDATION_FAILED');
});

test('operations bootstrap advertises role-specific capabilities only', async () => {
  const [admin, fleet, sales] = await Promise.all([
    request('/api/mobile/v1/operations/bootstrap', { token: tokens.admin }),
    request('/api/mobile/v1/operations/bootstrap', { token: tokens.fleet }),
    request('/api/mobile/v1/operations/bootstrap', { token: tokens.sales }),
  ]);
  assert.equal(admin.response.status, 200);
  assert.equal(admin.data.capabilities.includes('CREW_OVERRIDE'), true);
  assert.equal(fleet.data.capabilities.includes('CREW_OVERRIDE'), false);
  assert.equal(fleet.data.capabilities.includes('FLEET_SCHEDULE'), true);
  assert.equal(sales.data.capabilities.includes('SALES_INTAKE'), true);
  assert.equal(sales.data.capabilities.includes('FLEET_SCHEDULE'), false);
});

test('Admin reads are denied to Sales, Business, Pilot-app, and anonymous sessions', async () => {
  const endpoints = [
    '/api/mobile/v1/operations/admin/users',
    '/api/mobile/v1/operations/admin/drones',
    '/api/mobile/v1/operations/admin/regions',
    '/api/mobile/v1/operations/admin/policies',
  ];
  for (const path of endpoints) {
    assert.equal((await request(path, { token: tokens.admin })).response.status, 200, path);
    assert.equal((await request(path, { token: tokens.sales })).response.status, 403, path);
    assert.equal((await request(path, { token: tokens.business })).response.status, 403, path);
    assert.equal((await request(path, { token: tokens.pilot })).response.status, 403, path);
    assert.equal((await request(path, { token: 'invalid-token' })).response.status, 401, path);
  }
});

test('Business endpoints expose only explicitly linked organization data and real notifications', async () => {
  const [dashboard, requests, notifications, profile] = await Promise.all([
    request('/api/mobile/v1/operations/business/dashboard', { token: tokens.business }),
    request('/api/mobile/v1/operations/business/requests', { token: tokens.business }),
    request('/api/mobile/v1/operations/business/notifications', { token: tokens.business }),
    request('/api/mobile/v1/operations/business/profile', { token: tokens.business }),
  ]);
  assert.equal(dashboard.response.status, 200, JSON.stringify(dashboard.data));
  assert.equal(dashboard.data.summary.totalRequests, 1);
  assert.equal(requests.response.status, 200, JSON.stringify(requests.data));
  assert.equal(requests.data.requests.length, 1);
  assert.equal(requests.data.requests[0].crop, 'Paddy');
  assert.equal(JSON.stringify(requests.data).includes('Cotton'), false);
  assert.equal(notifications.response.status, 200, JSON.stringify(notifications.data));
  assert.deepEqual(Object.keys(notifications.data.notifications[0]).sort(), ['createdAt', 'id', 'message', 'readAt', 'type']);
  assert.equal(profile.response.status, 200, JSON.stringify(profile.data));
  assert.equal(profile.data.profile.name, `P35 Linked ${runId}`);
  assert.equal(profile.data.profile.role, 'BUSINESS');
});

test('Operations and Pilot mobile sessions cannot cross application boundaries', async () => {
  assert.equal((await request('/api/mobile/v1/pilot/bootstrap', { token: tokens.admin })).response.status, 403);
  assert.equal((await request('/api/mobile/v1/operations/bootstrap', { token: tokens.pilot })).response.status, 403);
});

test.after(async () => {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.notification.deleteMany({ where: { id: { in: ids.notifications } } });
    await transaction.mobileSession.deleteMany({ where: { installationId: { in: ids.installations } } });
    await transaction.mobileInstallation.deleteMany({ where: { id: { in: ids.installations } } });
    await transaction.businessMembership.deleteMany({ where: { id: { in: ids.memberships } } });
    await transaction.auditLog.deleteMany({ where: { OR: [
      { actorId: { in: ids.users } },
      { entityId: { in: [...ids.users, ...ids.leads, ...ids.installations] } },
    ] } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.businessOrganization.deleteMany({ where: { id: { in: ids.organizations } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
  });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
