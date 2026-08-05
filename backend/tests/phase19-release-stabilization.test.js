const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const { validateAcreage } = require('../services/intakeService');

let server;
let baseUrl;
let admin;
let fleet;
let pilot;
let centerA;
let centerB;
let lead;
let drone;
let lmv;
let assignment;
const runId = `${process.pid}-${Date.now()}`;

const auth = (user) => ({
  Authorization: `Bearer ${issueToken(user)}`,
  'Content-Type': 'application/json',
});

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  [centerA, centerB] = await Promise.all([
    prisma.operatingCenter.create({ data: { name: `Release Centre A ${runId}`, latitude: 10, longitude: 76, radiusKm: 50 } }),
    prisma.operatingCenter.create({ data: { name: `Release Centre B ${runId}`, latitude: 11, longitude: 77, radiusKm: 50 } }),
  ]);
  [admin, fleet] = await Promise.all([
    prisma.user.create({ data: { name: 'Release Admin', email: `release-admin-${runId}@example.test`, passwordHash: 'test', role: 'ADMIN' } }),
    prisma.user.create({ data: { name: 'Release Fleet', email: `release-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
  ]);
});

test('Admin cannot create a centerless pilot and Fleet can maintain pilot center assignment', async () => {
  const password = 'Release-check-password-123';
  const missingCenter = await fetch(`${baseUrl}/api/users/add`, {
    method: 'POST',
    headers: auth(admin),
    body: JSON.stringify({
      name: 'Centerless Pilot',
      email: `centerless-${runId}@example.test`,
      password,
      role: 'PILOT',
    }),
  });
  assert.equal(missingCenter.status, 400);

  // const createdResponse = await fetch(`${baseUrl}/api/users/add`, {
  //   method: 'POST',
  //   headers: auth(admin),
  //   body: JSON.stringify({
  //     name: 'Release Pilot',
  //     email: `release-pilot-${runId}@example.test`,
  //     password,
  //     role: 'PILOT',
  //     homeCenterId: centerA.id,
  //   }),
  // });

const createdResponse = await fetch(`${baseUrl}/api/users/add`, {
    method: 'POST',
    headers: auth(admin),
    body: JSON.stringify({
        name: 'Release Pilot',
        email: `release-pilot-${runId}@example.test`,
        password,
        role: 'PILOT',
        homeCenterId: centerA.id,
        idProof: `ID-${runId}`,
        licenseId: `LIC-${runId}`,
        addressLine1: 'Test Address',
        state: 'Andhra Pradesh',
        city: 'Vijayawada',
        pincode: '520001'
    }),
});
  const created = await createdResponse.json();

  console.log("CREATE PILOT STATUS:", createdResponse.status);
  console.log("CREATE PILOT RESPONSE:", JSON.stringify(created, null, 2));

  assert.equal(createdResponse.status, 201, JSON.stringify(created)); 
  pilot = created.user;
  assert.equal(pilot.homeCenterId, centerA.id);

  const movedResponse = await fetch(`${baseUrl}/api/users/${pilot.id}/operating-center`, {
    method: 'PATCH',
    headers: auth(fleet),
    body: JSON.stringify({ homeCenterId: centerB.id }),
  });
  const moved = await movedResponse.json();
  assert.equal(movedResponse.status, 200, JSON.stringify(moved));
  assert.equal(moved.user.homeCenterId, centerB.id);
  assert.ok(await prisma.auditLog.findFirst({
    where: { entityType: 'User', entityId: pilot.id, action: 'PILOT_OPERATING_CENTER_CHANGED', actorId: fleet.id },
  }));
});

test('fresh Admin-only databases accept valid acreage through the configured safety ceiling', async () => {
  const previousConfig = await prisma.pricingConfig.findUnique({ where: { key: 'MAX_LEAD_ACREAGE' } });
  const previousSafetyLimit = process.env.LEAD_ACREAGE_SAFETY_LIMIT;
  try {
    await prisma.pricingConfig.deleteMany({ where: { key: 'MAX_LEAD_ACREAGE' } });
    process.env.LEAD_ACREAGE_SAFETY_LIMIT = '10000';
    assert.equal(await validateAcreage(30), 30);
    await assert.rejects(() => validateAcreage(10001), /must not exceed 10000/);
  } finally {
    if (previousSafetyLimit === undefined) delete process.env.LEAD_ACREAGE_SAFETY_LIMIT;
    else process.env.LEAD_ACREAGE_SAFETY_LIMIT = previousSafetyLimit;
    if (previousConfig) {
      await prisma.pricingConfig.upsert({
        where: { key: previousConfig.key },
        create: { key: previousConfig.key, value: previousConfig.value },
        update: { value: previousConfig.value },
      });
    }
  }
});

test('an active pilot cannot move centers; completion releases fleet without creating immediate payment', async () => {
  [lead, drone, lmv] = await Promise.all([
    prisma.lead.create({
      data: {
        farmerName: 'Release Farmer',
        farmerPhone: `95555${String(Date.now()).slice(-5)}`,
        acreage: 4,
        intakeChannel: 'MANUAL_SALES',
        status: 'IN_PROGRESS',
        matchedCenterId: centerB.id,
      },
    }),
    prisma.drone.create({
      data: {
        model: 'Release Drone',
        serialNumber: `RELEASE-DRONE-${runId}`,
        // change 5-8-26
        uin: `UIN-RELEASE-2950-${Date.now()}`,
        status: 'ASSIGNED',
        homeCenterId: centerB.id,
      },
    }),
    prisma.lMV.create({
      data: {
        registrationNo: `RELEASE-LMV-${runId}`,
        status: 'ASSIGNED',
        homeCenterId: centerB.id,
      },
    }),
  ]);
  assignment = await prisma.assignment.create({
    data: {
      leadId: lead.id,
      pilotId: pilot.id,
      droneId: drone.id,
      lmvId: lmv.id,
      scheduledDate: new Date(),
      expectedAcreage: 4,
      acceptedAt: new Date(),
      startedAt: new Date(),
    },
  });

  const blocked = await fetch(`${baseUrl}/api/users/${pilot.id}/operating-center`, {
    method: 'PATCH',
    headers: auth(fleet),
    body: JSON.stringify({ homeCenterId: centerA.id }),
  });
  assert.equal(blocked.status, 409);

  const completedResponse = await fetch(`${baseUrl}/api/assignments/${assignment.id}/complete`, {
    method: 'POST',
    headers: auth(pilot),
    body: JSON.stringify({ actualAcreage: 4.25 }),
  });
  const completed = await completedResponse.json();
  assert.equal(completedResponse.status, 200, JSON.stringify(completed));
  assert.equal(Object.hasOwn(completed, 'payment'), false);
  assert.equal(await prisma.paymentRecord.count({ where: { assignmentId: assignment.id } }), 0);
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'AVAILABLE');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'AVAILABLE');
});

test('incomplete registration, payment, inquiry, and legacy assignment APIs stay retired', async () => {
  const registration = await fetch(`${baseUrl}/api/auth/business/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessName: 'Unapproved Business',
      contactPerson: 'Unapproved Contact',
      email: `unapproved-${runId}@example.test`,
      mobile: '9000000000',
      address: 'Not persisted',
      gstNo: 'UNAPPROVED',
      password: 'Unapproved-password-123',
    }),
  });
  const retiredPaths = [
    '/api/payments/pending',
    '/api/drones/inquire',
    '/api/drones/request-maintenance',
    '/api/drones/resolve-maintenance',
    '/api/assignments/status',
    '/api/assignments/complete',
    '/api/assignments/resolve',
  ];
  const retiredResponses = await Promise.all(retiredPaths.map((path) => fetch(`${baseUrl}${path}`, {
    method: path.endsWith('/pending') ? 'GET' : 'POST',
    headers: auth(admin),
    body: path.endsWith('/pending') ? undefined : '{}',
  })));
  assert.equal(registration.status, 404);
  assert.deepEqual(retiredResponses.map((response) => response.status), retiredPaths.map(() => 404));
  assert.equal(await prisma.user.count({ where: { email: `unapproved-${runId}@example.test` } }), 0);
});

test.after(async () => {
  if (assignment) {
    await prisma.auditLog.deleteMany({ where: { entityId: { in: [assignment.id, lead.id, pilot.id] } } });
    await prisma.notification.deleteMany({ where: { leadId: lead.id } });
    await prisma.assignment.delete({ where: { id: assignment.id } });
    await prisma.lead.delete({ where: { id: lead.id } });
    await prisma.drone.delete({ where: { id: drone.id } });
    await prisma.lMV.delete({ where: { id: lmv.id } });
  }
  if (pilot) {
    await prisma.auditLog.deleteMany({ where: { entityId: pilot.id } });
    await prisma.user.delete({ where: { id: pilot.id } });
  }
  await prisma.user.deleteMany({ where: { id: { in: [admin.id, fleet.id] } } });
  await prisma.operatingCenter.deleteMany({ where: { id: { in: [centerA.id, centerB.id] } } });
  await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});
