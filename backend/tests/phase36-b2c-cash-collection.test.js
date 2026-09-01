const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../services/passwordService');
const { issueToken } = require('../middleware/auth');

const runId = `${process.pid}-${Date.now()}`;
const password = 'phase36-password-strong';
const ids = { users: [], centers: [], drones: [], lmvs: [], leads: [], assignments: [], installations: [] };
let server;
let baseUrl;
let pilot;
let copilot;
let outsider;
let admin;
let sales;
let assignment;
let pilotToken;
let outsiderToken;

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

async function mobileLogin(user) {
  const result = await request('/api/mobile/v1/pilot/auth/login', {
    method: 'POST',
    body: {
      email: user.email,
      password,
      installationKey: crypto.randomBytes(48).toString('base64url'),
      platform: 'ANDROID',
      appVersion: '1.0.0',
      deviceLabel: 'Phase 36 synthetic device',
    },
  });
  assert.equal(result.response.status, 200, JSON.stringify(result.data));
  ids.installations.push(result.data.installation.id);
  return result.data.session.accessToken;
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const center = await prisma.operatingCenter.create({ data: { name: `P36 Centre ${runId}`, code: `P36-${runId}`, latitude: 15.1, longitude: 80.1 } });
  ids.centers.push(center.id);
  const passwordHash = await hashPassword(password);
  [pilot, copilot, outsider, admin, sales] = await Promise.all([
    prisma.user.create({ data: { name: 'P36 Pilot', email: `p36-pilot-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'P36 Copilot', email: `p36-copilot-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'P36 Outsider', email: `p36-outsider-${runId}@example.test`, passwordHash, role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'P36 Admin', email: `p36-admin-${runId}@example.test`, passwordHash, role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'P36 Sales', email: `p36-sales-${runId}@example.test`, passwordHash, role: 'SALES' } }),
  ]);
  ids.users.push(pilot.id, copilot.id, outsider.id, admin.id, sales.id);
  const [drone, lmv, lead] = await Promise.all([
    prisma.drone.create({ data: { name: 'P36 Drone', model: 'P36', serialNumber: `P36-D-${runId}`, homeCenterId: center.id } }),
    prisma.lMV.create({ data: { registrationNo: `P36-L-${runId}`, label: 'P36 LMV', homeCenterId: center.id } }),
    prisma.lead.create({ data: { farmerName: 'P36 Farmer', farmerPhone: '+919000000036', farmerAddress: 'P36 Farm', acreage: 2, acreageDecimal: '2.00', status: 'COMPLETED', intakeChannel: 'MANUAL_SALES', latitude: 15.1, longitude: 80.1, matchedCenterId: center.id, requestType: 'B2C' } }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  ids.leads.push(lead.id);
  assignment = await prisma.assignment.create({ data: { leadId: lead.id, pilotId: pilot.id, copilotId: copilot.id, droneId: drone.id, lmvId: lmv.id, scheduledDate: new Date(Date.now() - 3_600_000), serviceWindowStart: new Date(Date.now() - 3_600_000), serviceWindowEnd: new Date(Date.now() - 1_800_000), completedAt: new Date(), expectedAcreage: 2, actualAcreage: 2 } });
  ids.assignments.push(assignment.id);
  [pilotToken, outsiderToken] = await Promise.all([mobileLogin(pilot), mobileLogin(outsider)]);
});

test('completed B2C crew cash report is exact, idempotent, audited and Admin-visible', async () => {
  const actionId = crypto.randomUUID();
  const body = { clientActionId: actionId, amount: '1234.50' };
  const hidden = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/cash-collection`, { method: 'POST', token: outsiderToken, body });
  assert.equal(hidden.response.status, 404, JSON.stringify(hidden.data));

  const recorded = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/cash-collection`, { method: 'POST', token: pilotToken, body });
  assert.equal(recorded.response.status, 201, JSON.stringify(recorded.data));
  assert.equal(recorded.data.collection.amount, '1234.50');
  assert.equal(recorded.data.collection.currencyCode, 'INR');
  assert.equal(recorded.data.collection.reviewStatus, 'PENDING_REVIEW');

  const replay = await request(`/api/mobile/v1/pilot/assignments/${assignment.id}/cash-collection`, { method: 'POST', token: pilotToken, body });
  assert.equal(replay.response.status, 200, JSON.stringify(replay.data));
  assert.equal(replay.data.outcome, 'ALREADY_RECORDED');
  assert.equal(await prisma.b2cCashCollection.count({ where: { assignmentId: assignment.id } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entityType: 'B2cCashCollection', action: 'B2C_CASH_REPORTED_BY_PILOT' } }), 1);

  const listed = await request('/api/b2c-cash-collections', { token: issueToken(admin) });
  assert.equal(listed.response.status, 200, JSON.stringify(listed.data));
  assert.ok(listed.data.collections.some((item) => item.assignmentId === assignment.id));
  const denied = await request('/api/b2c-cash-collections', { token: issueToken(sales) });
  assert.equal(denied.response.status, 403);
});

test.after(async () => {
  await prisma.mobileSession.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.mobileInstallation.deleteMany({ where: { id: { in: ids.installations } } });
  await prisma.b2cCashCollection.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.auditLog.deleteMany({ where: { entityType: 'B2cCashCollection' } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});
