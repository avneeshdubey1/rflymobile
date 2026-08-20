const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const prisma = require('../src/lib/prisma');
const { issueToken } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const crewFormation = require('../src/repositories/crewFormationRepository');

let server;
let baseUrl;
let sales;
let pilot;
let copilot;
let center;
let assignment;
let scheduledLead;
const deliveries = [];
const ids = { users: [], drones: [], assignedDrones: [], lmvs: [], assignedLmvs: [], leads: [], assignments: [] };
const runId = `${process.pid}-${Date.now()}`;

const auth = (user) => ({ Authorization: `Bearer ${issueToken(user)}`, 'Content-Type': 'application/json' });

function templatesFor(leadId) {
  return deliveries.filter((delivery) => delivery.leadId === leadId).map((delivery) => delivery.templateKey);
}

test.before(async () => {
  whatsappService.setClient({ send: async (delivery) => {
    deliveries.push(delivery);
    return { id: `phase7-${deliveries.length}` };
  } });
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  center = await prisma.operatingCenter.create({ data: { name: `Phase 7 Centre ${runId}`, latitude: 11, longitude: 76, radiusKm: 50 } });
  [sales, pilot, copilot] = await Promise.all([
    prisma.user.create({ data: { name: 'Phase 7 Sales', email: `phase7-sales-${runId}@example.test`, passwordHash: 'test', role: 'SALES' } }),
    prisma.user.create({ data: { name: 'Phase 7 Pilot', email: `phase7-pilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
    prisma.user.create({ data: { name: 'Phase 7 Copilot', email: `phase7-copilot-${runId}@example.test`, passwordHash: 'test', role: 'PILOT', homeCenterId: center.id } }),
  ]);
  ids.users.push(sales.id, pilot.id, copilot.id);
  // const drone = await prisma.drone.create({ data: { model: 'Test', serialNumber: `PHASE7-DRONE-${runId}`, status: 'AVAILABLE', homeCenterId: center.id, airworthinessExpiry: new Date('2027-01-01') } });
  const drone = await prisma.drone.create({
  data: {
    model: 'Test',
    serialNumber: `PHASE7-DRONE-${runId}`,
    uin: `UIN-PHASE7-3110-${Date.now()}`,
    status: 'AVAILABLE',
    homeCenterId: center.id,
    airworthinessExpiry: new Date('2027-01-01'),
  },
});
  ids.drones.push(drone.id);
  const lmv = await prisma.lMV.create({ data: { registrationNo: `PHASE7-LMV-${runId}`, label: 'Phase 7 LMV', status: 'AVAILABLE', homeCenterId: center.id, capacity: 1 } });
  ids.lmvs.push(lmv.id);
});

test('lead processing, scheduling, mission start, and completion each send the correct English template', async () => {
  scheduledLead = await prisma.lead.create({ data: { farmerName: 'Phase 7 English Farmer', farmerPhone: '955550007', acreage: 3, intakeChannel: 'WEBSITE', status: 'NEW', preferredLanguage: 'en', latitude: 11, longitude: 76, matchedCenterId: center.id } });
  ids.leads.push(scheduledLead.id);
  const processedResponse = await fetch(`${baseUrl}/api/leads/process`, { method: 'POST', headers: auth(sales), body: JSON.stringify({ id: scheduledLead.id, employeeId: sales.id }) });
  const processed = await processedResponse.json();
  assert.equal(processedResponse.status, 200);
  assignment = processed.assignment.assignment;
  ids.assignments.push(assignment.id);
  ids.assignedDrones.push(assignment.droneId);
  ids.assignedLmvs.push(assignment.lmvId);
  assert.deepEqual(templatesFor(scheduledLead.id), ['lead_processed', 'mission_scheduled']);
  assert.match(deliveries.find((delivery) => delivery.templateKey === 'mission_scheduled').text, /pilot has been scheduled/i);

  await crewFormation.selectCopilot({
    assignmentId: assignment.id,
    candidateId: assignment.pilotId === pilot.id ? copilot.id : pilot.id,
    actorId: assignment.pilotId,
    expectedRevision: assignment.revision,
    now: new Date(new Date(assignment.serviceWindowStart || assignment.scheduledDate).getTime() - 1),
  });
  assert.equal((await fetch(`${baseUrl}/api/assignments/${assignment.id}/accept`, { method: 'POST', headers: auth(pilot) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/assignments/${assignment.id}/start`, { method: 'POST', headers: auth(pilot) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/assignments/${assignment.id}/complete`, { method: 'POST', headers: auth(pilot), body: JSON.stringify({ actualAcreage: 3.5 }) })).status, 200);
  assert.deepEqual(templatesFor(scheduledLead.id), ['lead_processed', 'mission_scheduled', 'mission_started', 'mission_completed']);
  assert.match(deliveries.find((delivery) => delivery.templateKey === 'mission_completed').text, /3.5 acres covered/i);
});

test('no configured client safely records a localized mock delivery', async () => {
  whatsappService.setClient(null);
  const mocked = await whatsappService.sendLeadMessage(scheduledLead, 'lead_processed');
  assert.equal(mocked.status, 'MOCKED');
  assert.equal(mocked.language, 'en');
});

test.after(async () => {
  whatsappService.setClient(null);
  await prisma.notificationEscalation.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.notification.deleteMany({ where: { leadId: { in: ids.leads } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: [...ids.leads, ...ids.assignments] } } });
  await prisma.paymentRecord.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.scheduleChangeLog.deleteMany({ where: { assignmentId: { in: ids.assignments } } });
  await prisma.drone.updateMany({ where: { id: { in: ids.assignedDrones.filter((id) => !ids.drones.includes(id)) } }, data: { status: 'AVAILABLE' } });
  await prisma.lMV.updateMany({ where: { id: { in: ids.assignedLmvs.filter((id) => id && !ids.lmvs.includes(id)) } }, data: { status: 'AVAILABLE' } });
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`SELECT set_config('rfly.allow_history_mutation', 'on', true)`;
    await transaction.assignment.deleteMany({ where: { id: { in: ids.assignments } } });
    await transaction.lead.deleteMany({ where: { id: { in: ids.leads } } });
    await transaction.drone.deleteMany({ where: { id: { in: ids.drones } } });
    await transaction.lMV.deleteMany({ where: { id: { in: ids.lmvs } } });
    await transaction.user.deleteMany({ where: { id: { in: ids.users } } });
    await transaction.operatingCenter.delete({ where: { id: center.id } });
  });
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections?.();
    server.closeAllConnections?.();
  });
  await prisma.$disconnect();
});
