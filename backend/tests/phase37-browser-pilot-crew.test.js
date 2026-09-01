const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const assignmentOperations = require('../src/repositories/assignmentOperationRepository');
const { issueToken } = require('../middleware/auth');

const runId = `${process.pid}-${Date.now()}`;
const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [], assignments: [] };
let server;
let baseUrl;
let center;
let primary;
let candidate;
let sales;
let assignment;

function token(user) {
  return issueToken(user);
}

async function request(pathname, { method = 'GET', user, body } = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${token(user)}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json().catch(() => ({})) };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  center = await prisma.operatingCenter.create({
    data: { name: `Phase 37 Centre ${runId}`, latitude: 11.6, longitude: 77.3, radiusKm: 30 },
  });
  ids.centers.push(center.id);
  [primary, candidate, sales] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 37 Primary', email: `p37-primary-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2100-01-01') } }),
    prisma.user.create({ data: { name: 'Phase 37 Copilot', email: `p37-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2100-01-01') } }),
    prisma.user.create({ data: { name: 'Phase 37 Sales', email: `p37-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
  ]);
  ids.users.push(primary.id, candidate.id, sales.id);

  const [drone, lmv] = await Promise.all([
    prisma.drone.create({ data: { model: 'Phase 37', serialNumber: `P37-D-${runId}`, uin: `P37-U-${runId}`, homeCenterId: center.id } }),
    prisma.lMV.create({ data: { registrationNo: `P37-L-${runId}`, homeCenterId: center.id } }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  const lead = await prisma.lead.create({
    data: {
      farmerName: 'Phase 37 Farmer', farmerPhone: `937${String(Date.now()).slice(-7)}`, acreage: 3,
      intakeChannel: 'MANUAL_SALES', status: 'PROCESSED', latitude: center.latitude,
      longitude: center.longitude, matchedCenterId: center.id,
    },
  });
  ids.leads.push(lead.id);
  const scheduled = await assignmentOperations.manualAssign({
    leadId: lead.id,
    pilotId: primary.id,
    droneId: drone.id,
    lmvId: lmv.id,
    serviceWindowStart: new Date(Date.now() + 48 * 60 * 60_000),
    serviceWindowEnd: new Date(Date.now() + 50 * 60 * 60_000),
    actorId: sales.id,
  });
  assignment = scheduled.assignment;
  ids.assignments.push(assignment.id);
});

test('browser Pilot crew endpoints are authenticated, Primary-only, and role-isolated', async () => {
  const anonymous = await request(`/api/assignments/${assignment.id}/eligible-copilots`);
  assert.equal(anonymous.response.status, 401);

  const wrongPilot = await request(`/api/assignments/${assignment.id}/eligible-copilots`, { user: candidate });
  assert.equal(wrongPilot.response.status, 403, JSON.stringify(wrongPilot.data));
  assert.equal(wrongPilot.data.code, 'PRIMARY_PILOT_REQUIRED');

  const wrongRole = await request(`/api/assignments/${assignment.id}/copilot`, {
    method: 'POST', user: sales, body: { candidateId: candidate.id, expectedRevision: assignment.revision },
  });
  assert.equal(wrongRole.response.status, 403);
});

test('browser Primary Pilot lists and selects a server-eligible Copilot with revision control', async () => {
  const eligible = await request(`/api/assignments/${assignment.id}/eligible-copilots`, { user: primary });
  assert.equal(eligible.response.status, 200, JSON.stringify(eligible.data));
  assert.deepEqual(eligible.data.candidates.map((item) => item.id), [candidate.id]);

  const selected = await request(`/api/assignments/${assignment.id}/copilot`, {
    method: 'POST', user: primary, body: { candidateId: candidate.id, expectedRevision: assignment.revision },
  });
  assert.equal(selected.response.status, 200, JSON.stringify(selected.data));
  assert.equal(selected.data.mission.copilot.id, candidate.id);
  assert.equal(selected.data.mission.crewFormationState, 'READY');
  assert.equal(selected.data.mission.revision, assignment.revision + 1);

  const stale = await request(`/api/assignments/${assignment.id}/copilot`, {
    method: 'POST', user: primary, body: { candidateId: candidate.id, expectedRevision: assignment.revision },
  });
  assert.equal(stale.response.status, 409);
  assert.equal(stale.data.code, 'ASSIGNMENT_REVISION_CONFLICT');
});

test.after(async () => {
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.assignments, ...ids.leads] } } });
  await prisma.scheduleChangeLog.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await transaction.leadHistory.deleteMany({ where: { leadId: { in: ids.leads } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await prisma.$disconnect();
});
