const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;
const ids = { center: null, users: [], drones: [], lmvs: [], leads: [], assignments: [] };
let fleetManager;
let pilot;
let copilot;
let sales;
const runId = `${process.pid}-${Date.now()}`;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const center = await prisma.operatingCenter.create({ data: { name: `Phase 5 Centre ${runId}`, latitude: 11, longitude: 76, radiusKm: 50 } });
  ids.center = center.id;
  [fleetManager, pilot, copilot, sales] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 5 Fleet', email: `phase5-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'Phase 5 Pilot', email: `phase5-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 5 Copilot', email: `phase5-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 5 Sales', email: `phase5-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
  ]);
  ids.users.push(fleetManager.id, pilot.id, copilot.id, sales.id);
});

test('a fleet manager can turn a manual-scheduling lead into an assignment, then reschedule it with a Sales notification', async () => {
  const [lead, drone, lmv] = await Promise.all([
    prisma.lead.create({ data: { farmerName: 'Phase 5 Farmer', farmerPhone: '955550005', acreage: 3, intakeChannel: 'MANUAL_SALES', status: 'NEEDS_MANUAL_SCHEDULING', latitude: 11, longitude: 76, matchedCenterId: ids.center } }),
    // prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE5-DRONE-${runId}`, status: 'AVAILABLE', homeCenterId: ids.center, airworthinessExpiry: new Date('2027-01-01') } }),
    prisma.drone.create({
  data: {
    model: 'Test',
    serialNumber: `PHASE5-DRONE-${runId}`,
    uin: `UIN-PHASE5-3070-${Date.now()}`,
    status: 'AVAILABLE',
    homeCenterId: ids.center,
    airworthinessExpiry: new Date('2027-01-01'),
  },
}),
    prisma.lMV.create({ data: { registrationNo: `PHASE5-LMV-${runId}`, label: 'Phase 5 LMV', status: 'AVAILABLE', homeCenterId: ids.center } }),
  ]);
  ids.leads.push(lead.id);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  const firstDate = new Date('2026-08-10T09:00:00.000Z');
  const firstEnd = new Date('2026-08-10T11:00:00.000Z');
  const createResponse = await fetch(`${baseUrl}/api/assignments/manual`, {
    method: 'POST', headers: auth(fleetManager), body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, copilotId: copilot.id, droneId: drone.id, lmvId: lmv.id, serviceWindowStart: firstDate, serviceWindowEnd: firstEnd }),
  });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(created.mission.autoAssigned, false);
  assert.equal(created.mission.lmvId, lmv.id);
  ids.assignments.push(created.mission.id);

  const rescheduledDate = new Date('2026-08-11T09:00:00.000Z');
  const rescheduledEnd = new Date('2026-08-11T12:00:00.000Z');
  const invalidPilotResponse = await fetch(`${baseUrl}/api/assignments/${created.mission.id}/reschedule`, {
    method: 'PUT',
    headers: auth(fleetManager),
    body: JSON.stringify({ serviceWindowStart: rescheduledDate, serviceWindowEnd: rescheduledEnd, pilotId: sales.id, reason: 'Invalid role attempt' }),
  });
  assert.equal(invalidPilotResponse.status, 409);

  const rescheduleResponse = await fetch(`${baseUrl}/api/assignments/${created.mission.id}/reschedule`, {
    method: 'PUT', headers: auth(fleetManager), body: JSON.stringify({ serviceWindowStart: rescheduledDate, serviceWindowEnd: rescheduledEnd, reason: 'Farmer requested another day' }),
  });
  assert.equal(rescheduleResponse.status, 200);
  const rescheduled = await rescheduleResponse.json();
  assert.equal(rescheduled.mission.serviceWindowStart, rescheduledDate.toISOString());
  assert.equal(rescheduled.mission.serviceWindowEnd, rescheduledEnd.toISOString());
  const bounded = await fetch(`${baseUrl}/api/assignments/all?from=2026-08-11T00:00:00.000Z&to=2026-08-12T00:00:00.000Z`, { headers: auth(fleetManager) });
  const boundedData = await bounded.json();
  assert.equal(bounded.status, 200);
  assert.equal(boundedData.missions.some((mission) => mission.id === created.mission.id), true);
  const excessive = await fetch(`${baseUrl}/api/assignments/all?from=2026-01-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z`, { headers: auth(fleetManager) });
  assert.equal(excessive.status, 400);
  const [change, notification] = await Promise.all([
    prisma.scheduleChangeLog.findFirst({ where: { assignmentId: created.mission.id, changedBy: fleetManager.id } }),
    prisma.notification.findFirst({ where: { leadId: lead.id, recipientId: sales.id, type: 'RESCHEDULE' } }),
  ]);
  assert.ok(change);
  assert.equal(change.reason, 'Farmer requested another day');
  assert.ok(notification);
  assert.match(notification.message, /rescheduled/i);
});

test.after(async () => {
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...ids.assignments] } } });
  await prisma.scheduleChangeLog.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.delete({ where: { id: ids.center } });
  });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
