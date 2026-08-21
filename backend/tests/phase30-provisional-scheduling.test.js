const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const assignments = require('../src/repositories/assignmentOperationRepository');
const crewFormation = require('../src/repositories/crewFormationRepository');

const runId = `${process.pid}-${Date.now()}`;
const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [], assignments: [] };
const start = new Date('2099-09-10T04:00:00.000Z');
const end = new Date('2099-09-10T06:00:00.000Z');
let center;
let fleet;
let primary;
let copilot;
let drone;
let lmv;

async function createLead(label, data = {}) {
  const lead = await prisma.lead.create({
    data: {
      farmerName: `Phase 30 ${label}`,
      farmerPhone: `930-${ids.leads.length}-${runId}`,
      acreage: 3,
      intakeChannel: 'MANUAL_SALES',
      status: 'PROCESSED',
      latitude: center.latitude,
      longitude: center.longitude,
      matchedCenterId: center.id,
      ...data,
    },
  });
  ids.leads.push(lead.id);
  return lead;
}

test.before(async () => {
  center = await prisma.operatingCenter.create({
    data: { name: `Phase 30 Centre ${runId}`, latitude: 11.4, longitude: 77.1, radiusKm: 30 },
  });
  ids.centers.push(center.id);
  [fleet, primary, copilot] = await Promise.all([
    prisma.user.create({
      data: { name: 'Phase 30 Fleet', email: `phase30-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' },
    }),
    prisma.user.create({
      data: {
        name: 'Phase 30 Primary', email: `phase30-primary-${runId}@example.test`, passwordHash: 'test', role: 'PILOT',
        homeCenterId: center.id, pilotLicenseExpiry: new Date('2100-01-01T00:00:00.000Z'),
      },
    }),
    prisma.user.create({
      data: {
        name: 'Phase 30 Copilot', email: `phase30-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT',
        homeCenterId: center.id, pilotLicenseExpiry: new Date('2100-01-01T00:00:00.000Z'),
      },
    }),
  ]);
  ids.users.push(fleet.id, primary.id, copilot.id);
  [drone, lmv] = await Promise.all([
    prisma.drone.create({
      data: { model: 'Phase 30', serialNumber: `P30-DRONE-${runId}`, uin: `P30-UIN-${runId}`, homeCenterId: center.id },
    }),
    prisma.lMV.create({ data: { registrationNo: `P30-LMV-${runId}`, homeCenterId: center.id } }),
  ]);
  ids.drones.push(drone.id);
  ids.lmvs.push(lmv.id);
});

test('manual scheduling reserves Primary, drone and LMV but remains non-executable until Copilot selection', async () => {
  const lead = await createLead('manual');
  const result = await assignments.manualAssign({
    leadId: lead.id,
    pilotId: primary.id,
    copilotId: copilot.id,
    droneId: drone.id,
    lmvId: lmv.id,
    serviceWindowStart: start,
    serviceWindowEnd: end,
    actorId: fleet.id,
  });
  ids.assignments.push(result.assignment.id);
  assert.equal(result.assignment.copilotId, null);
  assert.equal(result.assignment.crewFormationState, 'PENDING_COPILOT_SELECTION');
  assert.equal(result.assignment.revision, 1);
  assert.equal(result.lead.status, 'SCHEDULED');
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'ASSIGNED');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'ASSIGNED');
  assert.equal(await prisma.notificationEscalation.count({ where: { assignmentId: result.assignment.id } }), 0);

  await assert.rejects(
    assignments.transitionMission({ assignmentId: result.assignment.id, actorId: primary.id, action: 'accept' }),
    (error) => error.code === 'CREW_FORMATION_INCOMPLETE',
  );
  const formed = await crewFormation.selectCopilot({
    assignmentId: result.assignment.id,
    candidateId: copilot.id,
    actorId: primary.id,
    expectedRevision: 1,
  });
  assert.equal(formed.crewFormationState, 'READY');
  assert.equal(await prisma.notificationEscalation.count({ where: { assignmentId: result.assignment.id } }), 1);
  const accepted = await assignments.transitionMission({
    assignmentId: result.assignment.id,
    actorId: primary.id,
    action: 'accept',
  });
  assert.equal(accepted.lead.status, 'PILOT_ACCEPTED');
});

test('automatic scheduling creates the same provisional reservation without consuming a second Pilot', async () => {
  const autoCenter = await prisma.operatingCenter.create({
    data: { name: `Phase 30 Auto Centre ${runId}`, latitude: 12.4, longitude: 78.1, radiusKm: 30 },
  });
  ids.centers.push(autoCenter.id);
  const autoPrimary = await prisma.user.create({
    data: {
      name: 'Phase 30 Auto Primary', email: `phase30-auto-primary-${runId}@example.test`, passwordHash: 'test', role: 'PILOT',
      homeCenterId: autoCenter.id, pilotLicenseExpiry: new Date('2100-01-01T00:00:00.000Z'),
    },
  });
  ids.users.push(autoPrimary.id);
  const [autoDrone, autoLmv] = await Promise.all([
    prisma.drone.create({
      data: { model: 'Phase 30 Auto', serialNumber: `P30-AUTO-DRONE-${runId}`, uin: `P30-AUTO-UIN-${runId}`, homeCenterId: autoCenter.id },
    }),
    prisma.lMV.create({ data: { registrationNo: `P30-AUTO-LMV-${runId}`, homeCenterId: autoCenter.id } }),
  ]);
  ids.drones.push(autoDrone.id);
  ids.lmvs.push(autoLmv.id);
  const lead = await prisma.lead.create({
    data: {
      farmerName: 'Phase 30 Auto', farmerPhone: `930-auto-${runId}`, acreage: 3, intakeChannel: 'MANUAL_SALES',
      status: 'PROCESSED', latitude: autoCenter.latitude, longitude: autoCenter.longitude, matchedCenterId: autoCenter.id,
    },
  });
  ids.leads.push(lead.id);
  const policy = await prisma.autoAssignmentPolicy.upsert({
    where: { singletonKey: 'COMPANY' },
    create: { singletonKey: 'COMPANY', revision: 1 },
    update: { enabled: true },
  });
  const dayStart = new Date('2099-09-11T04:00:00.000Z');
  const dayEnd = new Date('2099-09-11T12:00:00.000Z');
  const result = await assignments.autoAssign({
    leadId: lead.id,
    dayStart,
    dayEnd,
    horizonStart: dayStart,
    horizonEnd: new Date('2099-09-12T12:00:00.000Z'),
    weather: { suitable: true, note: 'Focused test' },
    actorId: fleet.id,
    expectedPolicyRevision: policy.revision,
  });
  assert.equal(result.outcome, 'SCHEDULED');
  ids.assignments.push(result.assignment.id);
  assert.equal(result.assignment.pilotId, autoPrimary.id);
  assert.equal(result.assignment.copilotId, null);
  assert.equal(result.assignment.crewFormationState, 'PENDING_COPILOT_SELECTION');
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
