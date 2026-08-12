const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const assignmentOperations = require('../src/repositories/assignmentOperationRepository');
const missionStateService = require('../services/missionStateService');

const runId = `${process.pid}-${Date.now()}`;
const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [], assignments: [] };
let center;
let fleet;
let pilot;
let copilot;
let drone;
let lmv;
let unrelatedDrone;
let unrelatedLmv;

async function createLead(label, data = {}) {
  const lead = await prisma.lead.create({
    data: {
      farmerName: `Phase 25 ${label}`,
      farmerPhone: `925${String(ids.leads.length).padStart(7, '0')}`,
      acreage: 2,
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
    data: { name: `Phase 25 Center ${runId}`, latitude: 11.123, longitude: 76.456, radiusKm: 50 },
  });
  ids.centers.push(center.id);
  [fleet, pilot, copilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 25 Fleet', email: `phase25-fleet-${runId}@example.test`, passwordHash: 'test', role: 'FLEET_MANAGER' } }),
    prisma.user.create({ data: { name: 'Phase 25 Pilot', email: `phase25-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 25 Copilot', email: `phase25-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(fleet.id, pilot.id, copilot.id);
  [drone, lmv, unrelatedDrone, unrelatedLmv] = await Promise.all([
    prisma.drone.create({ data: { model: 'Atomic', serialNumber: `PHASE25-DRONE-${runId}`, uin: `PHASE25-UIN-${runId}`, homeCenterId: center.id } }),
    prisma.lMV.create({ data: { registrationNo: `PHASE25-LMV-${runId}`, homeCenterId: center.id } }),
    prisma.drone.create({ data: { model: 'Unrelated', serialNumber: `PHASE25-UNRELATED-DRONE-${runId}`, uin: `PHASE25-UNRELATED-UIN-${runId}`, homeCenterId: center.id, status: 'MAINTENANCE' } }),
    prisma.lMV.create({ data: { registrationNo: `PHASE25-UNRELATED-LMV-${runId}`, homeCenterId: center.id, status: 'OUT_OF_SERVICE' } }),
  ]);
  ids.drones.push(drone.id, unrelatedDrone.id);
  ids.lmvs.push(lmv.id, unrelatedLmv.id);
});

test('a failure after service-area revalidation rolls every scheduling write back', async () => {
  const lead = await createLead('rollback', { matchedCenterId: null, distanceFromCenterKm: null });
  const inactive = await prisma.user.create({
    data: { name: 'Phase 25 Inactive', email: `phase25-inactive-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, active: false },
  });
  ids.users.push(inactive.id);

  await assert.rejects(
    assignmentOperations.manualAssign({
      leadId: lead.id,
      pilotId: pilot.id,
      copilotId: inactive.id,
      droneId: drone.id,
      lmvId: lmv.id,
      scheduledDate: new Date('2026-09-01T09:00:00.000Z'),
      actorId: fleet.id,
    }),
    /Copilot must be active/,
  );

  const [storedLead, assignments, auditCount, storedDrone, storedLmv] = await Promise.all([
    prisma.lead.findUnique({ where: { id: lead.id } }),
    prisma.assignment.count({ where: { leadId: lead.id } }),
    prisma.auditLog.count({ where: { entityId: lead.id } }),
    prisma.drone.findUnique({ where: { id: drone.id } }),
    prisma.lMV.findUnique({ where: { id: lmv.id } }),
  ]);
  assert.equal(storedLead.matchedCenterId, null);
  assert.equal(storedLead.status, 'PROCESSED');
  assert.equal(assignments, 0);
  assert.equal(auditCount, 0);
  assert.equal(storedDrone.status, 'AVAILABLE');
  assert.equal(storedLmv.status, 'AVAILABLE');
});

test('concurrent scheduling creates one mission and commits all related state together', async () => {
  const lead = await createLead('concurrent');
  const request = () => assignmentOperations.manualAssign({
    leadId: lead.id,
    pilotId: pilot.id,
    copilotId: copilot.id,
    droneId: drone.id,
    lmvId: lmv.id,
    scheduledDate: new Date('2026-09-02T09:00:00.000Z'),
    actorId: fleet.id,
  });
  const outcomes = await Promise.allSettled([request(), request()]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 1);

  const [assignments, storedLead, storedDrone, storedLmv, leadHistory, droneHistory, lmvHistory] = await Promise.all([
    prisma.assignment.findMany({ where: { leadId: lead.id } }),
    prisma.lead.findUnique({ where: { id: lead.id } }),
    prisma.drone.findUnique({ where: { id: drone.id } }),
    prisma.lMV.findUnique({ where: { id: lmv.id } }),
    prisma.leadHistory.findFirst({ where: { leadId: lead.id }, orderBy: { version: 'desc' } }),
    prisma.droneHistory.findFirst({ where: { droneId: drone.id }, orderBy: { version: 'desc' } }),
    prisma.lMVHistory.findFirst({ where: { lmvId: lmv.id }, orderBy: { version: 'desc' } }),
  ]);
  assert.equal(assignments.length, 1);
  ids.assignments.push(assignments[0].id);
  assert.equal(storedLead.status, 'SCHEDULED');
  assert.equal(storedDrone.status, 'ASSIGNED');
  assert.equal(storedLmv.status, 'ASSIGNED');
  assert.equal(leadHistory.actorUserId, fleet.id);
  assert.equal(droneHistory.actorUserId, fleet.id);
  assert.equal(lmvHistory.actorUserId, fleet.id);
  assert.equal(await prisma.notificationEscalation.count({ where: { assignmentId: assignments[0].id } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entityId: assignments[0].id, action: 'MANUAL_ASSIGNMENT_CREATED' } }), 1);
});

test('concurrent overlapping windows cannot double-book either Pilot role, drone, or LMV', async () => {
  const firstLead = await createLead('window-race-primary');
  const secondLead = await createLead('window-race-swapped');
  const [raceDrone, raceLmv] = await Promise.all([
    prisma.drone.create({ data: { model: 'Window Race', serialNumber: `PHASE25-RACE-DRONE-${runId}`, uin: `PHASE25-RACE-UIN-${runId}`, homeCenterId: center.id } }),
    prisma.lMV.create({ data: { registrationNo: `PHASE25-RACE-LMV-${runId}`, homeCenterId: center.id } }),
  ]);
  ids.drones.push(raceDrone.id);
  ids.lmvs.push(raceLmv.id);
  const serviceWindowStart = new Date('2026-09-04T09:00:00.000Z');
  const serviceWindowEnd = new Date('2026-09-04T11:00:00.000Z');
  const request = (leadId, pilotId, copilotId) => assignmentOperations.manualAssign({
    leadId,
    pilotId,
    copilotId,
    droneId: raceDrone.id,
    lmvId: raceLmv.id,
    serviceWindowStart,
    serviceWindowEnd,
    actorId: fleet.id,
  });
  const outcomes = await Promise.allSettled([
    request(firstLead.id, pilot.id, copilot.id),
    request(secondLead.id, copilot.id, pilot.id),
  ]);
  assert.equal(outcomes.filter(({ status }) => status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(({ status }) => status === 'rejected').length, 1);
  const committed = await prisma.assignment.findMany({
    where: { leadId: { in: [firstLead.id, secondLead.id] } },
  });
  assert.equal(committed.length, 1);
  assert.equal(committed[0].serviceWindowStart.toISOString(), serviceWindowStart.toISOString());
  assert.equal(committed[0].serviceWindowEnd.toISOString(), serviceWindowEnd.toISOString());
  ids.assignments.push(committed[0].id);
});

test('one crew unit can run ordered same-day jobs, but cannot start them out of order', async () => {
  const first = await prisma.assignment.findFirst({
    where: { id: { in: ids.assignments } },
    include: { lead: true },
  });
  const secondLead = await createLead('second-job');
  const second = await assignmentOperations.manualAssign({
    leadId: secondLead.id,
    pilotId: pilot.id,
    copilotId: copilot.id,
    droneId: drone.id,
    lmvId: lmv.id,
    scheduledDate: new Date('2026-09-02T11:00:00.000Z'),
    actorId: fleet.id,
  });
  ids.assignments.push(second.assignment.id);
  assert.equal(first.dailySequence, 1);
  assert.equal(second.assignment.dailySequence, 2);

  await missionStateService.accept(second.assignment.id, copilot.id);
  await assert.rejects(missionStateService.start(second.assignment.id, copilot.id), /Complete job 1/);
  const unchangedSecond = await prisma.assignment.findUnique({ where: { id: second.assignment.id }, include: { lead: true } });
  assert.equal(unchangedSecond.startedAt, null);
  assert.equal(unchangedSecond.lead.status, 'PILOT_ACCEPTED');

  await missionStateService.accept(first.id, pilot.id);
  await missionStateService.start(first.id, pilot.id);
  await missionStateService.complete(first.id, pilot.id, 2.5);
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'ASSIGNED');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'ASSIGNED');

  await missionStateService.start(second.assignment.id, copilot.id);
  await missionStateService.complete(second.assignment.id, copilot.id, 2);
  assert.equal((await prisma.drone.findUnique({ where: { id: drone.id } })).status, 'AVAILABLE');
  assert.equal((await prisma.lMV.findUnique({ where: { id: lmv.id } })).status, 'AVAILABLE');
  const [completedLeadHistory, completedDroneHistory, completedLmvHistory, completionAudit, unrelatedDroneAfter, unrelatedLmvAfter] = await Promise.all([
    prisma.leadHistory.findFirst({ where: { leadId: secondLead.id }, orderBy: { version: 'desc' } }),
    prisma.droneHistory.findFirst({ where: { droneId: drone.id }, orderBy: { version: 'desc' } }),
    prisma.lMVHistory.findFirst({ where: { lmvId: lmv.id }, orderBy: { version: 'desc' } }),
    prisma.auditLog.findFirst({ where: { entityId: second.assignment.id, action: 'MISSION_COMPLETED' } }),
    prisma.drone.findUnique({ where: { id: unrelatedDrone.id } }),
    prisma.lMV.findUnique({ where: { id: unrelatedLmv.id } }),
  ]);
  assert.equal(completedLeadHistory.actorUserId, copilot.id);
  assert.equal(completedDroneHistory.actorUserId, copilot.id);
  assert.equal(completedLmvHistory.actorUserId, copilot.id);
  assert.equal(completionAudit.actorId, copilot.id);
  assert.equal(unrelatedDroneAfter.status, 'MAINTENANCE');
  assert.equal(unrelatedLmvAfter.status, 'OUT_OF_SERVICE');
});

test('decommission atomically flags the lead, retires the drone from service, releases the LMV, and records the event', async () => {
  const lead = await createLead('decommission');
  const scheduled = await assignmentOperations.manualAssign({
    leadId: lead.id,
    pilotId: pilot.id,
    copilotId: copilot.id,
    droneId: drone.id,
    lmvId: lmv.id,
    scheduledDate: new Date('2026-09-03T09:00:00.000Z'),
    actorId: fleet.id,
  });
  ids.assignments.push(scheduled.assignment.id);
  await missionStateService.accept(scheduled.assignment.id, pilot.id);
  const result = await missionStateService.decommission(scheduled.assignment.id, copilot.id, 'Propulsion inspection required');
  const [storedDrone, storedLmv, event, fleetNotice, droneHistory, lmvHistory] = await Promise.all([
    prisma.drone.findUnique({ where: { id: drone.id } }),
    prisma.lMV.findUnique({ where: { id: lmv.id } }),
    prisma.auditLog.findFirst({ where: { entityId: scheduled.assignment.id, action: 'DRONE_DECOMMISSIONED' } }),
    prisma.notification.findFirst({ where: { leadId: lead.id, recipientId: fleet.id, type: 'DRONE_DECOMMISSIONED' } }),
    prisma.droneHistory.findFirst({ where: { droneId: drone.id }, orderBy: { version: 'desc' } }),
    prisma.lMVHistory.findFirst({ where: { lmvId: lmv.id }, orderBy: { version: 'desc' } }),
  ]);
  assert.equal(result.lead.status, 'FLAGGED');
  assert.equal(storedDrone.status, 'MAINTENANCE');
  assert.equal(storedLmv.status, 'AVAILABLE');
  assert.ok(event);
  assert.equal(event.actorId, copilot.id);
  assert.ok(fleetNotice);
  assert.equal(droneHistory.actorUserId, copilot.id);
  assert.equal(lmvHistory.actorUserId, copilot.id);
  assert.ok((await prisma.notificationEscalation.findUnique({ where: { assignmentId: scheduled.assignment.id } })).closedAt);
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
