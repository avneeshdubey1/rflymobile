const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;
const runId = `${process.pid}-${Date.now()}`;
const ids = { users: [], leads: [], assignments: [], centers: [], drones: [], lmvs: [] };
let fleet;
let primary;
let copilot;
let outsider;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });
async function request(path, user, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: auth(user),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json().catch(() => ({})) };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const center = await prisma.operatingCenter.create({
    data: { name: `Phase 20 Centre ${runId}`, latitude: 11, longitude: 76, radiusKm: 50 },
  });
  ids.centers.push(center.id);
  [fleet, primary, copilot, outsider] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 20 Fleet', email: `phase20-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'Phase 20 Primary', email: `phase20-primary-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 20 Copilot', email: `phase20-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 20 Outsider', email: `phase20-outsider-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(fleet.id, primary.id, copilot.id, outsider.id);
});

test('one two-person operational unit performs several ordered non-overlapping jobs', async () => {
  const centerId = ids.centers[0];
  const [drone, lmv] = await Promise.all([
    prisma.drone.create({ data: { model: 'Phase 20 Drone', serialNumber: `PHASE20-DRONE-${runId}`, homeCenterId: centerId, status: 'AVAILABLE' } }),
    prisma.lMV.create({ data: { registrationNo: `PHASE20-LMV-${runId}`, homeCenterId: centerId, status: 'AVAILABLE' } }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  const leads = await Promise.all([1, 2].map((sequence) => prisma.lead.create({
    data: {
      farmerName: `Phase 20 Farmer ${sequence}`,
      farmerPhone: `9555520${sequence}`,
      acreage: sequence,
      intakeChannel: 'MANUAL_SALES',
      status: 'NEEDS_MANUAL_SCHEDULING',
      latitude: 11,
      longitude: 76,
      matchedCenterId: centerId,
    },
  })));
  ids.leads.push(...leads.map((lead) => lead.id));
  const scheduledDate = '2026-08-15T09:00:00.000Z';

  for (const lead of leads) {
    const created = await request('/api/assignments/manual', fleet, {
      method: 'POST',
      body: { leadId: lead.id, pilotId: primary.id, copilotId: copilot.id, droneId: drone.id, lmvId: lmv.id, scheduledDate },
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.data));
    ids.assignments.push(created.data.mission.id);
  }

  const stored = await prisma.assignment.findMany({
    where: { id: { in: ids.assignments } },
    orderBy: { dailySequence: 'asc' },
  });
  assert.deepEqual(stored.map((assignment) => assignment.dailySequence), [1, 2]);
  assert.equal(stored.every((assignment) => assignment.copilotId === copilot.id), true);

  const movedFirst = await request(`/api/assignments/${ids.assignments[1]}/sequence`, fleet, { method: 'PATCH', body: { dailySequence: 1 } });
  assert.equal(movedFirst.response.status, 200, JSON.stringify(movedFirst.data));
  assert.equal(movedFirst.data.mission.dailySequence, 1);
  const restoredSecond = await request(`/api/assignments/${ids.assignments[1]}/sequence`, fleet, { method: 'PATCH', body: { dailySequence: 2 } });
  assert.equal(restoredSecond.response.status, 200, JSON.stringify(restoredSecond.data));
  assert.equal(restoredSecond.data.mission.dailySequence, 2);

  const copilotQueue = await request('/api/assignments/pilot', copilot);
  assert.equal(copilotQueue.response.status, 200);
  assert.equal(copilotQueue.data.missions.filter((mission) => ids.assignments.includes(mission.id)).length, 2);

  const outsiderAttempt = await request(`/api/assignments/${ids.assignments[0]}/accept`, outsider, { method: 'POST', body: {} });
  assert.equal(outsiderAttempt.response.status, 409);

  assert.equal((await request(`/api/assignments/${ids.assignments[0]}/accept`, copilot, { method: 'POST', body: {} })).response.status, 200);
  assert.equal((await request(`/api/assignments/${ids.assignments[0]}/start`, primary, { method: 'POST', body: {} })).response.status, 200);
  assert.equal((await request(`/api/assignments/${ids.assignments[1]}/accept`, primary, { method: 'POST', body: {} })).response.status, 200);
  const overlappingStart = await request(`/api/assignments/${ids.assignments[1]}/start`, copilot, { method: 'POST', body: {} });
  assert.equal(overlappingStart.response.status, 409);
  assert.match(overlappingStart.data.error, /already in progress|Complete job/i);

  assert.equal((await request(`/api/assignments/${ids.assignments[0]}/complete`, copilot, { method: 'POST', body: { actualAcreage: 1 } })).response.status, 200);
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'ASSIGNED');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'ASSIGNED');
  assert.equal((await request(`/api/assignments/${ids.assignments[1]}/start`, primary, { method: 'POST', body: {} })).response.status, 200);
  assert.equal((await request(`/api/assignments/${ids.assignments[1]}/complete`, primary, { method: 'POST', body: { actualAcreage: 2 } })).response.status, 200);
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'AVAILABLE');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'AVAILABLE');
});

test.after(async () => {
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.assignments, ...ids.leads] } } });
  await prisma.scheduleChangeLog.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
