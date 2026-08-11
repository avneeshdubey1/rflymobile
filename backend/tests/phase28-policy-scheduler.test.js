const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const weatherService = require('../services/weatherService');
const { autoAssignProcessedLead } = require('../services/autoAssignmentService');

const runId = `${process.pid}-${Date.now()}`;
const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [] };
let originalPolicy;

async function lead(center, suffix) {
  const created = await prisma.lead.create({
    data: {
      farmerName: `Phase 28 ${suffix}`,
      farmerPhone: `+9191${String(Date.now()).slice(-8)}${suffix}`.slice(0, 13),
      acreage: 3,
      intakeChannel: 'MANUAL_SALES',
      status: 'PROCESSED',
      latitude: center.latitude,
      longitude: center.longitude,
      matchedCenterId: center.id,
      distanceFromCenterKm: 0,
    },
  });
  ids.leads.push(created.id);
  return created;
}

test.before(async () => {
  originalPolicy = await prisma.autoAssignmentPolicy.findUnique({ where: { singletonKey: 'COMPANY' } });
  await prisma.autoAssignmentPolicy.update({
    where: { singletonKey: 'COMPANY' },
    data: {
      enabled: true,
      searchHorizonDays: 3,
      workingDayStartMinutes: 540,
      workingDayEndMinutes: 1080,
      defaultJobDurationMinutes: 120,
      turnaroundMinutes: 30,
      maxJobsPerUnitPerDay: null,
      maxAcreagePerUnitPerDay: null,
      weatherUnavailableAction: 'SCHEDULE_WITH_WARNING',
    },
  });
  weatherService.setForecastProvider(async () => ({ windSpeedKph: 1, precipitationProbability: 0 }));
});

test('selection is stable by IDs and a reusable complete unit receives the next policy window', async () => {
  const center = await prisma.operatingCenter.create({ data: { name: `Phase 28 Center ${runId}`, latitude: 14.25, longitude: 78.25, radiusKm: 20 } });
  ids.centers.push(center.id);
  const pilots = await Promise.all(['Zulu', 'Alpha', 'Mike', 'Bravo'].map(async (name) => {
    const pilot = await prisma.user.create({
      data: {
        name: `Phase 28 ${name}`,
        email: `phase28-${name.toLowerCase()}-${runId}@example.test`,
        passwordHash: 'test',
        role: 'PILOT',
        homeCenterId: center.id,
        pilotLicenseExpiry: new Date('2028-01-01T00:00:00.000Z'),
      },
    });
    ids.users.push(pilot.id);
    return pilot;
  }));
  const drones = await Promise.all(['Z', 'A'].map(async (suffix) => {
    const drone = await prisma.drone.create({
      data: {
        model: 'Phase 28', serialNumber: `P28-${suffix}-${runId}`, uin: `P28-UIN-${suffix}-${runId}`,
        status: 'AVAILABLE', homeCenterId: center.id, airworthinessExpiry: new Date('2028-01-01T00:00:00.000Z'),
      },
    });
    ids.drones.push(drone.id);
    return drone;
  }));
  const lmvs = await Promise.all(['Z', 'A'].map(async (suffix) => {
    const lmv = await prisma.lMV.create({
      data: { registrationNo: `P28-LMV-${suffix}-${runId}`, label: `Phase 28 ${suffix}`, status: 'AVAILABLE', homeCenterId: center.id },
    });
    ids.lmvs.push(lmv.id);
    return lmv;
  }));
  const firstLead = await lead(center, '1');
  const now = new Date('2026-08-12T01:00:00.000Z');
  const first = await autoAssignProcessedLead(firstLead.id, { now, operatingTimeZone: 'UTC' });
  assert.equal(first.outcome, 'SCHEDULED');
  assert.equal(first.reasonCode, 'AUTO_ASSIGNMENT_SUCCESS');
  const expectedPilots = pilots.map(({ id }) => id).sort().slice(0, 2);
  assert.deepEqual([first.assignment.pilotId, first.assignment.copilotId], expectedPilots);
  assert.equal(first.assignment.droneId, drones.map(({ id }) => id).sort()[0]);
  assert.equal(first.assignment.lmvId, lmvs.map(({ id }) => id).sort()[0]);
  assert.equal(first.assignment.serviceWindowStart.toISOString(), '2026-08-12T09:00:00.000Z');
  assert.equal(first.assignment.serviceWindowEnd.toISOString(), '2026-08-12T11:00:00.000Z');

  const secondLead = await lead(center, '2');
  const second = await autoAssignProcessedLead(secondLead.id, { now, operatingTimeZone: 'UTC' });
  assert.equal(second.outcome, 'SCHEDULED');
  assert.deepEqual(
    [second.assignment.pilotId, second.assignment.copilotId, second.assignment.droneId, second.assignment.lmvId],
    [first.assignment.pilotId, first.assignment.copilotId, first.assignment.droneId, first.assignment.lmvId],
  );
  assert.equal(second.assignment.dailySequence, 2);
  assert.equal(second.assignment.serviceWindowStart.toISOString(), '2026-08-12T11:30:00.000Z');
  assert.equal(second.assignment.serviceWindowEnd.toISOString(), '2026-08-12T13:30:00.000Z');

  await prisma.autoAssignmentPolicy.update({
    where: { singletonKey: 'COMPANY' },
    data: { maxJobsPerUnitPerDay: 2, revision: { increment: 1 } },
  });
  const cappedLead = await lead(center, '4');
  const capped = await autoAssignProcessedLead(cappedLead.id, { now, operatingTimeZone: 'UTC' });
  assert.equal(capped.outcome, 'SCHEDULED');
  assert.notEqual(capped.assignment.droneId, first.assignment.droneId);
  assert.notEqual(capped.assignment.lmvId, first.assignment.lmvId);
  assert.equal(capped.assignment.serviceWindowStart.toISOString(), '2026-08-12T09:00:00.000Z');

  await prisma.autoAssignmentPolicy.update({
    where: { singletonKey: 'COMPANY' },
    data: { maxAcreagePerUnitPerDay: '2.00', revision: { increment: 1 } },
  });
  const acreageCappedLead = await lead(center, '5');
  const acreageCapped = await autoAssignProcessedLead(acreageCappedLead.id, { now, operatingTimeZone: 'UTC' });
  assert.equal(acreageCapped.outcome, 'MANUAL_SCHEDULING');
  assert.equal(acreageCapped.reasonCode, 'NO_CAPACITY_IN_HORIZON');

  const retry = await autoAssignProcessedLead(firstLead.id, { now, operatingTimeZone: 'UTC' });
  assert.equal(retry.outcome, 'SCHEDULED');
  assert.equal(retry.idempotent, true);
  assert.equal(retry.assignment.id, first.assignment.id);
});

test('disabled policy queues a lead once and re-enabling does not silently consume it', async () => {
  const center = await prisma.operatingCenter.create({ data: { name: `Phase 28 Disabled ${runId}`, latitude: 15.25, longitude: 79.25, radiusKm: 20 } });
  ids.centers.push(center.id);
  await prisma.autoAssignmentPolicy.update({ where: { singletonKey: 'COMPANY' }, data: { enabled: false, revision: { increment: 1 } } });
  const queuedLead = await lead(center, '3');
  const result = await autoAssignProcessedLead(queuedLead.id, { now: new Date('2026-08-12T01:00:00.000Z'), operatingTimeZone: 'UTC' });
  assert.equal(result.outcome, 'MANUAL_SCHEDULING');
  assert.equal(result.reasonCode, 'AUTO_ASSIGNMENT_POLICY_DISABLED');
  assert.equal(result.lead.status, 'NEEDS_MANUAL_SCHEDULING');
  await prisma.autoAssignmentPolicy.update({ where: { singletonKey: 'COMPANY' }, data: { enabled: true, revision: { increment: 1 } } });
  const unchanged = await prisma.lead.findUnique({ where: { id: queuedLead.id } });
  assert.equal(unchanged.status, 'NEEDS_MANUAL_SCHEDULING');
  assert.equal(await prisma.assignment.count({ where: { leadId: queuedLead.id } }), 0);
});

test('missing weather follows the configured manual-review outcome', async () => {
  const center = await prisma.operatingCenter.create({ data: { name: `Phase 28 Weather ${runId}`, latitude: 16.25, longitude: 80.25, radiusKm: 20 } });
  ids.centers.push(center.id);
  await prisma.autoAssignmentPolicy.update({
    where: { singletonKey: 'COMPANY' },
    data: { enabled: true, maxAcreagePerUnitPerDay: null, weatherUnavailableAction: 'MANUAL_REVIEW', revision: { increment: 1 } },
  });
  weatherService.setForecastProvider(null);
  const weatherLead = await lead(center, '6');
  const result = await autoAssignProcessedLead(weatherLead.id, { now: new Date('2026-08-12T01:00:00.000Z'), operatingTimeZone: 'UTC' });
  assert.equal(result.outcome, 'MANUAL_SCHEDULING');
  assert.equal(result.reasonCode, 'WEATHER_REVIEW_REQUIRED');
  assert.equal(result.lead.status, 'NEEDS_MANUAL_SCHEDULING');
});

test.after(async () => {
  const assignments = await prisma.assignment.findMany({ where: { leadId: { in: ids.leads } }, select: { id: true } });
  const assignmentIds = assignments.map(({ id }) => id);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ entityId: { in: ids.leads } }, { entityId: { in: assignmentIds } }] } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  if (originalPolicy) {
    await prisma.autoAssignmentPolicy.update({
      where: { id: originalPolicy.id },
      data: {
        enabled: originalPolicy.enabled,
        searchHorizonDays: originalPolicy.searchHorizonDays,
        workingDayStartMinutes: originalPolicy.workingDayStartMinutes,
        workingDayEndMinutes: originalPolicy.workingDayEndMinutes,
        defaultJobDurationMinutes: originalPolicy.defaultJobDurationMinutes,
        turnaroundMinutes: originalPolicy.turnaroundMinutes,
        maxJobsPerUnitPerDay: originalPolicy.maxJobsPerUnitPerDay,
        maxAcreagePerUnitPerDay: originalPolicy.maxAcreagePerUnitPerDay,
        weatherUnavailableAction: originalPolicy.weatherUnavailableAction,
        revision: originalPolicy.revision,
        updatedByUserId: originalPolicy.updatedByUserId,
      },
    });
  }
  weatherService.setForecastProvider(null);
  await prisma.$disconnect();
});
