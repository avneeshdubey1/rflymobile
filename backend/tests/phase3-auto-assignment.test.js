const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const weatherService = require('../services/weatherService');
const { autoAssignProcessedLead } = require('../services/autoAssignmentService');
const { processDueEscalations } = require('../jobs/notificationEscalationJob');

const ids = { centers: [], users: [], drones: [], lmvs: [], leads: [] };
let firstAssignmentId;

async function createCenter(name) {
  const center = await prisma.operatingCenter.create({ data: { name, latitude: 12, longitude: 77, radiusKm: 50 } });
  ids.centers.push(center.id);
  return center;
}

async function createLead(center, suffix) {
  const lead = await prisma.lead.create({ data: { farmerName: `Phase 3 ${suffix}`, farmerPhone: `94444${suffix}`, acreage: 3, intakeChannel: 'MANUAL_SALES', status: 'PROCESSED', latitude: 12, longitude: 77, matchedCenterId: center.id, distanceFromCenterKm: 0 } });
  ids.leads.push(lead.id);
  return lead;
}

test.before(async () => {
  process.env.NOTIFICATION_CASCADE_TIMERS_MS = '0,1,2,3';
  weatherService.setForecastProvider(async () => ({ windSpeedKph: 5, precipitationProbability: 5 }));
});

test('auto-assignment schedules an eligible pilot and escalates through reassignment', async () => {
  const center = await createCenter('Phase 3 Cascade Center');
  const managers = await prisma.user.findMany({ where: { role: 'FLEET_MANAGER' }, take: 1 });
  assert.equal(managers.length, 1);
  const pilots = await Promise.all(['A', 'B', 'C', 'D'].map(async (suffix) => {
    const pilot = await prisma.user.create({ data: { name: `Phase 3 Pilot ${suffix}`, email: `phase3-pilot-${suffix}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2027-01-01') } });
    ids.users.push(pilot.id);
    return pilot;
  }));
  await Promise.all(['A', 'B'].map(async (suffix) => {
    // const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE3-${suffix}`, status: 'AVAILABLE', homeCenterId: center.id, airworthinessExpiry: new Date('2027-01-01') } });
    const drone = await prisma.drone.create({
  data: {
    model: 'Test',
    serialNumber: `PHASE3-${suffix}`,
    uin: `UIN-PHASE3-${suffix}-${Date.now()}`,
    status: 'AVAILABLE',
    homeCenterId: center.id,
    airworthinessExpiry: new Date('2027-01-01'),
  },
});
    ids.drones.push(drone.id);
  }));
  await Promise.all(['A', 'B'].map(async (suffix) => {
    const lmv = await prisma.lMV.create({ data: { registrationNo: `PHASE3-LMV-${suffix}-${Date.now()}`, label: `Phase 3 LMV ${suffix}`, status: 'AVAILABLE', homeCenterId: center.id } });
    ids.lmvs.push(lmv.id);
  }));
  const lead = await createLead(center, '0001');
  const scheduled = await autoAssignProcessedLead(lead.id);
  assert.equal(scheduled.outcome, 'SCHEDULED');
  assert.equal(scheduled.lead.status, 'SCHEDULED');
  assert.equal(scheduled.assignment.weatherSuitable, true);
  assert.ok(scheduled.assignment.lmvId);
  firstAssignmentId = scheduled.assignment.id;
  const firstPilotId = scheduled.assignment.pilotId;

  const firstEscalation = await prisma.notificationEscalation.findUnique({ where: { assignmentId: firstAssignmentId } });
  await processDueEscalations(new Date(firstEscalation.nextActionAt.getTime() + 10));
  const smsEscalation = await prisma.notificationEscalation.findUnique({ where: { assignmentId: firstAssignmentId } });
  assert.equal(smsEscalation.stage, 'SMS_SENT');
  await processDueEscalations(new Date(smsEscalation.nextActionAt.getTime() + 10));
  const callEscalation = await prisma.notificationEscalation.findUnique({ where: { assignmentId: firstAssignmentId } });
  assert.equal(callEscalation.stage, 'CALL_TASK_CREATED');
  const callTasks = await prisma.notification.count({ where: { type: 'DISPATCH_CALL_TASK', leadId: lead.id } });
  assert.ok(callTasks > 0);
  await processDueEscalations(new Date(callEscalation.nextActionAt.getTime() + 10));

  const reassignedLead = await prisma.lead.findUnique({ where: { id: lead.id }, include: { assignment: true } });
  assert.equal(reassignedLead.status, 'SCHEDULED');
  assert.notEqual(reassignedLead.assignment.pilotId, firstPilotId);
  assert.ok(reassignedLead.assignment.lmvId);
  assert.ok(pilots.some((pilot) => pilot.id === reassignedLead.assignment.pilotId));
});

test('missing weather data fails open and a lack of candidates lands in the manual queue', async () => {
  const center = await createCenter('Phase 3 Fail-Open Center');
  const failOpenPilots = await Promise.all(['Primary', 'Copilot'].map((name) => prisma.user.create({ data: { name: `Phase 3 Fail-open ${name}`, email: `phase3-fail-open-${name.toLowerCase()}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id, pilotLicenseExpiry: new Date('2027-01-01') } })));
  ids.users.push(...failOpenPilots.map((pilot) => pilot.id));
  // const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: 'PHASE3-FAILOPEN', status: 'AVAILABLE', homeCenterId: center.id, airworthinessExpiry: new Date('2027-01-01') } });
  const drone = await prisma.drone.create({
  data: {
    model: 'Test',
    serialNumber: 'PHASE3-FAILOPEN',
    uin: `UIN-PHASE3-FAILOPEN-${Date.now()}`,
    status: 'AVAILABLE',
    homeCenterId: center.id,
    airworthinessExpiry: new Date('2027-01-01'),
  },
});
  ids.drones.push(drone.id);
  const lmv = await prisma.lMV.create({ data: { registrationNo: `PHASE3-FAILOPEN-LMV-${Date.now()}`, label: 'Phase 3 Fail-open LMV', status: 'AVAILABLE', homeCenterId: center.id } });
  ids.lmvs.push(lmv.id);
  weatherService.setForecastProvider(null);
  const failOpenLead = await createLead(center, '0002');
  const failOpen = await autoAssignProcessedLead(failOpenLead.id);
  assert.equal(failOpen.outcome, 'SCHEDULED');
  assert.equal(failOpen.assignment.weatherSuitable, null);

  const emptyCenter = await createCenter('Phase 3 No Candidate Center');
  const noCandidateLead = await createLead(emptyCenter, '0003');
  const manual = await autoAssignProcessedLead(noCandidateLead.id);
  assert.equal(manual.outcome, 'MANUAL_SCHEDULING');
  assert.equal(manual.lead.status, 'NEEDS_MANUAL_SCHEDULING');
  assert.match(manual.lead.notes, /No eligible two-person Pilot\/Copilot crew is available/);
  weatherService.setForecastProvider(async () => ({ windSpeedKph: 5, precipitationProbability: 5 }));
});

test.after(async () => {
  const assignments = await prisma.assignment.findMany({ where: { leadId: { in: ids.leads } }, select: { id: true } });
  const assignmentIds = assignments.map((assignment) => assignment.id);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...assignmentIds] } } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: assignmentIds } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.deleteMany({ where: { id: { in: ids.centers } } });
  });
  weatherService.setForecastProvider(null);
  delete process.env.NOTIFICATION_CASCADE_TIMERS_MS;
  await prisma.$disconnect();
});
