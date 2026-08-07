const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;
const ids = { center: null, users: [], drones: [], lmvs: [], leads: [], assignments: [] };
let pilot;
let copilot;
let otherPilot;
let sales;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

async function createScheduledMission(label, leadStatus = 'SCHEDULED') {
  // const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE4-${label}`, status: 'ASSIGNED', homeCenterId: ids.center, airworthinessExpiry: new Date('2027-01-01') } });
  const drone = await prisma.drone.create({
  data: {
    model: 'Test',
    serialNumber: `PHASE4-${label}`,
    uin: `UIN-PHASE4-${label}`,
    status: 'ASSIGNED',
    homeCenterId: ids.center,
    airworthinessExpiry: new Date('2027-01-01'),
  },
});
  ids.drones.push(drone.id);
  const lmv = await prisma.lMV.create({
    data: {
      registrationNo: `PHASE4-LMV-${label}`,
      status: 'ASSIGNED',
      homeCenterId: ids.center,
    },
  });
  ids.lmvs.push(lmv.id);
  const lead = await prisma.lead.create({ data: { farmerName: `Phase 4 ${label}`, farmerPhone: `95555${label}`, acreage: 2, intakeChannel: 'MANUAL_SALES', status: leadStatus, latitude: 11, longitude: 76, matchedCenterId: ids.center } });
  ids.leads.push(lead.id);
  const assignment = await prisma.assignment.create({
    data: {
      leadId: lead.id,
      pilotId: pilot.id,
      copilotId: copilot.id,
      droneId: drone.id,
      lmvId: lmv.id,
      scheduledDate: new Date(),
      dailySequence: ids.assignments.length + 1,
      expectedAcreage: 2,
      acceptedAt: leadStatus === 'PILOT_ACCEPTED' ? new Date() : null,
    },
  });
  ids.assignments.push(assignment.id);
  return { lead, drone, lmv, assignment };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const center = await prisma.operatingCenter.create({ data: { name: 'Phase 4 Center', latitude: 11, longitude: 76, radiusKm: 50 } });
  ids.center = center.id;
  [pilot, copilot, otherPilot, sales] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 4 Pilot', email: 'phase4-pilot@example.test', passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 4 Copilot', email: 'phase4-copilot@example.test', passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 4 Other Pilot', email: 'phase4-other@example.test', passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 4 Sales', email: 'phase4-sales@example.test', passwordHash: 'test', role: 'SALES' } }),
  ]);
  ids.users.push(pilot.id, copilot.id, otherPilot.id, sales.id);
});

test('Sales cannot create an assignment and a pilot cannot skip acceptance', async () => {
  const pendingLead = await prisma.lead.create({ data: { farmerName: 'Phase 4 Manual', farmerPhone: '955550001', acreage: 2, intakeChannel: 'MANUAL_SALES', status: 'NEEDS_MANUAL_SCHEDULING', latitude: 11, longitude: 76, matchedCenterId: ids.center } });
  ids.leads.push(pendingLead.id);
  const denied = await fetch(`${baseUrl}/api/assignments/manual`, { method: 'POST', headers: auth(sales), body: JSON.stringify({ leadId: pendingLead.id, pilotId: pilot.id, droneId: 'missing' }) });
  assert.equal(denied.status, 403);

  const mission = await createScheduledMission('0002');
  const skipped = await fetch(`${baseUrl}/api/assignments/${mission.assignment.id}/start`, { method: 'POST', headers: auth(pilot) });
  assert.equal(skipped.status, 409);
  const wrongPilot = await fetch(`${baseUrl}/api/assignments/${mission.assignment.id}/accept`, { method: 'POST', headers: auth(otherPilot) });
  assert.equal(wrongPilot.status, 409);
});

test('assigned pilot must accept, then start, then complete in order', async () => {
  const mission = await createScheduledMission('0003');
  const accepted = await fetch(`${baseUrl}/api/assignments/${mission.assignment.id}/accept`, { method: 'POST', headers: auth(pilot) });
  assert.equal(accepted.status, 200);
  const started = await fetch(`${baseUrl}/api/assignments/${mission.assignment.id}/start`, { method: 'POST', headers: auth(pilot) });
  assert.equal(started.status, 200);
  const completed = await fetch(`${baseUrl}/api/assignments/${mission.assignment.id}/complete`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ actualAcreage: 2.5 }) });
  const completedBody = await completed.json();
  assert.equal(completed.status, 200);
  assert.equal(completedBody.lead.status, 'COMPLETED');
  const drone = await prisma.drone.findUnique({ where: { id: mission.drone.id } });
  assert.equal(drone.status, 'AVAILABLE');
  const lmv = await prisma.lMV.findUnique({ where: { id: mission.lmv.id } });
  assert.equal(lmv.status, 'AVAILABLE');
});

test('pilot decommission flags the mission and sends the drone to maintenance', async () => {
  const mission = await createScheduledMission('0004', 'PILOT_ACCEPTED');
  const response = await fetch(`${baseUrl}/api/assignments/${mission.assignment.id}/decommission`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ reason: 'Battery fault' }) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.lead.status, 'FLAGGED');
  const drone = await prisma.drone.findUnique({ where: { id: mission.drone.id } });
  assert.equal(drone.status, 'MAINTENANCE');
});

test.after(async () => {
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...ids.assignments] } } });
  await prisma.paymentRecord.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids.leads } } });
  await prisma.drone.deleteMany({ where: { id: { in: ids.drones } } });
  await prisma.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.operatingCenter.delete({ where: { id: ids.center } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
