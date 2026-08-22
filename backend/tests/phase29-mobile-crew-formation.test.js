const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const crewFormation = require('../src/repositories/crewFormationRepository');

const runId = `${process.pid}-${Date.now()}`;
const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [], assignments: [] };
const windowStart = new Date('2099-08-20T04:00:00.000Z');
const windowEnd = new Date('2099-08-20T06:00:00.000Z');
let center;
let otherCenter;
let primary;
let eligible;
let secondEligible;
let fleet;
let admin;

async function createPilot(label, data = {}) {
  const user = await prisma.user.create({
    data: {
      name: `Phase 29 ${label}`,
      email: `phase29-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${runId}@example.test`,
      employeeCode: `P29-${label.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}-${runId}`,
      passwordHash: 'test',
      role: 'PILOT',
      homeCenterId: center.id,
      pilotLicenseExpiry: new Date('2100-01-01T00:00:00.000Z'),
      ...data,
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createPendingAssignment(label, overrides = {}) {
  const lead = await prisma.lead.create({
    data: {
      farmerName: `Phase 29 ${label}`,
      farmerPhone: `929-${ids.leads.length}-${runId}`,
      acreage: 2,
      intakeChannel: 'MANUAL_SALES',
      status: 'SCHEDULED',
      latitude: center.latitude,
      longitude: center.longitude,
      matchedCenterId: center.id,
    },
  });
  ids.leads.push(lead.id);
  const [drone, lmv] = await Promise.all([
    prisma.drone.create({
      data: {
        model: 'Phase 29',
        serialNumber: `P29-DRONE-${label}-${runId}`,
        uin: `P29-UIN-${label}-${runId}`,
        homeCenterId: center.id,
      },
    }),
    prisma.lMV.create({
      data: { registrationNo: `P29-LMV-${label}-${runId}`, homeCenterId: center.id },
    }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
  const assignment = await prisma.assignment.create({
    data: {
      leadId: lead.id,
      pilotId: primary.id,
      copilotId: null,
      droneId: drone.id,
      lmvId: lmv.id,
      crewFormationState: 'PENDING_COPILOT_SELECTION',
      scheduledDate: windowStart,
      serviceWindowStart: windowStart,
      serviceWindowEnd: windowEnd,
      expectedAcreage: 2,
      ...overrides,
    },
  });
  ids.assignments.push(assignment.id);
  return assignment;
}

test.before(async () => {
  [center, otherCenter] = await Promise.all([
    prisma.operatingCenter.create({
      data: { name: `Phase 29 Centre ${runId}`, latitude: 11.5, longitude: 77.2, radiusKm: 30 },
    }),
    prisma.operatingCenter.create({
      data: { name: `Phase 29 Other Centre ${runId}`, latitude: 12.5, longitude: 78.2, radiusKm: 30 },
    }),
  ]);
  ids.centers.push(center.id, otherCenter.id);
  [primary, eligible, secondEligible] = await Promise.all([
    createPilot('Primary'),
    createPilot('Eligible'),
    createPilot('Second Eligible'),
  ]);
  [fleet, admin] = await Promise.all([
    prisma.user.create({
      data: { name: 'Phase 29 Fleet', email: `phase29-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' },
    }),
    prisma.user.create({
      data: { name: 'Phase 29 Admin', email: `phase29-admin-${runId}@example.test`, passwordHash: 'test', role: 'ADMIN' },
    }),
  ]);
  ids.users.push(fleet.id, admin.id);
});

test('eligibility returns only minimal same-centre, active, compliant and free Pilot data', async () => {
  const assignment = await createPendingAssignment('eligibility');
  const inactive = await createPilot('Inactive', { active: false });
  const expired = await createPilot('Expired', { pilotLicenseExpiry: new Date('2098-01-01T00:00:00.000Z') });
  const crossCentre = await createPilot('Cross Centre', { homeCenterId: otherCenter.id });
  const busy = await createPilot('Busy');
  const conflict = await createPendingAssignment('busy-conflict', {
    pilotId: busy.id,
    serviceWindowStart: new Date('2099-08-20T05:00:00.000Z'),
    serviceWindowEnd: new Date('2099-08-20T07:00:00.000Z'),
    scheduledDate: new Date('2099-08-20T05:00:00.000Z'),
  });

  const candidates = await crewFormation.listEligibleCopilots({ assignmentId: assignment.id, actorId: primary.id });
  const candidateIds = candidates.map(({ id }) => id);
  assert.ok(candidateIds.includes(eligible.id));
  assert.ok(candidateIds.includes(secondEligible.id));
  assert.ok(!candidateIds.includes(primary.id));
  assert.ok(!candidateIds.includes(inactive.id));
  assert.ok(!candidateIds.includes(expired.id));
  assert.ok(!candidateIds.includes(crossCentre.id));
  assert.ok(!candidateIds.includes(busy.id));
  assert.deepEqual(Object.keys(candidates.find(({ id }) => id === eligible.id)).sort(), [
    'employeeCode', 'homeCenterId', 'id', 'name',
  ]);
  assert.equal(conflict.crewFormationState, 'PENDING_COPILOT_SELECTION');
});

test('Primary selection is revision checked, rejects invalid candidates, and commits audit plus notification', async () => {
  const assignment = await createPendingAssignment('selection');
  const inactive = await createPilot('Selection Inactive', { active: false });
  const expired = await createPilot('Selection Expired', { pilotLicenseExpiry: new Date('2098-01-01T00:00:00.000Z') });
  const crossCentre = await createPilot('Selection Cross Centre', { homeCenterId: otherCenter.id });

  await assert.rejects(
    crewFormation.selectCopilot({ assignmentId: assignment.id, candidateId: eligible.id, actorId: secondEligible.id, expectedRevision: 1 }),
    (error) => error.code === 'PRIMARY_PILOT_REQUIRED',
  );
  await assert.rejects(
    crewFormation.selectCopilot({ assignmentId: assignment.id, candidateId: primary.id, actorId: primary.id, expectedRevision: 1 }),
    (error) => error.code === 'COPILOT_SELF_SELECTION',
  );
  await assert.rejects(
    crewFormation.selectCopilot({ assignmentId: assignment.id, candidateId: inactive.id, actorId: primary.id, expectedRevision: 1 }),
    (error) => error.code === 'COPILOT_NOT_ELIGIBLE',
  );
  await assert.rejects(
    crewFormation.selectCopilot({ assignmentId: assignment.id, candidateId: expired.id, actorId: primary.id, expectedRevision: 1 }),
    (error) => error.code === 'COPILOT_LICENCE_EXPIRED',
  );
  await assert.rejects(
    crewFormation.selectCopilot({ assignmentId: assignment.id, candidateId: crossCentre.id, actorId: primary.id, expectedRevision: 1 }),
    (error) => error.code === 'COPILOT_CROSS_CENTRE',
  );
  await assert.rejects(
    crewFormation.selectCopilot({ assignmentId: assignment.id, candidateId: eligible.id, actorId: primary.id, expectedRevision: 99 }),
    (error) => error.code === 'ASSIGNMENT_REVISION_CONFLICT' && error.details.currentRevision === 1,
  );

  const selected = await crewFormation.selectCopilot({
    assignmentId: assignment.id,
    candidateId: eligible.id,
    actorId: primary.id,
    expectedRevision: 1,
  });
  assert.equal(selected.copilotId, eligible.id);
  assert.equal(selected.crewFormationState, 'READY');
  assert.equal(selected.revision, 2);
  assert.ok(selected.copilotSelectedAt);
  assert.equal(await prisma.auditLog.count({
    where: { entityId: assignment.id, action: 'COPILOT_SELECTED_BY_PRIMARY', actorId: primary.id },
  }), 1);
  assert.equal(await prisma.notification.count({
    where: { leadId: selected.leadId, recipientId: eligible.id, type: 'PILOT_ASSIGNMENT' },
  }), 1);
});

test('concurrent selection with one revision applies exactly once', async () => {
  const assignment = await createPendingAssignment('concurrent');
  const [concurrentA, concurrentB] = await Promise.all([
    createPilot('Concurrent A'),
    createPilot('Concurrent B'),
  ]);
  const request = (candidateId) => crewFormation.selectCopilot({
    assignmentId: assignment.id,
    candidateId,
    actorId: primary.id,
    expectedRevision: 1,
  });
  const results = await Promise.allSettled([request(concurrentA.id), request(concurrentB.id)]);
  assert.equal(results.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(results.filter(({ status }) => status === 'rejected').length, 1);
  const rejected = results.find(({ status }) => status === 'rejected');
  assert.equal(rejected.reason.code, 'ASSIGNMENT_REVISION_CONFLICT');
  const stored = await prisma.assignment.findUnique({ where: { id: assignment.id } });
  assert.equal(stored.revision, 2);
  assert.equal(stored.crewFormationState, 'READY');
  assert.ok([concurrentA.id, concurrentB.id].includes(stored.copilotId));
});

test('Admin override requires a reason; Fleet is denied; pre-start acceptance resets; post-start replacement is closed', async () => {
  const assignment = await createPendingAssignment('override');
  const [overrideInitial, overrideReplacement] = await Promise.all([
    createPilot('Override Initial'),
    createPilot('Override Replacement'),
  ]);
  const selected = await crewFormation.selectCopilot({
    assignmentId: assignment.id,
    candidateId: overrideInitial.id,
    actorId: primary.id,
    expectedRevision: 1,
  });
  await prisma.$transaction([
    prisma.assignment.update({ where: { id: assignment.id }, data: { acceptedAt: new Date('2099-08-19T05:00:00.000Z') } }),
    prisma.lead.update({ where: { id: selected.leadId }, data: { status: 'PILOT_ACCEPTED' } }),
  ]);

  await assert.rejects(
    crewFormation.overrideCopilot({
      assignmentId: assignment.id,
      candidateId: overrideReplacement.id,
      actorId: fleet.id,
      expectedRevision: 2,
      reason: 'Fleet cannot override the Copilot',
    }),
    (error) => error.code === 'CREW_OVERRIDE_FORBIDDEN',
  );
  await assert.rejects(
    crewFormation.overrideCopilot({ assignmentId: assignment.id, candidateId: overrideReplacement.id, actorId: admin.id, expectedRevision: 2 }),
    (error) => error.code === 'CREW_OVERRIDE_REASON_REQUIRED',
  );
  const overridden = await crewFormation.overrideCopilot({
    assignmentId: assignment.id,
    candidateId: overrideReplacement.id,
    actorId: admin.id,
    expectedRevision: 2,
    reason: 'Primary reported a pre-start availability change',
  });
  assert.equal(overridden.copilotId, overrideReplacement.id);
  assert.equal(overridden.revision, 3);
  assert.equal(overridden.acceptedAt, null);
  assert.equal(overridden.lead.status, 'SCHEDULED');

  await prisma.$transaction([
    prisma.assignment.update({ where: { id: assignment.id }, data: { startedAt: new Date('2099-08-19T06:00:00.000Z') } }),
    prisma.lead.update({ where: { id: selected.leadId }, data: { status: 'IN_PROGRESS' } }),
  ]);
  await assert.rejects(
    crewFormation.overrideCopilot({
      assignmentId: assignment.id,
      candidateId: overrideInitial.id,
      actorId: admin.id,
      expectedRevision: 3,
      reason: 'Should be closed',
    }),
    (error) => error.code === 'COPILOT_REPLACEMENT_CLOSED',
  );
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
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  await prisma.$disconnect();
});
