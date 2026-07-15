const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const auditLogService = require('../services/auditLogService');

let server;
let baseUrl;
let center;
let sales;
let pilot;
let lead;
let assignment;
let payment;
const runId = `${process.pid}-${Date.now()}`;
const ids = { users: [], drones: [], leads: [], assignments: [], payments: [] };
const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}` });

const forbiddenSnapshotKeys = new Set([
  'farmerphone', 'phone', 'farmeraddress', 'address', 'latitude', 'longitude', 'lat', 'lng',
  'lastknownlat', 'lastknownlng', 'coordinates', 'paymentlink', 'upilink', 'content', 'message',
  'password', 'passwordhash', 'authorization', 'token', 'secret', 'notes',
]);

function snapshotKeys(value, found = []) {
  if (Array.isArray(value)) value.forEach((item) => snapshotKeys(item, found));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => {
    found.push(key.toLowerCase().replace(/[^a-z0-9]/g, ''));
    snapshotKeys(item, found);
  });
  return found;
}

function assertPrivateSnapshotKeysAbsent(value) {
  assert.equal(snapshotKeys(value).some((key) => forbiddenSnapshotKeys.has(key)), false);
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  center = await prisma.operatingCenter.create({ data: { name: `Phase 10 Centre ${runId}`, latitude: 11, longitude: 76 } });
  [sales, pilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 10 Sales', email: `phase10-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
    prisma.user.create({ data: { name: 'Phase 10 Pilot', email: `phase10-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(sales.id, pilot.id);
  const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE10-DRONE-${runId}`, status: 'ASSIGNED', homeCenterId: center.id } });
  ids.drones.push(drone.id);
  lead = await prisma.lead.create({ data: { farmerName: 'Phase 10 Farmer', farmerPhone: '955550010', acreage: 4, intakeChannel: 'WEBSITE', status: 'COMPLETED', matchedCenterId: center.id } });
  ids.leads.push(lead.id);
  assignment = await prisma.assignment.create({ data: { leadId: lead.id, pilotId: pilot.id, droneId: drone.id, scheduledDate: new Date(), expectedAcreage: 4 } });
  ids.assignments.push(assignment.id);
  payment = await prisma.paymentRecord.create({ data: { leadId: lead.id, assignmentId: assignment.id, amount: 4, method: 'CASH', status: 'COMPLETED' } });
  ids.payments.push(payment.id);
  const started = new Date('2026-01-01T10:00:00.000Z');
  await auditLogService.record({ entityType: 'Lead', entityId: lead.id, action: 'GEOFENCE_CHECKED', createdAt: started });
  await auditLogService.record({ entityType: 'Assignment', entityId: assignment.id, action: 'MISSION_STARTED', createdAt: new Date('2026-01-01T10:01:00.000Z') });
  await auditLogService.record({ entityType: 'PaymentRecord', entityId: payment.id, action: 'CASH_PAYMENT_COLLECTED', createdAt: new Date('2026-01-01T10:02:00.000Z') });
});

test('Sales can open a lead timeline with lead, assignment, and payment events in order', async () => {
  const response = await fetch(`${baseUrl}/api/audit-log?entityType=Lead&entityId=${lead.id}`, { headers: auth(sales) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(body.entries.map((entry) => entry.action), ['GEOFENCE_CHECKED', 'MISSION_STARTED', 'CASH_PAYMENT_COLLECTED']);
  assert.equal(body.lead.id, lead.id);
});

test('pilot access and incomplete timeline queries are rejected', async () => {
  assert.equal((await fetch(`${baseUrl}/api/audit-log?entityType=Lead&entityId=${lead.id}`, { headers: auth(pilot) })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/audit-log?entityType=Assignment`, { headers: auth(sales) })).status, 400);
});

test('audit snapshots recursively exclude contact, GPS, payment, chat, and credential fields', async () => {
  const entry = await auditLogService.record({
    entityType: 'Lead',
    entityId: lead.id,
    action: 'PRIVACY_BOUNDARY_TEST',
    beforeState: {
      status: 'NEW',
      farmerPhone: 'not-persisted',
      farmerAddress: 'not-persisted',
      latitude: 1,
      longitude: 2,
      nested: { lastKnownLat: 1, lastKnownLng: 2, passwordHash: 'not-persisted' },
    },
    afterState: {
      status: 'PROCESSED',
      paymentLink: 'not-persisted',
      chat: { content: 'not-persisted' },
      credentials: { token: 'not-persisted' },
    },
    reason: 'phone=9000000010; coordinates 11.123,76.456; https://maps.example.invalid/private',
  });
  const stored = await prisma.auditLog.findUnique({ where: { id: entry.id } });
  assertPrivateSnapshotKeysAbsent(stored.beforeState);
  assertPrivateSnapshotKeysAbsent(stored.afterState);
  assert.equal(stored.beforeState.status, 'NEW');
  assert.equal(stored.afterState.status, 'PROCESSED');
  assert.equal(/9000000010|11\.123\s*,\s*76\.456|https?:\/\//.test(stored.reason), false);
});

test('stored legacy snapshots can be permanently redacted without exposing their values', async () => {
  const legacy = await prisma.auditLog.create({
    data: {
      entityType: 'Lead',
      entityId: lead.id,
      action: 'LEGACY_PRIVACY_TEST',
      beforeState: { farmerPhone: 'not-persisted', latitude: 1, safeStatus: 'NEW' },
      afterState: { farmerAddress: 'not-persisted', upiLink: 'not-persisted', safeStatus: 'PROCESSED' },
    },
  });
  const result = await require('../src/repositories/auditLogRepository').redactStoredSnapshots();
  const stored = await prisma.auditLog.findUnique({ where: { id: legacy.id } });
  assert.ok(result.redacted >= 1);
  assertPrivateSnapshotKeysAbsent(stored.beforeState);
  assertPrivateSnapshotKeysAbsent(stored.afterState);
  assert.equal(stored.beforeState.safeStatus, 'NEW');
  assert.equal(stored.afterState.safeStatus, 'PROCESSED');
});

test.after(async () => {
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...ids.assignments, ...ids.payments] } } });
  await prisma.paymentRecord.deleteMany({ where: { id: { in: ids.payments } } });
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.delete({ where: { id: center.id } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
