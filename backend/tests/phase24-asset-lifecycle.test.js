const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');

const runId = `${process.pid}-${Date.now()}`;
const ids = { users: [], centers: [], drones: [], lmvs: [], leads: [], assignments: [], maintenanceRequests: [] };
let server;
let baseUrl;
let admin;
let activeCenter;
let inactiveCenter;
let transferCenter;

const auth = (user) => ({
  Authorization: `Bearer ${issueToken(user)}`,
  'Content-Type': 'application/json',
});

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: auth(admin),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json().catch(() => ({})) };
}

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  [admin, activeCenter, inactiveCenter, transferCenter] = await Promise.all([
    prisma.user.create({
      data: {
        name: 'Phase 24 Admin',
        email: `phase24-admin-${runId}@example.test`,
        passwordHash: 'test-only',
        role: 'ADMIN',
      },
    }),
    prisma.operatingCenter.create({
      data: { name: `Phase 24 Active ${runId}`, latitude: 11, longitude: 77, radiusKm: 30 },
    }),
    prisma.operatingCenter.create({
      data: { name: `Phase 24 Inactive ${runId}`, latitude: 12, longitude: 78, radiusKm: 30, active: false },
    }),
    prisma.operatingCenter.create({
      data: { name: `Phase 24 Transfer ${runId}`, latitude: 11.5, longitude: 77.5, radiusKm: 30 },
    }),
  ]);
  ids.users.push(admin.id);
  ids.centers.push(activeCenter.id, inactiveCenter.id, transferCenter.id);
});

test('drone and LMV writes accept only active operating centers and bounded text', async () => {
  const inactiveDrone = await request('/api/drones/add', {
    method: 'POST',
    body: { model: 'Test', serialNumber: `P24-INACTIVE-${runId}`, homeCenterId: inactiveCenter.id },
  });
  assert.equal(inactiveDrone.response.status, 400);
  assert.match(inactiveDrone.data.error, /active operating center/i);

  const missingLmv = await request('/api/lmvs/add', {
    method: 'POST',
    body: { registrationNo: `P24-MISSING-${runId}`, homeCenterId: `missing-${runId}` },
  });
  assert.equal(missingLmv.response.status, 400);
  assert.match(missingLmv.data.error, /active operating center/i);

  const createdDrone = await request('/api/drones/add', {
    method: 'POST',
    body: { model: 'Lifecycle Drone', serialNumber: `P24-DRONE-${runId}`, homeCenterId: activeCenter.id },
  });
  assert.equal(createdDrone.response.status, 201, JSON.stringify(createdDrone.data));
  ids.drones.push(createdDrone.data.drone.id);

  const createdLmv = await request('/api/lmvs/add', {
    method: 'POST',
    body: { registrationNo: `P24-LMV-${runId}`, label: 'Lifecycle LMV', homeCenterId: activeCenter.id },
  });
  assert.equal(createdLmv.response.status, 201, JSON.stringify(createdLmv.data));
  ids.lmvs.push(createdLmv.data.lmv.id);

  const updatedDrone = await request(`/api/drones/${createdDrone.data.drone.id}`, {
    method: 'PATCH',
    body: { name: 'Lifecycle Drone Updated' },
  });
  const updatedLmv = await request(`/api/lmvs/${createdLmv.data.lmv.id}`, {
    method: 'PUT',
    body: { label: 'Lifecycle LMV Updated' },
  });
  assert.equal(updatedDrone.response.status, 200, JSON.stringify(updatedDrone.data));
  assert.equal(updatedLmv.response.status, 200, JSON.stringify(updatedLmv.data));

  const droneStatus = await request('/api/drones/update-status', {
    method: 'POST',
    body: { droneId: createdDrone.data.drone.id, status: 'MAINTENANCE', reason: 'Battery inspection required' },
  });
  const lmvStatus = await request('/api/lmvs/update-status', {
    method: 'POST',
    body: { lmvId: createdLmv.data.lmv.id, status: 'OUT_OF_SERVICE', reason: 'Safety inspection required' },
  });
  assert.equal(droneStatus.response.status, 200, JSON.stringify(droneStatus.data));
  assert.equal(lmvStatus.response.status, 200, JSON.stringify(lmvStatus.data));
  assert.equal(droneStatus.data.drone.operationalState, 'MAINTENANCE');
  assert.equal(droneStatus.data.drone.availabilityState, 'UNAVAILABLE');
  assert.equal(lmvStatus.data.lmv.operationalState, 'OUT_OF_SERVICE');
  assert.equal(lmvStatus.data.lmv.availabilityState, 'UNAVAILABLE');

  const droneReturned = await request('/api/drones/update-status', {
    method: 'POST',
    body: { droneId: createdDrone.data.drone.id, status: 'AVAILABLE', reason: 'Inspection completed' },
  });
  const lmvReturned = await request('/api/lmvs/update-status', {
    method: 'POST',
    body: { lmvId: createdLmv.data.lmv.id, status: 'AVAILABLE', reason: 'Inspection completed' },
  });
  assert.equal(droneReturned.data.drone.operationalState, 'IN_SERVICE');
  assert.equal(droneReturned.data.drone.availabilityState, 'AVAILABLE');
  assert.equal(lmvReturned.data.lmv.operationalState, 'IN_SERVICE');
  assert.equal(lmvReturned.data.lmv.availabilityState, 'AVAILABLE');

  const [droneHistory, lmvHistory] = await Promise.all([
    prisma.droneHistory.findMany({ where: { droneId: createdDrone.data.drone.id }, orderBy: { version: 'asc' } }),
    prisma.lMVHistory.findMany({ where: { lmvId: createdLmv.data.lmv.id }, orderBy: { version: 'asc' } }),
  ]);
  assert.deepEqual(droneHistory.map(({ eventType }) => eventType), ['CREATED', 'UPDATED', 'STATUS_CHANGED', 'STATUS_CHANGED']);
  assert.deepEqual(lmvHistory.map(({ eventType }) => eventType), ['CREATED', 'UPDATED', 'STATUS_CHANGED', 'STATUS_CHANGED']);
  assert.equal(droneHistory.every((entry) => entry.actorUserId === admin.id), true);
  assert.equal(lmvHistory.every((entry) => entry.actorUserId === admin.id), true);

  const [droneMove, lmvMove] = await Promise.all([
    request(`/api/drones/${createdDrone.data.drone.id}`, { method: 'PATCH', body: { homeCenterId: inactiveCenter.id } }),
    request(`/api/lmvs/${createdLmv.data.lmv.id}`, { method: 'PUT', body: { homeCenterId: inactiveCenter.id } }),
  ]);
  assert.equal(droneMove.response.status, 400);
  assert.equal(lmvMove.response.status, 400);

  const overlongLabel = await request(`/api/lmvs/${createdLmv.data.lmv.id}`, {
    method: 'PUT',
    body: { label: 'x'.repeat(121) },
  });
  assert.equal(overlongLabel.response.status, 400);
});

test('asset preferences are shareable while maintenance and lifecycle activity remain accountable', async () => {
  const [drone, lmv, firstPilot, secondPilot] = await Promise.all([
    prisma.drone.create({
      data: { model: 'Shared Preference Drone', serialNumber: `P24-SHARED-DRONE-${runId}`, homeCenterId: activeCenter.id },
    }),
    prisma.lMV.create({
      data: { registrationNo: `P24-SHARED-LMV-${runId}`, label: 'Shared Preference LMV', homeCenterId: activeCenter.id },
    }),
    prisma.user.create({
      data: { name: 'Phase 24 Shared Pilot One', email: `phase24-shared-one-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: activeCenter.id },
    }),
    prisma.user.create({
      data: { name: 'Phase 24 Shared Pilot Two', email: `phase24-shared-two-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: activeCenter.id },
    }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  ids.users.push(firstPilot.id, secondPilot.id);

  for (const pilot of [firstPilot, secondPilot]) {
    const updated = await request(`/api/users/${pilot.id}`, {
      method: 'PATCH',
      body: { assignedDroneId: drone.id, assignedLmvId: lmv.id },
    });
    assert.equal(updated.response.status, 200, JSON.stringify(updated.data));
    assert.equal(updated.data.user.assignedDroneId, drone.id);
    assert.equal(updated.data.user.assignedLmvId, lmv.id);
  }

  const storedPreferences = await prisma.user.findMany({
    where: { id: { in: [firstPilot.id, secondPilot.id] } },
    select: { assignedDroneId: true, assignedLmvId: true },
  });
  assert.equal(storedPreferences.length, 2);
  assert.equal(storedPreferences.every((pilot) => pilot.assignedDroneId === drone.id && pilot.assignedLmvId === lmv.id), true);

  const maintenance = await request('/api/maintenance-requests', {
    method: 'POST',
    body: {
      assetType: 'DRONE',
      assetId: drone.id,
      reasonCode: 'BATTERY_NOT_CHARGED',
      reason: 'Battery did not reach the safe charge threshold',
    },
  });
  assert.equal(maintenance.response.status, 201, JSON.stringify(maintenance.data));
  assert.equal(maintenance.data.request.status, 'ACCEPTED');
  ids.maintenanceRequests.push(maintenance.data.request.id);

  const listed = await request('/api/maintenance-requests');
  assert.equal(listed.response.status, 200, JSON.stringify(listed.data));
  assert.ok(listed.data.requests.some((entry) => entry.id === maintenance.data.request.id));
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'MAINTENANCE');

  const lmvStatus = await request('/api/lmvs/update-status', {
    method: 'POST',
    body: { lmvId: lmv.id, status: 'OUT_OF_SERVICE', reason: 'Tyre inspection required before dispatch' },
  });
  assert.equal(lmvStatus.response.status, 200, JSON.stringify(lmvStatus.data));
  const activity = await request('/api/maintenance-requests/activity');
  assert.equal(activity.response.status, 200, JSON.stringify(activity.data));
  const lifecycleEntry = activity.data.activity.find((entry) => entry.assetType === 'LMV' && entry.assetId === lmv.id);
  assert.ok(lifecycleEntry, 'direct Operations lifecycle changes must appear in the activity ledger');
  assert.equal(lifecycleEntry.reason, 'Tyre inspection required before dispatch');
  assert.equal(lifecycleEntry.actor.id, admin.id);
});

test('LMV transfer clears incompatible Pilot preference and retirement preserves history', async () => {
  const lmv = await prisma.lMV.create({
    data: { registrationNo: `P24-TRANSFER-LMV-${runId}`, label: 'Transfer LMV', homeCenterId: activeCenter.id },
  });
  const pilot = await prisma.user.create({
    data: {
      name: 'Phase 24 Transfer Pilot',
      email: `phase24-transfer-pilot-${runId}@example.test`,
      passwordHash: 'test',
      role: 'PILOT',
      homeCenterId: activeCenter.id,
      assignedLmvId: lmv.id,
    },
  });
  ids.lmvs.push(lmv.id);
  ids.users.push(pilot.id);

  const transferred = await request(`/api/lmvs/${lmv.id}`, {
    method: 'PUT',
    body: { homeCenterId: transferCenter.id },
  });
  assert.equal(transferred.response.status, 200, JSON.stringify(transferred.data));
  assert.equal(transferred.data.lmv.homeCenterId, transferCenter.id);
  assert.equal((await prisma.user.findUnique({ where: { id: pilot.id } })).assignedLmvId, null);

  const retired = await request(`/api/lmvs/${lmv.id}`, { method: 'DELETE', body: { reason: 'End of test service life' } });
  assert.equal(retired.response.status, 200, JSON.stringify(retired.data));
  assert.equal(retired.data.retired, true);
  assert.ok(retired.data.lmv.archivedAt);
  assert.equal(retired.data.lmv.status, 'OUT_OF_SERVICE');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })) !== null, true);

  const [history, audit] = await Promise.all([
    prisma.lMVHistory.findFirst({ where: { lmvId: lmv.id, eventType: 'ARCHIVED' } }),
    prisma.auditLog.findFirst({ where: { entityType: 'LMV', entityId: lmv.id, action: 'ARCHIVED' } }),
  ]);
  assert.equal(history.actorUserId, admin.id);
  assert.ok(audit);
});

test('drone DELETE retires and audits instead of deleting, and active missions block retirement', async () => {
  const [pilot, copilot] = await Promise.all([
    prisma.user.create({
      data: { name: 'Phase 24 Pilot', email: `phase24-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: activeCenter.id },
    }),
    prisma.user.create({
      data: { name: 'Phase 24 Copilot', email: `phase24-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: activeCenter.id },
    }),
  ]);
  ids.users.push(pilot.id, copilot.id);
  const drone = await prisma.drone.create({
    data: { model: 'Retirement Test', serialNumber: `P24-RETIRE-${runId}`, homeCenterId: activeCenter.id },
  });
  const lmv = await prisma.lMV.create({
    data: { registrationNo: `P24-RETIRE-LMV-${runId}`, homeCenterId: activeCenter.id },
  });
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  await prisma.user.update({ where: { id: pilot.id }, data: { assignedDroneId: drone.id } });
  const lead = await prisma.lead.create({
    data: {
      farmerName: 'Phase 24 Synthetic',
      farmerPhone: `90024${String(Date.now()).slice(-5)}`,
      acreage: 1,
      intakeChannel: 'MANUAL_SALES',
      status: 'SCHEDULED',
      matchedCenterId: activeCenter.id,
    },
  });
  ids.leads.push(lead.id);
  const assignment = await prisma.assignment.create({
    data: {
      leadId: lead.id,
      pilotId: pilot.id,
      copilotId: copilot.id,
      droneId: drone.id,
      lmvId: lmv.id,
      scheduledDate: new Date('2026-09-01T09:00:00.000Z'),
      dailySequence: 1,
      expectedAcreage: 1,
    },
  });
  ids.assignments.push(assignment.id);

  const blocked = await request(`/api/drones/${drone.id}`, { method: 'DELETE', body: { reason: 'Unsafe while assigned' } });
  assert.equal(blocked.response.status, 409);
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).archivedAt, null);

  await prisma.assignment.delete({ where: { id: assignment.id } });
  ids.assignments.splice(ids.assignments.indexOf(assignment.id), 1);
  const retired = await request(`/api/drones/${drone.id}`, { method: 'DELETE', body: { reason: 'End of test service life' } });
  assert.equal(retired.response.status, 200, JSON.stringify(retired.data));
  assert.equal(retired.data.retired, true);
  const stored = await prisma.drone.findUnique({ where: { id: drone.id } });
  assert.ok(stored, 'retirement must preserve the drone row');
  assert.ok(stored.archivedAt);
  assert.equal(stored.status, 'OUT_OF_SERVICE');
  assert.equal(stored.operationalState, 'OUT_OF_SERVICE');
  assert.equal(stored.availabilityState, 'UNAVAILABLE');
  assert.equal((await prisma.user.findUnique({ where: { id: pilot.id } })).assignedDroneId, null);

  const [history, audit] = await Promise.all([
    prisma.droneHistory.findFirst({ where: { droneId: drone.id, eventType: 'ARCHIVED' } }),
    prisma.auditLog.findFirst({ where: { entityType: 'Drone', entityId: drone.id, action: 'ARCHIVED' } }),
  ]);
  assert.ok(history, 'retirement must append a DroneHistory record');
  assert.equal(history.actorUserId, admin.id);
  assert.ok(audit, 'retirement must append an audit record');

  const again = await request(`/api/drones/${drone.id}`, { method: 'DELETE', body: { reason: 'Repeat retirement request' } });
  assert.equal(again.response.status, 200);
  assert.equal(again.data.alreadyRetired, true);

  await assert.rejects(prisma.assignment.create({
    data: {
      leadId: lead.id,
      pilotId: pilot.id,
      copilotId: copilot.id,
      droneId: drone.id,
      lmvId: lmv.id,
      scheduledDate: new Date('2026-09-02T09:00:00.000Z'),
      dailySequence: 1,
      expectedAcreage: 1,
    },
  }), /assigned drone must be an active in-service asset/i);

  const updateArchived = await request(`/api/drones/${drone.id}`, { method: 'PATCH', body: { model: 'Forbidden update' } });
  assert.equal(updateArchived.response.status, 409);
});

test.after(async () => {
  await prisma.auditLog.deleteMany({ where: { OR: [
    { entityType: 'Drone', entityId: { in: ids.drones } },
    { entityType: 'LMV', entityId: { in: ids.lmvs } },
    { entityType: 'AssetMaintenanceRequest', entityId: { in: ids.maintenanceRequests } },
  ] } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await transaction.leadHistory.deleteMany({ where: { leadId: { in: ids.leads } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.assetMaintenanceRequest.deleteMany({ where: { id: { in: ids.maintenanceRequests } } });
    await transaction.user.updateMany({
      where: { id: { in: ids.users } },
      data: { assignedDroneId: null, assignedLmvId: null },
    });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  await prisma.$disconnect();
  if (server) await new Promise((resolve) => server.close(resolve));
});
