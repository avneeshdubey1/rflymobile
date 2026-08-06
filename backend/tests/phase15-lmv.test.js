const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

let server;
let baseUrl;
let fleetManager;
let sales;
let pilot;
let copilot;
const runId = `${process.pid}-${Date.now()}`;
const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [], assignments: [], payments: [] };

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

async function createLead(centerId, suffix = 'main') {
  const lead = await prisma.lead.create({
    data: {
      farmerName: `Phase 15 Farmer ${suffix}`,
      farmerPhone: `95615${String(ids.leads.length).padStart(5, '0')}`,
      acreage: 3,
      intakeChannel: 'MANUAL_SALES',
      status: 'NEEDS_MANUAL_SCHEDULING',
      latitude: 11,
      longitude: 76,
      matchedCenterId: centerId,
    },
  });
  ids.leads.push(lead.id);
  return lead;
}

async function createDrone(centerId, suffix = ids.drones.length) {
  // const drone = await prisma.drone.create({
  //   data: { model: 'LMV Test Drone', serialNumber: `PHASE15-DRONE-${runId}-${suffix}`, status: 'AVAILABLE', homeCenterId: centerId, airworthinessExpiry: new Date('2027-01-01') },
  // });

const drone = await prisma.drone.create({
  data: {
    model: 'LMV Test Drone',
    serialNumber: `PHASE15-DRONE-${runId}-${suffix}`,
    uin: `UIN-PHASE15-${suffix}-${Date.now()}`,
    status: 'AVAILABLE',
    homeCenterId: centerId,
    airworthinessExpiry: new Date('2027-01-01'),
  },
});

  ids.drones.push(drone.id);
  return drone;
}

async function createLmv(centerId, suffix = ids.lmvs.length, status = 'AVAILABLE') {
  const lmv = await prisma.lMV.create({
    data: { registrationNo: `PHASE15-LMV-${runId}-${suffix}`, label: `Phase 15 LMV ${suffix}`, status, homeCenterId: centerId, capacity: 1 },
  });
  ids.lmvs.push(lmv.id);
  return lmv;
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const [center, otherCenter] = await Promise.all([
    prisma.operatingCenter.create({ data: { name: `Phase 15 Center ${runId}`, latitude: 11, longitude: 76, radiusKm: 50 } }),
    prisma.operatingCenter.create({ data: { name: `Phase 15 Other ${runId}`, latitude: 12, longitude: 77, radiusKm: 50 } }),
  ]);
  ids.centers.push(center.id, otherCenter.id);
  [fleetManager, sales, pilot, copilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 15 Fleet', email: `phase15-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'Phase 15 Sales', email: `phase15-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
    prisma.user.create({ data: { name: 'Phase 15 Pilot', email: `phase15-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2027-01-01') } }),
    prisma.user.create({ data: { name: 'Phase 15 Copilot', email: `phase15-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2027-01-01') } }),
  ]);
  ids.users.push(fleetManager.id, sales.id, pilot.id, copilot.id);
});

test('LMV management APIs enforce role, validation, and coordinate-free audit', async () => {
  const centerId = ids.centers[0];
  const denied = await fetch(`${baseUrl}/api/lmvs/add`, {
    method: 'POST',
    headers: auth(sales),
    body: JSON.stringify({ registrationNo: `DENIED-${runId}`, homeCenterId: centerId }),
  });
  assert.equal(denied.status, 403);

  const createdResponse = await fetch(`${baseUrl}/api/lmvs/add`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ registrationNo: `tn 72 lmv ${runId}`, label: 'Test LMV', homeCenterId: centerId }),
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  ids.lmvs.push(created.lmv.id);
  assert.equal(created.lmv.registrationNo, `TN 72 LMV ${runId}`);

  const duplicate = await fetch(`${baseUrl}/api/lmvs/add`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ registrationNo: `TN 72 LMV ${runId}`, homeCenterId: centerId }),
  });
  assert.equal(duplicate.status, 409);

  const audit = await prisma.auditLog.findFirst({ where: { entityType: 'LMV', entityId: created.lmv.id, action: 'CREATED' } });
  assert.ok(audit);
  assert.equal(/latitude|longitude|password|secret/i.test(JSON.stringify(audit)), false);
});

test('manual scheduling requires an eligible same-centre LMV and releases it on completion', async () => {
  const centerId = ids.centers[0];
  const otherCenterId = ids.centers[1];
  const [lead, drone, lmv, otherLmv, maintenanceLmv] = await Promise.all([
    createLead(centerId),
    createDrone(centerId),
    createLmv(centerId),
    createLmv(otherCenterId, 'other'),
    createLmv(centerId, 'maintenance', 'MAINTENANCE'),
  ]);
  const scheduledDate = new Date('2026-09-10T09:00:00.000Z');

  const missingLmv = await fetch(`${baseUrl}/api/assignments/manual`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, copilotId: copilot.id, droneId: drone.id, scheduledDate }),
  });
  assert.equal(missingLmv.status, 400);

  const wrongCenter = await fetch(`${baseUrl}/api/assignments/manual`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, copilotId: copilot.id, droneId: drone.id, lmvId: otherLmv.id, scheduledDate }),
  });
  assert.equal(wrongCenter.status, 409);

  const blocked = await fetch(`${baseUrl}/api/assignments/manual`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, copilotId: copilot.id, droneId: drone.id, lmvId: maintenanceLmv.id, scheduledDate }),
  });
  assert.equal(blocked.status, 409);

  const manualDroneReservation = await fetch(`${baseUrl}/api/drones/update-status`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ droneId: drone.id, status: 'ASSIGNED', reason: 'bypass attempt' }),
  });
  const manualLmvReservation = await fetch(`${baseUrl}/api/lmvs/update-status`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ lmvId: maintenanceLmv.id, status: 'ASSIGNED', reason: 'bypass attempt' }),
  });
  assert.deepEqual([manualDroneReservation.status, manualLmvReservation.status], [409, 409]);

  await prisma.user.update({ where: { id: pilot.id }, data: { active: false } });
  const inactivePilot = await fetch(`${baseUrl}/api/assignments/manual`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, copilotId: copilot.id, droneId: drone.id, lmvId: lmv.id, scheduledDate }),
  });
  assert.equal(inactivePilot.status, 409);
  await prisma.user.update({ where: { id: pilot.id }, data: { active: true } });

  const createdResponse = await fetch(`${baseUrl}/api/assignments/manual`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ leadId: lead.id, pilotId: pilot.id, copilotId: copilot.id, droneId: drone.id, lmvId: lmv.id, scheduledDate }),
  });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201, JSON.stringify(created));
  ids.assignments.push(created.mission.id);
  assert.equal(created.mission.lmvId, lmv.id);
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'ASSIGNED');

  const availableWhileActive = await fetch(`${baseUrl}/api/lmvs/update-status`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ lmvId: lmv.id, status: 'AVAILABLE', reason: 'test' }),
  });
  assert.equal(availableWhileActive.status, 409);

  const maintenanceWhileActive = await fetch(`${baseUrl}/api/lmvs/update-status`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ lmvId: lmv.id, status: 'MAINTENANCE', reason: 'test' }),
  });
  assert.equal(maintenanceWhileActive.status, 409);

  const droneAvailableWhileActive = await fetch(`${baseUrl}/api/drones/update-status`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ droneId: drone.id, status: 'AVAILABLE', reason: 'test' }),
  });
  const droneMaintenanceWhileActive = await fetch(`${baseUrl}/api/drones/update-status`, {
    method: 'POST',
    headers: auth(fleetManager),
    body: JSON.stringify({ droneId: drone.id, status: 'MAINTENANCE', reason: 'test' }),
  });
  assert.deepEqual([droneAvailableWhileActive.status, droneMaintenanceWhileActive.status], [409, 409]);

  assert.equal((await fetch(`${baseUrl}/api/assignments/${created.mission.id}/accept`, { method: 'POST', headers: auth(pilot), body: '{}' })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/assignments/${created.mission.id}/start`, { method: 'POST', headers: auth(pilot), body: '{}' })).status, 200);
  const completed = await fetch(`${baseUrl}/api/assignments/${created.mission.id}/complete`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ actualAcreage: 3 }) });
  assert.equal(completed.status, 200, await completed.text());
  const paymentRows = await prisma.paymentRecord.findMany({ where: { assignmentId: created.mission.id }, select: { id: true } });
  ids.payments.push(...paymentRows.map((payment) => payment.id));
  assert.equal(paymentRows.length, 0);
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'AVAILABLE');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'AVAILABLE');
});

test.after(async () => {
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.paymentRecord.deleteMany({ where: { id: { in: ids.payments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityType: 'LMV', entityId: { in: ids.lmvs } }, { entityId: { in: [...ids.leads, ...ids.assignments] } }] } });
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
