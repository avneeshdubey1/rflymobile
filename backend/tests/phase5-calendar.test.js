const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;
const ids = { center: null, users: [], drones: [], leads: [], assignments: [] };
let fleetManager;
let pilot;
let sales;
const runId = `${process.pid}-${Date.now()}`;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const center = await prisma.operatingCenter.create({ data: { name: `Phase 5 Centre ${runId}`, latitude: 11, longitude: 76, radiusKm: 50 } });
  ids.center = center.id;
  [fleetManager, pilot, sales] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 5 Fleet', email: `phase5-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'Phase 5 Pilot', email: `phase5-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 5 Sales', email: `phase5-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
  ]);
  ids.users.push(fleetManager.id, pilot.id, sales.id);
});

test('a fleet manager can turn a manual-scheduling lead into an assignment, then reschedule it with a Sales notification', async () => {
  const [lead, drone] = await Promise.all([
    prisma.lead.create({ data: { farmerName: 'Phase 5 Farmer', farmerPhone: '955550005', acreage: 3, intakeChannel: 'MANUAL_SALES', status: 'NEEDS_MANUAL_SCHEDULING', latitude: 11, longitude: 76, matchedCenterId: ids.center } }),
    prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE5-DRONE-${runId}`, status: 'AVAILABLE', homeCenterId: ids.center, airworthinessExpiry: new Date('2027-01-01') } }),
  ]);
  ids.leads.push(lead.id);
  ids.drones.push(drone.id);
  const firstDate = new Date('2026-08-10T09:00:00.000Z');
  const createResponse = await fetch(`${baseUrl}/api/assignments/manual`, {
    method: 'POST', headers: auth(fleetManager), body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, droneId: drone.id, scheduledDate: firstDate }),
  });
  const created = await createResponse.json();
  assert.equal(createResponse.status, 201);
  assert.equal(created.mission.autoAssigned, false);
  ids.assignments.push(created.mission.id);

  const rescheduledDate = new Date('2026-08-11T09:00:00.000Z');
  const rescheduleResponse = await fetch(`${baseUrl}/api/assignments/${created.mission.id}/reschedule`, {
    method: 'PUT', headers: auth(fleetManager), body: JSON.stringify({ scheduledDate: rescheduledDate, reason: 'Farmer requested another day' }),
  });
  assert.equal(rescheduleResponse.status, 200);
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
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.delete({ where: { id: ids.center } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
